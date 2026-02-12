// BOB - Tauri Backend
// Cross-platform commands for Silent Mode operation
// Legacy PowerShell functions removed for macOS compatibility

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

// ─── Types ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanResult {
    #[serde(rename = "windowTitle")]
    pub window_title: String,
    #[serde(rename = "windowHandle")]
    pub window_handle: i64,
    #[serde(rename = "processId")]
    pub process_id: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InstanceStatus {
    pub status: String,
    #[serde(rename = "currentIssue")]
    pub current_issue: u32,
    #[serde(rename = "totalIssues")]
    pub total_issues: u32,
    #[serde(rename = "retryCount")]
    pub retry_count: u32,
    #[serde(rename = "lastActivity")]
    pub last_activity: u64,
    #[serde(rename = "stepCount")]
    pub step_count: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UIStateResult {
    #[serde(rename = "hasAcceptButton")]
    pub has_accept_button: bool,
    #[serde(rename = "hasEnterButton")]
    pub has_enter_button: bool,
    #[serde(rename = "hasRetryButton")]
    pub has_retry_button: bool,
    #[serde(rename = "isPaused")]
    pub is_paused: bool,
    #[serde(rename = "chatButtonColor")]
    pub chat_button_color: String,
    #[serde(rename = "acceptButtonX")]
    pub accept_button_x: i32,
    #[serde(rename = "acceptButtonY")]
    pub accept_button_y: i32,
    #[serde(rename = "enterButtonX")]
    pub enter_button_x: i32,
    #[serde(rename = "enterButtonY")]
    pub enter_button_y: i32,
    #[serde(rename = "retryButtonX")]
    pub retry_button_x: i32,
    #[serde(rename = "retryButtonY")]
    pub retry_button_y: i32,
    #[serde(rename = "isBottomButton")]
    pub is_bottom_button: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BacklogResult {
    #[serde(rename = "totalIssues", default)]
    pub total_issues: i32,
    #[serde(rename = "completedIssues", default)]
    pub completed_issues: i32,
    #[serde(rename = "currentIssue", default)]
    pub current_issue: String,
    #[serde(rename = "backlogPath", default)]
    pub backlog_path: String,
    pub error: Option<String>,
}

// ─── Legacy Stubs (for frontend compatibility) ─────────────────────────
// These return empty/default values since Silent Mode doesn't need them

/// Scan windows - returns empty in Silent Mode (use get_silent_extensions instead)
#[tauri::command]
fn scan_windows() -> Result<Vec<ScanResult>, String> {
    // Legacy mode removed - BOB now uses Silent Mode exclusively
    // The frontend should use get_silent_extensions for connected instances
    Ok(vec![])
}

/// Get instance status - stub for compatibility
#[tauri::command]
fn get_instance_status(_window_handle: i64) -> Result<InstanceStatus, String> {
    Ok(InstanceStatus {
        status: "idle".to_string(),
        current_issue: 0,
        total_issues: 0,
        retry_count: 0,
        last_activity: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        step_count: 0,
    })
}

/// Paste prompt - removed, use send_silent_action instead
#[tauri::command]
fn paste_prompt(
    _window_title: String,
    _prompt: String,
    _instance_id: String,
) -> Result<(), String> {
    Err("Legacy mode removed. Use Silent Mode with send_silent_action.".to_string())
}

/// Detect UI state - removed, use send_silent_action('getState') instead
#[tauri::command]
fn detect_ui_state(_window_handle: i64) -> Result<UIStateResult, String> {
    Ok(UIStateResult {
        has_accept_button: false,
        has_enter_button: false,
        has_retry_button: false,
        is_paused: false,
        chat_button_color: "none".to_string(),
        accept_button_x: 0,
        accept_button_y: 0,
        enter_button_x: 0,
        enter_button_y: 0,
        retry_button_x: 0,
        retry_button_y: 0,
        is_bottom_button: false,
        error: Some("Legacy mode removed. Use Silent Mode.".to_string()),
    })
}

/// Click button - removed
#[tauri::command]
fn click_button(_window_handle: i64, _screen_x: i32, _screen_y: i32) -> Result<bool, String> {
    Err("Legacy mode removed. Use Silent Mode with send_silent_action.".to_string())
}

/// Accept dialog - removed
#[tauri::command]
fn accept_dialog(_window_handle: i64) -> Result<bool, String> {
    Err("Legacy mode removed. Use Silent Mode with send_silent_action.".to_string())
}

/// Scroll to bottom - removed
#[tauri::command]
fn scroll_to_bottom(_window_handle: i64) -> Result<bool, String> {
    Err("Legacy mode removed. Use Silent Mode with send_silent_action.".to_string())
}

/// Write to chat - removed
#[tauri::command]
fn write_to_chat(_window_handle: i64, _prompt: String) -> Result<bool, String> {
    Err("Legacy mode removed. Use Silent Mode with send_silent_action.".to_string())
}

// ─── Cross-Platform Functions ──────────────────────────────────────────

/// Read backlog from project path (pure Rust, cross-platform)
#[tauri::command]
fn read_backlog(_app: tauri::AppHandle, project_path: String) -> Result<BacklogResult, String> {
    use std::fs;
    use std::path::Path;

    let project_path = Path::new(&project_path);

    // Find backlog directory
    let backlog_base = find_backlog_dir(project_path);

    let backlog_base = match backlog_base {
        Some(p) => p,
        None => {
            return Ok(BacklogResult {
                total_issues: 0,
                completed_issues: 0,
                current_issue: String::new(),
                backlog_path: String::new(),
                error: Some(format!("No backlog found in {:?}", project_path)),
            });
        }
    };

    // Find issues directory
    let issues_path = find_issues_dir(&backlog_base);

    let issues_path = match issues_path {
        Some(p) => p,
        None => {
            return Ok(BacklogResult {
                total_issues: 0,
                completed_issues: 0,
                current_issue: String::new(),
                backlog_path: backlog_base.to_string_lossy().to_string(),
                error: Some("No issues directory found".to_string()),
            });
        }
    };

    // Count issues
    let mut total_issues = 0;
    let mut completed_issues = 0;
    let mut first_incomplete: Option<String> = None;

    if let Ok(entries) = fs::read_dir(&issues_path) {
        let mut files: Vec<_> = entries
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().map(|ext| ext == "md").unwrap_or(false))
            .collect();

        files.sort_by(|a, b| a.file_name().cmp(&b.file_name()));

        for entry in files {
            total_issues += 1;
            let path = entry.path();

            if let Ok(content) = fs::read_to_string(&path) {
                let is_done = content.contains("Status:")
                    && (content.to_lowercase().contains("done")
                        || content.contains("Completado")
                        || content.contains("Complete")
                        || content.contains("✅")
                        || content.contains("Hecho")
                        || content.contains("Terminado"));

                if is_done {
                    completed_issues += 1;
                } else if first_incomplete.is_none() {
                    if let Some(name) = path.file_stem() {
                        let name = name.to_string_lossy();
                        let re_match: Vec<&str> = name
                            .split(|c: char| !c.is_alphanumeric() && c != '-')
                            .collect();
                        if !re_match.is_empty() {
                            first_incomplete = Some(re_match[0].to_string());
                        }
                    }
                }
            }
        }
    }

    Ok(BacklogResult {
        total_issues,
        completed_issues,
        current_issue: first_incomplete.unwrap_or_else(|| {
            if total_issues > 0 && completed_issues == total_issues {
                "DONE".to_string()
            } else {
                String::new()
            }
        }),
        backlog_path: issues_path.to_string_lossy().to_string(),
        error: None,
    })
}

/// Find backlog directory - tries multiple patterns
fn find_backlog_dir(project_path: &std::path::Path) -> Option<std::path::PathBuf> {
    use std::fs;

    // Pattern 1: docs/backlog (flat)
    let direct = project_path.join("docs").join("backlog");
    if direct.exists() {
        return Some(direct);
    }

    // Pattern 2: docs/*/backlog (nested)
    if let Ok(entries) = fs::read_dir(project_path.join("docs")) {
        for entry in entries.filter_map(|e| e.ok()) {
            if entry.path().is_dir() {
                let nested = entry.path().join("backlog");
                if nested.exists() {
                    return Some(nested);
                }
            }
        }
    }

    None
}

/// Find issues directory - checks for version folders or flat structure
fn find_issues_dir(backlog_base: &std::path::Path) -> Option<std::path::PathBuf> {
    use std::fs;

    // Check for version folders (v1.0, v2.0, etc.)
    if let Ok(entries) = fs::read_dir(backlog_base) {
        let mut version_dirs: Vec<_> = entries
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_dir() && e.file_name().to_string_lossy().starts_with('v'))
            .collect();

        version_dirs.sort_by(|a, b| b.file_name().cmp(&a.file_name()));

        if let Some(latest) = version_dirs.first() {
            let issues = latest.path().join("issues");
            if issues.exists() {
                return Some(issues);
            }
        }
    }

    // Fallback: issues folder directly in backlog
    let flat = backlog_base.join("issues");
    if flat.exists() {
        return Some(flat);
    }

    None
}

/// Read backlog directly from a specific issues directory path (no auto-discovery)
#[tauri::command]
fn read_backlog_direct(_app: tauri::AppHandle, issues_path: String) -> Result<BacklogResult, String> {
    use std::fs;
    use std::path::Path;

    let issues_path = Path::new(&issues_path);

    if !issues_path.exists() {
        return Ok(BacklogResult {
            total_issues: 0,
            completed_issues: 0,
            current_issue: String::new(),
            backlog_path: issues_path.to_string_lossy().to_string(),
            error: Some(format!("Issues path does not exist: {:?}", issues_path)),
        });
    }

    let mut total_issues = 0;
    let mut completed_issues = 0;
    let mut first_incomplete: Option<String> = None;

    if let Ok(entries) = fs::read_dir(issues_path) {
        let mut files: Vec<_> = entries
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().map(|ext| ext == "md").unwrap_or(false))
            .collect();

        files.sort_by(|a, b| a.file_name().cmp(&b.file_name()));

        for entry in files {
            total_issues += 1;
            let path = entry.path();

            if let Ok(content) = fs::read_to_string(&path) {
                let is_done = content.contains("Status:")
                    && (content.to_lowercase().contains("done")
                        || content.contains("Completado")
                        || content.contains("Complete")
                        || content.contains("✅")
                        || content.contains("Hecho")
                        || content.contains("Terminado"));

                if is_done {
                    completed_issues += 1;
                } else if first_incomplete.is_none() {
                    if let Some(name) = path.file_stem() {
                        let name = name.to_string_lossy();
                        let re_match: Vec<&str> = name
                            .split(|c: char| !c.is_alphanumeric() && c != '-')
                            .collect();
                        if !re_match.is_empty() {
                            first_incomplete = Some(re_match[0].to_string());
                        }
                    }
                }
            }
        }
    }

    Ok(BacklogResult {
        total_issues,
        completed_issues,
        current_issue: first_incomplete.unwrap_or_else(|| {
            if total_issues > 0 && completed_issues == total_issues {
                "DONE".to_string()
            } else {
                String::new()
            }
        }),
        backlog_path: issues_path.to_string_lossy().to_string(),
        error: None,
    })
}

/// Send a notification to Discord webhook
#[tauri::command]
async fn notify_discord(webhook_url: String, title: String, message: String) -> Result<(), String> {
    let client = reqwest::Client::new();
    let payload = serde_json::json!({
        "embeds": [{
            "title": title,
            "description": message,
            "color": 0x00ff88
        }]
    });

    client
        .post(&webhook_url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to send Discord notification: {}", e))?;

    Ok(())
}

/// Write a log entry to file
#[tauri::command]
fn write_log(log_path: String, level: String, message: String) -> Result<(), String> {
    use std::fs::OpenOptions;
    use std::io::Write;

    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
    let log_line = format!("[{}] [{}] {}\n", timestamp, level, message);

    let path = std::path::Path::new(&log_path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create log directory: {}", e))?;
    }

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|e| format!("Failed to open log file: {}", e))?;

    file.write_all(log_line.as_bytes())
        .map_err(|e| format!("Failed to write to log: {}", e))?;

    Ok(())
}

// ─── Silent Mode / WebSocket Functions ─────────────────────────────────

mod ws_server;

/// Get list of connected silent-mode extensions
#[tauri::command]
async fn get_silent_extensions(
    state: tauri::State<'_, ws_server::ExtensionRegistry>,
) -> Result<Vec<serde_json::Value>, String> {
    let extensions = ws_server::get_connected_extensions(&state).await;
    let result: Vec<serde_json::Value> = extensions
        .into_iter()
        .map(|(window_id, workspace_name, workspace_path, last_state)| {
            serde_json::json!({
                "windowId": window_id,
                "workspaceName": workspace_name,
                "workspacePath": workspace_path,
                "state": last_state,
            })
        })
        .collect();
    Ok(result)
}

/// Send an action to a connected extension (silent mode)
#[tauri::command]
async fn send_silent_action(
    state: tauri::State<'_, ws_server::ExtensionRegistry>,
    window_id: String,
    action: String,
    payload: Option<serde_json::Value>,
) -> Result<bool, String> {
    let msg = ws_server::WsMessage {
        msg_type: action,
        payload: payload.unwrap_or(serde_json::Value::Null),
        id: format!(
            "action-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        ),
    };
    ws_server::send_to_extension(&state, &window_id, msg).await?;
    Ok(true)
}

/// Simulate Enter key press (cross-platform)
#[tauri::command]
fn simulate_enter() -> Result<bool, String> {
    use enigo::{Direction, Enigo, Key, Keyboard, Settings};

    let mut enigo =
        Enigo::new(&Settings::default()).map_err(|e| format!("Failed to create Enigo: {}", e))?;

    // Alt+Enter for Antigravity send
    enigo
        .key(Key::Alt, Direction::Press)
        .map_err(|e| format!("Failed to press Alt: {}", e))?;
    enigo
        .key(Key::Return, Direction::Click)
        .map_err(|e| format!("Failed to press Enter: {}", e))?;
    enigo
        .key(Key::Alt, Direction::Release)
        .map_err(|e| format!("Failed to release Alt: {}", e))?;

    Ok(true)
}

// ─── Extension Installation ────────────────────────────────────────────

/// Get the path to the bundled extension
fn get_extension_path() -> PathBuf {
    if cfg!(debug_assertions) {
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("bob-helper.vsix")
    } else {
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.to_path_buf()))
            .map(|d| d.join("resources").join("bob-helper.vsix"))
            .unwrap_or_else(|| PathBuf::from("resources/bob-helper.vsix"))
    }
}

/// Check if the BOB Helper extension is installed
#[tauri::command]
fn check_extension_installed() -> Result<bool, String> {
    // Check for antigravity CLI first, then fall back to code
    let tools = ["antigravity", "code"];

    for tool in &tools {
        let output = std::process::Command::new(tool)
            .args(["--list-extensions"])
            .output();

        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.contains("bob-helper") {
                return Ok(true);
            }
        }
    }

    Ok(false)
}

/// Install the BOB Helper extension
#[tauri::command]
fn install_extension() -> Result<bool, String> {
    let vsix_path = get_extension_path();

    if !vsix_path.exists() {
        return Err(format!("Extension file not found at {:?}", vsix_path));
    }

    // Try antigravity first, then code
    let tools = ["antigravity", "code"];

    for tool in &tools {
        let result = std::process::Command::new(tool)
            .args(["--install-extension", vsix_path.to_str().unwrap_or("")])
            .output();

        if let Ok(output) = result {
            if output.status.success() {
                return Ok(true);
            }
        }
    }

    Err("Failed to install extension. Make sure Antigravity or VS Code is in PATH.".to_string())
}

// ─── App Entry Point ───────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_user_input::init())
        .setup(|app| {
            // Start WebSocket server for companion extension communication
            let registry = ws_server::start_ws_server(9876);
            app.manage(registry);
            println!("[BOB] WebSocket server started on ws://localhost:9876");
            println!("[BOB] Running in Silent Mode only (cross-platform)");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Legacy stubs (for frontend compatibility)
            scan_windows,
            get_instance_status,
            paste_prompt,
            detect_ui_state,
            click_button,
            accept_dialog,
            scroll_to_bottom,
            write_to_chat,
            // Cross-platform functions
            read_backlog,
            read_backlog_direct,
            write_log,
            notify_discord,
            // Silent Mode
            get_silent_extensions,
            send_silent_action,
            simulate_enter,
            // Extension management
            check_extension_installed,
            install_extension
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
