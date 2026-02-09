// BOB Diagnostics Extension
// Captures Antigravity diagnostics for analysis

import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('BOB Diagnostics');
    
    // Command: Capture Diagnostics
    const captureDiagnostics = vscode.commands.registerCommand(
        'bob-diagnostics.captureDiagnostics',
        async () => {
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
                            parsed.recentTrajectories.forEach((traj: any, i: number) => {
                                outputChannel.appendLine(`  [${i}] lastStepIndex: ${traj.lastStepIndex}`);
                                outputChannel.appendLine(`      summary: ${traj.summary?.substring(0, 100)}...`);
                                // Log ALL fields of trajectory
                                outputChannel.appendLine(`      ALL FIELDS: ${Object.keys(traj).join(', ')}`);
                                // Check for error-related fields
                                if (traj.status) outputChannel.appendLine(`      ⚠️ status: ${traj.status}`);
                                if (traj.error) outputChannel.appendLine(`      ❌ error: ${JSON.stringify(traj.error)}`);
                                if (traj.failed) outputChannel.appendLine(`      ❌ failed: ${traj.failed}`);
                                if (traj.state) outputChannel.appendLine(`      📌 state: ${traj.state}`);
                            });
                        } else {
                            outputChannel.appendLine('📋 recentTrajectories: (empty or missing)');
                        }
                        
                        // Log all top-level keys
                        outputChannel.appendLine('');
                        outputChannel.appendLine(`📂 TOP-LEVEL KEYS: ${Object.keys(parsed).join(', ')}`);
                        
                    } catch (parseErr) {
                        outputChannel.appendLine('⚠️ Could not parse as JSON:');
                        outputChannel.appendLine(result);
                    }
                } else if (result) {
                    outputChannel.appendLine('📄 Result (not a string):');
                    outputChannel.appendLine(JSON.stringify(result, null, 2));
                } else {
                    outputChannel.appendLine('⚠️ No result returned from getDiagnostics');
                }
                
            } catch (error) {
                outputChannel.appendLine(`❌ Error executing getDiagnostics: ${error}`);
            }
            
            outputChannel.appendLine('');
            outputChannel.appendLine('═══════════════════════════════════════════════════════════');
            outputChannel.appendLine('  END OF DIAGNOSTICS');
            outputChannel.appendLine('═══════════════════════════════════════════════════════════');
            
            vscode.window.showInformationMessage('BOB Diagnostics captured! Check the output panel.');
        }
    );
    
    // Command: List all Antigravity commands
    const captureAllCommands = vscode.commands.registerCommand(
        'bob-diagnostics.captureAllCommands',
        async () => {
            outputChannel.clear();
            outputChannel.show(true);
            
            outputChannel.appendLine('═══════════════════════════════════════════════════════════');
            outputChannel.appendLine('  ANTIGRAVITY COMMANDS LIST');
            outputChannel.appendLine(`  Timestamp: ${new Date().toISOString()}`);
            outputChannel.appendLine('═══════════════════════════════════════════════════════════');
            outputChannel.appendLine('');
            
            try {
                const allCommands = await vscode.commands.getCommands(true);
                const antigravityCommands = allCommands.filter(cmd => 
                    cmd.toLowerCase().includes('antigravity') ||
                    cmd.toLowerCase().includes('cascade')
                );
                
                outputChannel.appendLine(`Found ${antigravityCommands.length} Antigravity/Cascade commands:`);
                outputChannel.appendLine('');
                antigravityCommands.sort().forEach(cmd => {
                    outputChannel.appendLine(`  ${cmd}`);
                });
                
            } catch (error) {
                outputChannel.appendLine(`❌ Error: ${error}`);
            }
            
            outputChannel.appendLine('');
            outputChannel.appendLine('═══════════════════════════════════════════════════════════');
        }
    );
    
    context.subscriptions.push(captureDiagnostics, captureAllCommands, outputChannel);
    
    console.log('BOB Diagnostics extension activated');
}

export function deactivate() {}
