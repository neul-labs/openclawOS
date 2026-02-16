# IPC Protocol

OpenClawOS uses a JSONL-based IPC protocol for kernel-application communication over Unix domain sockets.

## Transport

- **Socket Type**: Unix domain socket
- **Location**: `$XDG_RUNTIME_DIR/openclawos/kernel.sock` or `/tmp/openclawos/kernel.sock`
- **Format**: JSONL (newline-delimited JSON)

## Message Types

### IPCRequest

Request from app to kernel:

```typescript
interface IPCRequest {
  id: string; // Unique message ID (UUID)
  type: "request";
  timestamp: number; // Unix timestamp in milliseconds
  method: string; // Method name, e.g., "app.register"
  params: unknown; // Method parameters
}
```

### IPCResponse

Response from kernel to app:

```typescript
interface IPCResponse {
  id: string;
  type: "response";
  timestamp: number;
  requestId: string; // ID of the request this responds to
  success: boolean;
  result?: unknown; // Result payload (if success)
  error?: IPCError; // Error details (if !success)
}
```

### IPCEvent

Event pushed from kernel to app:

```typescript
interface IPCEvent {
  id: string;
  type: "event";
  timestamp: number;
  event: string; // Event name, e.g., "hook:message_received"
  payload: unknown;
}
```

### IPCStream

Streaming response chunk:

```typescript
interface IPCStream {
  id: string;
  type: "stream";
  timestamp: number;
  requestId: string;
  chunk: unknown;
  done: boolean; // True for final chunk
}
```

## Error Codes

| Code                  | Description                |
| --------------------- | -------------------------- |
| `UNKNOWN_ERROR`       | Unspecified error          |
| `INVALID_REQUEST`     | Malformed request          |
| `METHOD_NOT_FOUND`    | Unknown method             |
| `INVALID_PARAMS`      | Invalid parameters         |
| `INTERNAL_ERROR`      | Kernel internal error      |
| `UNAUTHORIZED`        | Authentication required    |
| `FORBIDDEN`           | Permission denied          |
| `NOT_FOUND`           | Resource not found         |
| `CONFLICT`            | Resource conflict          |
| `TIMEOUT`             | Operation timed out        |
| `APP_NOT_REGISTERED`  | App must register first    |
| `CAPABILITY_DENIED`   | Capability not granted     |
| `HOOK_NOT_SUBSCRIBED` | Hook subscription required |
| `CONNECTION_CLOSED`   | Connection was closed      |

## Methods

### App Lifecycle

#### app.register

Register an app with the kernel. Must be called first.

```typescript
// Request
{
  manifest: PackageManifest;
}

// Response
{
  appId: string; // Assigned app ID
  token: string; // Auth token for subsequent requests
  protocolVersion: string;
}
```

#### app.heartbeat

Health check. Should be called periodically (every 30s).

```typescript
// Request
{
  status?: Record<string, unknown>  // Optional status payload
}

// Response
{
  ok: boolean;
  serverTime: number;   // Kernel timestamp for clock sync
}
```

#### app.ready

Signal that app is ready to receive traffic.

```typescript
// Request
{
  metadata?: Record<string, unknown>
}

// Response
{
  ok: boolean;
}
```

#### app.shutdown

Graceful shutdown request.

```typescript
// Request
{
  reason?: string;
  timeout?: number;     // Timeout in ms before force kill
}

// Response
{
  ok: boolean;
}
```

### Capability Registration

#### capability.register

Register a capability with the kernel.

```typescript
// Request
{
  type: "channel" | "tool" | "hook" | "gateway_method" | "http_route" | "provider";
  config: unknown;      // Type-specific configuration
}

// Response
{
  capabilityId: string;
  granted: boolean;
  reason?: string;      // If not granted
}
```

#### capability.unregister

Remove a registered capability.

```typescript
// Request
{
  capabilityId: string;
}

// Response
{
  ok: boolean;
}
```

### Hooks

#### hook.subscribe

Subscribe to hook events.

```typescript
// Request
{
  events: string[];     // Hook names to subscribe to
}

// Response
{
  subscribed: string[]; // Successfully subscribed
  denied: string[];     // Permission denied
}
```

#### hook.unsubscribe

Unsubscribe from hook events.

```typescript
// Request
{
  events: string[];
}

// Response
{
  unsubscribed: string[];
}
```

#### hook.result

Return result for an intercepting hook.

```typescript
// Request
{
  eventId: string; // Event ID from the hook event
  result: unknown; // Hook result payload
}

// Response
{
  ok: boolean;
}
```

### Configuration

#### config.get

Get configuration value.

```typescript
// Request
{
  path?: string;        // JSON path (empty for full config)
}

// Response
{
  value: unknown;
}
```

#### config.watch

Watch for config changes (streaming).

```typescript
// Request
{
  paths?: string[];     // Paths to watch (empty for all)
}

// Stream chunks
{
  path: string;
  oldValue: unknown;
  newValue: unknown;
}
```

### Sessions

#### session.get

Get session information.

```typescript
// Request
{
  key: string;
}

// Response
{
  session: SessionEntry | null;
}
```

#### session.list

List sessions with optional filtering.

```typescript
// Request
{
  filter?: {
    agentId?: string;
    channelId?: string;
    accountId?: string;
    active?: boolean;
  };
  limit?: number;
  offset?: number;
}

// Response
{
  sessions: SessionEntry[];
  total: number;
}
```

### Messages

#### message.dispatch

Send a message via kernel.

```typescript
// Request
{
  sessionKey: string;
  content: string;
  metadata?: Record<string, unknown>;
}

// Response
{
  dispatchId: string;
  queued: boolean;
}
```

### Agent

#### agent.queue

Queue an agent invocation.

```typescript
// Request
{
  sessionKey: string;
  text: string;
  metadata?: Record<string, unknown>;
}

// Response
{
  runId: string;
  queued: boolean;
}
```

## Hook Events

Hook events are pushed to subscribed apps:

```typescript
interface HookEventPayload<T = unknown> {
  eventId: string; // For hook.result correlation
  hookName: string;
  data: T;
  context: {
    agentId?: string;
    sessionKey?: string;
    channelId?: string;
    accountId?: string;
    timestamp: number;
  };
}
```

### Available Hooks

| Hook Name          | Description           | Interceptable |
| ------------------ | --------------------- | ------------- |
| `message_received` | Inbound message       | No            |
| `message_sending`  | Outbound message      | Yes           |
| `agent_starting`   | Agent run starting    | No            |
| `agent_completed`  | Agent run completed   | No            |
| `tool_executing`   | Tool about to execute | Yes           |
| `tool_completed`   | Tool execution done   | No            |

## Connection Flow

```
┌───────────────────────────────────────────────────────────────┐
│ App                                              Kernel       │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Connect to Unix socket ─────────────────────────▶           │
│                                                               │
│  app.register ───────────────────────────────────▶           │
│                         ◀─────────────── { appId, token }    │
│                                                               │
│  capability.register (channel) ──────────────────▶           │
│                         ◀─────────────── { granted: true }   │
│                                                               │
│  hook.subscribe ─────────────────────────────────▶           │
│                         ◀─────────────── { subscribed: [...]}│
│                                                               │
│  app.ready ──────────────────────────────────────▶           │
│                         ◀─────────────── { ok: true }        │
│                                                               │
│  ═══════════════════ Ready for traffic ═══════════════════  │
│                                                               │
│  agent.queue (on inbound message) ───────────────▶           │
│                         ◀─────────────── { queued: true }    │
│                                                               │
│                         ◀─── hook:message_sending event      │
│  (send message to platform API)                               │
│                                                               │
│  app.heartbeat ──────────────────────────────────▶           │
│                         ◀─────────────── { ok: true }        │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Wire Format Example

```json
{"id":"a1b2c3","type":"request","timestamp":1707000000000,"method":"app.register","params":{"manifest":{"id":"@openclawos/telegram","name":"Telegram","version":"1.0.0","type":"app","main":"dist/index.js","protocol":{"version":"1.0"},"capabilities":{"channels":{"provides":["telegram"]}}}}}
{"id":"d4e5f6","type":"response","timestamp":1707000000001,"requestId":"a1b2c3","success":true,"result":{"appId":"@openclawos/telegram","token":"secret123","protocolVersion":"1.0"}}
{"id":"g7h8i9","type":"event","timestamp":1707000000500,"event":"hook:message_sending","payload":{"eventId":"evt123","hookName":"message_sending","data":{"channelId":"telegram","target":"123456","content":"Hello!"},"context":{"timestamp":1707000000500}}}
```

## Next Steps

- [Process Supervision](process-supervision.md) - App lifecycle
- [Capabilities](capabilities.md) - Permission system
- [SDK Reference](../sdk/index.md) - Building apps with the SDK
