//! System tray: icon, menu, aur menu labels ka locale-aware translation.
//!
//! "Sab kuch locales mein ho, kuch hardcoded na ho" — tray ke labels bhi
//! frontend ke `src/locales/*.json` files se aate hain (compile-time embed,
//! `include_str!` se), Rust mein alag se translation table nahi likhi.
//! Frontend jab locale badalta hai, `set_tray_locale` command call karta
//! hai (dekhein `I18nProvider.tsx`) aur tray turant update ho jata hai.

use std::sync::Mutex;

use serde_json::Value;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Wry};

use crate::proxy;

const EN: &str = include_str!("../../src/locales/en.json");
const UR: &str = include_str!("../../src/locales/ur.json");
const DE: &str = include_str!("../../src/locales/de.json");
const AR: &str = include_str!("../../src/locales/ar.json");
const HI: &str = include_str!("../../src/locales/hi.json");

fn locale_json(locale: &str) -> &'static str {
    match locale {
        "ur" => UR,
        "de" => DE,
        "ar" => AR,
        "hi" => HI,
        _ => EN,
    }
}

/// `(show_label, quit_label)` — locale JSON ke `tray.show` / `tray.quit`
/// keys se. Locale invalid/missing key ho to English par fallback.
fn tray_strings(locale: &str) -> (String, String) {
    let fallback: Value = serde_json::from_str(EN).unwrap_or_default();
    let parsed: Value = serde_json::from_str(locale_json(locale)).unwrap_or_default();

    let get = |key: &str| -> String {
        parsed["tray"][key]
            .as_str()
            .or_else(|| fallback["tray"][key].as_str())
            .unwrap_or(key)
            .to_string()
    };

    (get("show"), get("quit"))
}

pub struct TrayHandles {
    show_item: MenuItem<Wry>,
    quit_item: MenuItem<Wry>,
}

pub struct TrayState(pub Mutex<Option<TrayHandles>>);

impl Default for TrayState {
    fn default() -> Self {
        Self(Mutex::new(None))
    }
}

/// Hidden/minimized window ko wapas saamne lao (tray click, "Show" menu,
/// ya doosri baar app launch hone par single-instance se).
pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn build(app: &tauri::App) -> tauri::Result<()> {
    let (show_label, quit_label) = tray_strings("en");

    let show = MenuItem::with_id(app, "show", show_label, true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", quit_label, true, None::<&str>)?;
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

    let state: tauri::State<TrayState> = app.state();
    *state.0.lock().unwrap() = Some(TrayHandles {
        show_item: show,
        quit_item: quit,
    });

    Ok(())
}

/// Frontend locale badalte hi ye call hota hai — tray menu turant switch
/// ho jata hai, app restart kiye baghair.
#[tauri::command]
pub fn set_tray_locale(app: AppHandle, locale: String) -> Result<(), String> {
    let state: tauri::State<TrayState> = app.state();
    let guard = state.0.lock().unwrap();

    if let Some(handles) = guard.as_ref() {
        let (show_label, quit_label) = tray_strings(&locale);
        let _ = handles.show_item.set_text(show_label);
        let _ = handles.quit_item.set_text(quit_label);
    }

    Ok(())
}
