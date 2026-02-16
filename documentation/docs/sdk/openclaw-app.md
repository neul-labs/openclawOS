# OpenClawApp

`OpenClawApp` is the base class for all OpenClawOS applications.

## Overview

```typescript
import { OpenClawApp } from "@openclawos/sdk/app";

class MyApp extends OpenClawApp {
  manifest = {
    id: "@myorg/my-app",
    name: "My App",
    version: "1.0.0",
    type: "app",
    main: "dist/index.js",
    protocol: { version: "1.0" },
    capabilities: {},
  };

  protected async setup(): Promise<void> {
    // Initialize your app
  }
}

new MyApp().start();
```

## Properties

### manifest

**Required.** The package manifest:

```typescript
abstract readonly manifest: PackageManifest;
```

### kernel

The kernel client instance:

```typescript
protected kernel: KernelClient;
```

### log

Logger instance:

```typescript
protected log: AppLogger;
```

## Lifecycle Methods

### start()

Start the application:

```typescript
await app.start();
```

This method:

1. Connects to the kernel
2. Registers the manifest
3. Calls `setup()`
4. Signals ready
5. Starts heartbeat loop

### stop()

Stop the application:

```typescript
await app.stop("Shutting down");
```

This method:

1. Calls `teardown()` if defined
2. Notifies kernel of shutdown
3. Disconnects
4. Exits process

### setup()

**Required.** Initialize your application:

```typescript
protected abstract setup(): Promise<void>;
```

Called after registration but before signaling ready. Use this to:

- Register capabilities
- Subscribe to hooks
- Initialize connections

### teardown()

**Optional.** Clean up on shutdown:

```typescript
protected teardown?(): Promise<void>;
```

Called during `stop()`. Use this to:

- Close connections
- Flush queues
- Release resources

## Capability Registration

### registerChannel()

Register a channel capability:

```typescript
protected async registerChannel(config: ChannelConfig): Promise<string>;

// Usage
const capId = await this.registerChannel({
  id: "mychannel",
  meta: { name: "My Channel" },
});
```

### registerTool()

Register a tool for agents:

```typescript
protected async registerTool(tool: ToolDefinition): Promise<string>;

// Usage
await this.registerTool({
  name: "my_tool",
  description: "Does something useful",
  parameters: {
    type: "object",
    properties: {
      input: { type: "string" },
    },
    required: ["input"],
  },
  handler: async (params) => {
    return { result: params.input.toUpperCase() };
  },
});
```

### registerGatewayMethod()

Register a gateway API method:

```typescript
protected async registerGatewayMethod(
  method: string,
  handler: GatewayMethodHandler
): Promise<string>;

// Usage
await this.registerGatewayMethod("myapp.getStatus", async (params) => {
  return { status: "ok", uptime: process.uptime() };
});
```

### registerHttpRoute()

Register an HTTP route:

```typescript
protected async registerHttpRoute(
  path: string,
  handler: HttpRouteHandler
): Promise<string>;

// Usage
await this.registerHttpRoute("/api/myapp/webhook", async (req, res) => {
  res.json({ received: true });
});
```

## Hook Subscription

### onHook()

Subscribe to hook events:

```typescript
protected async onHook<T = unknown>(
  hookName: HookName,
  handler: HookHandler<T>
): Promise<void>;

// Usage - observing hook
await this.onHook("message_received", (data, context) => {
  this.log.info(`Message received: ${data.content}`);
});

// Usage - intercepting hook (return modified data)
await this.onHook("message_sending", async (data, context) => {
  return {
    ...data,
    content: `[Modified] ${data.content}`,
  };
});
```

## Complete Example

```typescript
import { OpenClawApp, ToolDefinition } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";

class DiagnosticsApp extends OpenClawApp {
  manifest: PackageManifest = {
    id: "@openclawos/diagnostics",
    name: "Diagnostics",
    version: "1.0.0",
    type: "app",
    main: "dist/index.js",
    protocol: { version: "1.0" },
    capabilities: {
      tools: { provides: ["diagnostics_health"] },
      hooks: { subscribes: ["agent_end"] },
      gateway: { methods: ["diagnostics.status"] },
    },
  };

  private metrics = {
    agentRuns: 0,
    errors: 0,
    startTime: Date.now(),
  };

  protected async setup(): Promise<void> {
    // Register tool
    await this.registerTool({
      name: "diagnostics_health",
      description: "Get system health status",
      handler: async () => ({
        uptime: Date.now() - this.metrics.startTime,
        agentRuns: this.metrics.agentRuns,
        errors: this.metrics.errors,
      }),
    });

    // Register gateway method
    await this.registerGatewayMethod("diagnostics.status", async () => ({
      ...this.metrics,
      uptime: Date.now() - this.metrics.startTime,
    }));

    // Subscribe to hooks
    await this.onHook("agent_end", (data) => {
      this.metrics.agentRuns++;
      if (data.error) {
        this.metrics.errors++;
      }
    });

    this.log.info("Diagnostics app initialized");
  }

  protected async teardown(): Promise<void> {
    this.log.info("Diagnostics app shutting down", {
      totalRuns: this.metrics.agentRuns,
    });
  }
}

new DiagnosticsApp().start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
```

## Type Definitions

### ToolDefinition

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters?: JSONSchema;
  handler: (params: unknown) => Promise<unknown>;
}
```

### GatewayMethodHandler

```typescript
type GatewayMethodHandler = (params: unknown) => Promise<unknown>;
```

### HttpRouteHandler

```typescript
type HttpRouteHandler = (req: unknown, res: unknown) => Promise<void>;
```

### HookHandler

```typescript
type HookHandler<T> = (data: T, context: HookContext) => void | Promise<unknown>;

interface HookContext {
  eventId: string;
  agentId?: string;
  sessionKey?: string;
  channelId?: string;
  timestamp: number;
}
```

### AppLogger

```typescript
interface AppLogger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}
```

## Signal Handling

`OpenClawApp` automatically handles:

- `SIGTERM` - Graceful shutdown
- `SIGINT` - Graceful shutdown (Ctrl+C)

```typescript
// Signals are handled automatically
// Override behavior if needed:
process.on("SIGTERM", () => {
  // Custom handling before stop
  app.stop("SIGTERM");
});
```

## Next Steps

- [ChannelApp](channel-app.md) - Channel application class
- [KernelClient](kernel-client.md) - Low-level client API
- [Hooks](hooks.md) - Hook system reference
