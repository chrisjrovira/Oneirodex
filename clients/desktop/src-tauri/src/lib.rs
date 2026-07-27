use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{copy, Write};
use std::path::{Path, PathBuf};
use tauri::Manager;
use zip::ZipArchive;

/// Service name for OS credential store entries (Windows Credential Manager, etc.).
const SECURE_STORE_SERVICE: &str = "com.gametheca.desktop";

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
    // Never persist API tokens in plaintext JSON — secrets live in the OS store.
    let sanitized = AppConfig {
        base_url: config.base_url,
        token: None,
    };
    let data = serde_json::to_string_pretty(&sanitized).map_err(|error| error.to_string())?;
    fs::write(path, data).map_err(|error| error.to_string())
}

fn secure_entry(account: &str) -> Result<Entry, String> {
    Entry::new(SECURE_STORE_SERVICE, account).map_err(|error| error.to_string())
}

#[tauri::command]
fn secure_store_get(account: String) -> Result<Option<String>, String> {
    let entry = secure_entry(&account)?;
    match entry.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn secure_store_set(account: String, secret: String) -> Result<(), String> {
    let entry = secure_entry(&account)?;
    entry.set_password(&secret).map_err(|error| error.to_string())
}

#[tauri::command]
fn secure_store_delete(account: String) -> Result<(), String> {
    let entry = secure_entry(&account)?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
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
    let cheats = resolve_subdir(&app, "cheats")?;
    let patches = resolve_subdir(&app, "patches")?;
    let mods = resolve_subdir(&app, "mods")?;
    let file_path = PathBuf::from(&path);
    ensure_path_under_any_root(&file_path, &[&downloads, &cheats, &patches, &mods])?;
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
        let candidate = PathBuf::from(&exe);
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
    let cheats = resolve_subdir(&app, "cheats")?;
    let patches = resolve_subdir(&app, "patches")?;
    let mods = resolve_subdir(&app, "mods")?;
    let target = PathBuf::from(&path);
    ensure_path_under_any_root(&target, &[&downloads, &installs, &cheats, &patches, &mods])?;
    if !target.exists() {
        return Ok(());
    }
    remove_path_inner(&target)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FlipsApplyResult {
    pub output_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApplyStagedModResult {
    pub applied: u32,
}

fn sanitize_mod_filename(name: &str) -> String {
    let trimmed = name.trim().replace('\\', "/");
    let base = trimmed.rsplit('/').next().unwrap_or("mod.bin");
    let cleaned: String = base
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let trimmed_clean = cleaned.trim_start_matches('.');
    if trimmed_clean.is_empty() {
        "mod.bin".to_string()
    } else {
        trimmed_clean.to_string()
    }
}

fn is_mod_zip_path(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("zip"))
}

/// Copy a staged mod file or extract a zip into the game install directory (path-safe).
#[tauri::command]
fn apply_staged_mod(
    app: tauri::AppHandle,
    source_path: String,
    install_root: String,
) -> Result<ApplyStagedModResult, String> {
    let mods = resolve_subdir(&app, "mods")?;
    let installs = resolve_subdir(&app, "installs")?;
    let source = PathBuf::from(&source_path);
    let destination_root = PathBuf::from(&install_root);
    ensure_path_under_root(&source, &mods)?;
    ensure_path_under_root(&destination_root, &installs)?;
    if !source.is_file() {
        return Err(format!("Staged mod not found: {source_path}"));
    }

    let mut applied: u32 = 0;
    if is_mod_zip_path(&source) {
        let file = File::open(&source).map_err(|error| error.to_string())?;
        let mut zip = ZipArchive::new(file).map_err(|error| error.to_string())?;
        for index in 0..zip.len() {
            let mut entry = zip.by_index(index).map_err(|error| error.to_string())?;
            let entry_path = match entry.enclosed_name() {
                Some(path) => destination_root.join(path),
                None => continue,
            };
            if !entry_path.starts_with(&destination_root) {
                continue;
            }
            if entry.name().ends_with('/') {
                fs::create_dir_all(&entry_path).map_err(|error| error.to_string())?;
                continue;
            }
            if let Some(parent) = entry_path.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            let mut out = File::create(&entry_path).map_err(|error| error.to_string())?;
            copy(&mut entry, &mut out).map_err(|error| error.to_string())?;
            applied += 1;
        }
    } else {
        let file_name = source
            .file_name()
            .and_then(|n| n.to_str())
            .map(sanitize_mod_filename)
            .unwrap_or_else(|| "mod.bin".to_string());
        let target = destination_root.join(file_name);
        ensure_path_under_root(&target, &installs)?;
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::copy(&source, &target).map_err(|error| error.to_string())?;
        applied = 1;
    }

    Ok(ApplyStagedModResult { applied })
}

#[tauri::command]
fn get_flips_path() -> Result<String, String> {
    Ok(std::env::var("FLIPS_PATH").unwrap_or_default())
}

/// Apply an IPS/BPS patch with Flips. Paths must live under app_data/patches.
#[tauri::command]
fn run_flips_apply(
    app: tauri::AppHandle,
    flips_path: Option<String>,
    patch_path: String,
    rom_path: String,
    output_path: Option<String>,
    game_uuid: String,
) -> Result<FlipsApplyResult, String> {
    let patches = resolve_subdir(&app, "patches")?;
    let downloads = resolve_subdir(&app, "downloads")?;
    let installs = resolve_subdir(&app, "installs")?;
    let patch = PathBuf::from(&patch_path);
    let rom = PathBuf::from(&rom_path);
    ensure_path_under_root(&patch, &patches)?;
    ensure_path_under_any_root(&rom, &[&patches, &downloads, &installs])?;
    if !patch.is_file() {
        return Err(format!("Patch not found: {patch_path}"));
    }
    if !rom.is_file() {
        return Err(format!("ROM not found: {rom_path}"));
    }

    let flips = flips_path
        .filter(|value| !value.trim().is_empty())
        .or_else(|| std::env::var("FLIPS_PATH").ok().filter(|v| !v.trim().is_empty()))
        .ok_or_else(|| {
            "FLIPS_PATH not configured. Install Flips and set FLIPS_PATH, or apply manually."
                .to_string()
        })?;

    let out = if let Some(explicit) = output_path.filter(|v| !v.trim().is_empty()) {
        PathBuf::from(explicit)
    } else {
        let safe_uuid = game_uuid
            .chars()
            .map(|c| {
                if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                    c
                } else {
                    '_'
                }
            })
            .collect::<String>();
        let rom_name = rom
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("rom.bin");
        let stem = Path::new(rom_name)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("rom");
        let ext = Path::new(rom_name)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("bin");
        patches.join(safe_uuid).join(format!("{stem}.patched.{ext}"))
    };
    ensure_path_under_root(&out, &patches)?;
    if let Some(parent) = out.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let patch_s = patch.to_string_lossy().into_owned();
    let rom_s = rom.to_string_lossy().into_owned();
    let out_s = out.to_string_lossy().into_owned();
    let status = std::process::Command::new(&flips)
        .args(["--apply", &patch_s, &rom_s, &out_s])
        .status()
        .map_err(|error| format!("Failed to start Flips: {error}"))?;
    if !status.success() {
        return Err(format!("Flips exited with status {status}"));
    }
    Ok(FlipsApplyResult {
        output_path: out_s,
    })
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
            secure_store_get,
            secure_store_set,
            secure_store_delete,
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
            get_flips_path,
            run_flips_apply,
            apply_staged_mod,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
