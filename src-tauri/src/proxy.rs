//! Node proxy process ko spawn, monitor aur kill karta hai, aur uske stdout /
//! stderr ko live events ke taur par frontend tak pahunchata hai.
//!
//! Do tareeqon se chalta hai:
//!
//! 1. **Bundled sidecar** (default) — app ke saath staged Node binary
//!    (`src-tauri/binaries/node-<target-triple>`), Tauri ke shell-plugin
//!    "sidecar" feature se. End user ko Node install karne ki zaroorat nahi.
//!    `pnpm fetch:node` se stage hota hai (`pnpm app:build` se pehle khud
//!    chal jata hai — `tauri.conf.json` ka `beforeBundleCommand`).
//! 2. **System Node** (fallback) — agar sidecar staged nahi hai (abhi
//!    `fetch:node` nahi chalaya) ya user ne Settings mein explicit
//!    `node_path` diya ho, to PATH se ya diye gaye path se `node` chalate
//!    hain. Dev ke liye convenient — bina sidecar fetch kiye bhi kaam chal
//!    jata hai.
//!
//! `proxy.js` khud binary ke andar `include_str!` se embed hai — is se
//! Tauri ke resource-path resolver par depend nahi karna padta (jo dev mode
//! mein Windows par galat path resolve kar raha tha aur `EISDIR` crash deta
//! tha). Runtime par ek temp file mein likh kar wahi chalate hain.

use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

use crate::config;

/// `proxy.js` ka poora content compile-time par binary ke andar embed ho
/// jata hai — koi runtime resource-lookup nahi.
const PROXY_SCRIPT: &str = include_str!("../resources/proxy.js");

/// Chal raha proxy process — sidecar (bundled Node) ya system Node, dono ko
/// alag se kill karna padta hai kyunki dono alag types hain.
enum RunningProxy {
    Sidecar(tauri_plugin_shell::process::CommandChild),
    System(std::process::Child),
}

pub struct ProxyState(Mutex<Option<RunningProxy>>);

impl Default for ProxyState {
    fn default() -> Self {
        Self(Mutex::new(None))
    }
}

#[derive(Serialize, Clone)]
pub struct LogLine {
    pub level: String,
    pub text: String,
}

/// proxy.js har line ko `INFO` / `WARN` / `ERROR` / `DEBUG` se tag karta hai.
fn classify(line: &str) -> &'static str {
    if line.contains("ERROR") {
        "error"
    } else if line.contains("WARN") {
        "warn"
    } else if line.contains("DEBUG") {
        "debug"
    } else {
        "info"
    }
}

fn emit_log(app: &AppHandle, level: &str, text: impl Into<String>) {
    let _ = app.emit(
        "proxy://log",
        LogLine {
            level: level.to_string(),
            text: text.into(),
        },
    );
}

/// `proxy.js` ko har run par ek fresh temp file mein likhta hai. Tauri ke
/// resource resolver ke bajaye ye path hamesha sahi hota hai — dev ho ya
/// bundled app, dono mein.
fn write_script_to_temp() -> Result<std::path::PathBuf, String> {
    let dir = std::env::temp_dir().join("manzil-proxy");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Temp dir nahi bani: {e}"))?;

    let path = dir.join("proxy.js");
    std::fs::write(&path, PROXY_SCRIPT)
        .map_err(|e| format!("proxy.js temp file mein likhi nahi gayi: {e}"))?;

    Ok(path)
}

/// Env vars jo proxy.js dono modes (sidecar aur system) mein chahiye.
fn proxy_env(port: u16, api_key: &str, model: &str, small_model: &str) -> Vec<(&'static str, String)> {
    let small = if small_model.trim().is_empty() {
        model.trim().to_string()
    } else {
        small_model.trim().to_string()
    };

    vec![
        // Kisi random .env file ko config override na karne do
        ("ENV_FILE", "__tauri_no_dotenv__".into()),
        ("PORT", port.to_string()),
        ("UPSTREAM_BASE_URL", config::UPSTREAM_BASE_URL.into()),
        ("UPSTREAM_API_KEY", api_key.trim().to_string()),
        ("DEFAULT_MODEL", model.trim().to_string()),
        ("SMALL_MODEL", small),
        ("MAX_TOKENS_LIMIT", config::MAX_TOKENS.to_string()),
        ("REASONING_EFFORT", config::REASONING_EFFORT.into()),
        ("TEMPERATURE", config::TEMPERATURE.into()),
        (
            "FORCE_DEFAULT_MODEL",
            config::FORCE_DEFAULT_MODEL.to_string(),
        ),
        (
            "INCLUDE_REASONING",
            config::INCLUDE_REASONING.to_string(),
        ),
        ("DEBUG", config::DEBUG_LOGS.to_string()),
    ]
}

// ======================================================
// COMMANDS
// ======================================================

/// Node maujood hai aur kaafi naya hai? Version string ya error wapas.
/// (Sirf system Node ke liye — bundled sidecar hamesha sahi version hoti
/// hai, kyunki `fetch-node.mjs` khud pin ki hui version download karta hai.)
#[tauri::command]
pub fn check_node(node_path: String) -> Result<String, String> {
    let node = if node_path.trim().is_empty() {
        "node".to_string()
    } else {
        node_path.trim().to_string()
    };

    let out = Command::new(&node).arg("--version").output().map_err(|e| {
        format!(
            "`{node}` nahi mila: {e}\n\n\
             Node {}+ install karein (nodejs.org), ya Settings mein poora path dein.",
            config::MIN_NODE_MAJOR
        )
    })?;

    let version = String::from_utf8_lossy(&out.stdout).trim().to_string();

    let major: u32 = version
        .trim_start_matches('v')
        .split('.')
        .next()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    if major < config::MIN_NODE_MAJOR {
        return Err(format!(
            "Node {version} mila, lekin {}+ chahiye (built-in fetch ke liye).",
            config::MIN_NODE_MAJOR
        ));
    }

    Ok(version)
}

/// Is platform ke liye Tauri sidecar naming convention ke mutabiq expected
/// filename — bilkul `scripts/fetch-node.mjs` jaisi hi mapping (dono sync
/// rakhna zaroori hai, dekhein SKILLS.md). Compile-time constants se, koi
/// filesystem resolve nahi — is se Tauri ke resource-resolver wala purana
/// bug dobara nahi aata.
fn expected_sidecar_filename() -> String {
    let triple = match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", "x86_64") => "x86_64-pc-windows-msvc",
        ("macos", "x86_64") => "x86_64-apple-darwin",
        ("macos", "aarch64") => "aarch64-apple-darwin",
        ("linux", "x86_64") => "x86_64-unknown-linux-gnu",
        ("linux", "aarch64") => "aarch64-unknown-linux-gnu",
        _ => "unknown-target",
    };
    let ext = if std::env::consts::OS == "windows" { ".exe" } else { "" };
    format!("node-{triple}{ext}")
}

#[derive(Serialize, Clone)]
pub struct BundledNodeInfo {
    /// `true` agar sidecar staged hai aur Tauri isay chala sakta hai.
    pub available: bool,
    /// Is platform ke liye expected filename — `available` false ho tab bhi
    /// dikhta hai, taake user ko pata ho `pnpm fetch:node` kya banayega.
    pub filename: String,
}

/// Settings page ke "Node runtime" card ke liye — user ko manually kuch
/// dhoondne/browse karne ki zaroorat nahi, ye khud bata deta hai bundled
/// Node maujood hai ya nahi.
#[tauri::command]
pub fn bundled_node_info(app: AppHandle) -> BundledNodeInfo {
    BundledNodeInfo {
        available: app.shell().sidecar("node").is_ok(),
        filename: expected_sidecar_filename(),
    }
}

#[tauri::command]
pub fn proxy_status(state: State<'_, ProxyState>) -> bool {
    let mut guard = state.0.lock().unwrap();

    match guard.as_mut() {
        Some(RunningProxy::System(child)) => match child.try_wait() {
            Ok(None) => true,
            _ => {
                *guard = None;
                false
            }
        },
        // Sidecar child ka synchronous try_wait nahi milta — jab wo khatam
        // hota hai to Terminated event guard ko khud None kar deta hai
        // (neeche dekhein), is liye yahan maujood hona hi "running" maan
        // lete hain.
        Some(RunningProxy::Sidecar(_)) => true,
        None => false,
    }
}

#[tauri::command]
pub fn start_proxy(
    app: AppHandle,
    state: State<'_, ProxyState>,
    api_key: String,
    model: String,
    small_model: String,
    node_path: String,
    port: u16,
) -> Result<(), String> {
    {
        let mut guard = state.0.lock().unwrap();
        let still_running = match guard.as_mut() {
            Some(RunningProxy::System(child)) => matches!(child.try_wait(), Ok(None)),
            Some(RunningProxy::Sidecar(_)) => true,
            None => false,
        };
        if still_running {
            return Err("Proxy pehle se chal raha hai.".into());
        }
        *guard = None;
    }

    if api_key.trim().is_empty() {
        return Err("API key khali hai — Settings mein NVIDIA key daalein.".into());
    }
    if model.trim().is_empty() {
        return Err("Koi model select nahi hua.".into());
    }

    // 0 ya kisi wajah se invalid ho to default par gir jao — kabhi crash
    // na ho sirf is wajah se ke frontend ne 0 bhej diya.
    let port = if port == 0 { config::DEFAULT_PORT } else { port };

    let script = write_script_to_temp()?;
    let env = proxy_env(port, &api_key, &model, &small_model);

    // node_path khali ho to pehle bundled sidecar try karo. Sidecar staged
    // na ho (abhi `pnpm fetch:node` nahi chalaya) to system Node par gir
    // jaate hain — dev ke liye convenient.
    if node_path.trim().is_empty() {
        if let Ok(mut sidecar) = app.shell().sidecar("node") {
            sidecar = sidecar.arg(script.to_string_lossy().to_string());
            for (k, v) in &env {
                sidecar = sidecar.env(*k, v);
            }

            match sidecar.spawn() {
                Ok((mut rx, child)) => {
                    let app_events = app.clone();
                    tauri::async_runtime::spawn(async move {
                        while let Some(event) = rx.recv().await {
                            match event {
                                CommandEvent::Stdout(bytes) => {
                                    for line in String::from_utf8_lossy(&bytes).lines() {
                                        emit_log(&app_events, classify(line), line.to_string());
                                    }
                                }
                                CommandEvent::Stderr(bytes) => {
                                    for line in String::from_utf8_lossy(&bytes).lines() {
                                        emit_log(&app_events, "error", line.to_string());
                                    }
                                }
                                CommandEvent::Error(msg) => emit_log(&app_events, "error", msg),
                                CommandEvent::Terminated(_) => {
                                    let state: State<ProxyState> = app_events.state();
                                    *state.0.lock().unwrap() = None;
                                    let _ = app_events.emit("proxy://exit", ());
                                    break;
                                }
                                _ => {}
                            }
                        }
                    });

                    let mut guard = state.0.lock().unwrap();
                    *guard = Some(RunningProxy::Sidecar(child));
                    return Ok(());
                }
                Err(e) => {
                    emit_log(
                        &app,
                        "warn",
                        format!(
                            "Bundled Node start nahi hua ({e}) — system Node try kar raha hoon."
                        ),
                    );
                }
            }
        } else {
            emit_log(
                &app,
                "warn",
                "Bundled Node nahi mila (`pnpm fetch:node` nahi chalaya gaya) — system Node use kar raha hoon.",
            );
        }
    }

    // ---- system Node fallback ----
    let node = if node_path.trim().is_empty() {
        "node".to_string()
    } else {
        node_path.trim().to_string()
    };

    let mut cmd = Command::new(&node);
    cmd.arg(&script)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());

    for (k, v) in &env {
        cmd.env(k, v);
    }

    // Windows par console window flash na ho
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }

    let mut child = cmd.spawn().map_err(|e| {
        format!(
            "`{node}` start nahi hua: {e}\n\n\
             Node {}+ install hai? Settings mein poora path bhi de sakte hain, \
             ya `pnpm fetch:node` chala kar bundled Node stage karein.",
            config::MIN_NODE_MAJOR
        )
    })?;

    let stdout = child.stdout.take().ok_or("stdout capture nahi hua")?;
    let stderr = child.stderr.take().ok_or("stderr capture nahi hua")?;

    {
        let app = app.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                let level = classify(&line);
                emit_log(&app, level, line);
            }
            let _ = app.emit("proxy://exit", ());
        });
    }

    {
        let app = app.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                emit_log(&app, "error", line);
            }
        });
    }

    let mut guard = state.0.lock().unwrap();
    *guard = Some(RunningProxy::System(child));
    Ok(())
}

#[tauri::command]
pub fn stop_proxy(app: AppHandle, state: State<'_, ProxyState>) -> Result<(), String> {
    let mut guard = state.0.lock().unwrap();

    match guard.take() {
        Some(RunningProxy::System(mut child)) => {
            let _ = child.kill();
            let _ = child.wait();
        }
        Some(RunningProxy::Sidecar(child)) => {
            let _ = child.kill();
        }
        None => return Err("Proxy chal hi nahi raha.".into()),
    }

    emit_log(&app, "warn", "Proxy rok diya gaya.");
    let _ = app.emit("proxy://exit", ());
    Ok(())
}

/// App band hote waqt orphan process na chhode.
pub fn kill_if_running(app: &AppHandle) {
    let state: State<ProxyState> = app.state();
    let mut guard = state.0.lock().unwrap();

    match guard.take() {
        Some(RunningProxy::System(mut child)) => {
            let _ = child.kill();
            let _ = child.wait();
        }
        Some(RunningProxy::Sidecar(child)) => {
            let _ = child.kill();
        }
        None => {}
    }
}
