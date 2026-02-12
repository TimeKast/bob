// BOB Helper — State Reader
// Reads Antigravity's internal state via VS Code context API

import * as vscode from 'vscode';
import type { AntigravityState } from './protocol';
import { log } from './logger';

// Agent working detection via lastStepIndex from getDiagnostics
let lastStepIndex = -1;
let stepIndexStableCount = 0;
let lastAgentWorking: boolean | null = null; // null = first run
// Agent is considered idle only after step index is stable for this many polls
// At ~5s per poll, 12 polls = ~60 seconds of no step changes
const STABLE_POLLS_FOR_IDLE = 12;

// Prompt tracking for fatal error detection
let promptSentAt: number | null = null;
let lastConsecutiveErrors = 0;
const ERROR_CHECK_DELAY_MS = 30_000; // 30 seconds after prompt to check for errors

// Fatal error patterns that KILL the agent
const FATAL_PATTERNS = [
    'agent executor error',
    'connection was forcibly closed',
    'established connection was aborted',
    'language server exited',
];

/**
 * Called by actions.ts when a prompt is sent successfully.
 * Starts the 30-second timer for fatal error checking.
 */
export function markPromptSent(): void {
    promptSentAt = Date.now();
    lastConsecutiveErrors = 0;
    log(`[stateReader] Prompt sent, will check for errors after 30s`);
}

export async function readAntigravityState(): Promise<AntigravityState> {
    const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'unknown';
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

    // Get agent working state from getDiagnostics
    const { agentWorking, currentStepIndex, consecutiveErrors, capacityErrors, lastActivityTimestamp, messageCount } = await checkAgentWorkingState();

    // hasEnter = agent is idle (ready for input)
    const hasEnterButton = !agentWorking;

    // Log only on state changes (or first run)
    if (lastAgentWorking === null || agentWorking !== lastAgentWorking) {
        const errStr = consecutiveErrors > 0 ? ` ❌ errors: ${consecutiveErrors}` : '';
        log(agentWorking ? `⏳ Agent WORKING (step ${currentStepIndex})` : `✅ Agent IDLE (step ${currentStepIndex})${errStr}`);
        lastAgentWorking = agentWorking;
    }

    const hasAcceptButton = false;
    const terminalPending = false;
    const hasRetryButton = consecutiveErrors > 0;

    return {
        hasAcceptButton,
        hasRetryButton,
        hasEnterButton,
        agentWorking,
        terminalPending,
        workspaceName,
        workspacePath,
        consecutiveErrors,
        capacityErrors,
        lastActivityTimestamp,
        messageCount,
    };
}

/**
 * Check if agent is working by comparing lastStepIndex from getDiagnostics.
 * If prompt was sent and step hasn't advanced in 30s, checks for fatal errors.
 */
async function checkAgentWorkingState(): Promise<{ agentWorking: boolean; currentStepIndex: number; consecutiveErrors: number; capacityErrors: number; lastActivityTimestamp: string; messageCount: number }> {
    try {
        const result = await vscode.commands.executeCommand('antigravity.getDiagnostics') as string;

        if (!result || typeof result !== 'string') {
            return { agentWorking: false, currentStepIndex: -1, consecutiveErrors: lastConsecutiveErrors, capacityErrors: 0, lastActivityTimestamp: '', messageCount: 0 };
        }

        // getDiagnostics returns a JSON string, parse it
        const diagnostics = JSON.parse(result);

        // Parse 503 capacity errors
        const capacityErrors = parse503Errors(diagnostics.extensionLogs || []);

        // Extract last activity info
        const lastActivityTimestamp = diagnostics.lastAgentActivity?.timestamp || '';
        const messageCount = diagnostics.lastAgentActivity?.messageCount || 0;

        // Try recentTrajectories
        if (diagnostics.recentTrajectories?.length) {
            const activeTrajectory = diagnostics.recentTrajectories[0];
            const currentStepIndex = activeTrajectory.lastStepIndex || 0;

            if (lastStepIndex === -1) {
                log(`[DEBUG] Got step ${currentStepIndex} from: ${activeTrajectory.summary}`);
                lastStepIndex = currentStepIndex;
                stepIndexStableCount = 0;
                return { agentWorking: false, currentStepIndex, consecutiveErrors: 0, capacityErrors, lastActivityTimestamp, messageCount };
            }

            if (currentStepIndex !== lastStepIndex) {
                // Step advanced — agent is working, reset errors
                lastStepIndex = currentStepIndex;
                stepIndexStableCount = 0;
                promptSentAt = null; // Clear prompt timer since agent responded
                lastConsecutiveErrors = 0;
                return { agentWorking: true, currentStepIndex, consecutiveErrors: 0, capacityErrors, lastActivityTimestamp, messageCount };
            } else {
                // Step didn't advance
                stepIndexStableCount++;
                const agentWorking = stepIndexStableCount < STABLE_POLLS_FOR_IDLE;

                // Check for fatal errors if:
                // 1. A prompt was sent
                // 2. Enough time has passed (30s)
                // 3. Step hasn't advanced (agent is not responding)
                if (!agentWorking && promptSentAt && (Date.now() - promptSentAt >= ERROR_CHECK_DELAY_MS)) {
                    const errors = parseFatalErrors(diagnostics.extensionLogs || []);
                    if (errors > 0) {
                        lastConsecutiveErrors = errors;
                        log(`[stateReader] 💀 Detected ${errors} fatal error(s) since last step`);
                    }
                    promptSentAt = null; // Only check once per prompt
                }

                return { agentWorking, currentStepIndex, consecutiveErrors: lastConsecutiveErrors, capacityErrors, lastActivityTimestamp, messageCount };
            }
        }

        // No recentTrajectories - return idle
        return { agentWorking: false, currentStepIndex: -1, consecutiveErrors: lastConsecutiveErrors, capacityErrors: 0, lastActivityTimestamp: '', messageCount: 0 };
    } catch (e) {
        log(`[DEBUG] Error: ${e}`);
        return { agentWorking: false, currentStepIndex: -1, consecutiveErrors: lastConsecutiveErrors, capacityErrors: 0, lastActivityTimestamp: '', messageCount: 0 };
    }
}

/**
 * Parse extensionLogs for fatal errors that occurred after the last successful step.
 * Returns the count of fatal errors found.
 */
function parseFatalErrors(logs: string[]): number {
    if (!logs || logs.length === 0) return 0;

    // Find the index of the last successful planner request
    let lastPlannerIdx = -1;
    for (let i = logs.length - 1; i >= 0; i--) {
        if (logs[i].includes('Requesting planner')) {
            lastPlannerIdx = i;
            break;
        }
    }

    // Search for fatal errors after the last planner request
    // If no planner request found, search the last 50 lines
    const startIdx = lastPlannerIdx >= 0 ? lastPlannerIdx : Math.max(0, logs.length - 50);

    let fatalCount = 0;
    for (let i = startIdx; i < logs.length; i++) {
        const line = logs[i].toLowerCase();
        if (FATAL_PATTERNS.some(p => line.includes(p))) {
            fatalCount++;
        }
    }

    return fatalCount;
}

/**
 * Parse extensionLogs for recent 503 capacity errors.
 * Returns the count of 503 errors found in the last 100 log lines.
 */
function parse503Errors(logs: string[]): number {
    if (!logs || logs.length === 0) return 0;

    const recentLogs = logs.slice(-100);
    let count = 0;
    for (const line of recentLogs) {
        if (line.includes('503') || line.includes('capacity') || line.includes('overloaded')) {
            count++;
        }
    }
    return count;
}

/**
 * Sets up watchers to detect state changes and invoke callback.
 */
export class StateWatcher {
    private interval: NodeJS.Timeout | null = null;
    private lastState: string = '';
    private onChange: (state: AntigravityState) => void;

    constructor(onChange: (state: AntigravityState) => void) {
        this.onChange = onChange;
    }

    start(pollMs: number = 3000): void {
        if (this.interval) { return; }

        this.interval = setInterval(async () => {
            const state = await readAntigravityState();
            const stateHash = JSON.stringify(state);

            if (stateHash !== this.lastState) {
                this.lastState = stateHash;
                this.onChange(state);
            }
        }, pollMs);
    }

    stop(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}
