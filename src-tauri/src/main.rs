#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod proxy;
mod tray;

use tauri::{Manager, WindowEvent};
use tauri_plugin_sql::{Migration, MigrationKind};

/// SQLite file app ke data dir mein banti hai (`sqlite:manzil.db`).
/// Settings (API key, model, port, locale, theme) yahan persist hoti hain.
///
/// `models` table (version 1 migration) ab **use nahi hoti** — model
/// catalog ab live-fetch nahi, `src/lib/models.ts` mein hardcoded hai
/// (dekhein MEMORY.md). Migration khud edit nahi ki (purani migrations
/// kabhi edit nahi karte) — table schema mein reh gayi hai, bas empty
/// rehti hai, koi nuksan nahi.
fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "settings + model catalog",
            kind: MigrationKind::Up,
            sql: r#"
                CREATE TABLE IF NOT EXISTS settings (
                    key        TEXT PRIMARY KEY,
                    value      TEXT NOT NULL,
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                );

                CREATE TABLE IF NOT EXISTS models (
                    id         TEXT PRIMARY KEY,
                    category   TEXT NOT NULL,
                    agentic    INTEGER NOT NULL DEFAULT 0,
                    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
                );

                CREATE INDEX IF NOT EXISTS idx_models_category ON models(category);
            "#,
        },
        Migration {
            version: 2,
            description: "recently used models",
            kind: MigrationKind::Up,
            sql: r#"
                CREATE TABLE IF NOT EXISTS model_usage (
                    model_id  TEXT PRIMARY KEY,
                    uses      INTEGER NOT NULL DEFAULT 0,
                    last_used TEXT NOT NULL DEFAULT (datetime('now'))
                );
            "#,
        },
    ]
}

fn main() {
    tauri::Builder::default()
        // Single-instance hamesha SABSE PEHLE register hona chahiye (Tauri
        // ki apni recommendation) — doosri baar app launch hone par (user
        // ne dobara icon/shortcut click kiya) ye hamari pehli, already
        // running instance ko signal bhejta hai, jo window ko saamne le
        // aati hai. Isi se "jab bhi tool open karun to active window show
        // ho" wala masla fix hota hai — warna doosra process khud start ho
        // jata (aur proxy port clash karta).
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            tray::show_main_window(app);
        }))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:manzil.db", migrations())
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // Autostart: system boot par `--hidden` arg ke saath launch hota
        // hai — setup() mein isay check kar ke window show nahi karte,
        // seedha tray mein chup chaap chali jati hai (background utility
        // jaisa behavior). Manual launch (double-click, Start Menu) is
        // arg ke baghair hota hai, is liye window turant show hoti hai.
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .manage(proxy::ProxyState::default())
        .manage(tray::TrayState::default())
        .invoke_handler(tauri::generate_handler![
            config::runtime_info,
            proxy::check_node,
            proxy::bundled_node_info,
            proxy::proxy_status,
            proxy::start_proxy,
            proxy::stop_proxy,
            tray::set_tray_locale,
        ])
        .setup(|app| {
            tray::build(app)?;

            // Window `tauri.conf.json` mein `visible: false` hai — taake
            // autostart (system boot) par chup-chaap tray mein chali jaye.
            // Normal launch par yahan turant show karte hain, khud Rust
            // side se — frontend/JS ke load hone ka wait nahi karte. Is se
            // window "kabhi dikhti hi nahi" wala bug nahi aata, chahe JS
            // mein koi silent error ho jaye.
            let launched_hidden = std::env::args().any(|a| a == "--hidden");
            if !launched_hidden {
                tray::show_main_window(&app.handle());
            }

            Ok(())
        })
        // Tray: window band (X) karne par app quit nahi hoti — sirf chhup
        // jati hai aur proxy background mein chalta rehta hai. Asal quit
        // sirf tray menu ke "Quit" se hota hai.
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
            }
            WindowEvent::Destroyed => proxy::kill_if_running(window.app_handle()),
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("Tauri app start nahi hua");
}
