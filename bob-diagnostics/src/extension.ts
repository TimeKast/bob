// BOB Diagnostics Extension
// Captures Antigravity diagnostics for analysis

import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('BOB Diagnostics');
    
    // Status bar button
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
    statusBar.text = '🔍 Diag';
    statusBar.tooltip = 'BOB: Capture Antigravity Diagnostics';
    statusBar.command = 'bob-diagnostics.captureDiagnostics';
    statusBar.show();
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
                        
                        // ── FATAL ERRORS SECTION ──
                        const logs: string[] = parsed.extensionLogs || [];
                        
                        // Patterns that KILL the agent
                        const fatalPatterns = [
                            'agent executor error',
                            'connection was forcibly closed',
                            'established connection was aborted',
                            'no such host',
                            'Language server shutting down',
                            'Language server exited',
                        ];
                        
                        const fatalErrors = logs.filter((line: string) => {
                            const lower = line.toLowerCase();
                            return fatalPatterns.some(p => lower.includes(p.toLowerCase()));
                        });
                        
                        if (fatalErrors.length === 0) {
                            outputChannel.appendLine('✅ NO FATAL ERRORS FOUND');
                        } else {
                            outputChannel.appendLine(`💀 FATAL ERRORS: ${fatalErrors.length}`);
                            outputChannel.appendLine('─────────────────────────────────────────────────────────');
                            fatalErrors.forEach((line: string, i: number) => {
                                outputChannel.appendLine(`  ${i + 1}. ${line.trim()}`);
                            });
                            outputChannel.appendLine('─────────────────────────────────────────────────────────');
                        }
                        
                        // ── 503 ERRORS (may kill after retries) ──
                        const capacityErrors = logs.filter((line: string) => 
                            line.includes('No capacity available')
                        );
                        if (capacityErrors.length > 0) {
                            outputChannel.appendLine('');
                            outputChannel.appendLine(`⚠️ 503 CAPACITY ERRORS: ${capacityErrors.length}`);
                            // Show last 5 only
                            capacityErrors.slice(-5).forEach((line: string) => {
                                const match = line.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
                                const model = line.match(/model (\S+)/);
                                outputChannel.appendLine(`  ${match?.[1] || '?'} → ${model?.[1] || '?'}`);
                            });
                        }
                        
                        // ── LAST ACTIVITY ──
                        outputChannel.appendLine('');
                        const plannerLogs = logs.filter((line: string) => 
                            line.includes('Requesting planner')
                        );
                        if (plannerLogs.length > 0) {
                            const last = plannerLogs[plannerLogs.length - 1];
                            const match = last.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
                            const msgs = last.match(/(\d+) chat messages/);
                            outputChannel.appendLine(`📊 LAST AGENT ACTIVITY: ${match?.[1] || '?'} (${msgs?.[1] || '?'} messages)`);
                        }
                        
                        // ── TRAJECTORIES ──
                        if (parsed.recentTrajectories?.length) {
                            outputChannel.appendLine('');
                            outputChannel.appendLine(`📋 TRAJECTORIES: ${parsed.recentTrajectories.length}`);
                            parsed.recentTrajectories.forEach((traj: any, i: number) => {
                                const status = traj.status || traj.state || 'unknown';
                                const error = traj.error ? `❌ ${JSON.stringify(traj.error)}` : '✅';
                                outputChannel.appendLine(`  [${i}] step ${traj.lastStepIndex || '?'} | ${status} | ${error}`);
                            });
                        }
                        
                        // ── TOP-LEVEL KEYS (for reference) ──
                        outputChannel.appendLine('');
                        outputChannel.appendLine(`📂 KEYS: ${Object.keys(parsed).join(', ')}`);
                        
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
    
    context.subscriptions.push(captureDiagnostics, captureAllCommands, outputChannel, statusBar);
    
    console.log('BOB Diagnostics extension activated');
}

export function deactivate() {}
