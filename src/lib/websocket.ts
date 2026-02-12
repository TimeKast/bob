// BOB Frontend — WebSocket Client Manager
// Manages connections to companion extensions via the Tauri backend

import { invoke } from '@tauri-apps/api/core';
import type { Instance } from './types';

// ─── Types ──────────────────────────────────────────────────────────

export interface SilentExtension {
    windowId: string;
    workspaceName: string;
    workspacePath: string;  // Full path to workspace root
    state: SilentState | null;
}

export interface SilentState {
    hasAcceptButton: boolean;
    hasRetryButton: boolean;
    hasEnterButton: boolean;
    agentWorking: boolean;
    terminalPending: boolean;
    workspaceName: string;
    workspacePath: string;  // Full path to workspace root
    consecutiveErrors: number;  // Fatal errors since last successful step
    capacityErrors: number;     // Recent 503 capacity errors
    lastActivityTimestamp: string; // ISO timestamp of last agent activity
    messageCount: number;       // Total message count from diagnostics
    currentStepIndex: number;   // Current step index from getDiagnostics
}

// ─── Extension Discovery ───────────────────────────────────────────

/**
 * Get all connected companion extensions from the WebSocket server
 */
export async function getSilentExtensions(): Promise<SilentExtension[]> {
    try {
        const result = await invoke<SilentExtension[]>('get_silent_extensions');
        return result;
    } catch (error) {
        console.error('[Silent] Failed to get extensions:', error);
        return [];
    }
}

/**
 * Match a connected extension to a BOB instance by workspace name
 */
export function matchExtensionToInstance(
    extensions: SilentExtension[],
    instance: Instance
): SilentExtension | null {
    // Debug: log what we're comparing
    console.log(`[Silent] Matching instance "${instance.projectName}" against ${extensions.length} extensions`);
    for (const ext of extensions) {
        console.log(`[Silent]   - Extension: "${ext.workspaceName}" vs Instance: "${instance.projectName}" → ${ext.workspaceName.toLowerCase() === instance.projectName.toLowerCase() ? '✅ MATCH' : '❌ no match'}`);
    }

    // Match by project name
    return extensions.find(ext =>
        ext.workspaceName.toLowerCase() === instance.projectName.toLowerCase()
    ) || null;
}

// ─── Silent Actions ─────────────────────────────────────────────────

/**
 * Send an action to a connected extension
 */
export async function sendSilentAction(
    windowId: string,
    action: string,
    payload?: Record<string, unknown>
): Promise<boolean> {
    try {
        return await invoke<boolean>('send_silent_action', {
            windowId,
            action,
            payload: payload || null,
        });
    } catch (error) {
        console.error(`[Silent] Action '${action}' failed:`, error);
        return false;
    }
}

/**
 * Get the UI state from a connected extension.
 * Reads the cached state that was pushed by the helper via stateChanged events.
 * No active request needed — the helper proactively pushes state changes.
 */
export async function getStateSilent(windowId: string): Promise<SilentState | null> {
    try {
        const exts = await getSilentExtensions();
        const ext = exts.find(e => e.windowId === windowId);
        return ext?.state || null;
    } catch {
        return null;
    }
}

/**
 * Accept all changes via silent mode
 */
export async function acceptAllSilent(windowId: string): Promise<boolean> {
    return sendSilentAction(windowId, 'acceptAll');
}

/**
 * Accept agent step via silent mode
 */
export async function acceptStepSilent(windowId: string): Promise<boolean> {
    return sendSilentAction(windowId, 'acceptStep');
}

/**
 * Accept terminal command via silent mode
 */
export async function acceptTerminalSilent(windowId: string): Promise<boolean> {
    return sendSilentAction(windowId, 'acceptTerminal');
}

/**
 * Send a prompt to Antigravity chat via silent mode
 */
export async function sendPromptSilent(windowId: string, text: string): Promise<boolean> {
    return sendSilentAction(windowId, 'sendPrompt', { text });
}

/**
 * Retry via silent mode
 */
export async function retrySilent(windowId: string): Promise<boolean> {
    return sendSilentAction(windowId, 'retry');
}
