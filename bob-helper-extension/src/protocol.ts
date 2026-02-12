// BOB Helper — Protocol Types
// Defines the WebSocket message format between BOB Monitor and this extension

// ─── Messages from BOB → Extension ─────────────────────────────────

export type BobMessageType =
  | 'getState'
  | 'acceptAll'
  | 'acceptStep'
  | 'acceptTerminal'
  | 'runTerminal'
  | 'retry'
  | 'sendPrompt'
  | 'ping';

export interface BobMessage {
  type: BobMessageType;
  payload?: Record<string, unknown>;
  id: string; // Correlation ID for request/response
}

// ─── Messages from Extension → BOB ─────────────────────────────────

export type ExtensionResponseType =
  | 'state'
  | 'result'
  | 'error'
  | 'stateChanged'
  | 'hello'
  | 'pong'
  | 'simulateEnter';  // Request BOB to simulate Enter key press

export interface ExtensionResponse {
  type: ExtensionResponseType;
  payload: Record<string, unknown>;
  id: string; // Matches the request ID, or unique for push messages
}

// ─── State payload ──────────────────────────────────────────────────

export interface AntigravityState {
  hasAcceptButton: boolean;    // Changes pending acceptance
  hasRetryButton: boolean;     // Error state, retry available
  hasEnterButton: boolean;     // Chat is ready for input
  agentWorking: boolean;       // Agent is currently processing
  terminalPending: boolean;    // Terminal command awaiting approval
  workspaceName: string;       // Current workspace/project name
  workspacePath: string;       // Full path to workspace root
  consecutiveErrors: number;   // Fatal errors since last successful step
  capacityErrors: number;      // Recent 503 capacity errors (API overloaded)
  lastActivityTimestamp: string; // ISO timestamp of last agent activity
  messageCount: number;        // Total message count from diagnostics
  currentStepIndex: number;    // Current step index from getDiagnostics
}

// ─── Handshake ──────────────────────────────────────────────────────

export interface HelloPayload {
  extensionVersion: string;
  workspaceName: string;
  workspacePath: string;       // Full path to workspace root
  windowId: string;            // Unique identifier for this Antigravity window
}

// ─── Action result ──────────────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  action: string;
  error?: string;
}
