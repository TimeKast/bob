// BOB Helper — State Reader
// Reads Antigravity's internal state via VS Code context API

import * as vscode from 'vscode';
import type { AntigravityState } from './protocol';
import { log } from './logger';

// Agent working detection via lastStepIndex from getDiagnostics
let lastStepIndex = -1;
let stepIndexStableCount = 0;
let lastAgentWorking: boolean | null = null; // null = first run
const STABLE_POLLS_FOR_IDLE = 6;

export async function readAntigravityState(): Promise<AntigravityState> {
    const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'unknown';
    
    // Get agent working state from getDiagnostics
    const { agentWorking, currentStepIndex } = await checkAgentWorkingState();
    
    // hasEnter = agent is idle (ready for input)
    const hasEnterButton = !agentWorking;
    
    // Log only on state changes (or first run)
    if (lastAgentWorking === null || agentWorking !== lastAgentWorking) {
        log(agentWorking ? `⏳ Agent WORKING (step ${currentStepIndex})` : `✅ Agent IDLE (step ${currentStepIndex})`);
        lastAgentWorking = agentWorking;
    }
    
    const hasAcceptButton = false;
    const terminalPending = false;
    const hasRetryButton = false;

    return {
        hasAcceptButton,
        hasRetryButton,
        hasEnterButton,
        agentWorking,
        terminalPending,
        workspaceName,
    };
}

/**
 * Check if agent is working by comparing lastStepIndex from getDiagnostics
 */
async function checkAgentWorkingState(): Promise<{ agentWorking: boolean; currentStepIndex: number }> {
    try {
        const result = await vscode.commands.executeCommand('antigravity.getDiagnostics') as string;
        
        if (!result || typeof result !== 'string') {
            return { agentWorking: false, currentStepIndex: -1 };
        }
        
        // getDiagnostics returns a JSON string, parse it
        const diagnostics = JSON.parse(result);
        
        // Try recentTrajectories
        if (diagnostics.recentTrajectories?.length) {
            const activeTrajectory = diagnostics.recentTrajectories[0];
            const currentStepIndex = activeTrajectory.lastStepIndex || 0;
            
            if (lastStepIndex === -1) {
                log(`[DEBUG] Got step ${currentStepIndex} from: ${activeTrajectory.summary}`);
                lastStepIndex = currentStepIndex;
                stepIndexStableCount = 0;
                return { agentWorking: false, currentStepIndex };
            }
            
            if (currentStepIndex !== lastStepIndex) {
                lastStepIndex = currentStepIndex;
                stepIndexStableCount = 0;
                return { agentWorking: true, currentStepIndex };
            } else {
                stepIndexStableCount++;
                return { 
                    agentWorking: stepIndexStableCount < STABLE_POLLS_FOR_IDLE, 
                    currentStepIndex 
                };
            }
        }
        
        // No recentTrajectories - return idle
        return { agentWorking: false, currentStepIndex: -1 };
    } catch (e) {
        log(`[DEBUG] Error: ${e}`);
        return { agentWorking: false, currentStepIndex: -1 };
    }
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

    start(pollMs: number = 10000): void {
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
