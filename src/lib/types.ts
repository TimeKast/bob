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
    issuesPathDev?: string; // Explicit path for dev issues
    issuesPathSupport?: string; // Explicit path for support issues
    developmentMode?: boolean; // Separate folder for dev issues
    supportMode?: boolean; // Separate folder for support issues
    githubRepo?: string; // Legacy field (kept for potential migration, or can be removed if we migrate data)
    githubRepoSupport?: string; // GitHub repository (owner/repo) for support mode
    githubRepoDev?: string; // GitHub repository (owner/repo) for dev mode
    currentIssueBody?: string; // Body of the current issue (for context)
    currentIssueTitle?: string; // Title of the current issue (e.g. "#123 Title")
    lastInProgressUpdate?: number; // Timestamp of last "in-progress" update to GitHub

    // Mode-specific configuration
    customPromptDev?: string;
    customPromptSupport?: string;

    // Separate stats for modes
    issuesDev?: {
        current: number;
        total: number;
        completed: number;
        title?: string;
        body?: string;
    };
    issuesSupport?: {
        current: number;
        total: number;
        completed: number;
        title?: string;
        body?: string;
    };
}

export interface Settings {
    defaultPrompt: string;
    defaultSupportPrompt: string;
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
    // GitHub Integration
    githubToken?: string;
    // Per-project overrides (persisted across restarts)
    projectOverrides: Record<string, {
        issuesPath?: string;
        issuesPathDev?: string;
        issuesPathSupport?: string;
        customPrompt?: string;
        enabled?: boolean;
        developmentMode?: boolean;
        supportMode?: boolean;
        githubRepo?: string;
        githubRepoSupport?: string;
        githubRepoDev?: string;
        customPromptDev?: string;
        customPromptSupport?: string;
    }>;
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
