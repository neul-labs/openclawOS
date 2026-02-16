# SDK Overview

The `@openclawos/sdk` package provides everything you need to build OpenClawOS applications.

## Installation

```bash
npm install @openclawos/sdk
```

## Package Structure

```
@openclawos/sdk
├── app          # Application base classes
├── client       # Kernel client for IPC
└── types        # TypeScript types
```

## Quick Start

### Channel App

```typescript
import { ChannelApp } from "@openclawos/sdk/app";

class MyChannelApp extends ChannelApp {
  protected channelId = "mychannel";
  manifest = { ... };

  protected async setupChannel(): Promise<void> {
    // Initialize
  }

  protected async handleInbound(event): Promise<void> {
    await this.dispatchInbound(event.from, event.content);
  }

  protected async sendMessage(params): Promise<void> {
    // Send to platform
  }
}

new MyChannelApp().start();
```

### Plugin App

```typescript
import { OpenClawApp } from "@openclawos/sdk/app";

class MyPluginApp extends OpenClawApp {
  manifest = { ... };

  protected async setup(): Promise<void> {
    // Register tools
    await this.registerTool({
      name: "my_tool",
      description: "Does something",
      handler: async (params) => {
        return { result: "done" };
      }
    });

    // Subscribe to hooks
    await this.onHook("message_received", async (data) => {
      console.log("Message received:", data);
    });
  }
}

new MyPluginApp().start();
```

### Standalone Client

```typescript
import { createKernelClient } from "@openclawos/sdk/client";

const kernel = createKernelClient();
await kernel.connect();

// Make requests
const sessions = await kernel.call("session.list", { limit: 10 });
```

## Core Classes

### OpenClawApp

Base class for all applications. Provides:

- Lifecycle management (start, stop)
- Kernel connection handling
- Capability registration helpers
- Hook subscription helpers
- Heartbeat management

See [OpenClawApp Reference](openclaw-app.md).

### ChannelApp

Extends `OpenClawApp` for channel implementations. Adds:

- Channel registration
- Inbound message handling
- Outbound message hook
- Session key building

See [ChannelApp Reference](channel-app.md).

### KernelClient

Low-level IPC client for kernel communication:

- Connection management
- Request/response handling
- Event subscription
- Streaming support

See [KernelClient Reference](kernel-client.md).

## Type Exports

```typescript
// App types
import type {
  MessageReceivedEvent,
  MessageSendingEvent,
  SendMessageParams,
  ToolDefinition,
  HookHandler,
} from "@openclawos/sdk/app";

// Protocol types (from @openclawos/protocol)
import type {
  PackageManifest,
  PackageCapabilities,
  IPCRequest,
  IPCResponse,
  HookName,
} from "@openclawos/protocol";
```

## Environment Variables

The SDK reads these environment variables:

| Variable            | Description          | Default       |
| ------------------- | -------------------- | ------------- |
| `OPENCLAWOS_SOCKET` | IPC socket path      | Auto-detected |
| `OPENCLAWOS_APP_ID` | App identifier       | From manifest |
| `OPENCLAWOS_DEBUG`  | Enable debug logging | `false`       |

## Error Handling

SDK methods throw typed errors:

```typescript
import { IPCError } from "@openclawos/sdk/client";

try {
  await kernel.call("session.get", { key: "invalid" });
} catch (error) {
  if (error instanceof IPCError) {
    console.log(error.code); // "NOT_FOUND"
    console.log(error.message); // "Session not found"
  }
}
```

## Logging

Apps include a built-in logger:

```typescript
class MyApp extends OpenClawApp {
  protected async setup(): Promise<void> {
    this.log.debug("Debug message");
    this.log.info("Info message");
    this.log.warn("Warning message");
    this.log.error("Error message");
  }
}
```

## Next Steps

- [KernelClient](kernel-client.md) - Low-level client API
- [OpenClawApp](openclaw-app.md) - Base application class
- [ChannelApp](channel-app.md) - Channel application class
- [Hooks](hooks.md) - Hook system reference
