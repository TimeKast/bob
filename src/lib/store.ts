// Svelte stores for Antigravity Monitor state management

import { writable, get } from 'svelte/store';
import type { Instance, Settings } from './types';
import { invoke } from '@tauri-apps/api/core';
import { getSilentExtensions, matchExtensionToInstance, type SilentExtension } from './websocket';

// Default Support Prompt (Fallback)
// Default Support Prompt (Knowledge Base Generator)
const DEFAULT_SUPPORT_PROMPT = `6.0 👨💻 Generador de Knowledge Base para AI Support Agent


> *Input*: /docs/* (documentación completa)
> *Output*: /docs/support/* (knowledge base para AI)
> *Siguiente*: 7.0_Mantenimiento_Auditoria.md (cuando haya cambios)


Actúa como un AI Documentation Architect y Support Enablement Specialist.


Tu objetivo es preparar una base de conocimiento completa y precisa para un agente de AI que dará soporte técnico y funcional a clientes y usuarios finales de esta aplicación.


Tareas obligatorias:


1. Revisión y comprensión total
   - Recorre y analiza exhaustivamente TODOS los archivos dentro del directorio /docs del repositorio.
   - Asume que /docs contiene la fuente de verdad del producto.
   - Comprende a profundidad:
     - El propósito de la aplicación.
     - El flujo completo del usuario.
     - La arquitectura funcional (no solo técnica).
     - Las reglas de negocio.
     - Los tipos de usuario y sus permisos.
     - Casos normales, casos borde y flujos de error.
     - Procesos críticos y sensibles (financieros, autorizaciones, estados, etc).
     - El Design System (tokens, temas, componentes) documentado en /docs/16_design_system.md.
     - Opciones de personalización de tema disponibles para el usuario.


2. Modelo mental del producto
   - Reconstruye mentalmente cómo funciona la aplicación de inicio a fin.
   - Identifica claramente:
     - Qué problema resuelve.
     - Para quién está diseñada.
     - Qué acciones puede y no puede hacer cada tipo de usuario.
     - Qué decisiones son automáticas y cuáles requieren intervención humana.


3. Extracción de User Stories y flujos
   - Deriva y documenta:
     - User Stories claras por tipo de usuario.
     - Flujos principales (happy paths).
     - Flujos alternos.
     - Flujos de error comunes.
   - Usa lenguaje entendible tanto para usuarios finales como para agentes de soporte.


4. Identificación de temas de soporte
   - Identifica y documenta:
     - Dudas frecuentes esperables.
     - Errores comunes de usuario.
     - Bugs conocidos (si están documentados).
     - Comportamientos que podrían confundirse con bugs.
     - Limitaciones actuales del sistema.
     - Supuestos importantes que el usuario debe conocer.


5. Generación de archivos de soporte para AI
   - Crea uno o varios archivos especializados (según lo consideres óptimo).
   - Los archivos DEBEN crearse dentro del directorio:
     /docs/support
   - Ejemplos de archivos posibles (no limitativo):
     - AI_SUPPORT_KNOWLEDGE.md
     - AI_SUPPORT_PLAYBOOK.md
     - AI_SUPPORT_FAQ.md
     - AI_SUPPORT_CONTEXT.md
   - Cada archivo debe estar claramente enfocado y no ser redundante.


6. Contenido obligatorio de los archivos
   Los archivos deben incluir, como mínimo:


   - Visión general del producto (qué es y qué no es).
   - Tipos de usuario y capacidades por rol.
   - Glosario de términos del sistema.
   - User stories resumidas y detalladas.
   - Explicación de flujos clave paso a paso.
   - Mapeo de pantallas o módulos con su función.
   - Lista de preguntas frecuentes con respuestas claras.
   - Guía para clasificar feedback entrante:
     - Duda general
     - Sugerencia / mejora
     - Bug
     - Problema de uso
   - Guía para hacer preguntas de aclaración al usuario cuando la información sea insuficiente.
   - Señales claras para escalar a equipo técnico o de producto.
   - Referencias cruzadas a documentos específicos de /docs para consulta rápida (usando nombres exactos de archivo o secciones).


7. Enfoque en soporte con AI
   - Escribe el contenido pensando en que será usado por otro agente de AI.
   - El lenguaje debe ser:
     - Preciso
     - No ambiguo
     - Operativo
     - Fácil de consultar rápidamente
   - Evita suposiciones no documentadas.
   - Si algo no está claro en /docs, márcalo explícitamente como “No documentado” o “Asunción”.


8. Calidad y completitud
   - El resultado debe permitir que un agente de AI:
     - Atienda dudas funcionales sin ayuda humana.
     - Reciba y clasifique correctamente sugerencias y feedback.
     - Identifique bugs reales vs errores de uso.
     - Guíe al usuario de forma clara, consistente y empática.
   - No omitas información relevante por simplicidad.


Entregables:
- Genera los archivos finales listos para ser versionados en el repositorio.
- Asegúrate de que todos los archivos estén dentro de /docs/support.
- Usa Markdown bien estructurado.
- No incluyas explicaciones fuera de los archivos generados.
- El resultado debe poder usarse directamente como contexto base para un AI Support Agent.`;

// Default settings
const defaultSettings: Settings = {
    defaultPrompt: 'Continúa con el siguiente paso',
    defaultSupportPrompt: DEFAULT_SUPPORT_PROMPT,
    inactivitySeconds: 30,
    maxRetries: 3,
    discordWebhook: '',
    notifyOnComplete: true,
    notifyOnError: true,
    minimizeToTray: true,
    // Auto-implementation settings
    autoPrompt: 'Continúa con el siguiente paso del issue actual. Si no hay issue en progreso, ejecuta /implement con el siguiente issue P0/P1 del backlog. Si todos los issues están completados, responde exactamente: "✅ BACKLOG COMPLETADO".',
    pollIntervalSeconds: 5,  // Poll every 5 seconds (fast with WebSocket)
    stopConditions: [
        '🛑 STOP',
        '❌',
        'Architect Gating',
        'Blocked By',
        'ESCALAR',
        '✅ BACKLOG COMPLETADO'
    ],
    inactivityTimeoutMinutes: 20,  // Stop project if no prompt sent in 20 minutes
    promptSendDelaySeconds: 15,  // Cooldown after sending prompt before allowing next send
    // Logging settings
    loggingEnabled: true,
    logFilePath: '',  // Empty = use default location (app data dir)
    // Silent mode
    silentModePreferred: true,  // If true, prefer silent mode when extension is connected
    // GitHub Integration
    githubToken: import.meta.env.VITE_GITHUB_TOKEN || '',
    // Per-project overrides
    projectOverrides: {}  // { projectName: { issuesPath?: string } }
};

// Load settings from localStorage
function loadSettings(): Settings {
    if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem('bob-settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Fallback to env var if local setting is empty
            if (!parsed.githubToken && defaultSettings.githubToken) {
                parsed.githubToken = defaultSettings.githubToken;
            }
            return { ...defaultSettings, ...parsed };
        }
    }
    return defaultSettings;
}

// Settings store with persistence
function createSettingsStore() {
    const { subscribe, set, update } = writable<Settings>(loadSettings());

    return {
        subscribe,
        set: (value: Settings) => {
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem('bob-settings', JSON.stringify(value));
            }
            set(value);
        },
        update: (updater: (value: Settings) => Settings) => {
            update((current) => {
                const newValue = updater(current);
                if (typeof window !== 'undefined' && window.localStorage) {
                    localStorage.setItem('bob-settings', JSON.stringify(newValue));
                }
                return newValue;
            });
        }
    };
}

export const settings = createSettingsStore();

// Logging utility - writes to file via Tauri backend
export const log = {
    async write(level: string, message: string): Promise<void> {
        const currentSettings = get(settings);
        if (!currentSettings.loggingEnabled) return;

        try {
            await invoke('write_log', {
                logPath: currentSettings.logFilePath,
                level,
                message
            });
        } catch (e) {
            console.error('[log] Failed to write log:', e);
        }
    },
    info: (msg: string) => log.write('INFO', msg),
    warn: (msg: string) => log.write('WARN', msg),
    error: (msg: string) => log.write('ERROR', msg),
    debug: (msg: string) => log.write('DEBUG', msg)
};

// Instances store
export const instances = writable<Instance[]>([]);

// Scan for Antigravity instances via Silent Mode (WebSocket connections)
export async function scanForInstances(): Promise<void> {
    try {
        // Get connected extensions via Silent Mode (cross-platform)
        let silentExtensions: SilentExtension[] = [];
        try {
            silentExtensions = await getSilentExtensions();
            await log.info(`Scan completed: found ${silentExtensions.length} connected extensions`);
        } catch (e) {
            console.warn('Silent extension scan failed, falling back to legacy:', e);
        }

        const currentInstances = get(instances);
        let newInstances: Instance[] = [];

        if (silentExtensions.length > 0) {
            // Map silent extensions to Instance objects
            newInstances = silentExtensions.map((ext) => {
                // Use workspacePath from extension, with windowId as handle
                const windowHandle = parseInt(ext.windowId.replace(/\D/g, '')) || Date.now();

                // Check if this instance already exists (by workspace name)
                const existing = currentInstances.find(i =>
                    i.projectName.toLowerCase() === ext.workspaceName.toLowerCase()
                );

                if (existing) {
                    return {
                        ...existing,
                        windowTitle: `${ext.workspaceName} - Antigravity`,
                        projectPath: ext.workspacePath || existing.projectPath,
                        connectionMode: 'silent' as const,
                        silentWindowId: ext.windowId,
                    };
                }

                // Create new instance from silent extension
                const currentSettings = get(settings);
                const override = currentSettings.projectOverrides?.[ext.workspaceName];
                return {
                    id: `instance-${ext.windowId}`,
                    windowTitle: `${ext.workspaceName} - Antigravity`,
                    windowHandle: windowHandle,
                    projectPath: ext.workspacePath || '',
                    projectName: ext.workspaceName,
                    enabled: false,
                    currentIssue: 0,
                    totalIssues: 0,
                    retryCount: 0,
                    maxRetries: get(settings).maxRetries,
                    status: ext.state?.agentWorking ? 'working'
                        : ((ext.state?.consecutiveErrors ?? 0) > 0) ? 'error' : 'idle',
                    lastActivity: Date.now(),
                    stepCount: 0,
                    connectionMode: 'silent' as const,
                    silentWindowId: ext.windowId,
                    // Apply persisted overrides
                    issuesPath: override?.issuesPath,
                    issuesPathSupport: override?.issuesPathSupport,
                    githubRepoSupport: override?.githubRepoSupport,
                    githubRepoDev: override?.githubRepoDev,
                    // Legacy fallback
                    githubRepo: override?.githubRepo,
                };
            });
        } else {
            // Fallback: Legacy Scan (Windows Only)
            try {
                const windows = await invoke<ScanResult[]>('scan_windows');
                if (windows.length > 0) {
                    newInstances = windows.map(w => {
                        const existing = currentInstances.find(i => i.windowHandle === w.windowHandle);
                        if (existing) return existing;

                        const projectName = extractProjectName(w.windowTitle);
                        const currentSettings = get(settings);
                        const override = currentSettings.projectOverrides?.[projectName];

                        return {
                            id: `legacy-${w.windowHandle}`,
                            windowTitle: w.windowTitle,
                            windowHandle: w.windowHandle,
                            projectPath: extractProjectPath(w.windowTitle),
                            projectName: projectName,
                            enabled: false,
                            currentIssue: 0,
                            totalIssues: 0,
                            retryCount: 0,
                            maxRetries: get(settings).maxRetries,
                            status: 'idle',
                            lastActivity: Date.now(),
                            stepCount: 0,
                            connectionMode: 'legacy',
                            // Apply overrides
                            issuesPath: override?.issuesPath,
                            issuesPathSupport: override?.issuesPathSupport,
                            githubRepoSupport: override?.githubRepoSupport,
                            githubRepoDev: override?.githubRepoDev,
                            githubRepo: override?.githubRepo,
                        };
                    });
                }
            } catch (e) {
                console.error('Legacy scan failed:', e);
            }
        }

        instances.set(newInstances);

        // Update backlog info for each instance (wait for it to complete)
        await updateInstanceBacklogs();
    } catch (error) {
        console.error('Failed to scan for instances:', error);
        // Fallback: use mock data for development without Tauri
        if (import.meta.env.DEV) {
            instances.set([
                {
                    id: 'mock-1',
                    windowTitle: 'constela_back - Antigravity',
                    windowHandle: 12345,
                    projectPath: 'C:/Users/flevik/Proyectos/constela_back',
                    projectName: 'constela_back',
                    enabled: true,
                    currentIssue: 3,
                    totalIssues: 8,
                    retryCount: 0,
                    maxRetries: 3,
                    status: 'working',
                    lastActivity: Date.now() - 5000,
                    stepCount: 12
                },
                {
                    id: 'mock-2',
                    windowTitle: 'clawdbot - Visual Studio Code',
                    windowHandle: 67890,
                    projectPath: 'C:/Users/flevik/Proyectos/clawdbot',
                    projectName: 'clawdbot',
                    enabled: false,
                    currentIssue: 0,
                    totalIssues: 5,
                    retryCount: 0,
                    maxRetries: 3,
                    status: 'idle',
                    lastActivity: Date.now() - 60000,
                    stepCount: 0
                }
            ]);
        }
    }
}

// Update backlog information for all instances (async)
export async function updateInstanceBacklogs(): Promise<void> {
    const currentInstances = get(instances);
    console.log(`[Backlog] Updating ${currentInstances.length} instances...`);

    for (const instance of currentInstances) {
        try {
            console.log(`[${instance.projectName}] Reading backlog from: ${instance.issuesPath || instance.projectPath}`);

            // 1. Fetch Default/Base Backlog (always needed for base path)
            // -----------------------------------------------------------
            let baseResult: BacklogResult | null = instance.issuesPath
                ? await invoke<BacklogResult>('read_backlog_direct', { issuesPath: instance.issuesPath })
                : await invoke<BacklogResult>('read_backlog', { projectPath: instance.projectPath });

            // Base path for relative calculations
            const basePath = baseResult?.backlogPath || '';
            const separator = instance.projectPath.includes('\\') ? '\\' : '/';
            const cleanBasePath = basePath.endsWith(separator) ? basePath.slice(0, -1) : basePath;


            // 2. Fetch DEV Backlog (statsDev)
            // -------------------------------
            let statsDev = { current: 0, total: 0, completed: 0, title: '', body: '' };
            let devRepo = instance.githubRepoDev;
            let devPath = instance.issuesPathDev;

            // Auto-detect dev path if not explicit
            if (!devRepo && !devPath) {
                devPath = `${cleanBasePath}${separator}dev`;
            }

            if (devRepo && get(settings).githubToken) {
                // GitHub Dev
                try {
                    const ghResult = await invoke<any>('read_backlog_github', { token: get(settings).githubToken, repo: devRepo });
                    if (ghResult) {
                        statsDev = {
                            current: ghResult.completedIssues,
                            total: ghResult.totalIssues,
                            completed: ghResult.completedIssues,
                            title: ghResult.currentIssue,
                            body: ghResult.currentIssueBody
                        };
                    }
                } catch (e) { console.warn(`[${instance.projectName}] Dev GitHub failed:`, e); }
            } else if (devPath) {
                // Local Dev
                try {
                    const localResult = await invoke<BacklogResult>('read_backlog_direct', { issuesPath: devPath });
                    if (localResult && !localResult.error) {
                        statsDev = {
                            current: localResult.completedIssues,
                            total: localResult.totalIssues,
                            completed: localResult.completedIssues,
                            title: localResult.currentIssue,
                            body: ''
                        };
                    }
                } catch (e) { /* ignore if folder doesn't exist */ }
            }


            // 3. Fetch SUPPORT Backlog (statsSupport)
            // ---------------------------------------
            let statsSupport = { current: 0, total: 0, completed: 0, title: '', body: '' };
            let supportRepo = instance.githubRepoSupport || instance.githubRepo; // fallback
            let supportPath = instance.issuesPathSupport;

            // Auto-detect support path if not explicit
            if (!supportRepo && !supportPath) {
                supportPath = `${cleanBasePath}${separator}support`;
            }

            if (supportRepo && get(settings).githubToken) {
                // GitHub Support
                try {
                    const ghResult = await invoke<any>('read_backlog_github', { token: get(settings).githubToken, repo: supportRepo });
                    if (ghResult) {
                        statsSupport = {
                            current: ghResult.completedIssues,
                            total: ghResult.totalIssues,
                            completed: ghResult.completedIssues,
                            title: ghResult.currentIssue,
                            body: ghResult.currentIssueBody
                        };
                    }
                } catch (e) { console.warn(`[${instance.projectName}] Support GitHub failed:`, e); }
            } else if (supportPath) {
                // Local Support
                try {
                    const localResult = await invoke<BacklogResult>('read_backlog_direct', { issuesPath: supportPath });
                    if (localResult && !localResult.error) {
                        statsSupport = {
                            current: localResult.completedIssues,
                            total: localResult.totalIssues,
                            completed: localResult.completedIssues,
                            title: localResult.currentIssue,
                            body: ''
                        };
                    }
                } catch (e) { /* ignore */ }
            }


            // 4. Update Instance State
            // ------------------------
            // Decide which stats to show as "Main" based on active mode
            let result = baseResult; // Default to base
            let currentIssueBody = undefined;
            let currentIssueTitle = baseResult?.currentIssue;

            if (instance.developmentMode) {
                // Dev Mode Active
                result = {
                    totalIssues: statsDev.total,
                    completedIssues: statsDev.completed,
                    currentIssue: statsDev.title,
                    backlogPath: devPath || 'GitHub',
                    error: undefined
                };
                currentIssueBody = statsDev.body;
                currentIssueTitle = statsDev.title;
            } else if (instance.supportMode) {
                // Support Mode Active
                result = {
                    totalIssues: statsSupport.total,
                    completedIssues: statsSupport.completed,
                    currentIssue: statsSupport.title,
                    backlogPath: supportPath || 'GitHub',
                    error: undefined
                };
                currentIssueBody = statsSupport.body;
                currentIssueTitle = statsSupport.title;
            } else {
                // Standard/Base Mode (no toggle)
                // Use baseResult as is
            }

            console.log(`[${instance.projectName}] Backlog result:`, result);

            if (result && !result.error) {
                instances.update(list =>
                    list.map(i => i.id === instance.id
                        ? {
                            ...i,
                            totalIssues: result!.totalIssues,
                            currentIssue: result!.completedIssues,
                            issuesCompleted: result!.completedIssues,
                            // Store GitHub/Local context if available
                            currentIssueBody: currentIssueBody,
                            currentIssueTitle: currentIssueTitle,
                            // Store separate mode stats
                            issuesDev: statsDev,
                            issuesSupport: statsSupport
                        }
                        : i
                    )
                );
                console.log(`[${instance.projectName}] ✅ Backlog: ${result.completedIssues}/${result.totalIssues}, current: ${result.currentIssue}`);
            } else if (result?.error) {
                console.warn(`[${instance.projectName}] Backlog error: ${result.error}`);
            }
        } catch (error) {
            console.warn(`[${instance.projectName}] Failed to read backlog:`, error);
        }
    }
}

// Update silent mode connections - match extensions to instances
export async function updateSilentModeConnections(): Promise<void> {
    const currentSettings = get(settings);
    if (!currentSettings.silentModePreferred) return;

    try {
        const extensions = await getSilentExtensions();
        console.log(`[Silent] Found ${extensions.length} connected extensions`);

        instances.update(list =>
            list.map(instance => {
                const match = matchExtensionToInstance(extensions, instance);
                if (match) {
                    console.log(`[Silent] ✅ ${instance.projectName} → extension ${match.windowId} (silent mode, path: ${match.workspacePath})`);
                    return {
                        ...instance,
                        connectionMode: 'silent' as const,
                        silentWindowId: match.windowId,
                        // Use workspace path from extension if available (for backlog detection)
                        projectPath: match.workspacePath || instance.projectPath,
                    };
                } else {
                    // No matching extension — use legacy mode
                    return {
                        ...instance,
                        connectionMode: 'legacy' as const,
                        silentWindowId: undefined,
                    };
                }
            })
        );
    } catch (error) {
        console.warn('[Silent] Failed to update connections:', error);
    }
}

// Refresh instances (update status, don't rescan)
export async function refreshInstances(): Promise<void> {
    const currentInstances = get(instances);

    for (const instance of currentInstances) {
        if (!instance.enabled) continue;

        try {
            // Call Tauri to get instance status
            const status = await invoke<InstanceStatus>('get_instance_status', {
                windowHandle: instance.windowHandle
            });

            // Don't overwrite fields managed by polling (stepCount, retryCount, backlog fields)
            // Only update status and lastActivity from get_instance_status
            instances.update(list =>
                list.map(i => i.id === instance.id ? {
                    ...i,
                    status: status.status,
                    lastActivity: status.lastActivity
                    // NOT including: stepCount, retryCount, totalIssues, currentIssue, issuesCompleted
                } : i)
            );
        } catch (error) {
            console.error(`Failed to refresh instance ${instance.id}:`, error);
        }
    }
}

// Helper: Extract project path from window title
function extractProjectPath(title: string): string {
    // Window title format: "projectName - Antigravity - Tab"
    const match = title.match(/^(.+?)\s*[-–]\s*Antigravity/);
    if (match) {
        const projectName = match[1].trim();
        // Build full path using known base directory
        // TODO: Make this configurable in settings
        return `C:\\Users\\flevik\\Proyectos Timekast\\${projectName}`;
    }
    return title;
}

// Helper: Extract project name from window title
function extractProjectName(title: string): string {
    const path = extractProjectPath(title);
    return path.split(/[/\\]/).pop() || path;
}

// Types for scan results
interface ScanResult {
    windowTitle: string;
    windowHandle: number;
    processId: number;
}

interface InstanceStatus {
    status: 'idle' | 'working' | 'error' | 'complete';
    currentIssue: number;
    totalIssues: number;
    retryCount: number;
    lastActivity: number;
    stepCount: number;
}

import {
    getStateSilent,
    acceptAllSilent,
    acceptStepSilent,
    sendPromptSilent,
    retrySilent,
    type SilentState
} from './websocket';

// UI Automation types
interface UIStateResult {
    hasAcceptButton: boolean;
    hasEnterButton: boolean;
    hasRetryButton: boolean;
    isPaused: boolean;  // True if agent is working (red button or unknown)
    chatButtonColor: string;  // "gray" = ready, "red" = working, "none" = unknown
    acceptButtonX: number;
    acceptButtonY: number;
    enterButtonX: number;
    enterButtonY: number;
    retryButtonX: number;
    retryButtonY: number;
    isBottomButton: boolean;  // True = Accept all (needs click), False = dialog (use Alt+Enter)
    error?: string;
}

// Detect UI state for a window
export async function detectUIState(windowHandle: number): Promise<UIStateResult | null> {
    try {
        const result = await invoke<UIStateResult>('detect_ui_state', { windowHandle });
        return result;
    } catch (error) {
        console.error('Failed to detect UI state:', error);
        return null;
    }
}

// Click the accept/enter button (legacy - uses mouse click)
export async function clickAcceptButton(windowHandle: number, x: number, y: number): Promise<boolean> {
    try {
        const result = await invoke<boolean>('click_button', {
            windowHandle,
            screenX: x,
            screenY: y
        });
        return result;
    } catch (error) {
        console.error('Failed to click accept:', error);
        return false;
    }
}

// Accept dialog using Alt+Enter keyboard shortcut (more reliable)
export async function acceptDialog(windowHandle: number): Promise<boolean> {
    try {
        const result = await invoke<boolean>('accept_dialog', { windowHandle });
        return result;
    } catch (error) {
        console.error('Failed to accept dialog:', error);
        return false;
    }
}

// Scroll chat to bottom using Ctrl+End
export async function scrollToBottom(windowHandle: number): Promise<boolean> {
    try {
        const result = await invoke<boolean>('scroll_to_bottom', { windowHandle });
        return result;
    } catch (error) {
        console.error('Failed to scroll to bottom:', error);
        return false;
    }
}

// Click the retry button
export async function clickRetryButton(windowHandle: number, x: number, y: number): Promise<boolean> {
    return clickAcceptButton(windowHandle, x, y);
}

// Backlog reading result interface
interface BacklogResult {
    totalIssues: number;
    completedIssues: number;
    currentIssue: string;
    backlogPath: string;
    error?: string;
}

// Read backlog from project path
export async function readBacklog(projectPath: string): Promise<BacklogResult | null> {
    try {
        const result = await invoke<BacklogResult>('read_backlog', { projectPath });
        return result;
    } catch (error) {
        console.error('Failed to read backlog:', error);
        return null;
    }
}

// Write to chat and submit
export async function writeToChat(windowHandle: number, prompt: string): Promise<boolean> {
    try {
        const result = await invoke<boolean>('write_to_chat', {
            windowHandle,
            prompt
        });
        return result;
    } catch (error) {
        console.error('Failed to write to chat:', error);
        return false;
    }
}

// Helper to extract issue number from string "#123 Title"
function extractIssueNumber(str: string): number | null {
    const match = str.match(/^#(\d+)/);
    return match ? parseInt(match[1]) : null;
}

// Ensure the current GitHub issue is marked as in-progress
async function ensureIssueInProgress(instance: Instance): Promise<void> {
    const currentSettings = get(settings);
    if (!instance.supportMode || !instance.githubRepo || !currentSettings.githubToken) return;

    // throttle updates (once per 5 minutes per instance?)
    // or just check if we already did it for this "session"
    // Let's rely on lastInProgressUpdate
    if (instance.lastInProgressUpdate && (Date.now() - instance.lastInProgressUpdate < 300000)) {
        return;
    }

    // Extract issue number via currentIssueTitle
    if (!instance.currentIssueTitle) return;

    const issueNum = extractIssueNumber(instance.currentIssueTitle);
    if (!issueNum) return;

    try {
        const success = await invoke<boolean>('update_github_issue_status', {
            token: currentSettings.githubToken,
            repo: instance.githubRepo,
            issueNumber: issueNum,
            status: 'in-progress'
        });

        if (success) {
            console.log(`[${instance.projectName}] Marked issue #${issueNum} as in-progress`);
            instances.update(list =>
                list.map(i => i.id === instance.id
                    ? { ...i, lastInProgressUpdate: Date.now() }
                    : i
                )
            );
        }
    } catch (e) {
        console.error(`[${instance.projectName}] Failed to update issue status:`, e);
    }
}

// Close current GitHub issue
export async function closeIssue(instanceId: string): Promise<string> {
    const currentInstances = get(instances);
    const instance = currentInstances.find(i => i.id === instanceId);
    const currentSettings = get(settings);

    if (!instance || !instance.supportMode || !instance.githubRepo || !currentSettings.githubToken) {
        return "Not a GitHub instance";
    }

    if (!instance.currentIssueTitle) return "No current issue loaded";

    const issueNum = extractIssueNumber(instance.currentIssueTitle);
    if (!issueNum) return "Could not extract issue number";

    try {
        const success = await invoke<boolean>('update_github_issue_status', {
            token: currentSettings.githubToken,
            repo: instance.githubRepo,
            issueNumber: issueNum,
            status: 'done'
        });

        if (success) {
            // Trigger refresh to update backlog counts
            setTimeout(updateInstanceBacklogs, 1000);
            return `Closed issue #${issueNum}`;
        } else {
            return "Failed to close issue";
        }
    } catch (e) {
        return `Error: ${e}`;
    }
}

// Check UI state for silent instances
async function checkAndActOnInstanceSilent(instance: Instance, silentWindowId: string, testMode: boolean): Promise<string> {
    // Get state from websocket
    const state = await getStateSilent(silentWindowId);
    if (!state) return 'No silent state available';

    const currentSettings = get(settings);

    // Map SilentState to UIStateResult for UI compatibility
    const uiState: UIStateResult = {
        hasAcceptButton: state.hasAcceptButton,
        hasEnterButton: state.hasEnterButton,
        hasRetryButton: state.hasRetryButton,
        isPaused: !state.agentWorking, // Rough approximation
        chatButtonColor: state.agentWorking ? 'red' : 'gray',
        acceptButtonX: 0, acceptButtonY: 0,
        enterButtonX: 0, enterButtonY: 0,
        retryButtonX: 0, retryButtonY: 0,
        isBottomButton: false
    };

    // Update instance UI state
    instances.update(list =>
        list.map(i => i.id === instance.id
            ? { ...i, uiState: uiState, lastActivity: Date.now() }
            : i
        )
    );

    // Handle Retry
    if (state.hasRetryButton) {
        const newRetryCount = instance.retryCount + 1;

        if (newRetryCount >= instance.maxRetries) {
            instances.update(list =>
                list.map(i => i.id === instance.id
                    ? { ...i, retryCount: newRetryCount, status: 'error', enabled: false }
                    : i
                )
            );
            await notifyDiscordGeneric(instance, `❌ Error en ${instance.projectName}`, `Se alcanzó el máximo de reintentos (${instance.maxRetries}).`);
            return `Max retries reached (${newRetryCount})`;
        } else {
            await retrySilent(silentWindowId);
            instances.update(list =>
                list.map(i => i.id === instance.id
                    ? { ...i, retryCount: newRetryCount, status: 'working', lastActivity: Date.now() }
                    : i
                )
            );
            return `Clicked Retry (Silent) (attempt ${newRetryCount})`;
        }
    }

    // Handle Accept
    if (state.hasAcceptButton) {
        await acceptAllSilent(silentWindowId);
        instances.update(list =>
            list.map(i => i.id === instance.id
                ? { ...i, status: 'working', lastActivity: Date.now() }
                : i
            )
        );
        return 'Clicked Accept (Silent)';
    }

    // Handle Enter (Prompt)
    if (state.hasEnterButton && !state.agentWorking) {
        // Select prompt based on mode
        let userPrompt = instance.customPrompt;
        if (instance.developmentMode) {
            userPrompt = instance.customPromptDev || instance.customPrompt;
        } else if (instance.supportMode) {
            userPrompt = instance.customPromptSupport || currentSettings.defaultSupportPrompt || DEFAULT_SUPPORT_PROMPT;
        }

        let prompt = testMode ? 'Test' : (userPrompt || currentSettings.autoPrompt || currentSettings.defaultPrompt);

        // Inject context for GitHub mode (works for both Dev and Support as currentIssueBody is set by updateInstanceBacklogs)
        if (!testMode && (instance.supportMode || instance.developmentMode) && instance.currentIssueBody && instance.currentIssueTitle) {
            const context = `CONTEXTO DEL ISSUE (${instance.currentIssueTitle}):\n${instance.currentIssueBody}\n\nINSTRUCCIONES:\n`;
            if (userPrompt) {
                prompt = context + userPrompt;
            } else {
                prompt = context + (currentSettings.autoPrompt || currentSettings.defaultPrompt);
            }
        }

        await ensureIssueInProgress(instance);
        await sendPromptSilent(silentWindowId, prompt);

        instances.update(list =>
            list.map(i => i.id === instance.id
                ? { ...i, retryCount: 0, status: 'working', lastActivity: Date.now(), stepCount: i.stepCount + 1, lastPromptSent: Date.now() }
                : i
            )
        );
        return `Sent prompt (Silent): "${prompt.substring(0, 50)}..."`;
    }

    return 'No action needed (Silent)';
}


// Check UI state and perform auto-actions for enabled instances
export async function checkAndActOnInstance(instanceId: string, testMode: boolean = false): Promise<string> {
    const currentInstances = get(instances);
    const instance = currentInstances.find(i => i.id === instanceId);

    if (!instance) return 'Instance not found';
    if (!instance.enabled && !testMode) return 'Instance disabled';

    // Skip if blocked
    if (instance.isBlocked) return 'Instance is blocked';

    // Dispatch to Silent Mode handler if applicable
    if (instance.connectionMode === 'silent' && instance.silentWindowId) {
        return await checkAndActOnInstanceSilent(instance, instance.silentWindowId, testMode);
    }

    // Legacy Mode (Pixel Detection) - DEPRECATED/REMOVED
    // Try to detect state via legacy method (will fail with "Legacy mode removed" if backend is updated)
    console.log(`[${instance.projectName}] Detecting legacy UI state...`);
    const uiState = await detectUIState(instance.windowHandle);

    if (!uiState) {
        console.error(`[${instance.projectName}] Failed to detect UI state (null)`);
        return 'Failed to detect UI state';
    }

    if (uiState.error) {
        console.error(`[${instance.projectName}] UI Detection Error: ${uiState.error}`);
        return `Error: ${uiState.error}`;
    }

    console.log(`[${instance.projectName}] Legacy UI State:`, JSON.stringify(uiState));

    const currentSettings = get(settings);

    // ... rest of legacy logic continues below ...

    // Update instance UI state
    instances.update(list =>
        list.map(i => i.id === instanceId
            ? { ...i, uiState: uiState, lastActivity: Date.now() }
            : i
        )
    );

    // Handle error state (Retry button detected)
    if (uiState.hasRetryButton) {
        const newRetryCount = instance.retryCount + 1;

        if (newRetryCount >= instance.maxRetries) {
            // Max retries reached - disable and notify
            instances.update(list =>
                list.map(i => i.id === instanceId
                    ? { ...i, retryCount: newRetryCount, status: 'error', enabled: false }
                    : i
                )
            );

            // Send Discord notification (throttled/generic helper)
            await notifyDiscordGeneric(instance, `❌ Error en ${instance.projectName}`, `Se alcanzó el máximo de reintentos (${instance.maxRetries}). Requiere atención manual.`);

            return `Max retries reached (${newRetryCount})`;
        } else (
            // Click retry and increment counter
            await clickRetryButton(instance.windowHandle, uiState.retryButtonX, uiState.retryButtonY),
            instances.update(list =>
                list.map(i => i.id === instanceId
                    ? { ...i, retryCount: newRetryCount, status: 'working', lastActivity: Date.now() }
                    : i
                )
            ),
            `Clicked Retry (attempt ${newRetryCount}/${instance.maxRetries})`
        );
    }

    // Handle accept button - click it
    if (uiState.hasAcceptButton) {
        await clickAcceptButton(instance.windowHandle, uiState.acceptButtonX, uiState.acceptButtonY);
        instances.update(list =>
            list.map(i => i.id === instanceId
                ? { ...i, status: 'working', lastActivity: Date.now() }
                : i
            )
        );
        return 'Clicked Accept button';
    }

    // Handle enter/ready state - chat is available, send prompt
    if (uiState.hasEnterButton) {
        // Select prompt based on mode
        let userPrompt = instance.customPrompt;
        if (instance.developmentMode) {
            userPrompt = instance.customPromptDev || instance.customPrompt;
        } else if (instance.supportMode) {
            userPrompt = instance.customPromptSupport || currentSettings.defaultSupportPrompt || DEFAULT_SUPPORT_PROMPT;
        }

        let prompt = testMode ? 'Test' : (userPrompt || currentSettings.autoPrompt || currentSettings.defaultPrompt);

        // Inject context for GitHub mode (if not in test mode)
        if (!testMode && (instance.supportMode || instance.developmentMode) && instance.currentIssueBody && instance.currentIssueTitle) {
            const context = `CONTEXTO DEL ISSUE (${instance.currentIssueTitle}):\n${instance.currentIssueBody}\n\nINSTRUCCIONES:\n`;
            if (userPrompt) {
                prompt = context + userPrompt;
            } else {
                prompt = context + (currentSettings.autoPrompt || currentSettings.defaultPrompt);
            }
        }

        // Ensure issue is marked in-progress
        await ensureIssueInProgress(instance);

        await writeToChat(instance.windowHandle, prompt);

        // Update status and lastPromptSent
        instances.update(list =>
            list.map(i => i.id === instanceId
                ? { ...i, retryCount: 0, status: 'working', lastActivity: Date.now(), stepCount: i.stepCount + 1, lastPromptSent: Date.now() }
                : i
            )
        );
        return `Sent prompt: "${prompt.substring(0, 50)}..."`;
    }

    return 'No action needed - Antigravity is working';
}

// UI Polling state
let pollingTimeout: ReturnType<typeof setTimeout> | null = null;
let pollingActive = false;

// Poll loop logic that handles inactivity checks and instance processing
async function pollOnce(): Promise<void> {
    const currentSettings = get(settings);

    // Update silent mode connections first
    await updateSilentModeConnections();

    const currentInstances = get(instances);

    for (const instance of currentInstances) {
        if (!pollingActive) break;


        if (!instance.enabled || instance.isBlocked) continue;

        // Inactivity check
        const inactivityMs = currentSettings.inactivityTimeoutMinutes * 60 * 1000;
        const lastPrompt = instance.lastPromptSent || 0;
        const timeSinceLastPrompt = Date.now() - lastPrompt;

        if (lastPrompt > 0 && timeSinceLastPrompt > inactivityMs) {
            // If status is 'working', we might just be waiting for a long generation
            if (instance.status === 'working') {
                // Allow double the timeout for 'working' state
                if (timeSinceLastPrompt < inactivityMs * 3) continue;
            }

            const minutesInactive = Math.round(timeSinceLastPrompt / 60000);
            console.log(`[${instance.projectName}] ⏰ Inactivity timeout: ${minutesInactive} minutes since last prompt`);

            // Disable instance
            instances.update(list =>
                list.map(i => i.id === instance.id
                    ? { ...i, enabled: false, status: 'error', isBlocked: true, blockReason: `Inactivity timeout: ${minutesInactive} min` }
                    : i
                )
            );

            await notifyDiscordGeneric(instance, `🛑 Timeout: ${instance.projectName}`, `Detenido tras ${minutesInactive} minutos sin actividad (Timeout).`);
            continue;
        }

        try {
            const result = await checkAndActOnInstance(instance.id, false);
            // Only log significant actions to avoid spam
            if (!result.includes('No action needed')) {
                console.log(`[${instance.projectName}] ${result}`);
            }
        } catch (error) {
            console.error(`[${instance.projectName}] Error:`, error);
        }
    }

    // Schedule next poll if still active
    if (pollingActive) {
        // Convert seconds to ms
        const interval = (currentSettings.pollIntervalSeconds || 5) * 1000;
        pollingTimeout = setTimeout(pollOnce, interval);
    }
}

// Start automatic UI polling for all enabled instances
export function startUIPolling(intervalMs: number = 5000): void {
    if (pollingActive) return;

    pollingActive = true;
    console.log(`Starting UI polling...`);

    // Start the recursive poll loop
    pollOnce();
}

// Stop UI polling
export function stopUIPolling(): void {
    if (pollingTimeout) {
        clearTimeout(pollingTimeout);
        pollingTimeout = null;
    }
    pollingActive = false;
    console.log('UI polling stopped');
}

// Aliases for compatibility
export const startAutoImplementation = startUIPolling;
export const stopAutoImplementation = stopUIPolling;

// Check if polling is active
export function isPollingActive(): boolean {
    return pollingActive;
}

// Manual test function - directly send "Test" to chat
export async function testInstance(instanceId: string): Promise<string> {
    const currentInstances = get(instances);
    const instance = currentInstances.find(i => i.id === instanceId);

    if (!instance) return 'Instance not found';

    try {
        const success = await writeToChat(instance.windowHandle, 'Test');
        if (success) {
            instances.update(list =>
                list.map(i => i.id === instanceId
                    ? { ...i, lastActivity: Date.now(), stepCount: i.stepCount + 1 }
                    : i
                )
            );
            return 'Sent "Test" to chat';
        } else {
            return 'Failed to send - writeToChat returned false';
        }
    } catch (error) {
        return `Error: ${error}`;
    }
}

// Detect stop conditions in response text
export function detectStopCondition(text: string, stopConditions: string[]): { detected: boolean; condition: string } {
    for (const condition of stopConditions) {
        if (text.includes(condition)) {
            return { detected: true, condition };
        }
    }
    return { detected: false, condition: '' };
}

// Send auto-implementation prompt to an instance
export async function sendAutoPrompt(instanceId: string): Promise<string> {
    const currentInstances = get(instances);
    const instance = currentInstances.find(i => i.id === instanceId);
    const currentSettings = get(settings);

    if (!instance) return 'Instance not found';
    if (!instance.enabled) return 'Instance disabled';

    // Use custom prompt or autoPrompt from settings
    const prompt = instance.customPrompt || currentSettings.autoPrompt;

    try {
        const success = await writeToChat(instance.windowHandle, prompt);
        if (success) {
            instances.update(list =>
                list.map(i => i.id === instanceId
                    ? {
                        ...i,
                        lastActivity: Date.now(),
                        stepCount: i.stepCount + 1,
                        status: 'working' as const
                    }
                    : i
                )
            );
            return `Sent prompt: "${prompt.substring(0, 50)}..."`;
        } else {
            return 'Failed to send prompt';
        }
    } catch (error) {
        return `Error: ${error}`;
    }
}

// Notify Discord about a stop condition or completion
async function notifyStopCondition(instance: Instance, condition: string): Promise<void> {
    const currentSettings = get(settings);
    if (!currentSettings.discordWebhook) return;

    const isComplete = condition === '✅ BACKLOG COMPLETADO';
    const shouldNotify = isComplete ? currentSettings.notifyOnComplete : currentSettings.notifyOnError;

    if (!shouldNotify) return;

    try {
        const title = isComplete
            ? `✅ ${instance.projectName} - Backlog Completado`
            : `⚠️ ${instance.projectName} - Requiere Atención`;

        const message = isComplete
            ? `El backlog ha sido completado exitosamente. Issues completados: ${instance.issuesCompleted || 0}`
            : `Condición detectada: ${condition}. Requiere intervención manual.`;

        await invoke('notify_discord', {
            webhookUrl: currentSettings.discordWebhook,
            title,
            message
        });
    } catch (e) {
        console.error('Failed to send Discord notification:', e);
    }
}

// Generic Discord notification helper for any block/error case
async function notifyDiscordGeneric(instance: Instance, title: string, message: string): Promise<void> {
    const currentSettings = get(settings);
    if (!currentSettings.discordWebhook || !currentSettings.notifyOnError) return;

    try {
        await invoke('notify_discord', {
            webhookUrl: currentSettings.discordWebhook,
            title,
            message
        });
        console.log(`[${instance.projectName}] Discord notification sent: ${title}`);
    } catch (e) {
        console.error(`[${instance.projectName}] Failed to send Discord notification:`, e);
    }
}

// Track last time we notified about no-connection per instance to avoid spam
const lastNoConnectionNotified: Map<string, number> = new Map();
