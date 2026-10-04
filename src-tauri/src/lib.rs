use std::path::Path;
use std::process::Command;
use tauri::{AppHandle, Manager, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

/// The only remote site that may load inside the app window.
/// Keep in sync with ADMIN_URL in www/config.js.
const ADMIN_HOST: &str = "admin.asbdataghana.com";

/// Runs on every page the window loads: hides the "Download App" menu and adds
/// native-feeling polish to the admin panel.
const INJECT: &str = include_str!("inject.js");

/// "owner/repo" of the GitHub repo that publishes releases. Baked in at build
/// time by the release workflow; empty for local dev builds (updates disabled).
const REPO: &str = match option_env!("ASB_REPO") {
    Some(r) => r,
    None => "",
};

/// The only files the updater will ever download from the release.
const ALLOWED_ASSETS: [&str; 2] = ["ASBDataGhana.exe", "ASBDataGhana-mac.tar.gz"];

#[tauri::command]
fn app_info(app: AppHandle) -> serde_json::Value {
    serde_json::json!({
        "version": app.package_info().version.to_string(),
        "repo": REPO,
        "os": std::env::consts::OS,
    })
}

/// Downloads the new version from this repo's latest release, installs it and
/// restarts the app. Called by the splash screen when a newer release exists.
#[tauri::command]
async fn apply_update(app: AppHandle, asset: String) -> Result<(), String> {
    if !ALLOWED_ASSETS.contains(&asset.as_str()) {
        return Err("unknown update file".into());
    }
    if REPO.is_empty() {
        return Err("this build has no update source".into());
    }
    let url = format!("https://github.com/{REPO}/releases/latest/download/{asset}");
    tauri::async_runtime::spawn_blocking(move || install(&url))
        .await
        .map_err(|e| e.to_string())??;
    app.exit(0);
    Ok(())
}

/// curl ships with Windows 10+ and macOS, so no extra HTTP stack is needed.
fn download(url: &str, dest: &Path) -> Result<(), String> {
    let mut cmd = Command::new("curl");
    cmd.args(["-L", "-f", "-sS", "--retry", "2", "--max-time", "900", "-o"])
        .arg(dest)
        .arg(url);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let out = cmd.output().map_err(|e| format!("could not start curl: {e}"))?;
    if !out.status.success() {
        return Err(format!("download failed: {}", String::from_utf8_lossy(&out.stderr).trim()));
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn ps_quote(p: &Path) -> String {
    p.to_string_lossy().replace('\'', "''")
}

#[cfg(target_os = "windows")]
fn install(url: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    let installer = std::env::temp_dir().join("ASBDataGhana-update.exe");
    download(url, &installer)?;
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    // Wait for this process to exit, run the installer silently, then relaunch.
    let script = format!(
        "Start-Sleep -Seconds 2; Start-Process -FilePath '{}' -ArgumentList '/S' -Wait; Start-Process -FilePath '{}'",
        ps_quote(&installer),
        ps_quote(&exe)
    );
    Command::new("powershell")
        .args(["-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-Command", &script])
        .creation_flags(0x0800_0000)
        .spawn()
        .map_err(|e| format!("could not start the installer: {e}"))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn sh_quote(p: &Path) -> String {
    format!("'{}'", p.to_string_lossy().replace('\'', "'\\''"))
}

#[cfg(target_os = "macos")]
fn install(url: &str) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    // .../ASBDataGhana.app/Contents/MacOS/<binary>
    let bundle = exe.ancestors().nth(3).ok_or("cannot locate the app bundle")?.to_path_buf();
    if bundle.extension().and_then(|e| e.to_str()) != Some("app") {
        return Err("not running from an .app bundle".into());
    }

    let tmp = std::env::temp_dir().join("asbdata-update");
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).map_err(|e| e.to_string())?;
    let archive = tmp.join("update.tar.gz");
    download(url, &archive)?;

    let unpacked = Command::new("tar")
        .arg("-xzf").arg(&archive).arg("-C").arg(&tmp)
        .status()
        .map_err(|e| e.to_string())?;
    if !unpacked.success() {
        return Err("could not unpack the update".into());
    }
    let new_app = std::fs::read_dir(&tmp)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .find(|p| p.extension().and_then(|e| e.to_str()) == Some("app"))
        .ok_or("the update archive has no app in it")?;

    // Copy next to the old app first, then swap, so a failed copy never leaves
    // the user without an app. Runs after this process exits.
    let staged = bundle.with_extension("app.new");
    let script = format!(
        "sleep 1; ditto {new} {staged} && rm -rf {old} && mv {staged} {old}; xattr -cr {old}; open {old}",
        new = sh_quote(&new_app),
        staged = sh_quote(&staged),
        old = sh_quote(&bundle),
    );
    Command::new("sh").arg("-c").arg(script).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn install(_url: &str) -> Result<(), String> {
    Err("updates are not supported on this platform".into())
}

pub fn run() {
    tauri::Builder::default()
        // Must be first: launching a second copy just focuses the open window.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![app_info, apply_update])
        .setup(|app| {
            let handle = app.handle().clone();
            let cfg = app
                .config()
                .app
                .windows
                .first()
                .cloned()
                .expect("tauri.conf.json must define the main window");

            WebviewWindowBuilder::from_config(app.handle(), &cfg)?
                .initialization_script(INJECT)
                .on_navigation(move |url| {
                    let host = url.host_str().unwrap_or("");
                    let internal = matches!(url.scheme(), "tauri" | "about" | "blob" | "data")
                        || host == "tauri.localhost"
                        || host == ADMIN_HOST
                        || (cfg!(debug_assertions) && host == "localhost");
                    if internal {
                        return true;
                    }
                    // Anything else (docs, WhatsApp, payment pages...) opens in the
                    // default browser instead of replacing the dashboard.
                    if matches!(url.scheme(), "http" | "https" | "mailto" | "tel") {
                        let _ = handle.opener().open_url(url.as_str(), None::<&str>);
                    }
                    false
                })
                .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running ASBData Ghana");
}
