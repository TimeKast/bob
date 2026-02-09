"use strict";
// BOB Helper — Actions
// Executes Antigravity commands silently (no focus stealing)
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.acceptAll = acceptAll;
exports.acceptAgentStep = acceptAgentStep;
exports.acceptTerminalCommand = acceptTerminalCommand;
exports.runTerminalCommand = runTerminalCommand;
exports.rejectChanges = rejectChanges;
exports.retryAction = retryAction;
exports.sendPrompt = sendPrompt;
const vscode = __importStar(require("vscode"));
/**
 * Accept all pending changes in the current file.
 * Equivalent to user pressing Ctrl+Enter when changes are pending.
 */
async function acceptAll() {
    return executeAction('antigravity.command.accept', 'acceptAll');
}
/**
 * Accept the current agent step (dialog).
 * Equivalent to user pressing Alt+Enter.
 */
async function acceptAgentStep() {
    return executeAction('antigravity.agent.acceptAgentStep', 'acceptStep');
}
/**
 * Accept a pending terminal command.
 * Equivalent to user pressing Alt+Enter in terminal.
 */
async function acceptTerminalCommand() {
    return executeAction('antigravity.terminalCommand.accept', 'acceptTerminal');
}
/**
 * Run a pending terminal command.
 * Equivalent to user pressing Ctrl+Enter in terminal.
 */
async function runTerminalCommand() {
    return executeAction('antigravity.terminalCommand.run', 'runTerminal');
}
/**
 * Reject current changes.
 */
async function rejectChanges() {
    return executeAction('antigravity.command.reject', 'reject');
}
/**
 * Retry the last failed agent action.
 * Appears when Antigravity encounters an error.
 */
async function retryAction() {
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
        }
        catch {
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
 * Uses sendTextToChat to write, then asks BOB to simulate Enter key press.
 */
async function sendPrompt(text) {
    const { log } = await Promise.resolve().then(() => __importStar(require('./logger')));
    const { send } = await Promise.resolve().then(() => __importStar(require('./extension')));
    log(`[sendPrompt] Starting with text: "${text.substring(0, 50)}..."`);
    try {
        // Try sending text up to 3 times
        let textSent = false;
        for (let attempt = 1; attempt <= 3 && !textSent; attempt++) {
            try {
                log(`[sendPrompt] Attempt ${attempt}: Writing text with sendTextToChat`);
                await vscode.commands.executeCommand('antigravity.sendTextToChat', true, text);
                textSent = true;
                log(`[sendPrompt] Text written successfully on attempt ${attempt}`);
            }
            catch (e) {
                log(`[sendPrompt] Attempt ${attempt} failed: ${e}`);
                if (attempt < 3) {
                    await sleep(500);
                }
            }
        }
        if (!textSent) {
            log(`[sendPrompt] FAILED: Could not write text after 3 attempts`);
            return {
                success: false,
                action: 'sendPrompt',
                error: 'Failed to write text to chat after 3 attempts'
            };
        }
        await sleep(400);
        // Focus the chat input
        log(`[sendPrompt] Focusing with agentPanel.focus`);
        await vscode.commands.executeCommand('antigravity.agentPanel.focus');
        await sleep(200);
        // Ask BOB to simulate Alt+Enter to submit
        const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || '';
        log(`[sendPrompt] Sending simulateEnter to BOB (workspace: ${workspaceName})`);
        send({
            type: 'simulateEnter',
            payload: { workspaceName },
            id: `enter-${Date.now()}`
        });
        log(`[sendPrompt] Complete!`);
        return { success: true, action: 'sendPrompt' };
    }
    catch (e) {
        log(`[sendPrompt] FAILED: ${e}`);
        return {
            success: false,
            action: 'sendPrompt',
            error: `sendPrompt failed: ${e}`
        };
    }
}
// ─── Helpers ────────────────────────────────────────────────────────
async function executeAction(command, actionName) {
    try {
        await vscode.commands.executeCommand(command);
        return { success: true, action: actionName };
    }
    catch (err) {
        return {
            success: false,
            action: actionName,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=actions.js.map