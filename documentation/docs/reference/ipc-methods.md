# IPC Methods

Complete reference for all kernel IPC methods.

## App Lifecycle

### app.register

Register an app with the kernel.

**Request:**

```typescript
{
  manifest: PackageManifest;
}
```

**Response:**

```typescript
{
  appId: string;
  token: string;
  protocolVersion: string;
}
```

### app.heartbeat

Health check ping.

**Request:**

```typescript
{
  status?: Record<string, unknown>
}
```

**Response:**

```typescript
{
  ok: boolean;
  serverTime: number;
}
```

### app.ready

Signal app is ready for traffic.

**Request:**

```typescript
{
  metadata?: Record<string, unknown>
}
```

**Response:**

```typescript
{
  ok: boolean;
}
```

### app.shutdown

Graceful shutdown notification.

**Request:**

```typescript
{
  reason?: string;
  timeout?: number;
}
```

**Response:**

```typescript
{
  ok: boolean;
}
```

## Capability Registration

### capability.register

Register a capability.

**Request:**

```typescript
{
  type: "channel" | "tool" | "hook" | "gateway_method" | "http_route" | "provider";
  config: unknown;
}
```

**Response:**

```typescript
{
  capabilityId: string;
  granted: boolean;
  reason?: string;
}
```

### capability.unregister

Remove a capability.

**Request:**

```typescript
{
  capabilityId: string;
}
```

**Response:**

```typescript
{
  ok: boolean;
}
```

## Hooks

### hook.subscribe

Subscribe to hook events.

**Request:**

```typescript
{
  events: string[];
}
```

**Response:**

```typescript
{
  subscribed: string[];
  denied: string[];
}
```

### hook.unsubscribe

Unsubscribe from hooks.

**Request:**

```typescript
{
  events: string[];
}
```

**Response:**

```typescript
{
  unsubscribed: string[];
}
```

### hook.result

Return result for intercepting hook.

**Request:**

```typescript
{
  eventId: string;
  result: unknown;
}
```

**Response:**

```typescript
{
  ok: boolean;
}
```

## Configuration

### config.get

Get configuration value.

**Request:**

```typescript
{
  path?: string;
}
```

**Response:**

```typescript
{
  value: unknown;
}
```

### config.watch

Watch for config changes (streaming).

**Request:**

```typescript
{
  paths?: string[];
}
```

**Stream chunks:**

```typescript
{
  path: string;
  oldValue: unknown;
  newValue: unknown;
}
```

## Sessions

### session.get

Get session info.

**Request:**

```typescript
{
  key: string;
}
```

**Response:**

```typescript
{
  session: {
    key: string;
    agentId: string;
    channelId?: string;
    accountId?: string;
    createdAt: number;
    lastActiveAt: number;
    messageCount: number;
  } | null;
}
```

### session.list

List sessions.

**Request:**

```typescript
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
```

**Response:**

```typescript
{
  sessions: SessionEntry[];
  total: number;
}
```

## Messages

### message.dispatch

Dispatch a message.

**Request:**

```typescript
{
  sessionKey: string;
  content: string;
  metadata?: Record<string, unknown>;
}
```

**Response:**

```typescript
{
  dispatchId: string;
  queued: boolean;
}
```

## Agent

### agent.queue

Queue a message for agent processing.

**Request:**

```typescript
{
  sessionKey: string;
  text: string;
  metadata?: Record<string, unknown>;
}
```

**Response:**

```typescript
{
  runId: string;
  queued: boolean;
}
```

## Error Codes

| Code                  | Description              |
| --------------------- | ------------------------ |
| `UNKNOWN_ERROR`       | Unspecified error        |
| `INVALID_REQUEST`     | Malformed request        |
| `METHOD_NOT_FOUND`    | Unknown method           |
| `INVALID_PARAMS`      | Invalid parameters       |
| `INTERNAL_ERROR`      | Kernel internal error    |
| `UNAUTHORIZED`        | Auth required            |
| `FORBIDDEN`           | Permission denied        |
| `NOT_FOUND`           | Resource not found       |
| `CONFLICT`            | Resource conflict        |
| `TIMEOUT`             | Operation timeout        |
| `APP_NOT_REGISTERED`  | Must register first      |
| `CAPABILITY_DENIED`   | Capability not granted   |
| `HOOK_NOT_SUBSCRIBED` | Hook subscription needed |
| `CONNECTION_CLOSED`   | Connection closed        |

## Next Steps

- [IPC Protocol](../architecture/ipc-protocol.md)
- [Hook Events](hook-events.md)
