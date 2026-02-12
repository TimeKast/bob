// Types for Antigravity Monitor

export type InstanceStatus = 'idle' | 'working' | 'error' | 'complete' | 'disabled' | 'blocked';

export interface Instance {
    id: string;
    windowTitle: string;
    windowHandle: number;
    projectPath: string;
    projectName: string;
    enabled: boolean;
    customPrompt?: string;
    currentIssue: number;
    totalIssues: number;
    retryCount: number;
    maxRetries: number;
    status: InstanceStatus;
    lastActivity: number;
    stepCount: number;
    // New fields for auto-implementation
    lastResponse?: string;
    isBlocked?: boolean;
    blockReason?: string;
    issuesCompleted?: number;
    lastPromptSent?: number;  // Timestamp of last prompt sent (for inactivity timeout)
    stepIndexAtLastPrompt?: number;  // Step index when last prompt was sent
    noAdvanceCount?: number;  // How many times we detected idle without step advancement
    // Silent mode fields
    connectionMode?: 'silent' | 'legacy';  // 'silent' = via companion extension, 'legacy' = via PowerShell
    silentWindowId?: string;  // WebSocket window ID of companion extension
    // Per-instance settings
    issuesPath?: string;  // Custom path to issues directory (overrides auto-detection)
}

export interface Settings {
    defaultPrompt: string;
    inactivitySeconds: number;
    maxRetries: number;
    discordWebhook: string;
    notifyOnComplete: boolean;
    notifyOnError: boolean;
    minimizeToTray: boolean;
    // New fields for auto-implementation
    autoPrompt: string;
    pollIntervalSeconds: number;
    stopConditions: string[];
    inactivityTimeoutMinutes: number;  // Minutes before stopping inactive project (default 20)
    promptSendDelaySeconds: number;  // Delay after sending prompt before next action (default 5)
    // Logging settings
    loggingEnabled: boolean;
    logFilePath: string;  // Path to log file (e.g., "C:/logs/antigravity.log")
    // Silent mode
    silentModePreferred: boolean;  // If true, prefer silent mode when extension is connected
    // Per-project overrides (persisted across restarts)
    projectOverrides: Record<string, { issuesPath?: string }>;
}

export interface ScanResult {
    windowTitle: string;
    windowHandle: number;
    processId: number;
}

// Stop condition detection result
export interface StopCondition {
    detected: boolean;
    condition: string;
    message: string;
}
