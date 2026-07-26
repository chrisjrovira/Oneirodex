use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{copy, Write};
use std::path::{Path, PathBuf};
use tauri::Manager;
use zip::ZipArchive;

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct AppConfig {
    pub base_url: String,
    pub token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LifecycleRecord {
    pub game_uuid: String,
    pub state: String,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct LifecycleRegistryFile {
    pub records: Vec<LifecycleRecord>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstallRecord {
    pub archive_path: String,
    pub extract_path: String,
    pub exe_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct InstallsFile {
    pub installs: std::collections::HashMap<String, InstallRecord>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExtractZipResult {
    pub extract_path: String,
    pub exe_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LaunchGameResult {
    pub pid: u32,
    pub exe_path: String,
    pub resolved_exe_path: Option<String>,
}

fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("config.json"))
}

fn lifecycle_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("lifecycle.json"))
}

fn installs_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("installs.json"))
}

fn resolve_subdir(app: &tauri::AppHandle, subdir: &str) -> Result<PathBuf, String> {
    let dir = app_data_dir(app)?.join(subdir);
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn installs_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    resolve_subdir(app, "installs")
}

fn canonicalize_path(path: &Path) -> Result<PathBuf, String> {
    if path.exists() {
        return path.canonicalize().map_err(|error| error.to_string());
    }

    if let Some(parent) = path.parent() {
        if parent.as_os_str().is_empty() {
            return Ok(path.to_path_buf());
        }
        let canonical_parent = parent.canonicalize().map_err(|error| error.to_string())?;
        if let Some(file_name) = path.file_name() {
            return Ok(canonical_parent.join(file_name));
        }
    }

    Ok(path.to_path_buf())
}

fn ensure_path_under_root(path: &Path, root: &Path) -> Result<(), String> {
    let canonical_root = root.canonicalize().map_err(|error| error.to_string())?;
    let canonical_path = canonicalize_path(path)?;
    if !canonical_path.starts_with(&canonical_root) {
        return Err("Path is outside allowed app directory".into());
    }
    Ok(())
}

fn ensure_path_under_any_root(path: &Path, roots: &[&Path]) -> Result<(), String> {
    for root in roots {
        if ensure_path_under_root(path, root).is_ok() {
            return Ok(());
        }
    }
    Err("Path is outside allowed app directories".into())
}

fn find_likely_exe(dir: &Path, max_depth: u32) -> Option<String> {
    find_likely_exe_inner(dir, 0, max_depth)
}

fn find_likely_exe_inner(dir: &Path, depth: u32, max_depth: u32) -> Option<String> {
    if depth > max_depth {
        return None;
    }

    let entries = fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if path
                .extension()
                .is_some_and(|ext| ext.eq_ignore_ascii_case("exe"))
            {
                return Some(path.to_string_lossy().into_owned());
            }
        }
    }

    if depth >= max_depth {
        return None;
    }

    let entries = fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(found) = find_likely_exe_inner(&path, depth + 1, max_depth) {
                return Some(found);
            }
        }
    }

    None
}

fn check_process_running(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }

    #[cfg(unix)]
    {
        use std::process::Command;
        return Command::new("kill")
            .args(["-0", &pid.to_string()])
            .status()
            .map(|status| status.success())
            .unwrap_or(false);
    }

    #[cfg(windows)]
    {
        use std::process::Command;
        return Command::new("tasklist")
            .args(["/FI", &format!("PID eq {pid}"), "/NH"])
            .output()
            .map(|output| {
                String::from_utf8_lossy(&output.stdout)
                    .contains(&pid.to_string())
            })
            .unwrap_or(false);
    }

    #[cfg(not(any(unix, windows)))]
    {
        let _ = pid;
        false
    }
}

#[tauri::command]
fn load_config(app: tauri::AppHandle) -> Result<AppConfig, String> {
    let path = config_path(&app)?;
    if !path.exists() {
        return Ok(AppConfig::default());
    }

    let data = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&data).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_config(app: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    let path = config_path(&app)?;
    let data = serde_json::to_string_pretty(&config).map_err(|error| error.to_string())?;
    fs::write(path, data).map_err(|error| error.to_string())
}

#[tauri::command]
fn load_lifecycle_registry(app: tauri::AppHandle) -> Result<LifecycleRegistryFile, String> {
    let path = lifecycle_path(&app)?;
    if !path.exists() {
        return Ok(LifecycleRegistryFile::default());
    }

    let data = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&data).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_lifecycle_registry(
    app: tauri::AppHandle,
    registry: LifecycleRegistryFile,
) -> Result<(), String> {
    let path = lifecycle_path(&app)?;
    let data = serde_json::to_string_pretty(&registry).map_err(|error| error.to_string())?;
    fs::write(path, data).map_err(|error| error.to_string())
}

#[tauri::command]
fn load_installs(app: tauri::AppHandle) -> Result<InstallsFile, String> {
    let path = installs_path(&app)?;
    if !path.exists() {
        return Ok(InstallsFile::default());
    }

    let data = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&data).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_installs(app: tauri::AppHandle, installs_file: InstallsFile) -> Result<(), String> {
    let path = installs_path(&app)?;
    let data = serde_json::to_string_pretty(&installs_file).map_err(|error| error.to_string())?;
    fs::write(path, data).map_err(|error| error.to_string())
}

#[tauri::command]
fn get_app_subdir(app: tauri::AppHandle, subdir: String) -> Result<String, String> {
    resolve_subdir(&app, &subdir).map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
fn write_file_bytes(app: tauri::AppHandle, path: String, bytes: Vec<u8>) -> Result<(), String> {
    let downloads = resolve_subdir(&app, "downloads")?;
    let file_path = PathBuf::from(&path);
    ensure_path_under_root(&file_path, &downloads)?;
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let mut file = File::create(&file_path).map_err(|error| error.to_string())?;
    file.write_all(&bytes).map_err(|error| error.to_string())
}

#[tauri::command]
fn append_file_bytes(app: tauri::AppHandle, path: String, bytes: Vec<u8>) -> Result<(), String> {
    use std::fs::OpenOptions;

    let downloads = resolve_subdir(&app, "downloads")?;
    let file_path = PathBuf::from(&path);
    ensure_path_under_root(&file_path, &downloads)?;
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .map_err(|error| error.to_string())?;
    file.write_all(&bytes).map_err(|error| error.to_string())
}

#[tauri::command]
fn extract_zip_archive(
    app: tauri::AppHandle,
    archive_path: String,
    dest_dir: String,
) -> Result<ExtractZipResult, String> {
    let downloads = resolve_subdir(&app, "downloads")?;
    let installs = resolve_subdir(&app, "installs")?;
    let archive = PathBuf::from(&archive_path);
    let destination = PathBuf::from(&dest_dir);
    ensure_path_under_root(&archive, &downloads)?;
    ensure_path_under_root(&destination, &installs)?;

    if !archive.is_file() {
        return Err(format!("Archive not found: {archive_path}"));
    }

    if destination.exists() {
        remove_path_inner(&destination)?;
    }
    fs::create_dir_all(&destination).map_err(|error| error.to_string())?;

    let file = File::open(&archive).map_err(|error| error.to_string())?;
    let mut zip = ZipArchive::new(file).map_err(|error| error.to_string())?;

    for index in 0..zip.len() {
        let mut entry = zip.by_index(index).map_err(|error| error.to_string())?;
        let entry_path = match entry.enclosed_name() {
            Some(path) => destination.join(path),
            None => continue,
        };

        if entry.name().ends_with('/') {
            fs::create_dir_all(&entry_path).map_err(|error| error.to_string())?;
            continue;
        }

        if let Some(parent) = entry_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }

        let mut out = File::create(&entry_path).map_err(|error| error.to_string())?;
        copy(&mut entry, &mut out).map_err(|error| error.to_string())?;
    }

    let exe_path = find_likely_exe(&destination, 2);
    Ok(ExtractZipResult {
        extract_path: destination.to_string_lossy().into_owned(),
        exe_path,
    })
}

#[tauri::command]
fn launch_game(
    app: tauri::AppHandle,
    game_uuid: String,
    exe_path: Option<String>,
    extract_path: String,
) -> Result<LaunchGameResult, String> {
    let _ = game_uuid;
    let installs = installs_root(&app)?;
    let extract = PathBuf::from(&extract_path);
    ensure_path_under_root(&extract, &installs)?;

    let had_exe_path = exe_path.is_some();
    let resolved = if let Some(exe) = exe_path {
        let candidate = PathBuf::from(exe);
        ensure_path_under_root(&candidate, &installs)?;
        if !candidate.is_file() {
            return Err(format!("Executable not found: {exe}"));
        }
        candidate
    } else {
        find_likely_exe(&extract, 2)
            .map(PathBuf::from)
            .ok_or_else(|| "No executable found in install directory".to_string())?
    };

    ensure_path_under_root(&resolved, &installs)?;

    let working_dir = resolved
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| extract.clone());

    let child = std::process::Command::new(&resolved)
        .current_dir(working_dir)
        .spawn()
        .map_err(|error| error.to_string())?;

    Ok(LaunchGameResult {
        pid: child.id(),
        exe_path: resolved.to_string_lossy().into_owned(),
        resolved_exe_path: if had_exe_path {
            None
        } else {
            Some(resolved.to_string_lossy().into_owned())
        },
    })
}

#[tauri::command]
fn is_process_running(pid: u32) -> Result<bool, String> {
    Ok(check_process_running(pid))
}

fn remove_path_inner(path: &Path) -> Result<(), String> {
    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|error| error.to_string())
    } else if path.is_file() {
        fs::remove_file(path).map_err(|error| error.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
fn remove_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let downloads = resolve_subdir(&app, "downloads")?;
    let installs = resolve_subdir(&app, "installs")?;
    let target = PathBuf::from(&path);
    ensure_path_under_any_root(&target, &[&downloads, &installs])?;
    if !target.exists() {
        return Ok(());
    }
    remove_path_inner(&target)
}

#[tauri::command]
fn rename_path(app: tauri::AppHandle, from: String, to: String) -> Result<(), String> {
    let installs = resolve_subdir(&app, "installs")?;
    let source = PathBuf::from(&from);
    let destination = PathBuf::from(&to);
    ensure_path_under_root(&source, &installs)?;
    ensure_path_under_root(&destination, &installs)?;
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::rename(&source, &destination).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_config,
            save_config,
            load_lifecycle_registry,
            save_lifecycle_registry,
            load_installs,
            save_installs,
            get_app_subdir,
            write_file_bytes,
            append_file_bytes,
            extract_zip_archive,
            launch_game,
            is_process_running,
            remove_path,
            rename_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
