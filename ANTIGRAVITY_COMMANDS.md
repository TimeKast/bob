# Antigravity Commands Reference

Lista de comandos disponibles en Antigravity (165 comandos detectados via `vscode.commands.getCommands()`).

---

## 🎯 Accept / Reject (Cambios de Código)

| Comando | Descripción |
|---------|-------------|
| `antigravity.command.accept` | Acepta el cambio/comando actual |
| `antigravity.command.reject` | Rechaza el cambio/comando actual |
| `antigravity.agent.acceptAgentStep` | Acepta un paso del agente (ej. alt+enter) |
| `antigravity.agent.rejectAgentStep` | Rechaza un paso del agente |
| `antigravity.prioritized.agentAcceptAllInFile` | Acepta todos los cambios en el archivo actual |
| `antigravity.prioritized.agentRejectAllInFile` | Rechaza todos los cambios en el archivo actual |
| `antigravity.prioritized.agentAcceptFocusedHunk` | Acepta solo el hunk/bloque enfocado |
| `antigravity.prioritized.agentRejectFocusedHunk` | Rechaza solo el hunk/bloque enfocado |
| `antigravity.prioritized.agentFocusNextHunk` | Navega al siguiente hunk de cambios |
| `antigravity.prioritized.agentFocusPreviousHunk` | Navega al hunk anterior |
| `antigravity.prioritized.agentFocusNextFile` | Navega al siguiente archivo con cambios |
| `antigravity.prioritized.agentFocusPreviousFile` | Navega al archivo anterior con cambios |

---

## 💬 Chat / Conversación

| Comando | Descripción |
|---------|-------------|
| `antigravity.sendTextToChat` | Envía texto al chat (sin enviar) |
| `antigravity.sendChatActionMessage` | Envía un mensaje de acción al chat |
| `antigravity.toggleChatFocus` | Cambia foco al chat |
| `antigravity.startNewConversation` | Inicia nueva conversación |
| `antigravity.openConversationPicker` | Abre selector de conversaciones |
| `antigravity.openConversationWorkspaceQuickPick` | Quick pick de conversaciones del workspace |
| `antigravity.setVisibleConversation` | Establece conversación visible |
| `antigravity.executeCascadeAction` | Ejecuta una acción de Cascade |
| `antigravity.prioritized.chat.openNewConversation` | Abre nueva conversación (prioritario) |

---

## 🖥️ Terminal

| Comando | Descripción |
|---------|-------------|
| `antigravity.terminalCommand.accept` | Acepta comando de terminal pendiente |
| `antigravity.terminalCommand.reject` | Rechaza comando de terminal pendiente |
| `antigravity.terminalCommand.run` | Ejecuta comando de terminal (ctrl+enter) |
| `antigravity.prioritized.terminalCommand.open` | Abre el comando de terminal |
| `antigravity.sendTerminalToSidePanel` | Envía terminal al panel lateral |
| `antigravity.showManagedTerminal` | Muestra terminal administrada |
| `antigravity.onShellCommandCompletion` | Hook cuando comando shell termina |
| `antigravity.onManagerTerminalCommandStart` | Hook inicio de comando en manager |
| `antigravity.onManagerTerminalCommandData` | Hook datos de comando en manager |
| `antigravity.onManagerTerminalCommandFinish` | Hook fin de comando en manager |
| `antigravity.updateTerminalLastCommand` | Actualiza último comando de terminal |

---

## 🪟 Panel / UI

| Comando | Descripción |
|---------|-------------|
| `antigravity.openAgent` | Abre el agente |
| `antigravity.agentPanel.open` | Abre panel del agente |
| `antigravity.agentPanel.focus` | Enfoca panel del agente |
| `antigravity.agentPanel.expandView` | Expande vista del panel |
| `antigravity.agentPanel.toggleVisibility` | Toggle visibilidad del panel |
| `antigravity.agentPanel.removeView` | Remueve vista del panel |
| `antigravity.agentPanel.resetViewLocation` | Resetea ubicación del panel |
| `antigravity.agentSidePanel.open` | Abre panel lateral del agente |
| `antigravity.agentSidePanel.focus` | Enfoca panel lateral |
| `antigravity.agentSidePanel.expandView` | Expande panel lateral |
| `antigravity.agentSidePanel.resetViewLocation` | Resetea ubicación panel lateral |
| `antigravity.agentViewContainerId` | ID del contenedor de vista |
| `antigravity.agentViewContainerId.resetViewContainerLocation` | Resetea ubicación contenedor |
| `antigravity.switchBetweenWorkspaceAndAgent` | Cambia entre workspace y agente |
| `workbench.antigravity.showLaunchpad` | Muestra launchpad |

---

## 📝 Diff Zones

| Comando | Descripción |
|---------|-------------|
| `antigravity.openDiffZones` | Abre zonas de diff |
| `antigravity.closeAllDiffZones` | Cierra todas las zonas de diff |
| `antigravity.setDiffZonesState` | Establece estado de zonas de diff |
| `antigravity.handleDiffZoneEdit` | Maneja edición en zona de diff |
| `antigravity.openReviewChanges` | Abre revisión de cambios |
| `antigravity.sidecar.sendDiffZone` | Envía zona de diff al sidecar |

---

## ⚙️ Configuración

| Comando | Descripción |
|---------|-------------|
| `antigravity.openQuickSettingsPanel` | Abre panel de configuración rápida |
| `antigravity.editorModeSettings` | Configuración del modo editor |
| `antigravity.openGlobalRules` | Abre reglas globales |
| `antigravity.openCustomizationsTab` | Abre pestaña de personalizaciones |
| `antigravity.customizeAppIcon` | Personaliza ícono de la app |
| `antigravity.openMcpConfigFile` | Abre archivo de configuración MCP |
| `antigravity.openConfigurePluginsPage` | Abre página de configuración de plugins |

---

## 🔌 Importación / Migración

| Comando | Descripción |
|---------|-------------|
| `antigravity.migrateWindsurfSettings` | Migra configuración de Windsurf |
| `antigravity.importVSCodeSettings` | Importa configuración de VS Code |
| `antigravity.importVSCodeExtensions` | Importa extensiones de VS Code |
| `antigravity.importCursorSettings` | Importa configuración de Cursor |
| `antigravity.importCursorExtensions` | Importa extensiones de Cursor |
| `antigravity.importCiderSettings` | Importa configuración de Cider |
| `antigravity.importWindsurfSettings` | Importa configuración de Windsurf |
| `antigravity.importWindsurfExtensions` | Importa extensiones de Windsurf |
| `antigravity.importVSCodeRecentWorkspaces` | Importa workspaces recientes de VS Code |

---

## 🐛 Debug / Diagnóstico

| Comando | Descripción |
|---------|-------------|
| `antigravity.getDiagnostics` | Obtiene diagnósticos (devuelve JSON) |
| `antigravity.downloadDiagnostics` | Descarga archivo de diagnósticos |
| `antigravity.toggleDebugInfoWidget` | Toggle widget de debug |
| `antigravity.updateDebugInfoWidget` | Actualiza widget de debug |
| `antigravity.toggleManagerDevTools` | Toggle devtools del manager |
| `antigravity.toggleSettingsDevTools` | Toggle devtools de settings |
| `antigravity.getWorkbenchTrace` | Obtiene trace del workbench |
| `antigravity.getManagerTrace` | Obtiene trace del manager |
| `antigravity.enableTracing` | Habilita tracing |
| `antigravity.clearAndDisableTracing` | Limpia y deshabilita tracing |
| `antigravity.captureTraces` | Captura traces |
| `antigravity.sendAnalyticsAction` | Envía acción de analytics |
| `antigravity.uploadErrorAction` | Sube error |
| `antigravity.logObservabilityDataAction` | Log de datos de observabilidad |
| `antigravity.simulateSegFault` | Simula segfault (testing) |

---

## 🔄 Onboarding / Reset

| Comando | Descripción |
|---------|-------------|
| `antigravity.onboarding.reset` | Resetea onboarding |
| `agent.postOnboarding.reset` | Resetea post-onboarding |
| `antigravity.manager.onboarding.reset` | Resetea onboarding del manager |
| `antigravity.resetOnboardingBackend` | Resetea backend de onboarding |
| `antigravity.reloadWindow` | Recarga ventana |

---

## 📚 Documentación / Ayuda

| Comando | Descripción |
|---------|-------------|
| `antigravity.openDocs` | Abre documentación |
| `antigravity.openMcpDocsPage` | Abre docs de MCP |
| `antigravity.openRulesEducationalLink` | Abre link educativo de reglas |
| `antigravity.openTroubleshooting` | Abre troubleshooting |
| `antigravity.openChangeLog` | Abre changelog |
| `antigravity.openIssueReporter` | Abre reporter de issues |
| `antigravity.prioritized.explainProblem` | Explica el problema |
| `antigravity.explainAndFixProblem` | Explica y arregla problema |

---

## 🧩 Workflows / Reglas

| Comando | Descripción |
|---------|-------------|
| `antigravity.createWorkflow` | Crea workflow |
| `antigravity.createGlobalWorkflow` | Crea workflow global |
| `antigravity.createRule` | Crea regla |

---

## 🌐 Browser / Navegador

| Comando | Descripción |
|---------|-------------|
| `antigravity.openBrowser` | Abre navegador |
| `antigravity.showBrowserAllowlist` | Muestra allowlist del navegador |
| `antigravity.getBrowserOnboardingPort` | Obtiene puerto de onboarding del browser |
| `antigravity.openGenericUrl` | Abre URL genérica |
| `antigravity.openInCiderAction.topBar` | Abre en Cider desde top bar |

---

## 🔐 Autenticación

| Comando | Descripción |
|---------|-------------|
| `antigravity.cancelLogin` | Cancela login |
| `antigravity.handleAuthRefresh` | Maneja refresh de auth |

---

## 🎵 Audio

| Comando | Descripción |
|---------|-------------|
| `antigravity.playAudio` | Reproduce audio |
| `antigravity.playNote` | Reproduce nota |

---

## ⌨️ Autocompletado

| Comando | Descripción |
|---------|-------------|
| `antigravity.acceptCompletion` | Acepta autocompletado |
| `antigravity.prioritized.supercompleteAccept` | Acepta supercomplete |
| `antigravity.prioritized.supercompleteEscape` | Escapa de supercomplete |
| `antigravity.snoozeAutocomplete` | Pospone autocompletado |
| `antigravity.cancelSnoozeAutocomplete` | Cancela posposición |

---

## 🔧 Otros / Internos

| Comando | Descripción |
|---------|-------------|
| `antigravity.initializeAgent` | Inicializa el agente |
| `antigravity.restartLanguageServer` | Reinicia language server |
| `antigravity.setWorkingDirectories` | Establece directorios de trabajo |
| `antigravity.tabReporting` | Reporta tabs |
| `antigravity.isFileGitIgnored` | Verifica si archivo está en gitignore |
| `antigravity.pollMcpServerStates` | Poll de estados de servidores MCP |
| `antigravity.getCascadePluginTemplate` | Obtiene template de plugin Cascade |
| `antigravity.updatePluginInstallationCount` | Actualiza conteo de instalación de plugins |
| `antigravity.restartUserStatusUpdater` | Reinicia updater de estado de usuario |
| `antigravity.killRemoteExtensionHost` | Mata host de extensión remota |
| `antigravity.trackBackgroundConversationCreated` | Trackea creación de conversación en background |
| `antigravity.generateCommitMessage` | Genera mensaje de commit |
| `antigravity.cancelGenerateCommitMessage` | Cancela generación de commit message |
| `antigravity.prioritized.command.open` | Abre comando (prioritario) |
| `antigravity.artifacts.startComment` | Inicia comentario en artifacts |
| `antigravity.toggleRerenderFrequencyAlerts` | Toggle alertas de frecuencia de rerender |
| `antigravity.startDemoMode` | Inicia modo demo |
| `antigravity.endDemoMode` | Termina modo demo |

---

## 🖥️ Full Screen Views

| Comando | Descripción |
|---------|-------------|
| `antigravity.showSshDisconnectionFullScreenView` | Muestra vista de desconexión SSH |
| `antigravity.showLanguageServerInitFailureFullScreenView` | Muestra falla de init de LS |
| `antigravity.showAuthFailureFullScreenView` | Muestra falla de auth |
| `antigravity.showLanguageServerCrashFullScreenView` | Muestra crash de LS |
| `antigravity.hideFullScreenView` | Oculta vista fullscreen |

---

## 🐳 Dev Containers / SSH / WSL

| Comando | Descripción |
|---------|-------------|
| `antigravityDevContainers.open` | Abre dev containers |
| `antigravityDevContainers.focus` | Enfoca dev containers |
| `antigravityDevContainers.expandView` | Expande vista |
| `antigravityDevContainers.resetViewLocation` | Resetea ubicación |
| `antigravitySSHHosts.open` | Abre SSH hosts |
| `antigravitySSHHosts.focus` | Enfoca SSH hosts |
| `antigravitySSHHosts.expandView` | Expande vista SSH |
| `antigravitySSHHosts.resetViewLocation` | Resetea ubicación SSH |
| `antigravityWslTargets.open` | Abre targets WSL |
| `antigravityWslTargets.focus` | Enfoca WSL |
| `antigravityWslTargets.expandView` | Expande vista WSL |
| `antigravityWslTargets.resetViewLocation` | Resetea ubicación WSL |
| `antigravity-dev-containers.openInContainer` | Abre en container |
| `antigravity-dev-containers.reopenInContainer` | Reabre en container |
| `antigravity-dev-containers.attachToRunningContainer` | Attach a container corriendo |
| `antigravity-dev-containers.showLog` | Muestra log de container |
| `antigravity-dev-containers.reopenFolderLocally` | Reabre folder localmente |

---

## 📊 Git

| Comando | Descripción |
|---------|-------------|
| `git.antigravityReportCloneProgress` | Reporta progreso de clone |
| `git.antigravityClearCloneProgress` | Limpia progreso de clone |
| `git.antigravityCloneNonInteractive` | Clone no interactivo |
| `git.antigravityGetRemoteUrl` | Obtiene URL remota |

---

## 📋 Output Channels

| Comando | Descripción |
|---------|-------------|
| `workbench.action.output.show.google.antigravity.Antigravity` | Muestra output de Antigravity |
| `workbench.action.output.show.google.antigravity.Antigravity Crash Logs` | Muestra crash logs |
| `workbench.action.output.show.extension-output-google.antigravity-dev-containers-#1...` | Output de dev containers |

---

## 📌 Agent Manager

| Comando | Descripción |
|---------|-------------|
| `antigravityAgentManager.reportError` | Reporta error |
| `antigravityAgentManager.reportStatus` | Reporta status |
| `antigravityAgentManager.clearErrors` | Limpia errores |
| `antigravityAgentManager.reportNotification` | Reporta notificación |

---

## 🔑 Comandos Clave para BOB

Los más relevantes para la integración con BOB:

1. **Envío de prompts**: `antigravity.sendTextToChat`, `antigravity.sendChatActionMessage`
2. **Accept/Reject**: `antigravity.command.accept`, `antigravity.command.reject`
3. **Terminal**: `antigravity.terminalCommand.accept`, `antigravity.terminalCommand.run`
4. **Focus**: `antigravity.agentPanel.focus`, `antigravity.toggleChatFocus`
5. **Diagnóstico**: `antigravity.getDiagnostics`

---

*Generado desde `vscode.commands.getCommands(true)` en Antigravity*
