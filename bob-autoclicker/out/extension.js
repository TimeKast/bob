"use strict";
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
exports.activate = activate;
exports.deactivate = deactivate;
// BOB Auto Clicker - Simple auto-accept extension
const vscode = __importStar(require("vscode"));
let interval = null;
let statusBar;
function activate(context) {
    console.log('BOB Auto Clicker v0.5.0 activated');
    // Create clickable status bar item
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.command = 'bobAutoclicker.showMenu';
    statusBar.tooltip = 'Click to configure BOB Auto Clicker';
    context.subscriptions.push(statusBar);
    // Register menu command
    context.subscriptions.push(vscode.commands.registerCommand('bobAutoclicker.showMenu', showSettingsMenu));
    // Watch for config changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('bobAutoclicker')) {
            updateState();
        }
    }));
    // Initial state
    updateState();
}
async function showSettingsMenu() {
    const config = vscode.workspace.getConfiguration('bobAutoclicker');
    const enableAccept = config.get('enableAccept', true);
    const enableAcceptAll = config.get('enableAcceptAll', true);
    const enableAllow = config.get('enableAllow', true);
    const intervalSeconds = config.get('intervalSeconds', 10);
    const items = [
        {
            label: `$(${enableAccept ? 'check' : 'circle-slash'}) Accept/Run`,
            description: enableAccept ? 'ON - Auto-accept steps and terminal' : 'OFF',
            detail: 'Toggle auto-accept for agent steps and terminal commands',
        },
        {
            label: `$(${enableAcceptAll ? 'check' : 'circle-slash'}) Accept All`,
            description: enableAcceptAll ? 'ON - Auto-accept all changes' : 'OFF',
            detail: 'Toggle auto-accept for all file changes',
        },
        {
            label: `$(${enableAllow ? 'check' : 'circle-slash'}) Allow Tools`,
            description: enableAllow ? 'ON - Auto-allow tool permissions' : 'OFF',
            detail: 'Toggle auto-allow for tool permission dialogs (Allow for conversation)',
        },
        {
            label: `$(clock) Interval: ${intervalSeconds}s`,
            description: 'Change polling interval',
            detail: 'How often to attempt auto-accept (in seconds)',
        },
    ];
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'BOB Auto Clicker Settings',
    });
    if (!selected)
        return;
    if (selected.label.includes('Accept/Run')) {
        await config.update('enableAccept', !enableAccept, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`Accept/Run: ${!enableAccept ? 'ON' : 'OFF'}`);
    }
    else if (selected.label.includes('Accept All')) {
        await config.update('enableAcceptAll', !enableAcceptAll, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`Accept All: ${!enableAcceptAll ? 'ON' : 'OFF'}`);
    }
    else if (selected.label.includes('Allow Tools')) {
        await config.update('enableAllow', !enableAllow, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`Allow Tools: ${!enableAllow ? 'ON' : 'OFF'}`);
    }
    else if (selected.label.includes('Interval')) {
        const input = await vscode.window.showInputBox({
            prompt: 'Enter interval in seconds (1-60)',
            value: String(intervalSeconds),
            validateInput: (v) => {
                const n = parseInt(v);
                if (isNaN(n) || n < 1 || n > 60) {
                    return 'Please enter a number between 1 and 60';
                }
                return null;
            }
        });
        if (input) {
            await config.update('intervalSeconds', parseInt(input), vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Interval: ${input}s`);
        }
    }
    updateState();
}
function getConfig() {
    const config = vscode.workspace.getConfiguration('bobAutoclicker');
    return {
        enableAccept: config.get('enableAccept', true),
        enableAcceptAll: config.get('enableAcceptAll', true),
        enableAllow: config.get('enableAllow', true),
        intervalSeconds: config.get('intervalSeconds', 10),
    };
}
function updateState() {
    const cfg = getConfig();
    const isActive = cfg.enableAccept || cfg.enableAcceptAll || cfg.enableAllow;
    if (isActive && !interval) {
        startAutoClicker(cfg);
    }
    else if (!isActive && interval) {
        stopAutoClicker();
    }
    else if (isActive && interval) {
        // Config changed while running - restart with new interval
        stopAutoClicker();
        startAutoClicker(cfg);
    }
    // Update status bar
    const parts = [];
    if (cfg.enableAccept)
        parts.push('A');
    if (cfg.enableAcceptAll)
        parts.push('All');
    if (cfg.enableAllow)
        parts.push('Allow');
    if (parts.length > 0) {
        statusBar.text = `$(sync~spin) BOB [${parts.join('+')}]`;
        statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
    else {
        statusBar.text = '$(circle-slash) BOB';
        statusBar.backgroundColor = undefined;
    }
    statusBar.show();
}
function startAutoClicker(cfg) {
    console.log(`BOB Auto Clicker: STARTED (interval: ${cfg.intervalSeconds}s)`);
    const intervalMs = cfg.intervalSeconds * 1000;
    interval = setInterval(() => {
        tryAccept(getConfig()); // Get fresh config each time
    }, intervalMs);
    // Also try immediately
    tryAccept(cfg);
}
function stopAutoClicker() {
    console.log('BOB Auto Clicker: STOPPED');
    if (interval) {
        clearInterval(interval);
        interval = null;
    }
}
async function tryAccept(cfg) {
    console.log(`BOB: Attempting accept (Accept: ${cfg.enableAccept}, AcceptAll: ${cfg.enableAcceptAll})`);
    // Accept All - just call the command
    if (cfg.enableAcceptAll) {
        try {
            await vscode.commands.executeCommand('antigravity.prioritized.agentAcceptAllInFile');
            console.log('BOB: ✓ agentAcceptAllInFile');
        }
        catch (e) {
            // Silently ignore
        }
    }
    // Accept/Run - terminal and hunks
    if (cfg.enableAccept) {
        const acceptCommands = [
            // Terminal commands
            'antigravity.terminalCommand.accept',
            'antigravity.terminalCommand.run',
            'antigravity.prioritized.terminalCommand.open',
            // General accept
            'antigravity.command.accept',
            // Hunk accept
            'antigravity.prioritized.agentAcceptFocusedHunk',
            // Agent step accept
            'antigravity.agent.acceptAgentStep',
        ];
        for (const cmd of acceptCommands) {
            try {
                await vscode.commands.executeCommand(cmd);
                console.log(`BOB: ✓ ${cmd} succeeded`);
            }
            catch (e) {
                // Silently ignore - command may not be applicable
            }
        }
    }
    // Allow Tools - auto-allow permission dialogs
    if (cfg.enableAllow) {
        try {
            await vscode.commands.executeCommand('antigravity.permission.allowForConversation');
            console.log('BOB: ✓ allowForConversation');
        }
        catch (e) {
            // Silently ignore - no permission dialog may be active
        }
    }
}
function deactivate() {
    stopAutoClicker();
}
//# sourceMappingURL=extension.js.map