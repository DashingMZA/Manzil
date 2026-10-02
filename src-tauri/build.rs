fn main() {
    // Windows par Tauri default ek app manifest khud generate karta hai.
    // Hum apna manifest (`windows-app-manifest.xml`) use kar rahe hain —
    // ye Common-Controls v6 dependency declare karta hai, taake app ke
    // native controls (buttons, scrollbars, etc.) modern/themed dikhein
    // aur na ke Windows 95-era flat look mein.
    //
    // Icon aur installer metadata (product name, version, description,
    // authors -> company) alag se, `tauri_build::build()` ke andar hi
    // automatically embed hoti hai — `tauri.conf.json` ke `bundle.icon`
    // aur `Cargo.toml` ke `[package]` fields se. Manifest custom karne se
    // ye affect nahi hota, is liye yahan alag se kuch nahi likhna padta.
    let mut attributes = tauri_build::Attributes::new();

    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc")
    {
        let manifest = std::path::PathBuf::from(
            std::env::var_os("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is set by Cargo"),
        )
        .join("windows-app-manifest.xml");

        println!("cargo:rerun-if-changed={}", manifest.display());
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());

        attributes =
            attributes.windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest());
    }

    tauri_build::try_build(attributes).expect("failed to build Tauri resources");
}
