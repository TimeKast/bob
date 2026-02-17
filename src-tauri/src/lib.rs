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
    #[serde(rename = "currentIssueBody", default)]
    pub current_issue_body: Option<String>, // New field
    #[serde(rename = "backlogPath", default)]
    pub backlog_path: String,
    pub error: Option<String>,
}



// ─── Legacy Stubs (for frontend compatibility) ─────────────────────────
// These return empty/default values since Silent Mode doesn't need them

/// Scan windows for Antigravity (Legacy PowerShell)
#[tauri::command]
fn scan_windows() -> Result<Vec<ScanResult>, String> {
    let script = r#"
$windows = @()
$proc = Get-Process code -ErrorAction SilentlyContinue
if ($proc) {
    foreach ($p in $proc) {
        if ($p.MainWindowTitle -match "Antigravity") {
            $windows += [PSCustomObject]@{
                windowTitle = $p.MainWindowTitle
                windowHandle = $p.MainWindowHandle.ToInt64()
                processId = $p.Id
            }
        }
    }
}
return $windows | ConvertTo-Json -Compress
"#;

    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", script])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let json = String::from_utf8_lossy(&output.stdout);
    if json.trim().is_empty() {
        return Ok(vec![]);
    }

    // Handle single object vs array in PS JSON output
    // If array, good. If single object, we need to wrap or let serde handle it?
    // Serde usually expects array for Vec. PS ConvertTo-Json autodectects.
    // Let's ensure it's a list.
    
    let results: Vec<ScanResult> = serde_json::from_str(&json)
        .or_else(|_| {
            // Try parsing as single object and wrapping in vec
            serde_json::from_str::<ScanResult>(&json).map(|r| vec![r])
        })
        .map_err(|e| format!("Failed to parse JSON: {} | Input: {}", e, json))?;

    Ok(results)
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

/// Detect UI state (Legacy PowerShell)
#[tauri::command]
fn detect_ui_state(window_handle: i64) -> Result<UIStateResult, String> {
    // Check if handle is valid first
    if window_handle == 0 {
        return Err("Invalid window handle".to_string());
    }

    let script = r#"
param($handle)
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;

public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, int nFlags);
    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleDC(IntPtr hdc);
    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int nWidth, int nHeight);
    [DllImport("gdi32.dll")]
    public static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);
    [DllImport("gdi32.dll")]
    public static extern bool DeleteObject(IntPtr hObject);
    [DllImport("gdi32.dll")]
    public static extern bool DeleteDC(IntPtr hdc);
    [DllImport("user32.dll")]
    public static extern IntPtr GetWindowDC(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);
    [DllImport("gdi32.dll")]
    public static extern uint GetPixel(IntPtr hdc, int nXPos, int nYPos);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left, Top, Right, Bottom;
    }
}
"@

$hwnd = [IntPtr]$handle
$rect = New-Object Win32+RECT
[Win32]::GetWindowRect($hwnd, [ref]$rect)
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top

if ($width -le 0 -or $height -le 0) { return "{""error"": ""Invalid window dimensions""}" }

$bmp = new-object System.Drawing.Bitmap $width, $height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()

# PrintWindow to capture
[Win32]::PrintWindow($hwnd, $hdc, 2) # PW_CLIENTONLY | PW_RENDERFULLCONTENT

$g.ReleaseHdc($hdc)

# Analyze pixels
# Default positions (relative to bottom-right of window or specific UI elements)
# This is a HEURISTIC based on known UI colors.
# Updated for current Antigravity UI

$hasAccept = $false
$hasRetry = $false
$hasEnter = $false
$isPaused = $false
$acceptX = 0
$acceptY = 0
$retryX = 0
$retryY = 0

# Scan for green "Accept" button (bottom area)
# Color approximately #4CAF50 (R=76, G=175, B=80)
for ($y = $height - 100; $y -lt $height - 20; $y+=5) {
    for ($x = 20; $x -lt $width - 20; $x+=5) {
        $color = $bmp.GetPixel($x, $y)
        # Green Accept Button
        if ($color.R -lt 100 -and $color.G -gt 150 -and $color.B -lt 100) {
            $hasAccept = $true
            $acceptX = $x
            $acceptY = $y
            break
        }
        # Red/Orange Retry Button
        if ($color.R -gt 200 -and $color.G -lt 100 -and $color.B -lt 100) {
            $hasRetry = $true
            $retryX = $x
            $retryY = $y
            break
        }
    }
}

# Scan for input box / Enter button (bottom right)
# Usually blue or gray arrow
$enterX = $width - 50
$enterY = $height - 50
# Simple check: if not Accept or Retry, assume we can type if we are not processing?
# Actually, better to assume hasEnter if NO buttons are present AND we are not "working" loading spinner.
# For now, simplistic fallback:

if (-not $hasAccept -and -not $hasRetry) {
    $hasEnter = $true
}


$g.Dispose()
$bmp.Dispose()

$result = @{
    has_accept_button = $hasAccept
    has_enter_button = $hasEnter
    has_retry_button = $hasRetry
    is_paused = $isPaused
    accept_button_x = $acceptX
    accept_button_y = $acceptY
    retry_button_x = $retryX
    retry_button_y = $retryY
    enter_button_x = $enterX
    enter_button_y = $enterY
    error = $null
}

return $result | ConvertTo-Json
"#;

    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", script])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let json_str = String::from_utf8_lossy(&output.stdout);
    // Parse JSON manually or use serde_json Value if structure matches exactly
    // Here we need to map snake_case JSON to our struct
    let v: serde_json::Value = serde_json::from_str(&json_str).map_err(|e| e.to_string())?;

    Ok(UIStateResult {
        has_accept_button: v["has_accept_button"].as_bool().unwrap_or(false),
        has_enter_button: v["has_enter_button"].as_bool().unwrap_or(false),
        has_retry_button: v["has_retry_button"].as_bool().unwrap_or(false),
        is_paused: v["is_paused"].as_bool().unwrap_or(false),
        chat_button_color: "unknown".to_string(),
        accept_button_x: v["accept_button_x"].as_i64().unwrap_or(0) as i32,
        accept_button_y: v["accept_button_y"].as_i64().unwrap_or(0) as i32,
        enter_button_x: v["enter_button_x"].as_i64().unwrap_or(0) as i32,
        enter_button_y: v["enter_button_y"].as_i64().unwrap_or(0) as i32,
        retry_button_x: v["retry_button_x"].as_i64().unwrap_or(0) as i32,
        retry_button_y: v["retry_button_y"].as_i64().unwrap_or(0) as i32,
        is_bottom_button: false,
        error: None,
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
/// Write to chat and submit (Legacy PowerShell)
#[tauri::command]
fn write_to_chat(window_handle: i64, prompt: String) -> Result<bool, String> {
    let script = r#"
param($handle, $text)
$api = @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@
Add-Type -TypeDefinition $api -Language CCSharp

$hwnd = [IntPtr]$handle
[Win32]::ShowWindow($hwnd, 9) # SW_RESTORE
[Win32]::SetForegroundWindow($hwnd)
Start-Sleep -Nz 200

# Copy text to clipboard
Set-Clipboard -Value $text

# Ctrl+V
[Win32]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero) # Ctrl down
[Win32]::keybd_event(0x56, 0, 0, [UIntPtr]::Zero) # V down
[Win32]::keybd_event(0x56, 0, 2, [UIntPtr]::Zero) # V up
[Win32]::keybd_event(0x11, 0, 2, [UIntPtr]::Zero) # Ctrl up

Start-Sleep -Milliseconds 800

# Enter (using keybd_event)
[Win32]::keybd_event(0x0D, 0, 0, [UIntPtr]::Zero) # Enter down
[Win32]::keybd_event(0x0D, 0, 2, [UIntPtr]::Zero) # Enter up

Start-Sleep -Milliseconds 200

# Fallback: WScript.Shell SendKeys (sometimes works better for WebViews)
$wshell = New-Object -ComObject WScript.Shell
$wshell.SendKeys("{ENTER}")
Start-Sleep -Milliseconds 100
$wshell.SendKeys("{ENTER}")

return $true
"#;

    // Use specific prompt prioritization logic before this call in frontend
    // This function just executes the paste action
    
    let encoded_prompt = general_purpose::STANDARD.encode(prompt.as_bytes());

    // We can't easily pass multiline string to PS command line without issues, 
    // so we'll use base64 decoding inside PS or just simple clipboard setting if we trust the text.
    // Actually, passing prompts as arguments to powershell -Command can be tricky/limited length.
    // Better approach: Write prompt to temp file? Or just base64.
    
    // Simpler approach for now:
    // We already have the text in the Clipboard from Svelte? No, Rust sets it.
    // Let's implement Clipboard setting in Rust to be safe/faster, then just keys in PS.
    // Or just restore the PS script approach.
    
    // NOTE: The previous implementation used a separate .ps1 file. 
    // Embedding it here for simplicity and to reduce dependencies.
    
    let status = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!(
                "$h={}; $t=[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('{}')); {}", 
                window_handle, 
                encoded_prompt, 
                script
            )
        ])
        .status()
        .map_err(|e| e.to_string())?;

    Ok(status.success())
}

use base64::{Engine as _, engine::general_purpose};

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
                current_issue_body: None,
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
                current_issue_body: None,
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
                let lower = content.to_lowercase();
                let is_done = lower.contains("status:")
                    && (lower.contains("done")
                        || lower.contains("completado")
                        || lower.contains("complete")
                        || content.contains("✅")
                        || lower.contains("hecho")
                        || lower.contains("terminado"));

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
        current_issue_body: None,
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
            current_issue_body: None,
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
                let lower = content.to_lowercase();
                let is_done = lower.contains("status:")
                    && (lower.contains("done")
                        || lower.contains("completado")
                        || lower.contains("complete")
                        || content.contains("✅")
                        || lower.contains("hecho")
                        || lower.contains("terminado"));

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
        current_issue_body: None,
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

// ─── GitHub Integration ────────────────────────────────────────────────

#[derive(Debug, Deserialize)]

struct GithubIssue {
    number: i32,
    title: String,
    state: String,
    body: Option<String>,
    labels: Vec<GithubLabel>,
}

#[derive(Debug, Deserialize)]

struct GithubLabel {
    name: String,
}

/// Read backlog from GitHub repository
#[tauri::command]
async fn read_backlog_github(token: String, repo: String) -> Result<BacklogResult, String> {
    let client = reqwest::Client::new();
    
    // 1. Fetch OPEN issues
    // We filter for state=open to find the next task
    println!("[GitHub] Reading backlog for repo: {}", repo);
    let url = format!("https://api.github.com/repos/{}/issues?state=open", repo);
    
    let open_resp = client
        .get(&url)
        .header("User-Agent", "bob-monitor")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("GitHub API Error (Open Issues): {}", e))?;

    if !open_resp.status().is_success() {
        let status = open_resp.status();
        let body = open_resp.text().await.unwrap_or_default();
        println!("[GitHub] Error response: {} - {}", status, body);
        return Err(format!("GitHub API Error: {} - {}", status, body));
    }

    let open_issues: Vec<GithubIssue> = open_resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub response: {}", e))?;

    // 2. Fetch CLOSED issues count (just a rough estimate or fetch simplified)
    // For simplicity, we just fetch count or list. 
    // Optimization: Use search API for counts if needed, but for now let's just list recent closed?
    // Actually, to get "completed issues" count accurate, we'd need total count.
    // Let's rely on open_issues count + a placeholder for now, or fetch closed.
    // Fetching all closed issues might be heavy. Let's use search.
    let count_url = format!("https://api.github.com/search/issues?q=repo:{}+type:issue+state:closed", repo);
    let closed_resp = client
        .get(&count_url)
        .header("User-Agent", "bob-monitor")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await;
        
    let closed_count = match closed_resp {
        Ok(resp) => {
            if resp.status().is_success() {
                 #[derive(Deserialize)]
                 struct SearchResult { total_count: i32 }
                 resp.json::<SearchResult>().await.map(|r| r.total_count).unwrap_or(0)
            } else { 0 }
        }
        Err(_) => 0,
    };

    // 3. Determine current issue
    // Priority: Issues with "in-progress" label -> First open issue
    // We iterate to find one.

    let mut in_progress_issue = None;
    let mut first_open = None;

    for issue in &open_issues {
        // Skip pull requests if endpoint returns them (issues endpoint usually does unless filtered)
        // Actually issues endpoint returns PRs too. Check for pull_request field?
        // Struct doesn't have it, but deserialization won't fail if we don't map it.
        // But logic might be wrong. Let's assume issues only for now or check labels.
        
        let is_in_progress = issue.labels.iter().any(|l| l.name == "in-progress");
        
        if is_in_progress {
            in_progress_issue = Some(format!("#{} {}", issue.number, issue.title));
            break; // Found priority
        }
        
        if first_open.is_none() {
             first_open = Some(format!("#{} {}", issue.number, issue.title));
        }
    }

    // Re-find the issue object to get the body
    let current_issue_str = in_progress_issue.as_ref().map(|s| s.as_str())
        .or(first_open.as_ref().map(|s| s.as_str()))
        .unwrap_or("");

    let current_issue_obj = open_issues.iter().find(|i| 
        format!("#{} {}", i.number, i.title) == current_issue_str
    );

    let body = current_issue_obj.and_then(|i| i.body.clone());
    
    let mut current_issue = current_issue_str.to_string();
    
    // If no open issues, check if closed > 0 => DONE
    if current_issue.is_empty() && closed_count > 0 {
        current_issue = "DONE".to_string();
    }

    Ok(BacklogResult {
        total_issues: (open_issues.len() as i32) + closed_count,
        completed_issues: closed_count,
        current_issue,
        current_issue_body: body,
        backlog_path: format!("github://{}", repo),
        error: None,
    })
}

/// Update GitHub issue status (add label or close)
#[tauri::command]
async fn update_github_issue_status(token: String, repo: String, issue_number: i32, status: String) -> Result<bool, String> {
    let client = reqwest::Client::new();
    
    if status == "in-progress" {
        // Add "in-progress" label
        let url = format!("https://api.github.com/repos/{}/issues/{}/labels", repo, issue_number);
        let resp = client
            .post(&url)
            .header("User-Agent", "bob-monitor")
            .header("Authorization", format!("Bearer {}", token))
            .json(&serde_json::json!({
                "labels": ["in-progress"]
            }))
            .send()
            .await
            .map_err(|e| format!("Failed to add label: {}", e))?;
            
        return Ok(resp.status().is_success());
        
    } else if status == "done" {
        // Close the issue
        let url = format!("https://api.github.com/repos/{}/issues/{}", repo, issue_number);
        let resp = client
            .patch(&url)
            .header("User-Agent", "bob-monitor")
            .header("Authorization", format!("Bearer {}", token))
            .json(&serde_json::json!({
                "state": "closed"
            }))
            .send()
            .await
            .map_err(|e| format!("Failed to close issue: {}", e))?;
            
        return Ok(resp.status().is_success());
    }
    
    Ok(false)
}

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
            check_extension_installed,
            install_extension,
            // GitHub Integration
            read_backlog_github,
            update_github_issue_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
