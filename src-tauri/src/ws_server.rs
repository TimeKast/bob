// BOB — WebSocket Server for Companion Extension Communication
// This module runs a WebSocket server on localhost that companion extensions connect to.
// It acts as a bridge between BOB's frontend (Svelte) and the Antigravity extensions.
//
// IMPORTANT: We use tauri::async_runtime::spawn instead of tokio::spawn because
// Tauri manages its own Tokio runtime. Direct tokio::spawn calls from setup()
// would panic with "no reactor running".

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::{mpsc, RwLock};
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;

// ─── Types ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsMessage {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub payload: serde_json::Value,
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionInfo {
    #[serde(rename = "windowId")]
    pub window_id: String,
    #[serde(rename = "workspaceName")]
    pub workspace_name: String,
    #[serde(rename = "workspacePath", default)]
    pub workspace_path: String,
    #[serde(rename = "extensionVersion")]
    pub extension_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AntigravityState {
    #[serde(rename = "hasAcceptButton")]
    pub has_accept_button: bool,
    #[serde(rename = "hasRetryButton")]
    pub has_retry_button: bool,
    #[serde(rename = "hasEnterButton")]
    pub has_enter_button: bool,
    #[serde(rename = "agentWorking")]
    pub agent_working: bool,
    #[serde(rename = "terminalPending")]
    pub terminal_pending: bool,
    #[serde(rename = "workspaceName")]
    pub workspace_name: String,
    #[serde(rename = "workspacePath", default)]
    pub workspace_path: String,
}

/// Represents a connected extension instance
#[derive(Debug)]
pub struct ConnectedExtension {
    info: ExtensionInfo,
    sender: mpsc::UnboundedSender<String>,
    last_state: Option<AntigravityState>,
}

/// Shared state for all connected extensions
pub type ExtensionRegistry = Arc<RwLock<HashMap<String, ConnectedExtension>>>;

// ─── Keyboard Simulation ────────────────────────────────────────────

/// Focus the Antigravity window containing the given workspace name (Windows only)
#[cfg(target_os = "windows")]
fn focus_antigravity_window(workspace_name: &str) -> Result<(), String> {
    use std::sync::Mutex;

    // Windows API bindings
    #[link(name = "user32")]
    extern "system" {
        fn SetForegroundWindow(hWnd: *mut std::ffi::c_void) -> i32;
        fn EnumWindows(
            lpEnumFunc: extern "system" fn(*mut std::ffi::c_void, isize) -> i32,
            lParam: isize,
        ) -> i32;
        fn GetWindowTextW(hWnd: *mut std::ffi::c_void, lpString: *mut u16, nMaxCount: i32) -> i32;
        fn IsWindowVisible(hWnd: *mut std::ffi::c_void) -> i32;
    }

    // Static storage for search term and result (needed for callback)
    static SEARCH_TERM: Mutex<String> = Mutex::new(String::new());
    static FOUND_HWND: Mutex<Option<usize>> = Mutex::new(None);

    // Set the search term
    *SEARCH_TERM.lock().unwrap() = workspace_name.to_string();
    *FOUND_HWND.lock().unwrap() = None;

    extern "system" fn enum_windows_callback(hwnd: *mut std::ffi::c_void, _: isize) -> i32 {
        unsafe {
            if IsWindowVisible(hwnd) == 0 {
                return 1;
            }

            let mut title: [u16; 512] = [0; 512];
            let len = GetWindowTextW(hwnd, title.as_mut_ptr(), 512);
            if len > 0 {
                let title_str = String::from_utf16_lossy(&title[..len as usize]);
                let search = SEARCH_TERM.lock().unwrap();

                // Match if title contains workspace name, "Antigravity", or "Visual Studio Code"
                let matches = (!search.is_empty() && title_str.contains(search.as_str()))
                    || title_str.contains("Antigravity")
                    || title_str.contains("Visual Studio Code");

                if matches {
                    println!("[focus_window] Found window: {}", title_str);
                    *FOUND_HWND.lock().unwrap() = Some(hwnd as usize);
                    return 0;
                }
            }
            1
        }
    }

    println!(
        "[focus_window] Searching for window with '{}' or 'Antigravity'...",
        workspace_name
    );

    unsafe {
        EnumWindows(enum_windows_callback, 0);
    }

    let hwnd_opt = *FOUND_HWND.lock().unwrap();
    if let Some(hwnd_val) = hwnd_opt {
        println!("[focus_window] Focusing window...");
        unsafe {
            SetForegroundWindow(hwnd_val as *mut std::ffi::c_void);
        }
        std::thread::sleep(std::time::Duration::from_millis(150));
        println!("[focus_window] Window focused");
        Ok(())
    } else {
        println!("[focus_window] Window not found!");
        Err("Window not found".to_string())
    }
}

/// Focus the Antigravity window containing the given workspace name (macOS)
#[cfg(target_os = "macos")]
fn focus_antigravity_window(workspace_name: &str) -> Result<(), String> {
    use std::process::Command;

    println!(
        "[focus_window] macOS: Searching for window with '{}' or 'Antigravity'...",
        workspace_name
    );

    let script = format!(
        r#"
        tell application "System Events"
            set targetWindow to missing value
            set allProcesses to every process whose background only is false
            
            repeat with proc in allProcesses
                set procName to name of proc as string
                if procName contains "Antigravity" or procName contains "Code" then
                    set allWindows to every window of proc
                    repeat with win in allWindows
                        set winName to name of win as string
                        if winName contains "{workspace}" or winName contains "Antigravity" then
                            set targetWindow to win
                            set frontmost of proc to true
                            exit repeat
                        end if
                    end repeat
                end if
                if targetWindow is not missing value then exit repeat
            end repeat
            
            if targetWindow is missing value then
                return "not found"
            else
                return "found"
            end if
        end tell
    "#,
        workspace = workspace_name
    );

    let output = Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| format!("Failed to execute osascript: {}", e))?;

    let result = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if result == "found" {
        println!("[focus_window] macOS: Window found and activated");
        std::thread::sleep(std::time::Duration::from_millis(150));
        Ok(())
    } else {
        println!("[focus_window] macOS: Window not found");
        Err("Window not found".to_string())
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn focus_antigravity_window(_workspace_name: &str) -> Result<(), String> {
    println!("[focus_window] Linux: No implementation, waiting...");
    std::thread::sleep(std::time::Duration::from_millis(200));
    Ok(())
}

/// Simulate Alt+Enter key press using enigo (Antigravity's send shortcut)
fn simulate_enter_key(workspace_name: &str) -> Result<(), String> {
    use enigo::{Direction, Enigo, Key, Keyboard, Settings};

    println!(
        "[simulate_enter_key] Starting Alt+Enter simulation for workspace: {}",
        workspace_name
    );

    // First, focus the Antigravity window
    if let Err(e) = focus_antigravity_window(workspace_name) {
        println!(
            "[simulate_enter_key] Warning: Could not focus window: {}",
            e
        );
    }

    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to create Enigo instance: {:?}", e))?;

    // Simulate Alt+Enter
    enigo
        .key(Key::Alt, Direction::Press)
        .map_err(|e| format!("Failed to press Alt: {:?}", e))?;

    std::thread::sleep(std::time::Duration::from_millis(50));

    enigo
        .key(Key::Return, Direction::Click)
        .map_err(|e| format!("Failed to simulate Enter key: {:?}", e))?;

    std::thread::sleep(std::time::Duration::from_millis(50));
    enigo
        .key(Key::Alt, Direction::Release)
        .map_err(|e| format!("Failed to release Alt: {:?}", e))?;

    println!("[simulate_enter_key] Alt+Enter simulated successfully");
    Ok(())
}

// ─── Server ─────────────────────────────────────────────────────────

/// Start the WebSocket server on the given port.
/// Returns the shared extension registry that the Tauri commands use to communicate.
pub fn start_ws_server(port: u16) -> ExtensionRegistry {
    let registry: ExtensionRegistry = Arc::new(RwLock::new(HashMap::new()));
    let registry_clone = registry.clone();

    tauri::async_runtime::spawn(async move {
        let addr = format!("127.0.0.1:{}", port);
        let listener = match TcpListener::bind(&addr).await {
            Ok(l) => {
                println!("[WS] Server listening on ws://{}", addr);
                l
            }
            Err(e) => {
                eprintln!("[WS] Failed to bind to {}: {}", addr, e);
                return;
            }
        };

        while let Ok((stream, peer_addr)) = listener.accept().await {
            println!("[WS] New connection from {}", peer_addr);
            let registry = registry_clone.clone();

            tokio::spawn(async move {
                let ws_stream = match accept_async(stream).await {
                    Ok(ws) => ws,
                    Err(e) => {
                        eprintln!("[WS] Handshake failed: {}", e);
                        return;
                    }
                };

                let (mut ws_sender, mut ws_receiver) = ws_stream.split();
                let (tx, mut rx) = mpsc::unbounded_channel::<String>();
                let mut window_id: Option<String> = None;

                // Task to forward outgoing messages
                let send_task = tokio::spawn(async move {
                    while let Some(msg) = rx.recv().await {
                        if ws_sender.send(Message::Text(msg)).await.is_err() {
                            break;
                        }
                    }
                });

                // Process incoming messages
                while let Some(msg) = ws_receiver.next().await {
                    match msg {
                        Ok(Message::Text(text)) => {
                            if let Ok(ws_msg) = serde_json::from_str::<WsMessage>(&text) {
                                match ws_msg.msg_type.as_str() {
                                    "hello" => {
                                        // Register this extension
                                        if let Ok(info) =
                                            serde_json::from_value::<ExtensionInfo>(ws_msg.payload)
                                        {
                                            let wid = info.window_id.clone();
                                            println!(
                                                "[WS] Extension registered: {} (wid: {}, path: {})",
                                                info.workspace_name, wid, info.workspace_path
                                            );

                                            let ext = ConnectedExtension {
                                                info,
                                                sender: tx.clone(),
                                                last_state: None,
                                            };
                                            registry.write().await.insert(wid.clone(), ext);
                                            window_id = Some(wid);
                                        }
                                    }
                                    "stateChanged" => {
                                        // Update cached state
                                        if let (Some(wid), Ok(state)) = (
                                            &window_id,
                                            serde_json::from_value::<AntigravityState>(
                                                ws_msg.payload,
                                            ),
                                        ) {
                                            if let Some(ext) = registry.write().await.get_mut(wid) {
                                                ext.last_state = Some(state);
                                            }
                                        }
                                    }
                                    "state" => {
                                        // Response from getState — update cached state
                                        if let Some(wid) = &window_id {
                                            println!(
                                                "[WS] [{}] State response received (id: {})",
                                                wid, ws_msg.id
                                            );
                                            // Parse and cache the state
                                            if let Ok(state) = serde_json::from_value::<AntigravityState>(
                                                ws_msg.payload.clone(),
                                            ) {
                                                println!(
                                                    "[WS] [{}] State: accept={}, retry={}, enter={}, working={}, terminal={}",
                                                    wid, state.has_accept_button, state.has_retry_button, 
                                                    state.has_enter_button, state.agent_working, state.terminal_pending
                                                );
                                                if let Some(ext) = registry.write().await.get_mut(wid) {
                                                    ext.last_state = Some(state);
                                                }
                                            }
                                        }
                                    }
                                    "result" | "error" | "pong" => {
                                        // Other responses from extension — just log
                                        if let Some(wid) = &window_id {
                                            println!(
                                                "[WS] [{}] Response: {} (id: {})",
                                                wid, ws_msg.msg_type, ws_msg.id
                                            );
                                        }
                                    }
                                    "simulateEnter" => {
                                        // Request to simulate Enter key press
                                        let workspace_name = ws_msg
                                            .payload
                                            .get("workspaceName")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("");

                                        println!(
                                            "[WS] simulateEnter received for workspace: {}",
                                            workspace_name
                                        );

                                        // Use enigo to simulate Enter key press
                                        match simulate_enter_key(workspace_name) {
                                            Ok(_) => {
                                                println!("[WS] Enter key simulated successfully")
                                            }
                                            Err(e) => eprintln!(
                                                "[WS] Failed to simulate Enter key: {}",
                                                e
                                            ),
                                        }
                                    }

                                    _ => {
                                        println!("[WS] Unknown message type: {}", ws_msg.msg_type);
                                    }
                                }
                            }
                        }
                        Ok(Message::Close(_)) => break,
                        Err(e) => {
                            eprintln!("[WS] Error: {}", e);
                            break;
                        }
                        _ => {}
                    }
                }

                // Cleanup on disconnect
                if let Some(wid) = window_id {
                    println!("[WS] Extension disconnected: {}", wid);
                    registry.write().await.remove(&wid);
                }
                send_task.abort();
            });
        }
    });

    registry
}

// ─── Commands (send messages to extensions) ─────────────────────────

/// Send a message to a specific extension and return its response.
/// Uses a simple request/response pattern with correlation IDs.
pub async fn send_to_extension(
    registry: &ExtensionRegistry,
    window_id: &str,
    msg: WsMessage,
) -> Result<(), String> {
    let extensions = registry.read().await;

    if let Some(ext) = extensions.get(window_id) {
        let json = serde_json::to_string(&msg).map_err(|e| e.to_string())?;
        ext.sender
            .send(json)
            .map_err(|e| format!("Send failed: {}", e))?;
        Ok(())
    } else {
        Err(format!("Extension not connected: {}", window_id))
    }
}

/// Get the list of connected extensions with their cached state
pub async fn get_connected_extensions(
    registry: &ExtensionRegistry,
) -> Vec<(String, String, String, Option<AntigravityState>)> {
    let extensions = registry.read().await;
    extensions
        .iter()
        .map(|(wid, ext)| {
            (
                wid.clone(),
                ext.info.workspace_name.clone(),
                ext.info.workspace_path.clone(),
                ext.last_state.clone(),
            )
        })
        .collect()
}

/// Broadcast a message to all connected extensions
pub async fn broadcast(registry: &ExtensionRegistry, msg: WsMessage) {
    let extensions = registry.read().await;
    let json = match serde_json::to_string(&msg) {
        Ok(j) => j,
        Err(_) => return,
    };

    for ext in extensions.values() {
        let _ = ext.sender.send(json.clone());
    }
}
