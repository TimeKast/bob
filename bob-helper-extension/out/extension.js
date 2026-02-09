"use strict";
// BOB Helper — Extension Entry Point
// Companion extension that connects to BOB Monitor via WebSocket
// Enables silent mode: BOB controls Antigravity without stealing window focus
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
exports.send = send;
const vscode = __importStar(require("vscode"));
const ws_1 = __importDefault(require("ws"));
const stateReader_1 = require("./stateReader");
const actions = __importStar(require("./actions"));
const logger_1 = require("./logger");
const OUTPUT_CHANNEL_NAME = 'BOB Helper';
const DEFAULT_PORT = 9876;
const RECONNECT_INTERVAL_MS = 5000;
let ws = null;
let reconnectTimer = null;
let stateWatcher = null;
let outputChannel;
let statusBarItem;
// ─── Extension Lifecycle ────────────────────────────────────────────
function activate(context) {
    outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
    (0, logger_1.initLogger)(outputChannel); // Initialize shared logger for actions.ts
    log('BOB Helper extension activated (v0.1.23)');
    // Status bar indicator
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'bobHelper.status';
    updateStatusBar('disconnected');
    statusBarItem.show();
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand('bobHelper.connect', () => connect()), vscode.commands.registerCommand('bobHelper.disconnect', () => disconnect()), vscode.commands.registerCommand('bobHelper.status', () => showStatus()), outputChannel, statusBarItem);
    // Auto-connect if configured
    const config = vscode.workspace.getConfiguration('bobHelper');
    if (config.get('autoConnect', true)) {
        // Delay initial connection to let Antigravity finish loading
        setTimeout(() => connect(), 3000);
    }
}
function deactivate() {
    disconnect();
}
// ─── WebSocket Connection ───────────────────────────────────────────
function connect() {
    if (ws && ws.readyState === ws_1.default.OPEN) {
        log('Already connected');
        return;
    }
    const config = vscode.workspace.getConfiguration('bobHelper');
    const port = config.get('port', DEFAULT_PORT);
    const url = `ws://localhost:${port}`;
    log(`Connecting to BOB at ${url}...`);
    updateStatusBar('connecting');
    try {
        ws = new ws_1.default(url);
        ws.on('open', () => {
            log('✅ Connected to BOB Monitor');
            updateStatusBar('connected');
            clearReconnectTimer();
            // Send hello with workspace info
            const hello = {
                extensionVersion: '0.1.0',
                workspaceName: vscode.workspace.workspaceFolders?.[0]?.name || 'unknown',
                workspacePath: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                windowId: `ext-${Date.now()}`,
            };
            log(`📍 Sending hello - workspaceName: ${hello.workspaceName}`);
            log(`📍 Sending hello - workspacePath: ${hello.workspacePath}`);
            send({ type: 'hello', payload: hello, id: 'hello' });
            // Start state watcher — pushes state changes to BOB
            startStateWatcher();
        });
        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                handleMessage(msg);
            }
            catch (err) {
                log(`⚠️ Failed to parse message: ${err}`);
            }
        });
        ws.on('close', (code, reason) => {
            log(`Connection closed (${code}: ${reason.toString()})`);
            updateStatusBar('disconnected');
            stopStateWatcher();
            scheduleReconnect();
        });
        ws.on('error', (err) => {
            // Don't log ECONNREFUSED as error — BOB might not be running
            if (err.code === 'ECONNREFUSED') {
                log('BOB Monitor not running, will retry...');
            }
            else {
                log(`⚠️ WebSocket error: ${err.message}`);
            }
            updateStatusBar('disconnected');
        });
    }
    catch (err) {
        log(`Failed to create WebSocket: ${err}`);
        updateStatusBar('disconnected');
        scheduleReconnect();
    }
}
function disconnect() {
    clearReconnectTimer();
    stopStateWatcher();
    if (ws) {
        ws.close(1000, 'Extension deactivating');
        ws = null;
    }
    updateStatusBar('disconnected');
    log('Disconnected from BOB');
}
// ─── Message Handling ───────────────────────────────────────────────
async function handleMessage(msg) {
    log(`← Received: ${msg.type} (id: ${msg.id})`);
    switch (msg.type) {
        case 'getState': {
            const state = await (0, stateReader_1.readAntigravityState)();
            send({
                type: 'state',
                payload: state,
                id: msg.id,
            });
            break;
        }
        case 'acceptAll': {
            const result = await actions.acceptAll();
            send({ type: 'result', payload: result, id: msg.id });
            break;
        }
        case 'acceptStep': {
            const result = await actions.acceptAgentStep();
            send({ type: 'result', payload: result, id: msg.id });
            break;
        }
        case 'acceptTerminal': {
            const result = await actions.acceptTerminalCommand();
            send({ type: 'result', payload: result, id: msg.id });
            break;
        }
        case 'runTerminal': {
            const result = await actions.runTerminalCommand();
            send({ type: 'result', payload: result, id: msg.id });
            break;
        }
        case 'retry': {
            const result = await actions.retryAction();
            send({ type: 'result', payload: result, id: msg.id });
            break;
        }
        case 'sendPrompt': {
            const text = msg.payload?.text || '';
            if (!text) {
                send({
                    type: 'error',
                    payload: { success: false, action: 'sendPrompt', error: 'No prompt text provided' },
                    id: msg.id,
                });
                break;
            }
            const result = await actions.sendPrompt(text);
            send({ type: 'result', payload: result, id: msg.id });
            break;
        }
        case 'ping': {
            send({ type: 'pong', payload: { timestamp: Date.now() }, id: msg.id });
            break;
        }
        default:
            send({
                type: 'error',
                payload: { error: `Unknown message type: ${msg.type}` },
                id: msg.id,
            });
    }
}
// ─── State Watcher (Push) ───────────────────────────────────────────
function startStateWatcher() {
    if (stateWatcher) {
        return;
    }
    stateWatcher = new stateReader_1.StateWatcher((state) => {
        send({
            type: 'stateChanged',
            payload: state,
            id: `push-${Date.now()}`,
        });
    });
    stateWatcher.start(10000); // Poll every 10s for state changes
    log('State watcher started');
}
function stopStateWatcher() {
    if (stateWatcher) {
        stateWatcher.stop();
        stateWatcher = null;
        log('State watcher stopped');
    }
}
// ─── Reconnect Logic ────────────────────────────────────────────────
function scheduleReconnect() {
    if (reconnectTimer) {
        return;
    }
    const config = vscode.workspace.getConfiguration('bobHelper');
    if (!config.get('autoConnect', true)) {
        return;
    }
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
    }, RECONNECT_INTERVAL_MS);
}
function clearReconnectTimer() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
}
// ─── Helpers ────────────────────────────────────────────────────────
function send(msg) {
    if (ws && ws.readyState === ws_1.default.OPEN) {
        ws.send(JSON.stringify(msg));
        log(`→ Sent: ${msg.type} (id: ${msg.id})`);
    }
}
function updateStatusBar(status) {
    switch (status) {
        case 'connected':
            statusBarItem.text = '$(plug) BOB 🔇';
            statusBarItem.tooltip = 'BOB Helper: Connected (Silent Mode)';
            statusBarItem.backgroundColor = undefined;
            break;
        case 'connecting':
            statusBarItem.text = '$(sync~spin) BOB...';
            statusBarItem.tooltip = 'BOB Helper: Connecting...';
            break;
        case 'disconnected':
            statusBarItem.text = '$(debug-disconnect) BOB';
            statusBarItem.tooltip = 'BOB Helper: Disconnected — Click to show status';
            break;
    }
}
function showStatus() {
    const connected = ws && ws.readyState === ws_1.default.OPEN;
    const workspace = vscode.workspace.workspaceFolders?.[0]?.name || 'none';
    vscode.window.showInformationMessage(`BOB Helper: ${connected ? '✅ Connected' : '❌ Disconnected'} | Workspace: ${workspace}`, connected ? 'Disconnect' : 'Connect').then(action => {
        if (action === 'Connect') {
            connect();
        }
        if (action === 'Disconnect') {
            disconnect();
        }
    });
}
function log(message) {
    const timestamp = new Date().toISOString().substring(11, 23);
    outputChannel.appendLine(`[${timestamp}] ${message}`);
}
//# sourceMappingURL=extension.js.map