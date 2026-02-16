# KernelClient

The `KernelClient` class provides low-level IPC communication with the kernel.

## Creating a Client

```typescript
import { createKernelClient, KernelClient } from "@openclawos/sdk/client";

// Default options (auto-detect socket)
const kernel = createKernelClient();

// Custom options
const kernel = createKernelClient({
  socketPath: "/tmp/openclawos/kernel.sock",
  timeout: 30000,
  reconnect: true,
});
```

## Options

```typescript
interface KernelClientOptions {
  /** Path to Unix socket */
  socketPath?: string;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Auto-reconnect on disconnect */
  reconnect?: boolean;

  /** Maximum reconnect attempts */
  maxReconnectAttempts?: number;

  /** Delay between reconnect attempts */
  reconnectDelay?: number;
}
```

## Connection Lifecycle

### connect()

Connect to the kernel:

```typescript
await kernel.connect();
```

### disconnect()

Disconnect from the kernel:

```typescript
await kernel.disconnect();
```

### isConnected

Check connection status:

```typescript
if (kernel.isConnected) {
  // Connected
}
```

## Making Requests

### call()

Make a typed request:

```typescript
// Generic call
const result = await kernel.call("session.list", { limit: 10 });

// Typed call (with method map)
const sessions = await kernel.call<SessionListResult>("session.list", {
  filter: { channelId: "telegram" },
  limit: 10,
});
```

### Available Methods

See [IPC Methods Reference](../reference/ipc-methods.md) for all methods.

## Registration

### register()

Register the app with the kernel:

```typescript
const result = await kernel.register(manifest);
// { appId: "@myorg/myapp", token: "...", protocolVersion: "1.0" }
```

### ready()

Signal that the app is ready:

```typescript
await kernel.ready();
```

### shutdown()

Notify kernel of shutdown:

```typescript
await kernel.shutdown("User requested");
```

### heartbeat()

Send health check:

```typescript
await kernel.heartbeat({ status: "healthy" });
```

## Capability Registration

### registerCapability()

Register a capability:

```typescript
const result = await kernel.registerCapability("channel", {
  id: "mychannel",
  meta: { name: "My Channel" },
});

if (result.granted) {
  console.log("Capability granted:", result.capabilityId);
} else {
  console.error("Denied:", result.reason);
}
```

### unregisterCapability()

Remove a capability:

```typescript
await kernel.unregisterCapability(capabilityId);
```

## Hooks

### subscribeHooks()

Subscribe to hook events:

```typescript
const result = await kernel.subscribeHooks(["message_received", "message_sending"]);
// { subscribed: ["message_received", "message_sending"], denied: [] }
```

### unsubscribeHooks()

Unsubscribe from hooks:

```typescript
await kernel.unsubscribeHooks(["message_received"]);
```

### onHook()

Handle hook events:

```typescript
kernel.onHook("message_sending", async (data, context) => {
  console.log("Message being sent:", data);
  // Return modified data for intercepting hooks
  return { ...data, content: data.content.toUpperCase() };
});
```

### sendHookResult()

Send result for intercepting hook:

```typescript
kernel.onHook("message_sending", async (data, context) => {
  // For intercepting hooks, call sendHookResult
  await kernel.sendHookResult(context.eventId, {
    ...data,
    content: `[Modified] ${data.content}`,
  });
});
```

## Sessions

### getSession()

Get session info:

```typescript
const session = await kernel.getSession("telegram:123");
```

### listSessions()

List sessions:

```typescript
const result = await kernel.listSessions({
  filter: { channelId: "telegram", active: true },
  limit: 50,
});
// { sessions: [...], total: 100 }
```

## Agent

### queueAgent()

Queue a message for agent processing:

```typescript
const result = await kernel.queueAgent(
  "telegram:123", // session key
  "Hello, agent!", // message content
  { from: "user123" }, // metadata
);
// { runId: "run_abc", queued: true }
```

## Configuration

### getConfig()

Get configuration:

```typescript
// Get full config
const config = await kernel.getConfig();

// Get specific path
const telegramConfig = await kernel.getConfig("channels.telegram");
```

### watchConfig()

Watch for config changes (streaming):

```typescript
const subscription = kernel.watchConfig(["channels.telegram"], (change) => {
  console.log(`Config changed at ${change.path}`);
  console.log("Old:", change.oldValue);
  console.log("New:", change.newValue);
});

// Later: unsubscribe
subscription.unsubscribe();
```

## Events

### on()

Listen for client events:

```typescript
kernel.on("connected", () => {
  console.log("Connected to kernel");
});

kernel.on("disconnected", () => {
  console.log("Disconnected from kernel");
});

kernel.on("error", (error) => {
  console.error("Client error:", error);
});

kernel.on("reconnecting", (attempt) => {
  console.log(`Reconnecting... attempt ${attempt}`);
});
```

### off()

Remove event listener:

```typescript
const handler = () => console.log("Connected");
kernel.on("connected", handler);
kernel.off("connected", handler);
```

## Error Handling

```typescript
import { IPCError, TimeoutError, ConnectionError } from "@openclawos/sdk/client";

try {
  await kernel.call("session.get", { key: "invalid" });
} catch (error) {
  if (error instanceof IPCError) {
    switch (error.code) {
      case "NOT_FOUND":
        console.log("Session not found");
        break;
      case "UNAUTHORIZED":
        console.log("Not authorized");
        break;
      default:
        console.error("IPC error:", error.message);
    }
  } else if (error instanceof TimeoutError) {
    console.error("Request timed out");
  } else if (error instanceof ConnectionError) {
    console.error("Connection lost");
  }
}
```

## Advanced Usage

### Raw Messages

Send raw IPC messages:

```typescript
const response = await kernel.sendRaw({
  id: crypto.randomUUID(),
  type: "request",
  timestamp: Date.now(),
  method: "custom.method",
  params: { custom: "params" },
});
```

### Streaming Requests

For methods that return streams:

```typescript
const stream = kernel.stream("logs.tail", { lines: 100 });

for await (const chunk of stream) {
  console.log(chunk);
}
```

## Next Steps

- [OpenClawApp](openclaw-app.md) - Application base class
- [IPC Protocol](../architecture/ipc-protocol.md) - Protocol details
- [IPC Methods](../reference/ipc-methods.md) - All available methods
