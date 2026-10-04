fn main() {
    // ASB_REPO ("owner/repo") is set by the release workflow so the app knows
    // where to look for updates. Rebuild when it changes.
    println!("cargo:rerun-if-env-changed=ASB_REPO");
    tauri_build::build()
}
