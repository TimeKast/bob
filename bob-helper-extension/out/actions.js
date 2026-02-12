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
 * Attempt A: Uses sendChatActionMessage to send+submit in one shot
 */
async function sendPrompt(text) {
    const { log } = await Promise.resolve().then(() => __importStar(require('./logger')));
    const { markPromptSent } = await Promise.resolve().then(() => __importStar(require('./stateReader')));
    log(`[sendPrompt] Starting with text: "${text.substring(0, 50)}..."`);
    try {
        // Attempt: Use sendChatActionMessage to send AND submit
        log(`[sendPrompt] Using antigravity.sendChatActionMessage`);
        await vscode.commands.executeCommand('antigravity.sendChatActionMessage', text);
        log(`[sendPrompt] Complete via sendChatActionMessage!`);
        markPromptSent();
        return { success: true, action: 'sendPrompt' };
    }
    catch (e) {
        log(`[sendPrompt] sendChatActionMessage FAILED: ${e}`);
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