use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{copy, Write};
use std::path::{Path, PathBuf};
use tauri::Manager;
use zip::ZipArchive;

/// Fallback service name for OS credential store entries when the bundle
/// identifier is unavailable (tests, unbundled dev runs).
const SECURE_STORE_SERVICE_FALLBACK: &str = "com.oneirodex.desktop";

/// Service name for OS credential store entries (Windows Credential Manager,
/// macOS Keychain, Secret Service).
///
/// This is the app's own bundle identifier, not a constant: the full companion
/// (`com.oneirodex.desktop`) and the thin client (`com.oneirodex.thin`) ship as
/// separate apps with separate app-data directories, and they must not share a
/// credential. They did — both wrote the account `api_token` under the
/// companion's service — so installing thin on a companion PC overwrote the
/// companion's token with a thin-preset one that carries no `write:download`,
/// and Download/Install then failed on scope with nothing to point at.
fn secure_store_service(app: &tauri::AppHandle) -> String {
    let identifier = app.config().identifier.trim().to_string();
    if identifier.is_empty() {
        return SECURE_STORE_SERVICE_FALLBACK.to_string();
    }
    identifier
}

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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RevealPathResult {
    pub path: String,
    pub revealed_as: String,
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

/// Is this file the sort of thing we can hand to `Command::new`?
///
/// Windows answers with the `.exe` extension. Unix has no extension to read, so
/// the executable bit is the only real signal — which is exactly why
/// `extract_zip_archive` restores it. Shared libraries carry that bit too and
/// are never an entry point, so they are excluded by extension.
#[cfg(windows)]
fn is_launchable_file(path: &Path) -> bool {
    path.extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("exe"))
}

#[cfg(unix)]
fn is_launchable_file(path: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;

    if let Some(ext) = path.extension() {
        // Executable-bit-carrying files that are never the entry point.
        for skip in ["so", "dylib", "a", "o", "bundle"] {
            if ext.eq_ignore_ascii_case(skip) {
                return false;
            }
        }
    }

    fs::metadata(path)
        .map(|meta| meta.permissions().mode() & 0o111 != 0)
        .unwrap_or(false)
}

#[cfg(not(any(unix, windows)))]
fn is_launchable_file(_path: &Path) -> bool {
    false
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
        if path.is_file() && is_launchable_file(&path) {
            return Some(path.to_string_lossy().into_owned());
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

// Each `cfg` arm is a full `return` so the arms stay mutually exclusive without
// tripping "unreachable expression" on the platform whose arm is compiled last;
// clippy reads the explicit `return` as needless, but dropping it makes the
// multi-arm shape fragile. Scoped allow rather than a crate-wide one.
#[allow(clippy::needless_return)]
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
            .map(|output| String::from_utf8_lossy(&output.stdout).contains(&pid.to_string()))
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

fn secure_entry(app: &tauri::AppHandle, account: &str) -> Result<Entry, String> {
    Entry::new(&secure_store_service(app), account).map_err(|error| error.to_string())
}

#[tauri::command]
fn secure_store_get(app: tauri::AppHandle, account: String) -> Result<Option<String>, String> {
    let entry = secure_entry(&app, &account)?;
    match entry.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn secure_store_set(app: tauri::AppHandle, account: String, secret: String) -> Result<(), String> {
    let entry = secure_entry(&app, &account)?;
    entry
        .set_password(&secret)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn secure_store_delete(app: tauri::AppHandle, account: String) -> Result<(), String> {
    let entry = secure_entry(&app, &account)?;
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
    extract_zip_to_dir(&archive, &destination)
}

/// Extract every entry of `archive` under `destination`, restoring unix
/// permission bits, and return the extract path plus a best-guess entry point.
///
/// Split out from `extract_zip_archive` so the zip-slip / `enclosed_name()`
/// handling is unit-testable without a `tauri::AppHandle`. The command wrapper
/// still owns the app-root containment check on `archive` / `destination`.
fn extract_zip_to_dir(archive: &Path, destination: &Path) -> Result<ExtractZipResult, String> {
    if !archive.is_file() {
        return Err(format!("Archive not found: {}", archive.display()));
    }

    if destination.exists() {
        remove_path_inner(destination)?;
    }
    fs::create_dir_all(destination).map_err(|error| error.to_string())?;

    let file = File::open(archive).map_err(|error| error.to_string())?;
    let mut zip = ZipArchive::new(file).map_err(|error| error.to_string())?;

    for index in 0..zip.len() {
        let mut entry = zip.by_index(index).map_err(|error| error.to_string())?;
        // `enclosed_name()` returns `None` for any entry name that would escape
        // the destination (`..` segments, absolute paths, drive letters), so a
        // zip-slip entry is skipped outright.
        let entry_path = match entry.enclosed_name() {
            Some(path) => destination.join(path),
            None => continue,
        };

        // Defence in depth: `enclosed_name()` already blocks traversal, but a
        // future swap of the zip crate must not be able to silently reintroduce
        // zip-slip. A join that lands outside `destination` is dropped.
        if !entry_path.starts_with(destination) {
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

        // Restore the archived permission bits on unix. Without this every
        // extracted file lands 0644 and `launch_game` fails with "permission
        // denied" on the one file that was supposed to be the entry point —
        // and `find_likely_exe` cannot see it either, because the executable
        // bit is the only thing that marks an entry point on a platform with
        // no `.exe` extension. Archives authored on Windows carry no unix mode
        // at all; those stay 0644, which is correct — a Windows build is not
        // launchable here regardless.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Some(mode) = entry.unix_mode() {
                fs::set_permissions(&entry_path, fs::Permissions::from_mode(mode))
                    .map_err(|error| error.to_string())?;
            }
        }
    }

    let exe_path = find_likely_exe(destination, 2);
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
        .or_else(|| {
            std::env::var("FLIPS_PATH")
                .ok()
                .filter(|v| !v.trim().is_empty())
        })
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
        patches
            .join(safe_uuid)
            .join(format!("{stem}.patched.{ext}"))
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
    Ok(FlipsApplyResult { output_path: out_s })
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

fn is_absolute_os_path(path: &Path) -> bool {
    if path.is_absolute() {
        return true;
    }
    let s = path.to_string_lossy();
    // UNC / drive letter may still parse absolute on Windows; keep explicit checks.
    s.starts_with("\\\\")
        || s.starts_with("//")
        || (s.len() >= 3
            && s.as_bytes()[0].is_ascii_alphabetic()
            && s.as_bytes()[1] == b':'
            && (s.as_bytes()[2] == b'\\' || s.as_bytes()[2] == b'/'))
}

fn path_has_dotdot_segment(path: &str) -> bool {
    path.split(['/', '\\']).any(|segment| segment == "..")
}

/// Validate a caller-supplied reveal path and classify it as a file or directory.
///
/// Every rejection here happens before any OS process is spawned, which is what
/// makes the guard testable in isolation: empty / whitespace-only, longer than
/// 4096 bytes, embedded NUL / CR / LF, any `..` path segment, a non-absolute
/// path, or a path that does not exist on this machine.
fn validate_reveal_path(path: &str) -> Result<(PathBuf, &'static str), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Path is required".into());
    }
    if trimmed.len() > 4096 {
        return Err("Path is too long".into());
    }
    if trimmed.contains('\0') || trimmed.contains('\n') || trimmed.contains('\r') {
        return Err("Path contains invalid control characters".into());
    }
    if path_has_dotdot_segment(trimmed) {
        return Err("Path must not contain .. segments".into());
    }

    let target = PathBuf::from(trimmed);
    if !is_absolute_os_path(&target) {
        return Err("Path must be absolute".into());
    }
    if !target.exists() {
        return Err(format!("Path does not exist on this machine: {trimmed}"));
    }

    let revealed_as = if target.is_file() {
        "file"
    } else {
        "directory"
    };
    Ok((target, revealed_as))
}

/// Open `path` in Explorer (Windows), Finder (macOS), or the default file manager (Linux).
/// When `select` is true and the path is a file, select it in the parent folder.
#[tauri::command]
fn reveal_path_in_os(path: String, select: Option<bool>) -> Result<RevealPathResult, String> {
    let trimmed = path.trim();
    let (target, revealed_as) = validate_reveal_path(trimmed)?;
    let select_item = select.unwrap_or(true);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let status = if select_item && target.is_file() {
            // explorer /select,<path> — comma is part of the switch, not a shell.
            std::process::Command::new("explorer")
                .arg(format!("/select,{}", target.display()))
                .creation_flags(CREATE_NO_WINDOW)
                .status()
                .map_err(|error| format!("Failed to start Explorer: {error}"))?
        } else {
            let folder = if target.is_file() {
                target
                    .parent()
                    .map(Path::to_path_buf)
                    .unwrap_or_else(|| target.clone())
            } else {
                target.clone()
            };
            std::process::Command::new("explorer")
                .arg(folder.as_os_str())
                .creation_flags(CREATE_NO_WINDOW)
                .status()
                .map_err(|error| format!("Failed to start Explorer: {error}"))?
        };
        // explorer.exe often returns non-zero even on success; existence check is enough.
        let _ = status;
    }

    #[cfg(target_os = "macos")]
    {
        let status = if select_item {
            std::process::Command::new("open")
                .args(["-R", trimmed])
                .status()
                .map_err(|error| format!("Failed to start Finder: {error}"))?
        } else {
            let open_target = if target.is_file() {
                target
                    .parent()
                    .map(|p| p.to_string_lossy().into_owned())
                    .unwrap_or_else(|| trimmed.to_string())
            } else {
                trimmed.to_string()
            };
            std::process::Command::new("open")
                .arg(&open_target)
                .status()
                .map_err(|error| format!("Failed to start Finder: {error}"))?
        };
        if !status.success() {
            return Err(format!("open exited with status {status}"));
        }
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let open_target = if target.is_file() {
            target
                .parent()
                .map(|p| p.to_string_lossy().into_owned())
                .unwrap_or_else(|| trimmed.to_string())
        } else {
            trimmed.to_string()
        };
        let status = std::process::Command::new("xdg-open")
            .arg(&open_target)
            .status()
            .map_err(|error| format!("Failed to start file manager: {error}"))?;
        if !status.success() {
            return Err(format!("xdg-open exited with status {status}"));
        }
        let _ = select_item;
    }

    #[cfg(not(any(windows, unix)))]
    {
        let _ = (select_item, revealed_as);
        return Err("Reveal path is not supported on this OS".into());
    }

    Ok(RevealPathResult {
        path: trimmed.to_string(),
        revealed_as: revealed_as.to_string(),
    })
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
            reveal_path_in_os,
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

#[cfg(test)]
mod tests {
    // `super::*` also re-globs lib.rs's `use std::io::{copy, Write}`, so the
    // `Write` trait `write_zip` needs is already in scope here.
    use super::*;
    use std::fs;
    use tempfile::tempdir;
    use zip::write::{SimpleFileOptions, ZipWriter};

    // ---------------------------------------------------------------
    // ensure_path_under_root
    // ---------------------------------------------------------------

    #[test]
    fn under_root_accepts_file_directly_inside() {
        let root = tempdir().unwrap();
        let target = root.path().join("archive.zip");
        assert!(ensure_path_under_root(&target, root.path()).is_ok());
    }

    #[test]
    fn under_root_accepts_existing_nested_file() {
        let root = tempdir().unwrap();
        let nested = root.path().join("a/b/c");
        fs::create_dir_all(&nested).unwrap();
        let target = nested.join("game.exe");
        fs::write(&target, b"x").unwrap();
        assert!(ensure_path_under_root(&target, root.path()).is_ok());
    }

    #[test]
    fn under_root_rejects_sibling_directory() {
        let base = tempdir().unwrap();
        let root = base.path().join("installs");
        let outside = base.path().join("outside");
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&outside).unwrap();
        let target = outside.join("evil.exe");
        let err = ensure_path_under_root(&target, &root).unwrap_err();
        assert!(err.contains("outside allowed"), "got: {err}");
    }

    #[test]
    fn under_root_rejects_dotdot_traversal_out_of_root() {
        let base = tempdir().unwrap();
        let root = base.path().join("installs");
        let child = root.join("game");
        fs::create_dir_all(&child).unwrap();
        // installs/game/../../escape.txt resolves to base/escape.txt
        let target = child.join("..").join("..").join("escape.txt");
        let err = ensure_path_under_root(&target, &root).unwrap_err();
        assert!(err.contains("outside allowed"), "got: {err}");
    }

    #[test]
    fn under_root_rejects_absolute_path_elsewhere() {
        let base = tempdir().unwrap();
        let root = base.path().join("installs");
        fs::create_dir_all(&root).unwrap();
        let other = tempdir().unwrap();
        let target = other.path().join("payload.bin");
        fs::write(&target, b"x").unwrap();
        assert!(ensure_path_under_root(&target, &root).is_err());
    }

    #[test]
    fn under_root_errors_when_root_missing() {
        let base = tempdir().unwrap();
        let missing_root = base.path().join("nope");
        let target = base.path().join("nope/x.txt");
        assert!(ensure_path_under_root(&target, &missing_root).is_err());
    }

    // ---------------------------------------------------------------
    // ensure_path_under_any_root
    // ---------------------------------------------------------------

    #[test]
    fn any_root_accepts_when_under_a_later_root() {
        let base = tempdir().unwrap();
        let downloads = base.path().join("downloads");
        let mods = base.path().join("mods");
        fs::create_dir_all(&downloads).unwrap();
        fs::create_dir_all(&mods).unwrap();
        let target = mods.join("patch.bin");
        assert!(
            ensure_path_under_any_root(&target, &[downloads.as_path(), mods.as_path()]).is_ok()
        );
    }

    #[test]
    fn any_root_rejects_when_under_none_of_them() {
        let base = tempdir().unwrap();
        let downloads = base.path().join("downloads");
        let mods = base.path().join("mods");
        let elsewhere = base.path().join("elsewhere");
        for dir in [&downloads, &mods, &elsewhere] {
            fs::create_dir_all(dir).unwrap();
        }
        let target = elsewhere.join("x.bin");
        let err = ensure_path_under_any_root(&target, &[downloads.as_path(), mods.as_path()])
            .unwrap_err();
        assert!(err.contains("outside allowed"), "got: {err}");
    }

    #[test]
    fn any_root_rejects_dotdot_bridge_between_roots() {
        let base = tempdir().unwrap();
        let downloads = base.path().join("downloads");
        let mods = base.path().join("mods");
        fs::create_dir_all(&downloads).unwrap();
        fs::create_dir_all(&mods).unwrap();
        // Start inside `mods`, climb out, land in `downloads` — still "allowed"
        // overall, but proves traversal is resolved rather than string-matched.
        let bridged = mods.join("..").join("downloads").join("real.bin");
        assert!(
            ensure_path_under_any_root(&bridged, &[downloads.as_path(), mods.as_path()]).is_ok()
        );
        // ...and the same climb into a non-root sibling is refused.
        let sibling = base.path().join("sibling");
        fs::create_dir_all(&sibling).unwrap();
        let escaped = mods.join("..").join("sibling").join("real.bin");
        assert!(
            ensure_path_under_any_root(&escaped, &[downloads.as_path(), mods.as_path()]).is_err()
        );
    }

    // ---------------------------------------------------------------
    // path_has_dotdot_segment / is_absolute_os_path
    // ---------------------------------------------------------------

    #[test]
    fn dotdot_segment_detection() {
        assert!(path_has_dotdot_segment("/home/user/../etc/passwd"));
        assert!(path_has_dotdot_segment("C:\\Users\\me\\..\\Administrator"));
        assert!(path_has_dotdot_segment(".."));
        assert!(path_has_dotdot_segment("a/../b"));
        assert!(!path_has_dotdot_segment("/home/user/games/rom.bin"));
        assert!(!path_has_dotdot_segment("/home/user/..name/ok")); // ".." only as a full segment
        assert!(!path_has_dotdot_segment("C:\\Users\\me\\game..v2"));
    }

    #[test]
    fn absolute_path_detection() {
        assert!(is_absolute_os_path(Path::new("C:\\Users\\me\\game")));
        assert!(is_absolute_os_path(Path::new("C:/Users/me/game")));
        assert!(is_absolute_os_path(Path::new("\\\\server\\share\\game")));
        assert!(is_absolute_os_path(Path::new("//server/share/game")));
        assert!(!is_absolute_os_path(Path::new("relative/path")));
        assert!(!is_absolute_os_path(Path::new("game.exe")));
        assert!(!is_absolute_os_path(Path::new("C:game"))); // drive-relative, no separator
    }

    // ---------------------------------------------------------------
    // validate_reveal_path (reveal_path_in_os guards)
    // ---------------------------------------------------------------

    #[test]
    fn reveal_rejects_empty_or_whitespace() {
        assert_eq!(validate_reveal_path("").unwrap_err(), "Path is required");
        assert_eq!(
            validate_reveal_path("    ").unwrap_err(),
            "Path is required"
        );
    }

    #[test]
    fn reveal_rejects_overlong_path() {
        let long = format!("/{}", "a".repeat(5000));
        assert_eq!(validate_reveal_path(&long).unwrap_err(), "Path is too long");
    }

    #[test]
    fn reveal_rejects_control_characters() {
        assert!(validate_reveal_path("/tmp/a\nb")
            .unwrap_err()
            .contains("control"));
        assert!(validate_reveal_path("/tmp/a\rb")
            .unwrap_err()
            .contains("control"));
        assert!(validate_reveal_path("/tmp/a\0b")
            .unwrap_err()
            .contains("control"));
    }

    #[test]
    fn reveal_rejects_dotdot_segments() {
        assert!(validate_reveal_path("/home/user/../root/secret")
            .unwrap_err()
            .contains(".."));
        assert!(validate_reveal_path("C:\\Users\\me\\..\\Administrator\\x")
            .unwrap_err()
            .contains(".."));
    }

    #[test]
    fn reveal_rejects_non_absolute_path() {
        assert_eq!(
            validate_reveal_path("relative/dir/here").unwrap_err(),
            "Path must be absolute"
        );
    }

    #[test]
    fn reveal_rejects_absolute_but_missing_path() {
        let base = tempdir().unwrap();
        let missing = base.path().join("does-not-exist-42");
        let err = validate_reveal_path(missing.to_str().unwrap()).unwrap_err();
        assert!(err.contains("does not exist"), "got: {err}");
    }

    #[test]
    fn reveal_accepts_existing_directory() {
        let base = tempdir().unwrap();
        let (path, kind) = validate_reveal_path(base.path().to_str().unwrap()).unwrap();
        assert_eq!(kind, "directory");
        assert_eq!(path, base.path());
    }

    #[test]
    fn reveal_accepts_existing_file() {
        let base = tempdir().unwrap();
        let file = base.path().join("readme.txt");
        fs::write(&file, b"hi").unwrap();
        let (_path, kind) = validate_reveal_path(file.to_str().unwrap()).unwrap();
        assert_eq!(kind, "file");
    }

    // ---------------------------------------------------------------
    // extract_zip_to_dir — enclosed_name() / zip-slip handling
    // ---------------------------------------------------------------

    fn write_zip(path: &Path, entries: &[(&str, &[u8])]) {
        let file = fs::File::create(path).unwrap();
        let mut zip = ZipWriter::new(file);
        let opts = SimpleFileOptions::default();
        for (name, body) in entries {
            if name.ends_with('/') {
                zip.add_directory(name.trim_end_matches('/'), opts).unwrap();
            } else {
                zip.start_file(*name, opts).unwrap();
                zip.write_all(body).unwrap();
            }
        }
        zip.finish().unwrap();
    }

    #[test]
    fn extract_places_normal_entries_under_destination() {
        let work = tempdir().unwrap();
        let archive = work.path().join("bundle.zip");
        write_zip(
            &archive,
            &[
                ("game/", b""),
                ("game/data.bin", b"payload"),
                ("readme.txt", b"hi"),
            ],
        );
        let dest = work.path().join("out");
        let result = extract_zip_to_dir(&archive, &dest).unwrap();
        assert_eq!(result.extract_path, dest.to_string_lossy().into_owned());
        assert!(dest.join("game/data.bin").is_file());
        assert_eq!(fs::read(dest.join("game/data.bin")).unwrap(), b"payload");
        assert!(dest.join("readme.txt").is_file());
    }

    #[test]
    fn extract_drops_parent_traversal_entry() {
        let work = tempdir().unwrap();
        let archive = work.path().join("evil.zip");
        write_zip(
            &archive,
            &[("../escape.txt", b"pwned"), ("safe.txt", b"ok")],
        );
        let dest = work.path().join("out");
        extract_zip_to_dir(&archive, &dest).unwrap();

        // The traversal entry must not have been written anywhere outside dest.
        assert!(!work.path().join("escape.txt").exists());
        assert!(!dest.parent().unwrap().join("escape.txt").exists());
        // The legitimate entry still lands.
        assert!(dest.join("safe.txt").is_file());
        // And nothing escaped the destination at all.
        assert!(!dest.join("../escape.txt").exists());
    }

    #[test]
    fn extract_drops_deep_traversal_and_absolute_entries() {
        let work = tempdir().unwrap();
        let src = work.path().join("src");
        fs::create_dir_all(&src).unwrap();
        let archive = src.join("evil2.zip");
        write_zip(
            &archive,
            &[
                ("a/b/../../../../../../tmp/evil.bin", b"x"),
                ("nested/ok.bin", b"y"),
            ],
        );
        let dest = work.path().join("out");
        extract_zip_to_dir(&archive, &dest).unwrap();

        assert!(dest.join("nested/ok.bin").is_file());
        // Nothing may have been written outside the destination.
        assert!(!work.path().join("tmp").exists());
        assert!(!work.path().join("evil.bin").exists());
        assert!(!dest.parent().unwrap().join("tmp/evil.bin").exists());

        // Walk the destination tree; every extracted path must stay inside it.
        let mut stack = vec![dest.clone()];
        while let Some(dir) = stack.pop() {
            for entry in fs::read_dir(&dir).unwrap() {
                let path = entry.unwrap().path();
                assert!(path.starts_with(&dest), "escaped path: {}", path.display());
                if path.is_dir() {
                    stack.push(path);
                }
            }
        }
    }

    #[test]
    fn extract_errors_when_archive_missing() {
        let work = tempdir().unwrap();
        let archive = work.path().join("absent.zip");
        let dest = work.path().join("out");
        let err = extract_zip_to_dir(&archive, &dest).unwrap_err();
        assert!(err.contains("Archive not found"), "got: {err}");
    }

    #[test]
    fn extract_replaces_a_pre_existing_destination() {
        let work = tempdir().unwrap();
        let archive = work.path().join("bundle.zip");
        write_zip(&archive, &[("fresh.txt", b"new")]);
        let dest = work.path().join("out");
        fs::create_dir_all(&dest).unwrap();
        fs::write(dest.join("stale.txt"), b"old").unwrap();

        extract_zip_to_dir(&archive, &dest).unwrap();
        assert!(dest.join("fresh.txt").is_file());
        assert!(!dest.join("stale.txt").exists());
    }
}
