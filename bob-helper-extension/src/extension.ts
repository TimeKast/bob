// BOB Helper — Extension Entry Point
// Companion extension that connects to BOB Monitor via WebSocket
// Enables silent mode: BOB controls Antigravity without stealing window focus

import * as vscode from 'vscode';
import WebSocket from 'ws';
import type { BobMessage, ExtensionResponse, HelloPayload } from './protocol';
import { readAntigravityState, StateWatcher } from './stateReader';
import * as actions from './actions';
import { initLogger } from './logger';

const OUTPUT_CHANNEL_NAME = 'BOB Helper';
const DEFAULT_PORT = 9876;
const RECONNECT_INTERVAL_MS = 5000;

let ws: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let stateWatcher: StateWatcher | null = null;
let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;

// ─── Extension Lifecycle ────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
    initLogger(outputChannel);  // Initialize shared logger for actions.ts
    log('BOB Helper extension activated (v0.1.23)');

    // Status bar indicator
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'bobHelper.status';
    updateStatusBar('disconnected');
    statusBarItem.show();

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('bobHelper.connect', () => connect()),
        vscode.commands.registerCommand('bobHelper.disconnect', () => disconnect()),
        vscode.commands.registerCommand('bobHelper.status', () => showStatus()),
        vscode.commands.registerCommand('bobHelper.discoverCommands', () => discoverCommands()),
        outputChannel,
        statusBarItem,
    );

    // Auto-connect if configured
    const config = vscode.workspace.getConfiguration('bobHelper');
    if (config.get<boolean>('autoConnect', true)) {
        // Delay initial connection to let Antigravity finish loading
        setTimeout(() => connect(), 3000);
    }
}

export function deactivate() {
    disconnect();
}

// ─── WebSocket Connection ───────────────────────────────────────────

function connect() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        log('Already connected');
        return;
    }

    const config = vscode.workspace.getConfiguration('bobHelper');
    const port = config.get<number>('port', DEFAULT_PORT);
    const url = `ws://localhost:${port}`;

    log(`Connecting to BOB at ${url}...`);
    updateStatusBar('connecting');

    try {
        ws = new WebSocket(url);

        ws.on('open', () => {
            log('✅ Connected to BOB Monitor');
            updateStatusBar('connected');
            clearReconnectTimer();

            // Send hello with workspace info
            const hello: HelloPayload = {
                extensionVersion: '0.1.0',
                workspaceName: vscode.workspace.workspaceFolders?.[0]?.name || 'unknown',
                workspacePath: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                windowId: `ext-${Date.now()}`,
            };
            log(`📍 Sending hello - workspaceName: ${hello.workspaceName}`);
            log(`📍 Sending hello - workspacePath: ${hello.workspacePath}`);
            send({ type: 'hello', payload: hello as unknown as Record<string, unknown>, id: 'hello' });

            // Start state watcher — pushes state changes to BOB
            startStateWatcher();
        });

        ws.on('message', (data: WebSocket.RawData) => {
            try {
                const msg: BobMessage = JSON.parse(data.toString());
                handleMessage(msg);
            } catch (err) {
                log(`⚠️ Failed to parse message: ${err}`);
            }
        });

        ws.on('close', (code: number, reason: Buffer) => {
            log(`Connection closed (${code}: ${reason.toString()})`);
            updateStatusBar('disconnected');
            stopStateWatcher();
            scheduleReconnect();
        });

        ws.on('error', (err: Error) => {
            // Don't log ECONNREFUSED as error — BOB might not be running
            if ((err as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
                log('BOB Monitor not running, will retry...');
            } else {
                log(`⚠️ WebSocket error: ${err.message}`);
            }
            updateStatusBar('disconnected');
        });
    } catch (err) {
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

async function handleMessage(msg: BobMessage) {
    log(`← Received: ${msg.type} (id: ${msg.id})`);

    switch (msg.type) {
        case 'getState': {
            const state = await readAntigravityState();
            send({
                type: 'state',
                payload: state as unknown as Record<string, unknown>,
                id: msg.id,
            });
            break;
        }

        case 'acceptAll': {
            const result = await actions.acceptAll();
            send({ type: 'result', payload: result as unknown as Record<string, unknown>, id: msg.id });
            break;
        }

        case 'acceptStep': {
            const result = await actions.acceptAgentStep();
            send({ type: 'result', payload: result as unknown as Record<string, unknown>, id: msg.id });
            break;
        }

        case 'acceptTerminal': {
            const result = await actions.acceptTerminalCommand();
            send({ type: 'result', payload: result as unknown as Record<string, unknown>, id: msg.id });
            break;
        }

        case 'runTerminal': {
            const result = await actions.runTerminalCommand();
            send({ type: 'result', payload: result as unknown as Record<string, unknown>, id: msg.id });
            break;
        }

        case 'retry': {
            const result = await actions.retryAction();
            send({ type: 'result', payload: result as unknown as Record<string, unknown>, id: msg.id });
            break;
        }

        case 'sendPrompt': {
            const text = (msg.payload?.text as string) || '';
            if (!text) {
                send({
                    type: 'error',
                    payload: { success: false, action: 'sendPrompt', error: 'No prompt text provided' },
                    id: msg.id,
                });
                break;
            }
            const result = await actions.sendPrompt(text);
            send({ type: 'result', payload: result as unknown as Record<string, unknown>, id: msg.id });
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
    if (stateWatcher) { return; }

    stateWatcher = new StateWatcher((state) => {
        send({
            type: 'stateChanged',
            payload: state as unknown as Record<string, unknown>,
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
    if (reconnectTimer) { return; }

    const config = vscode.workspace.getConfiguration('bobHelper');
    if (!config.get<boolean>('autoConnect', true)) { return; }

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

export function send(msg: ExtensionResponse) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
        log(`→ Sent: ${msg.type} (id: ${msg.id})`);
    }
}

function updateStatusBar(status: 'connected' | 'connecting' | 'disconnected') {
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
    const connected = ws && ws.readyState === WebSocket.OPEN;
    const workspace = vscode.workspace.workspaceFolders?.[0]?.name || 'none';

    vscode.window.showInformationMessage(
        `BOB Helper: ${connected ? '✅ Connected' : '❌ Disconnected'} | Workspace: ${workspace}`,
        connected ? 'Disconnect' : 'Connect',
    ).then(action => {
        if (action === 'Connect') { connect(); }
        if (action === 'Disconnect') { disconnect(); }
    });
}

function log(message: string) {
    const timestamp = new Date().toISOString().substring(11, 23);
    outputChannel.appendLine(`[${timestamp}] ${message}`);
}

async function discoverCommands() {
    const keywords = ['allow', 'permission', 'approve', 'trust', 'grant', 'yolo', 'tool', 'accept', 'cascade'];
    const allCommands = await vscode.commands.getCommands(true);

    // Filter for antigravity commands matching any keyword
    const matched = allCommands.filter(cmd => {
        const lower = cmd.toLowerCase();
        return lower.includes('antigravity') && keywords.some(kw => lower.includes(kw));
    });

    outputChannel.show();
    log('');
    log('══════════════════════════════════════════');
    log(`🔍 COMMAND DISCOVERY (${matched.length} matches from ${allCommands.length} total)`);
    log(`Keywords: ${keywords.join(', ')}`);
    log('──────────────────────────────────────────');
    matched.sort().forEach(cmd => log(`  • ${cmd}`));
    log('══════════════════════════════════════════');

    // Also try executing each "allow/permission" variant to see which ones exist
    const allowVariants = [
        'antigravity.permission.allow',
        'antigravity.permission.allowForConversation',
        'antigravity.permission.allowAll',
        'antigravity.permission.alwaysAllow',
        'antigravity.tool.allow',
        'antigravity.tool.approve',
        'antigravity.agent.allow',
        'antigravity.agent.approve',
        'antigravity.agent.allowTool',
        'antigravity.cascadeAction.allow',
        'antigravity.yolo',
    ];

    log('');
    log('🧪 TESTING ALLOW VARIANTS:');
    for (const cmd of allowVariants) {
        try {
            await vscode.commands.executeCommand(cmd);
            log(`  ✅ ${cmd} — EXECUTED (no error)`);
        } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : String(e);
            const exists = !errMsg.includes('not found') && !errMsg.includes('is not known');
            log(`  ${exists ? '⚠️' : '❌'} ${cmd} — ${errMsg.substring(0, 80)}`);
        }
    }
    log('══════════════════════════════════════════');

    vscode.window.showInformationMessage(`Found ${matched.length} matching commands — see BOB Helper output`);
}
