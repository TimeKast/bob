"use strict";
// BOB Helper — State Reader
// Reads Antigravity's internal state via VS Code context API
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
exports.StateWatcher = void 0;
exports.readAntigravityState = readAntigravityState;
const vscode = __importStar(require("vscode"));
const logger_1 = require("./logger");
// Agent working detection via lastStepIndex from getDiagnostics
let lastStepIndex = -1;
let stepIndexStableCount = 0;
let lastAgentWorking = null; // null = first run
const STABLE_POLLS_FOR_IDLE = 6;
async function readAntigravityState() {
    const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'unknown';
    // Get agent working state from getDiagnostics
    const { agentWorking, currentStepIndex } = await checkAgentWorkingState();
    // hasEnter = agent is idle (ready for input)
    const hasEnterButton = !agentWorking;
    // Log only on state changes (or first run)
    if (lastAgentWorking === null || agentWorking !== lastAgentWorking) {
        (0, logger_1.log)(agentWorking ? `⏳ Agent WORKING (step ${currentStepIndex})` : `✅ Agent IDLE (step ${currentStepIndex})`);
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
async function checkAgentWorkingState() {
    try {
        const result = await vscode.commands.executeCommand('antigravity.getDiagnostics');
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
                (0, logger_1.log)(`[DEBUG] Got step ${currentStepIndex} from: ${activeTrajectory.summary}`);
                lastStepIndex = currentStepIndex;
                stepIndexStableCount = 0;
                return { agentWorking: false, currentStepIndex };
            }
            if (currentStepIndex !== lastStepIndex) {
                lastStepIndex = currentStepIndex;
                stepIndexStableCount = 0;
                return { agentWorking: true, currentStepIndex };
            }
            else {
                stepIndexStableCount++;
                return {
                    agentWorking: stepIndexStableCount < STABLE_POLLS_FOR_IDLE,
                    currentStepIndex
                };
            }
        }
        // No recentTrajectories - return idle
        return { agentWorking: false, currentStepIndex: -1 };
    }
    catch (e) {
        (0, logger_1.log)(`[DEBUG] Error: ${e}`);
        return { agentWorking: false, currentStepIndex: -1 };
    }
}
/**
 * Sets up watchers to detect state changes and invoke callback.
 */
class StateWatcher {
    interval = null;
    lastState = '';
    onChange;
    constructor(onChange) {
        this.onChange = onChange;
    }
    start(pollMs = 10000) {
        if (this.interval) {
            return;
        }
        this.interval = setInterval(async () => {
            const state = await readAntigravityState();
            const stateHash = JSON.stringify(state);
            if (stateHash !== this.lastState) {
                this.lastState = stateHash;
                this.onChange(state);
            }
        }, pollMs);
    }
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}
exports.StateWatcher = StateWatcher;
//# sourceMappingURL=stateReader.js.map