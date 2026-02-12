// BOB Helper — Actions
// Executes Antigravity commands silently (no focus stealing)

import * as vscode from 'vscode';
import type { ActionResult } from './protocol';

/**
 * Accept all pending changes in the current file.
 * Equivalent to user pressing Ctrl+Enter when changes are pending.
 */
export async function acceptAll(): Promise<ActionResult> {
    return executeAction('antigravity.command.accept', 'acceptAll');
}

/**
 * Accept the current agent step (dialog).
 * Equivalent to user pressing Alt+Enter.
 */
export async function acceptAgentStep(): Promise<ActionResult> {
    return executeAction('antigravity.agent.acceptAgentStep', 'acceptStep');
}

/**
 * Accept a pending terminal command.
 * Equivalent to user pressing Alt+Enter in terminal.
 */
export async function acceptTerminalCommand(): Promise<ActionResult> {
    return executeAction('antigravity.terminalCommand.accept', 'acceptTerminal');
}

/**
 * Run a pending terminal command.
 * Equivalent to user pressing Ctrl+Enter in terminal.
 */
export async function runTerminalCommand(): Promise<ActionResult> {
    return executeAction('antigravity.terminalCommand.run', 'runTerminal');
}

/**
 * Reject current changes.
 */
export async function rejectChanges(): Promise<ActionResult> {
    return executeAction('antigravity.command.reject', 'reject');
}

/**
 * Retry the last failed agent action.
 * Appears when Antigravity encounters an error.
 */
export async function retryAction(): Promise<ActionResult> {
    // Try multiple possible retry commands
    const retryCommands = [
        'antigravity.agent.retry',
        'antigravity.retry',
        'antigravity.command.retry',
    ];

    for (const cmd of retryCommands) {
        try {
            await vscode.commands.executeCommand(cmd);
            return { success: true, action: 'retry' };
        } catch {
            // Try next command
        }
    }

    return {
        success: false,
        action: 'retry',
        error: 'No retry command found'
    };
}
/**
 * Send a prompt to Antigravity's chat.
 * Attempt A: Uses sendChatActionMessage to send+submit in one shot
 */
export async function sendPrompt(text: string): Promise<ActionResult> {
    const { log } = await import('./logger');
    const { markPromptSent } = await import('./stateReader');

    log(`[sendPrompt] Starting with text: "${text.substring(0, 50)}..."`);

    try {
        // Attempt: Use sendChatActionMessage to send AND submit
        log(`[sendPrompt] Using antigravity.sendChatActionMessage`);
        await vscode.commands.executeCommand('antigravity.sendChatActionMessage', text);

        log(`[sendPrompt] Complete via sendChatActionMessage!`);
        markPromptSent();
        return { success: true, action: 'sendPrompt' };
    } catch (e) {
        log(`[sendPrompt] sendChatActionMessage FAILED: ${e}`);
        return {
            success: false,
            action: 'sendPrompt',
            error: `sendPrompt failed: ${e}`
        };
    }
}

// ─── Helpers ────────────────────────────────────────────────────────

async function executeAction(command: string, actionName: string): Promise<ActionResult> {
    try {
        await vscode.commands.executeCommand(command);
        return { success: true, action: actionName };
    } catch (err) {
        return {
            success: false,
            action: actionName,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
