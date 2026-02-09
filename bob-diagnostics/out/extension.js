"use strict";
// BOB Diagnostics Extension
// Captures Antigravity diagnostics for analysis
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
const vscode = __importStar(require("vscode"));
let outputChannel;
function activate(context) {
    outputChannel = vscode.window.createOutputChannel('BOB Diagnostics');
    // Command: Capture Diagnostics
    const captureDiagnostics = vscode.commands.registerCommand('bob-diagnostics.captureDiagnostics', async () => {
        outputChannel.clear();
        outputChannel.show(true);
        outputChannel.appendLine('═══════════════════════════════════════════════════════════');
        outputChannel.appendLine('  BOB DIAGNOSTICS CAPTURE');
        outputChannel.appendLine(`  Timestamp: ${new Date().toISOString()}`);
        outputChannel.appendLine('═══════════════════════════════════════════════════════════');
        outputChannel.appendLine('');
        try {
            // Execute getDiagnostics command
            outputChannel.appendLine('📊 Executing antigravity.getDiagnostics...');
            outputChannel.appendLine('');
            const result = await vscode.commands.executeCommand('antigravity.getDiagnostics');
            if (result && typeof result === 'string') {
                try {
                    const parsed = JSON.parse(result);
                    outputChannel.appendLine('✅ Raw JSON (formatted):');
                    outputChannel.appendLine('─────────────────────────────────────────────────────────');
                    outputChannel.appendLine(JSON.stringify(parsed, null, 2));
                    outputChannel.appendLine('─────────────────────────────────────────────────────────');
                    // Highlight key fields
                    outputChannel.appendLine('');
                    outputChannel.appendLine('🔍 KEY FIELDS ANALYSIS:');
                    outputChannel.appendLine('');
                    // Check recentTrajectories
                    if (parsed.recentTrajectories?.length) {
                        outputChannel.appendLine(`📋 recentTrajectories: ${parsed.recentTrajectories.length} items`);
                        parsed.recentTrajectories.forEach((traj, i) => {
                            outputChannel.appendLine(`  [${i}] lastStepIndex: ${traj.lastStepIndex}`);
                            outputChannel.appendLine(`      summary: ${traj.summary?.substring(0, 100)}...`);
                            // Log ALL fields of trajectory
                            outputChannel.appendLine(`      ALL FIELDS: ${Object.keys(traj).join(', ')}`);
                            // Check for error-related fields
                            if (traj.status)
                                outputChannel.appendLine(`      ⚠️ status: ${traj.status}`);
                            if (traj.error)
                                outputChannel.appendLine(`      ❌ error: ${JSON.stringify(traj.error)}`);
                            if (traj.failed)
                                outputChannel.appendLine(`      ❌ failed: ${traj.failed}`);
                            if (traj.state)
                                outputChannel.appendLine(`      📌 state: ${traj.state}`);
                        });
                    }
                    else {
                        outputChannel.appendLine('📋 recentTrajectories: (empty or missing)');
                    }
                    // Log all top-level keys
                    outputChannel.appendLine('');
                    outputChannel.appendLine(`📂 TOP-LEVEL KEYS: ${Object.keys(parsed).join(', ')}`);
                }
                catch (parseErr) {
                    outputChannel.appendLine('⚠️ Could not parse as JSON:');
                    outputChannel.appendLine(result);
                }
            }
            else if (result) {
                outputChannel.appendLine('📄 Result (not a string):');
                outputChannel.appendLine(JSON.stringify(result, null, 2));
            }
            else {
                outputChannel.appendLine('⚠️ No result returned from getDiagnostics');
            }
        }
        catch (error) {
            outputChannel.appendLine(`❌ Error executing getDiagnostics: ${error}`);
        }
        outputChannel.appendLine('');
        outputChannel.appendLine('═══════════════════════════════════════════════════════════');
        outputChannel.appendLine('  END OF DIAGNOSTICS');
        outputChannel.appendLine('═══════════════════════════════════════════════════════════');
        vscode.window.showInformationMessage('BOB Diagnostics captured! Check the output panel.');
    });
    // Command: List all Antigravity commands
    const captureAllCommands = vscode.commands.registerCommand('bob-diagnostics.captureAllCommands', async () => {
        outputChannel.clear();
        outputChannel.show(true);
        outputChannel.appendLine('═══════════════════════════════════════════════════════════');
        outputChannel.appendLine('  ANTIGRAVITY COMMANDS LIST');
        outputChannel.appendLine(`  Timestamp: ${new Date().toISOString()}`);
        outputChannel.appendLine('═══════════════════════════════════════════════════════════');
        outputChannel.appendLine('');
        try {
            const allCommands = await vscode.commands.getCommands(true);
            const antigravityCommands = allCommands.filter(cmd => cmd.toLowerCase().includes('antigravity') ||
                cmd.toLowerCase().includes('cascade'));
            outputChannel.appendLine(`Found ${antigravityCommands.length} Antigravity/Cascade commands:`);
            outputChannel.appendLine('');
            antigravityCommands.sort().forEach(cmd => {
                outputChannel.appendLine(`  ${cmd}`);
            });
        }
        catch (error) {
            outputChannel.appendLine(`❌ Error: ${error}`);
        }
        outputChannel.appendLine('');
        outputChannel.appendLine('═══════════════════════════════════════════════════════════');
    });
    context.subscriptions.push(captureDiagnostics, captureAllCommands, outputChannel);
    console.log('BOB Diagnostics extension activated');
}
function deactivate() { }
//# sourceMappingURL=extension.js.map