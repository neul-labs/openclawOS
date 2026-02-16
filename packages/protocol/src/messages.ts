/**
 * OpenClawOS IPC Protocol Messages
 *
 * JSONL-based protocol for kernel-application communication over Unix sockets.
 */

// =============================================================================
// Base Message Types
// =============================================================================

export interface IPCMessageBase {
  /** Unique message identifier for correlation */
  id: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
}

/** Request from app to kernel */
export interface IPCRequest extends IPCMessageBase {
  type: "request";
  /** Method name, e.g., "app.register", "capability.register" */
  method: string;
  /** Method parameters */
  params: unknown;
}

/** Response from kernel to app */
export interface IPCResponse extends IPCMessageBase {
  type: "response";
  /** ID of the request this responds to */
  requestId: string;
  /** Whether the request succeeded */
  success: boolean;
  /** Result payload (if success) */
  result?: unknown;
  /** Error details (if !success) */
  error?: IPCError;
}

/** Event pushed from kernel to app */
export interface IPCEvent extends IPCMessageBase {
  type: "event";
  /** Event name, e.g., "hook:message_received" */
  event: string;
  /** Event payload */
  payload: unknown;
}

/** Streaming response chunk */
export interface IPCStream extends IPCMessageBase {
  type: "stream";
  /** ID of the request this stream belongs to */
  requestId: string;
  /** Stream chunk data */
  chunk: unknown;
  /** Whether this is the final chunk */
  done: boolean;
}

export type IPCMessage = IPCRequest | IPCResponse | IPCEvent | IPCStream;

// =============================================================================
// Error Types
// =============================================================================

export interface IPCError {
  /** Error code for programmatic handling */
  code: IPCErrorCode;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: unknown;
}

export type IPCErrorCode =
  | "UNKNOWN_ERROR"
  | "INVALID_REQUEST"
  | "METHOD_NOT_FOUND"
  | "INVALID_PARAMS"
  | "INTERNAL_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "TIMEOUT"
  | "APP_NOT_REGISTERED"
  | "CAPABILITY_DENIED"
  | "HOOK_NOT_SUBSCRIBED"
  | "CONNECTION_CLOSED";

// =============================================================================
// App Lifecycle Methods
// =============================================================================

/** app.register - Register an app with the kernel */
export interface AppRegisterParams {
  manifest: import("./manifest.js").PackageManifest;
}

export interface AppRegisterResult {
  /** Assigned app ID (may differ from manifest if collision) */
  appId: string;
  /** Authentication token for subsequent requests */
  token: string;
  /** Protocol version negotiated */
  protocolVersion: string;
}

/** app.heartbeat - Health check */
export interface AppHeartbeatParams {
  /** Optional status payload */
  status?: Record<string, unknown>;
}

export interface AppHeartbeatResult {
  ok: boolean;
  /** Kernel timestamp for clock sync */
  serverTime: number;
}

/** app.ready - Signal app is ready to receive traffic */
export interface AppReadyParams {
  /** Optional metadata about ready state */
  metadata?: Record<string, unknown>;
}

export interface AppReadyResult {
  ok: boolean;
}

/** app.shutdown - Graceful shutdown request */
export interface AppShutdownParams {
  /** Reason for shutdown */
  reason?: string;
  /** Timeout in ms before force kill */
  timeout?: number;
}

export interface AppShutdownResult {
  ok: boolean;
}

// =============================================================================
// Capability Registration Methods
// =============================================================================

/** capability.register - Register a capability */
export interface CapabilityRegisterParams {
  type: "channel" | "tool" | "hook" | "gateway_method" | "http_route" | "provider";
  config: unknown;
}

export interface CapabilityRegisterResult {
  /** Unique capability ID */
  capabilityId: string;
  /** Whether capability was granted */
  granted: boolean;
  /** Reason if not granted */
  reason?: string;
}

/** capability.unregister - Remove a capability */
export interface CapabilityUnregisterParams {
  capabilityId: string;
}

export interface CapabilityUnregisterResult {
  ok: boolean;
}

// =============================================================================
// Hook Methods
// =============================================================================

/** hook.subscribe - Subscribe to hook events */
export interface HookSubscribeParams {
  events: string[];
}

export interface HookSubscribeResult {
  /** Events successfully subscribed to */
  subscribed: string[];
  /** Events that couldn't be subscribed (permission denied) */
  denied: string[];
}

/** hook.unsubscribe - Unsubscribe from hook events */
export interface HookUnsubscribeParams {
  events: string[];
}

export interface HookUnsubscribeResult {
  unsubscribed: string[];
}

/** hook.result - Return result for intercepting hook */
export interface HookResultParams {
  /** Event ID this result is for */
  eventId: string;
  /** Hook result payload */
  result: unknown;
}

export interface HookResultResult {
  ok: boolean;
}

// =============================================================================
// Config Methods
// =============================================================================

/** config.get - Get configuration */
export interface ConfigGetParams {
  /** JSON path to config section (empty for full config) */
  path?: string;
}

export interface ConfigGetResult {
  value: unknown;
}

/** config.watch - Watch for config changes (streaming) */
export interface ConfigWatchParams {
  /** Paths to watch (empty for all) */
  paths?: string[];
}

export interface ConfigChangeEvent {
  path: string;
  oldValue: unknown;
  newValue: unknown;
}

// =============================================================================
// Session Methods
// =============================================================================

/** session.get - Get session info */
export interface SessionGetParams {
  key: string;
}

export interface SessionGetResult {
  session: SessionEntry | null;
}

/** session.list - List sessions */
export interface SessionListParams {
  filter?: {
    agentId?: string;
    channelId?: string;
    accountId?: string;
    active?: boolean;
  };
  limit?: number;
  offset?: number;
}

export interface SessionListResult {
  sessions: SessionEntry[];
  total: number;
}

export interface SessionEntry {
  key: string;
  agentId: string;
  channelId?: string;
  accountId?: string;
  createdAt: number;
  lastActiveAt: number;
  messageCount: number;
}

// =============================================================================
// Message Methods
// =============================================================================

/** message.dispatch - Send a message via kernel */
export interface MessageDispatchParams {
  /** Target session key */
  sessionKey: string;
  /** Message content */
  content: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

export interface MessageDispatchResult {
  /** Dispatch ID for tracking */
  dispatchId: string;
  /** Whether message was queued */
  queued: boolean;
}

// =============================================================================
// Agent Methods
// =============================================================================

/** agent.queue - Queue an agent invocation */
export interface AgentQueueParams {
  sessionKey: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface AgentQueueResult {
  /** Run ID for tracking */
  runId: string;
  queued: boolean;
}

// =============================================================================
// Hook Event Payloads
// =============================================================================

export interface HookEventPayload<T = unknown> {
  /** Event ID for hook.result correlation */
  eventId: string;
  /** Hook name */
  hookName: string;
  /** Event data */
  data: T;
  /** Hook context */
  context: HookContext;
}

export interface HookContext {
  agentId?: string;
  sessionKey?: string;
  channelId?: string;
  accountId?: string;
  timestamp: number;
}

// =============================================================================
// Method Registry
// =============================================================================

/** All available IPC methods with their param/result types */
export interface IPCMethodMap {
  "app.register": { params: AppRegisterParams; result: AppRegisterResult };
  "app.heartbeat": { params: AppHeartbeatParams; result: AppHeartbeatResult };
  "app.ready": { params: AppReadyParams; result: AppReadyResult };
  "app.shutdown": { params: AppShutdownParams; result: AppShutdownResult };
  "capability.register": { params: CapabilityRegisterParams; result: CapabilityRegisterResult };
  "capability.unregister": {
    params: CapabilityUnregisterParams;
    result: CapabilityUnregisterResult;
  };
  "hook.subscribe": { params: HookSubscribeParams; result: HookSubscribeResult };
  "hook.unsubscribe": { params: HookUnsubscribeParams; result: HookUnsubscribeResult };
  "hook.result": { params: HookResultParams; result: HookResultResult };
  "config.get": { params: ConfigGetParams; result: ConfigGetResult };
  "config.watch": { params: ConfigWatchParams; result: void }; // streaming
  "session.get": { params: SessionGetParams; result: SessionGetResult };
  "session.list": { params: SessionListParams; result: SessionListResult };
  "message.dispatch": { params: MessageDispatchParams; result: MessageDispatchResult };
  "agent.queue": { params: AgentQueueParams; result: AgentQueueResult };
}

export type IPCMethodName = keyof IPCMethodMap;

// =============================================================================
// Utility Types
// =============================================================================

/** Extract params type for a method */
export type MethodParams<M extends IPCMethodName> = IPCMethodMap[M]["params"];

/** Extract result type for a method */
export type MethodResult<M extends IPCMethodName> = IPCMethodMap[M]["result"];

/** Create a typed request */
export function createRequest<M extends IPCMethodName>(
  method: M,
  params: MethodParams<M>,
): IPCRequest {
  return {
    id: crypto.randomUUID(),
    type: "request",
    timestamp: Date.now(),
    method,
    params,
  };
}

/** Create a typed response */
export function createResponse<T>(requestId: string, result: T): IPCResponse {
  return {
    id: crypto.randomUUID(),
    type: "response",
    timestamp: Date.now(),
    requestId,
    success: true,
    result,
  };
}

/** Create an error response */
export function createErrorResponse(
  requestId: string,
  code: IPCErrorCode,
  message: string,
  details?: unknown,
): IPCResponse {
  return {
    id: crypto.randomUUID(),
    type: "response",
    timestamp: Date.now(),
    requestId,
    success: false,
    error: { code, message, details },
  };
}

/** Create an event */
export function createEvent<T>(event: string, payload: T): IPCEvent {
  return {
    id: crypto.randomUUID(),
    type: "event",
    timestamp: Date.now(),
    event,
    payload,
  };
}
