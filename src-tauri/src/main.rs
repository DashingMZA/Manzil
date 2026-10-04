#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod proxy;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
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

/// Hidden/minimized window ko wapas saamne lao (tray click ya "Show" menu se).
fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:manzil.db", migrations())
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(proxy::ProxyState::default())
        .invoke_handler(tauri::generate_handler![
            config::runtime_info,
            proxy::check_node,
            proxy::bundled_node_info,
            proxy::proxy_status,
            proxy::start_proxy,
            proxy::stop_proxy,
        ])
        // Tray: window band (X) karne par app quit nahi hoti — sirf chhup jati
        // hai aur proxy background mein chalta rehta hai. Asal quit sirf tray
        // menu ke "Quit" se hota hai.
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Show Manzil", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Quit Manzil", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &separator, &quit])?;

            let mut tray = TrayIconBuilder::with_id("manzil-tray")
                .tooltip("Manzil")
                .menu(&menu)
                // Left click = window dikhao, right click = menu
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "quit" => {
                        // Proxy process pehle band karo, phir app exit.
                        proxy::kill_if_running(app);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;

            Ok(())
        })
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
