// Svelte stores for Antigravity Monitor state management

import { writable, get } from 'svelte/store';
import type { Instance, Settings } from './types';
import { invoke } from '@tauri-apps/api/core';
import { getSilentExtensions, matchExtensionToInstance, acceptAllSilent, acceptStepSilent, acceptTerminalSilent, sendPromptSilent, retrySilent, getStateSilent, type SilentExtension } from './websocket';

// Default settings
const defaultSettings: Settings = {
    defaultPrompt: 'Continúa con el siguiente paso',
    inactivitySeconds: 30,
    maxRetries: 3,
    discordWebhook: '',
    notifyOnComplete: true,
    notifyOnError: true,
    minimizeToTray: true,
    // Auto-implementation settings
    autoPrompt: 'Continúa con el siguiente paso del issue actual. Si no hay issue en progreso, ejecuta /implement con el siguiente issue P0/P1 del backlog. Si todos los issues están completados, responde exactamente: "✅ BACKLOG COMPLETADO".',
    pollIntervalSeconds: 5,  // Poll every 5 seconds (fast with WebSocket)
    stopConditions: [
        '🛑 STOP',
        '❌',
        'Architect Gating',
        'Blocked By',
        'ESCALAR',
        '✅ BACKLOG COMPLETADO'
    ],
    inactivityTimeoutMinutes: 20,  // Stop project if no prompt sent in 20 minutes
    // Logging settings
    loggingEnabled: true,
    logFilePath: '',  // Empty = use default location (app data dir)
    // Silent mode
    silentModePreferred: true  // If true, prefer silent mode when extension is connected
};

// Load settings from localStorage
function loadSettings(): Settings {
    if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem('bob-settings');
        if (saved) {
            return { ...defaultSettings, ...JSON.parse(saved) };
        }
    }
    return defaultSettings;
}

// Settings store with persistence
function createSettingsStore() {
    const { subscribe, set, update } = writable<Settings>(loadSettings());

    return {
        subscribe,
        set: (value: Settings) => {
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem('bob-settings', JSON.stringify(value));
            }
            set(value);
        },
        update
    };
}

export const settings = createSettingsStore();

// Logging utility - writes to file via Tauri backend
export const log = {
    async write(level: string, message: string): Promise<void> {
        const currentSettings = get(settings);
        if (!currentSettings.loggingEnabled) return;
        
        try {
            await invoke('write_log', {
                logPath: currentSettings.logFilePath,
                level,
                message
            });
        } catch (e) {
            console.error('[log] Failed to write log:', e);
        }
    },
    info: (msg: string) => log.write('INFO', msg),
    warn: (msg: string) => log.write('WARN', msg),
    error: (msg: string) => log.write('ERROR', msg),
    debug: (msg: string) => log.write('DEBUG', msg)
};

// Instances store
export const instances = writable<Instance[]>([]);

// Scan for Antigravity instances via Silent Mode (WebSocket connections)
export async function scanForInstances(): Promise<void> {
    try {
        // Get connected extensions via Silent Mode (cross-platform)
        const silentExtensions = await getSilentExtensions();
        await log.info(`Scan completed: found ${silentExtensions.length} connected extensions`);

        const currentInstances = get(instances);

        // Map silent extensions to Instance objects
        const newInstances: Instance[] = silentExtensions.map((ext) => {
            // Use workspacePath from extension, with windowId as handle
            const windowHandle = parseInt(ext.windowId.replace(/\D/g, '')) || Date.now();
            
            // Check if this instance already exists (by workspace name)
            const existing = currentInstances.find(i => 
                i.projectName.toLowerCase() === ext.workspaceName.toLowerCase()
            );

            if (existing) {
                return {
                    ...existing,
                    windowTitle: `${ext.workspaceName} - Antigravity`,
                    projectPath: ext.workspacePath || existing.projectPath,
                    connectionMode: 'silent' as const,
                    silentWindowId: ext.windowId,
                };
            }

            // Create new instance from silent extension
            return {
                id: `instance-${ext.windowId}`,
                windowTitle: `${ext.workspaceName} - Antigravity`,
                windowHandle: windowHandle,
                projectPath: ext.workspacePath || '',
                projectName: ext.workspaceName,
                enabled: false,
                currentIssue: 0,
                totalIssues: 0,
                retryCount: 0,
                maxRetries: get(settings).maxRetries,
                status: ext.state?.agentWorking ? 'working' : 'idle',
                lastActivity: Date.now(),
                stepCount: 0,
                connectionMode: 'silent' as const,
                silentWindowId: ext.windowId,
            };
        });

        instances.set(newInstances);
        
        // Update backlog info for each instance (wait for it to complete)
        await updateInstanceBacklogs();
    } catch (error) {
        console.error('Failed to scan for instances:', error);
        // Fallback: use mock data for development without Tauri
        if (import.meta.env.DEV) {
            instances.set([
                {
                    id: 'mock-1',
                    windowTitle: 'constela_back - Antigravity',
                    windowHandle: 12345,
                    projectPath: 'C:/Users/flevik/Proyectos/constela_back',
                    projectName: 'constela_back',
                    enabled: true,
                    currentIssue: 3,
                    totalIssues: 8,
                    retryCount: 0,
                    maxRetries: 3,
                    status: 'working',
                    lastActivity: Date.now() - 5000,
                    stepCount: 12
                },
                {
                    id: 'mock-2',
                    windowTitle: 'clawdbot - Visual Studio Code',
                    windowHandle: 67890,
                    projectPath: 'C:/Users/flevik/Proyectos/clawdbot',
                    projectName: 'clawdbot',
                    enabled: false,
                    currentIssue: 0,
                    totalIssues: 5,
                    retryCount: 0,
                    maxRetries: 3,
                    status: 'idle',
                    lastActivity: Date.now() - 60000,
                    stepCount: 0
                }
            ]);
        }
    }
}

// Update backlog information for all instances (async)
export async function updateInstanceBacklogs(): Promise<void> {
    const currentInstances = get(instances);
    console.log(`[Backlog] Updating ${currentInstances.length} instances...`);
    
    for (const instance of currentInstances) {
        try {
            console.log(`[${instance.projectName}] Reading backlog from: ${instance.projectPath}`);
            
            const backlog = await invoke<{
                totalIssues: number;
                completedIssues: number;
                currentIssue: string;
                error?: string;
            }>('read_backlog', { projectPath: instance.projectPath });
            
            console.log(`[${instance.projectName}] Backlog result:`, backlog);
            
            if (backlog && !backlog.error) {
                instances.update(list =>
                    list.map(i => i.id === instance.id
                        ? {
                            ...i,
                            totalIssues: backlog.totalIssues,
                            currentIssue: backlog.completedIssues,
                            issuesCompleted: backlog.completedIssues
                        }
                        : i
                    )
                );
                console.log(`[${instance.projectName}] ✅ Backlog: ${backlog.completedIssues}/${backlog.totalIssues}, current: ${backlog.currentIssue}`);
            } else if (backlog?.error) {
                console.warn(`[${instance.projectName}] Backlog error: ${backlog.error}`);
            }
        } catch (error) {
            console.warn(`[${instance.projectName}] Failed to read backlog:`, error);
        }
    }
}

// Update silent mode connections - match extensions to instances
export async function updateSilentModeConnections(): Promise<void> {
    const currentSettings = get(settings);
    if (!currentSettings.silentModePreferred) return;

    try {
        const extensions = await getSilentExtensions();
        console.log(`[Silent] Found ${extensions.length} connected extensions`);

        instances.update(list =>
            list.map(instance => {
                const match = matchExtensionToInstance(extensions, instance);
                if (match) {
                    console.log(`[Silent] ✅ ${instance.projectName} → extension ${match.windowId} (silent mode, path: ${match.workspacePath})`);
                    return {
                        ...instance,
                        connectionMode: 'silent' as const,
                        silentWindowId: match.windowId,
                        // Use workspace path from extension if available (for backlog detection)
                        projectPath: match.workspacePath || instance.projectPath,
                    };
                } else {
                    // No matching extension — use legacy mode
                    return {
                        ...instance,
                        connectionMode: 'legacy' as const,
                        silentWindowId: undefined,
                    };
                }
            })
        );
    } catch (error) {
        console.warn('[Silent] Failed to update connections:', error);
    }
}

// Refresh instances (update status, don't rescan)
export async function refreshInstances(): Promise<void> {
    const currentInstances = get(instances);

    for (const instance of currentInstances) {
        if (!instance.enabled) continue;

        try {
            // Call Tauri to get instance status
            const status = await invoke<InstanceStatus>('get_instance_status', {
                windowHandle: instance.windowHandle
            });

            // Don't overwrite fields managed by polling (stepCount, retryCount, backlog fields)
            // Only update status and lastActivity from get_instance_status
            instances.update(list =>
                list.map(i => i.id === instance.id ? { 
                    ...i, 
                    status: status.status,
                    lastActivity: status.lastActivity
                    // NOT including: stepCount, retryCount, totalIssues, currentIssue, issuesCompleted
                } : i)
            );
        } catch (error) {
            console.error(`Failed to refresh instance ${instance.id}:`, error);
        }
    }
}

// Helper: Extract project path from window title
function extractProjectPath(title: string): string {
    // Window title format: "projectName - Antigravity - Tab"
    const match = title.match(/^(.+?)\s*[-–]\s*Antigravity/);
    if (match) {
        const projectName = match[1].trim();
        // Build full path using known base directory
        // TODO: Make this configurable in settings
        return `C:\\Users\\flevik\\Proyectos Timekast\\${projectName}`;
    }
    return title;
}

// Helper: Extract project name from window title
function extractProjectName(title: string): string {
    const path = extractProjectPath(title);
    return path.split(/[/\\]/).pop() || path;
}

// Types for scan results
interface ScanResult {
    windowTitle: string;
    windowHandle: number;
    processId: number;
}

interface InstanceStatus {
    status: 'idle' | 'working' | 'error' | 'complete';
    currentIssue: number;
    totalIssues: number;
    retryCount: number;
    lastActivity: number;
    stepCount: number;
}

// UI Automation types
interface UIStateResult {
    hasAcceptButton: boolean;
    hasEnterButton: boolean;
    hasRetryButton: boolean;
    isPaused: boolean;  // True if agent is working (red button or unknown)
    chatButtonColor: string;  // "gray" = ready, "red" = working, "none" = unknown
    acceptButtonX: number;
    acceptButtonY: number;
    enterButtonX: number;
    enterButtonY: number;
    retryButtonX: number;
    retryButtonY: number;
    isBottomButton: boolean;  // True = Accept all (needs click), False = dialog (use Alt+Enter)
    error?: string;
}

// Detect UI state for a window
export async function detectUIState(windowHandle: number): Promise<UIStateResult | null> {
    try {
        const result = await invoke<UIStateResult>('detect_ui_state', { windowHandle });
        return result;
    } catch (error) {
        console.error('Failed to detect UI state:', error);
        return null;
    }
}

// Click the accept/enter button (legacy - uses mouse click)
export async function clickAcceptButton(windowHandle: number, x: number, y: number): Promise<boolean> {
    try {
        const result = await invoke<boolean>('click_button', {
            windowHandle,
            screenX: x,
            screenY: y
        });
        return result;
    } catch (error) {
        console.error('Failed to click accept:', error);
        return false;
    }
}

// Accept dialog using Alt+Enter keyboard shortcut (more reliable)
export async function acceptDialog(windowHandle: number): Promise<boolean> {
    try {
        const result = await invoke<boolean>('accept_dialog', { windowHandle });
        return result;
    } catch (error) {
        console.error('Failed to accept dialog:', error);
        return false;
    }
}

// Scroll chat to bottom using Ctrl+End
export async function scrollToBottom(windowHandle: number): Promise<boolean> {
    try {
        const result = await invoke<boolean>('scroll_to_bottom', { windowHandle });
        return result;
    } catch (error) {
        console.error('Failed to scroll to bottom:', error);
        return false;
    }
}

// Click the retry button
export async function clickRetryButton(windowHandle: number, x: number, y: number): Promise<boolean> {
    return clickAcceptButton(windowHandle, x, y);
}

// Backlog reading result interface
interface BacklogResult {
    totalIssues: number;
    completedIssues: number;
    currentIssue: string;
    backlogPath: string;
    error?: string;
}

// Read backlog from project path
export async function readBacklog(projectPath: string): Promise<BacklogResult | null> {
    try {
        const result = await invoke<BacklogResult>('read_backlog', { projectPath });
        return result;
    } catch (error) {
        console.error('Failed to read backlog:', error);
        return null;
    }
}

// Write to chat and submit
export async function writeToChat(windowHandle: number, prompt: string): Promise<boolean> {
    try {
        const result = await invoke<boolean>('write_to_chat', {
            windowHandle,
            prompt
        });
        return result;
    } catch (error) {
        console.error('Failed to write to chat:', error);
        return false;
    }
}

// Check UI state and perform auto-actions for enabled instances
export async function checkAndActOnInstance(instanceId: string, testMode: boolean = false): Promise<string> {
    const currentInstances = get(instances);
    const instance = currentInstances.find(i => i.id === instanceId);

    if (!instance) return 'Instance not found';
    if (!instance.enabled && !testMode) return 'Instance disabled';

    const uiState = await detectUIState(instance.windowHandle);
    if (!uiState) return 'Failed to detect UI state';
    if (uiState.error) return `Error: ${uiState.error}`;

    const currentSettings = get(settings);

    // Update instance UI state
    instances.update(list =>
        list.map(i => i.id === instanceId
            ? { ...i, uiState: uiState, lastActivity: Date.now() }
            : i
        )
    );

    // Handle error state (Retry button detected)
    if (uiState.hasRetryButton) {
        const newRetryCount = instance.retryCount + 1;

        if (newRetryCount >= instance.maxRetries) {
            // Max retries reached - disable and notify
            instances.update(list =>
                list.map(i => i.id === instanceId
                    ? { ...i, retryCount: newRetryCount, status: 'error', enabled: false }
                    : i
                )
            );

            // Send Discord notification
            if (currentSettings.discordWebhook && currentSettings.notifyOnError) {
                try {
                    await invoke('notify_discord', {
                        webhookUrl: currentSettings.discordWebhook,
                        title: `❌ Error en ${instance.projectName}`,
                        message: `Se alcanzó el máximo de reintentos (${instance.maxRetries}). Requiere atención manual.`
                    });
                } catch (e) {
                    console.error('Failed to send Discord notification:', e);
                }
            }
            return `Max retries reached (${newRetryCount}/${instance.maxRetries})`;
        } else {
            // Click retry and increment counter
            await clickRetryButton(instance.windowHandle, uiState.retryButtonX, uiState.retryButtonY);
            instances.update(list =>
                list.map(i => i.id === instanceId
                    ? { ...i, retryCount: newRetryCount, status: 'working', lastActivity: Date.now() }
                    : i
                )
            );
            return `Clicked Retry (attempt ${newRetryCount}/${instance.maxRetries})`;
        }
    }

    // Handle accept button - click it
    if (uiState.hasAcceptButton) {
        await clickAcceptButton(instance.windowHandle, uiState.acceptButtonX, uiState.acceptButtonY);
        instances.update(list =>
            list.map(i => i.id === instanceId
                ? { ...i, status: 'working', lastActivity: Date.now() }
                : i
            )
        );
        return 'Clicked Accept button';
    }

    // Handle enter/ready state - chat is available, send prompt
    if (uiState.hasEnterButton) {
        const prompt = testMode ? 'Test' : (instance.customPrompt || currentSettings.defaultPrompt);
        await writeToChat(instance.windowHandle, prompt);

        // Update status
        instances.update(list =>
            list.map(i => i.id === instanceId
                ? { ...i, retryCount: 0, status: 'working', lastActivity: Date.now(), stepCount: i.stepCount + 1 }
                : i
            )
        );
        return `Sent prompt: "${prompt}"`;
    }

    return 'No action needed - Antigravity is working';
}

// UI Polling state
let pollingInterval: ReturnType<typeof setInterval> | null = null;
let pollingActive = false;

// Start automatic UI polling for all enabled instances
export function startUIPolling(intervalMs: number = 5000): void {
    if (pollingActive) return;

    pollingActive = true;
    console.log(`Starting UI polling every ${intervalMs}ms`);

    pollingInterval = setInterval(async () => {
        const currentInstances = get(instances);

        for (const instance of currentInstances) {
            if (!instance.enabled) continue;

            try {
                const result = await checkAndActOnInstance(instance.id, false);
                console.log(`[${instance.projectName}] ${result}`);
            } catch (error) {
                console.error(`[${instance.projectName}] Error:`, error);
            }
        }
    }, intervalMs);
}

// Stop UI polling
export function stopUIPolling(): void {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    pollingActive = false;
    console.log('UI polling stopped');
}

// Check if polling is active
export function isPollingActive(): boolean {
    return pollingActive;
}

// Manual test function - directly send "Test" to chat
export async function testInstance(instanceId: string): Promise<string> {
    const currentInstances = get(instances);
    const instance = currentInstances.find(i => i.id === instanceId);

    if (!instance) return 'Instance not found';

    try {
        const success = await writeToChat(instance.windowHandle, 'Test');
        if (success) {
            instances.update(list =>
                list.map(i => i.id === instanceId
                    ? { ...i, lastActivity: Date.now(), stepCount: i.stepCount + 1 }
                    : i
                )
            );
            return 'Sent "Test" to chat';
        } else {
            return 'Failed to send - writeToChat returned false';
        }
    } catch (error) {
        return `Error: ${error}`;
    }
}

// Detect stop conditions in response text
export function detectStopCondition(text: string, stopConditions: string[]): { detected: boolean; condition: string } {
    for (const condition of stopConditions) {
        if (text.includes(condition)) {
            return { detected: true, condition };
        }
    }
    return { detected: false, condition: '' };
}

// Send auto-implementation prompt to an instance
export async function sendAutoPrompt(instanceId: string): Promise<string> {
    const currentInstances = get(instances);
    const instance = currentInstances.find(i => i.id === instanceId);
    const currentSettings = get(settings);

    if (!instance) return 'Instance not found';
    if (!instance.enabled) return 'Instance disabled';

    // Use custom prompt or autoPrompt from settings
    const prompt = instance.customPrompt || currentSettings.autoPrompt;

    try {
        const success = await writeToChat(instance.windowHandle, prompt);
        if (success) {
            instances.update(list =>
                list.map(i => i.id === instanceId
                    ? { 
                        ...i, 
                        lastActivity: Date.now(), 
                        stepCount: i.stepCount + 1,
                        status: 'working' as const
                    }
                    : i
                )
            );
            return `Sent prompt: "${prompt.substring(0, 50)}..."`;
        } else {
            return 'Failed to send prompt';
        }
    } catch (error) {
        return `Error: ${error}`;
    }
}

// Notify Discord about a stop condition or completion
async function notifyStopCondition(instance: Instance, condition: string): Promise<void> {
    const currentSettings = get(settings);
    if (!currentSettings.discordWebhook) return;

    const isComplete = condition === '✅ BACKLOG COMPLETADO';
    const shouldNotify = isComplete ? currentSettings.notifyOnComplete : currentSettings.notifyOnError;

    if (!shouldNotify) return;

    try {
        const title = isComplete 
            ? `✅ ${instance.projectName} - Backlog Completado`
            : `⚠️ ${instance.projectName} - Requiere Atención`;
        
        const message = isComplete
            ? `El backlog ha sido completado exitosamente. Issues completados: ${instance.issuesCompleted || 0}`
            : `Condición detectada: ${condition}. Requiere intervención manual.`;

        await invoke('notify_discord', {
            webhookUrl: currentSettings.discordWebhook,
            title,
            message
        });
    } catch (e) {
        console.error('Failed to send Discord notification:', e);
    }
}

// Enhanced UI polling with stop condition detection - using recursive setTimeout to prevent overlap
let pollingTimeout: ReturnType<typeof setTimeout> | null = null;

async function pollOnce(): Promise<void> {
    const currentSettings = get(settings);
    
    // ========== UPDATE SILENT MODE CONNECTIONS ==========
    // Check for newly connected extensions before processing instances
    // This ensures we detect extensions that connect after the initial scan
    await updateSilentModeConnections();
    
    // Get fresh instance list after connection update
    const currentInstances = get(instances);
    
    for (const instance of currentInstances) {
        if (!pollingActive) break; // Check if stopped
        if (!instance.enabled || instance.isBlocked) continue;
        
        // ========== INACTIVITY TIMEOUT CHECK ==========
        // If no prompt sent in X minutes, stop project and notify Discord
        const inactivityMs = currentSettings.inactivityTimeoutMinutes * 60 * 1000;
        const lastPrompt = instance.lastPromptSent || 0;
        const timeSinceLastPrompt = Date.now() - lastPrompt;
        
        if (lastPrompt > 0 && timeSinceLastPrompt > inactivityMs) {
            const minutesInactive = Math.round(timeSinceLastPrompt / 60000);
            console.log(`[${instance.projectName}] ⏰ Inactivity timeout: ${minutesInactive} minutes since last prompt`);
            
            // Disable the instance
            instances.update(list =>
                list.map(i => i.id === instance.id
                    ? { 
                        ...i, 
                        enabled: false, 
                        status: 'error' as const,
                        isBlocked: true,
                        blockReason: `Inactivity timeout: ${minutesInactive} min`
                    }
                    : i
                )
            );
            
            // Send Discord notification
            if (currentSettings.discordWebhook && currentSettings.notifyOnError) {
                try {
                    await invoke('notify_discord', {
                        webhookUrl: currentSettings.discordWebhook,
                        title: `⏰ ${instance.projectName} Detenido por Inactividad`,
                        message: `No se ha enviado ningún prompt en ${minutesInactive} minutos. El proyecto ha sido deshabilitado automáticamente.`
                    });
                    console.log(`[${instance.projectName}] Discord notification sent for inactivity`);
                } catch (e) {
                    console.error(`[${instance.projectName}] Failed to send inactivity notification:`, e);
                }
            }
            
            continue; // Skip further processing for this instance
        }
        
        // Update backlog for this instance on every poll (with timeout)
        try {
            const backlogTimeout = new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error('Backlog timeout')), 5000)
            );
            
            const backlogPromise = invoke<{
                totalIssues: number;
                completedIssues: number;
                currentIssue: string;
                error?: string;
            }>('read_backlog', { projectPath: instance.projectPath });
            
            const backlog = await Promise.race([backlogPromise, backlogTimeout]) as {
                totalIssues: number;
                completedIssues: number;
                currentIssue: string;
                error?: string;
            } | null;
            
            if (backlog && !backlog.error) {
                instances.update(list =>
                    list.map(i => i.id === instance.id
                        ? {
                            ...i,
                            totalIssues: backlog.totalIssues,
                            currentIssue: backlog.completedIssues,
                            issuesCompleted: backlog.completedIssues
                        }
                        : i
                    )
                );
                
                // ========== CHECK FOR PROJECT COMPLETION ==========
                // If all issues are completed, disable and notify
                if (backlog.totalIssues > 0 && backlog.completedIssues >= backlog.totalIssues) {
                    console.log(`[${instance.projectName}] 🎉 All issues completed (${backlog.completedIssues}/${backlog.totalIssues})`);
                    
                    // Update instance to disabled and completed
                    instances.update(list =>
                        list.map(i => i.id === instance.id
                            ? { 
                                ...i, 
                                enabled: false, 
                                status: 'complete' as const,
                                isBlocked: true,
                                blockReason: 'All issues completed'
                            }
                            : i
                        )
                    );
                    
                    // Send Discord notification
                    if (currentSettings.discordWebhook && currentSettings.notifyOnComplete) {
                        try {
                            await invoke('notify_discord', {
                                webhookUrl: currentSettings.discordWebhook,
                                title: `🎉 ${instance.projectName} Completado!`,
                                message: `Todos los issues han sido completados (${backlog.completedIssues}/${backlog.totalIssues}). El proyecto ha sido deshabilitado automáticamente.`
                            });
                            console.log(`[${instance.projectName}] Discord notification sent for completion`);
                        } catch (e) {
                            console.error(`[${instance.projectName}] Failed to send completion notification:`, e);
                        }
                    }
                    
                    continue; // Skip further processing for this instance
                }
            }
        } catch (e) {
            // Ignore backlog read errors, continue with detection
        }
        
        // ========== SILENT MODE PATH ==========
        // If companion extension is connected, use WebSocket instead of pixel scanning
        if (instance.connectionMode === 'silent' && instance.silentWindowId) {
            try {
                // Request FRESH state from extension (not cached)
                const silentState = await getStateSilent(instance.silentWindowId);

                if (!silentState) {
                    console.log(`[${instance.projectName}] 🔇 Silent: no state yet, waiting...`);
                    continue;
                }

                console.log(`[${instance.projectName}] 🔇 Silent state: accept=${silentState.hasAcceptButton}, retry=${silentState.hasRetryButton}, enter=${silentState.hasEnterButton}, terminal=${silentState.terminalPending}, working=${silentState.agentWorking}`);

                // Accept terminal commands
                if (silentState.terminalPending) {
                    console.log(`[${instance.projectName}] 🔇 Accepting terminal command`);
                    await acceptTerminalSilent(instance.silentWindowId);
                    instances.update(list =>
                        list.map(i => i.id === instance.id
                            ? { ...i, lastActivity: Date.now(), retryCount: 0 }
                            : i
                        )
                    );
                    continue;
                }

                // Accept pending changes
                if (silentState.hasAcceptButton) {
                    console.log(`[${instance.projectName}] 🔇 Accepting changes`);
                    await acceptAllSilent(instance.silentWindowId);
                    instances.update(list =>
                        list.map(i => i.id === instance.id
                            ? { ...i, lastActivity: Date.now(), retryCount: 0 }
                            : i
                        )
                    );
                    continue;
                }

                // Handle retry
                if (silentState.hasRetryButton) {
                    const maxRetries = currentSettings.maxRetries;
                    if (instance.retryCount >= maxRetries) {
                        instances.update(list =>
                            list.map(i => i.id === instance.id
                                ? { ...i, isBlocked: true, blockReason: 'Max retries reached', status: 'error' as const, enabled: false }
                                : i
                            )
                        );
                        await notifyStopCondition(instance, 'Max retries reached');
                    } else {
                        console.log(`[${instance.projectName}] 🔇 Retrying (${instance.retryCount + 1}/${maxRetries})`);
                        await retrySilent(instance.silentWindowId);
                        instances.update(list =>
                            list.map(i => i.id === instance.id
                                ? { ...i, retryCount: i.retryCount + 1, lastActivity: Date.now() }
                                : i
                            )
                        );
                    }
                    continue;
                }

                // Chat ready — send prompt
                if (silentState.hasEnterButton && !silentState.agentWorking) {
                    // Cooldown: Don't send another prompt if we sent one recently
                    const promptCooldownMs = 30000; // 30 seconds
                    const timeSinceLastPrompt = Date.now() - (instance.lastPromptSent || 0);
                    
                    if (timeSinceLastPrompt < promptCooldownMs) {
                        console.log(`[${instance.projectName}] ⏳ Cooldown: waiting ${Math.ceil((promptCooldownMs - timeSinceLastPrompt) / 1000)}s before next prompt`);
                        continue;
                    }
                    
                    const prompt = instance.customPrompt || currentSettings.autoPrompt;
                    console.log(`[${instance.projectName}] 🔇 Sending prompt: "${prompt.substring(0, 50)}..."`);
                    await sendPromptSilent(instance.silentWindowId, prompt);
                    instances.update(list =>
                        list.map(i => i.id === instance.id
                            ? {
                                ...i,
                                lastActivity: Date.now(),
                                lastPromptSent: Date.now(),
                                stepCount: i.stepCount + 1,
                                retryCount: 0,
                                status: 'working' as const
                            }
                            : i
                        )
                    );
                    continue;
                }

                // Agent working, nothing to do
                if (silentState.agentWorking) {
                    console.log(`[${instance.projectName}] 🔇 Agent working - waiting...`);
                }
                continue;

            } catch (error) {
                console.warn(`[${instance.projectName}] 🔇 Silent mode error, falling back to legacy:`, error);
                // Fall through to legacy detection below
            }
        }

        // ========== LEGACY MODE DISABLED ==========
        // Silent mode is required. If no extension connected, skip this instance.
        console.log(`[${instance.projectName}] ⚠️ No silent mode connection - skipping (install bob-helper extension in Antigravity)`);
        instances.update(list =>
            list.map(i => i.id === instance.id
                ? { ...i, status: 'idle' as const }
                : i
            )
        );
    }
}

function scheduleNextPoll(intervalMs: number): void {
    if (!pollingActive) return;
    
    pollingTimeout = setTimeout(async () => {
        if (!pollingActive) return;
        
        try {
            await pollOnce();
        } catch (error) {
            console.error('Poll cycle error:', error);
        }
        
        // Schedule next poll
        scheduleNextPoll(intervalMs);
    }, intervalMs);
}

export function startAutoImplementation(intervalMs?: number): void {
    const currentSettings = get(settings);
    const pollInterval = intervalMs || (currentSettings.pollIntervalSeconds * 1000);

    if (pollingActive) {
        console.log('Polling already active');
        return;
    }
    
    pollingActive = true;
    console.log(`Starting auto-implementation polling every ${pollInterval}ms`);
    
    // Update backlog info immediately when starting
    updateInstanceBacklogs();
    
    // Setup periodic backlog refresh (every 15 minutes)
    const backlogRefreshInterval = setInterval(() => {
        if (pollingActive) {
            console.log('[Backlog] Periodic refresh...');
            updateInstanceBacklogs();
        } else {
            clearInterval(backlogRefreshInterval);
        }
    }, 15 * 60 * 1000); // 15 minutes
    
    // Start first poll immediately, then schedule subsequent ones
    pollOnce().then(() => {
        scheduleNextPoll(pollInterval);
    }).catch(error => {
        console.error('Initial poll error:', error);
        scheduleNextPoll(pollInterval);
    });
}

// Stop auto-implementation
export function stopAutoImplementation(): void {
    pollingActive = false;
    if (pollingTimeout) {
        clearTimeout(pollingTimeout);
        pollingTimeout = null;
    }
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    console.log('Auto-implementation stopped');
}

