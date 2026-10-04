//! Har cheez yahan hardcoded hai. Sirf API key aur model selection SQLite se
//! aate hain — baaki sab yahan se, taake UI mein 15 knobs na banein.
//!
//! Badalna ho to yahan badlein aur rebuild karein.

use serde::Serialize;

/// Proxy kis port par sunega — ye sirf DEFAULT hai. User Settings page se
/// apna port choose kar sakta hai (SQLite mein `port` key ke taur par save
/// hota hai); wahan kuch save na ho to yahi value use hoti hai.
pub const DEFAULT_PORT: u16 = 3456;

/// NVIDIA NIM ka OpenAI-compatible endpoint. `/v1` URL ka hissa hai.
pub const UPSTREAM_BASE_URL: &str = "https://integrate.api.nvidia.com/v1";

/// Claude Code 32000+ max_tokens maangta hai; NVIDIA zyadatar models par
/// usay reject karta hai, is liye yahan clamp hota hai.
pub const MAX_TOKENS: u32 = 16384;

/// "low" | "medium" | "high" | "max" | "" (khali = field bheja hi na jaye).
/// `max` bohot slow hai aur tool-calling bigaad deta hai; medium sweet spot hai.
pub const REASONING_EFFORT: &str = "medium";

/// Khali chhodein to Claude Code khud decide karega.
pub const TEMPERATURE: &str = "1";

/// Claude Code jo model maange usay ignore kar ke hamesha chuna hua model use karo.
pub const FORCE_DEFAULT_MODEL: bool = true;

/// Model ki chain-of-thought transcript mein dikhao? Normally nahi.
pub const INCLUDE_REASONING: bool = false;

/// Upstream ko bheja gaya poora payload log karo? Debugging ke liye `true`.
pub const DEBUG_LOGS: bool = false;

/// Kam se kam Node version (built-in fetch ke liye 20+ chahiye).
pub const MIN_NODE_MAJOR: u32 = 20;

/// `Cargo.toml` ke `[package] version` se seedha — build ke waqt hi bind ho
/// jata hai, alag se kahin maintain nahi karna padta.
pub const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

pub const HOMEPAGE_URL: &str = "https://manzil.bond";

/// Asal auto-update ab `tauri-plugin-updater` se hoti hai (About page ka
/// "Check for updates" button) — ye URL sirf fallback hai jab app Tauri ke
/// baghair chal rahi ho (`pnpm dev`, browser preview), jahan updater plugin
/// kaam nahi karta.
pub const UPDATE_CHECK_URL: &str = "https://github.com/dashingmza/manzil/releases";

#[derive(Serialize, Clone)]
pub struct RuntimeInfo {
    /// Sirf default value — actual port Settings mein user set karta hai.
    pub default_port: u16,
    pub upstream_base_url: &'static str,
    pub max_tokens: u32,
    pub reasoning_effort: &'static str,
    pub temperature: &'static str,
    pub force_default_model: bool,
    pub include_reasoning: bool,
    pub debug_logs: bool,
    pub min_node_major: u32,
    pub app_version: &'static str,
    pub homepage_url: &'static str,
    pub update_check_url: &'static str,
}

impl RuntimeInfo {
    pub fn current() -> Self {
        Self {
            default_port: DEFAULT_PORT,
            upstream_base_url: UPSTREAM_BASE_URL,
            max_tokens: MAX_TOKENS,
            reasoning_effort: REASONING_EFFORT,
            temperature: TEMPERATURE,
            force_default_model: FORCE_DEFAULT_MODEL,
            include_reasoning: INCLUDE_REASONING,
            debug_logs: DEBUG_LOGS,
            min_node_major: MIN_NODE_MAJOR,
            app_version: APP_VERSION,
            homepage_url: HOMEPAGE_URL,
            update_check_url: UPDATE_CHECK_URL,
        }
    }
}

#[tauri::command]
pub fn runtime_info() -> RuntimeInfo {
    RuntimeInfo::current()
}
