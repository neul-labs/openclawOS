# Getting Started with App Development

This guide will help you build your first OpenClawOS application.

## What is an App?

Apps are **process-isolated** applications that communicate with the kernel via IPC. There are two types:

- **Channel Apps**: Connect messaging platforms (Telegram, Discord, etc.)
- **Plugin Apps**: Add capabilities (diagnostics, voice calls, etc.)

## Prerequisites

- Node.js 20+
- TypeScript 5+
- OpenClawOS kernel installed (`npm install -g openclaw`)

## Quick Start

### 1. Create Project

```bash
mkdir my-channel-app
cd my-channel-app
npm init -y
npm install @openclawos/sdk
npm install -D typescript @types/node
```

### 2. Create Manifest

Create `openclawos.manifest.json`:

```json
{
  "id": "@myorg/my-channel",
  "name": "My Channel",
  "version": "1.0.0",
  "description": "A custom channel app",
  "type": "app",
  "main": "dist/index.js",
  "protocol": {
    "version": "1.0"
  },
  "capabilities": {
    "channels": {
      "provides": ["mychannel"]
    },
    "hooks": {
      "intercepts": ["message_sending"]
    },
    "resources": {
      "env": ["MY_API_TOKEN"],
      "network": {
        "hosts": ["api.example.com"]
      }
    }
  }
}
```

### 3. Write the App

Create `src/index.ts`:

```typescript
import { ChannelApp, MessageReceivedEvent, SendMessageParams } from "@openclawos/sdk/app";

class MyChannelApp extends ChannelApp {
  protected channelId = "mychannel";

  manifest = {
    id: "@myorg/my-channel",
    name: "My Channel",
    version: "1.0.0",
    type: "app" as const,
    main: "dist/index.js",
    protocol: { version: "1.0" },
    capabilities: {
      channels: { provides: ["mychannel"] },
      hooks: { intercepts: ["message_sending"] },
    },
  };

  protected async setupChannel(): Promise<void> {
    // Connect to your messaging platform API
    this.log.info("Setting up channel connection...");

    // Example: Listen for incoming messages
    this.startPolling();
  }

  protected async handleInbound(event: MessageReceivedEvent): Promise<void> {
    // Dispatch to kernel for agent processing
    await this.dispatchInbound(event.from, event.content, event.metadata);
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    // Send message via your platform API
    this.log.info(`Sending to ${params.target}: ${params.content}`);

    // await myApi.send(params.target, params.content);
  }

  private startPolling(): void {
    // Poll for messages (replace with your API's event system)
    setInterval(async () => {
      // const messages = await myApi.getNewMessages();
      // for (const msg of messages) {
      //   await this.handleInbound({
      //     from: msg.sender,
      //     content: msg.text,
      //   });
      // }
    }, 1000);
  }
}

// Start the app
const app = new MyChannelApp();
app.start().catch(console.error);
```

### 4. Build and Run

```bash
# Build
npx tsc

# Run (kernel must be running)
node dist/index.js
```

## App Structure

A typical app has this structure:

```
my-channel-app/
├── openclawos.manifest.json    # Package manifest
├── package.json                # Node.js package
├── tsconfig.json               # TypeScript config
├── src/
│   ├── index.ts               # Entry point
│   ├── api.ts                 # Platform API client
│   └── handlers.ts            # Event handlers
└── dist/                      # Compiled output
    └── index.js
```

## The ChannelApp Base Class

`ChannelApp` provides:

| Method              | Purpose                          |
| ------------------- | -------------------------------- |
| `setupChannel()`    | Initialize channel connection    |
| `handleInbound()`   | Process incoming messages        |
| `sendMessage()`     | Send outgoing messages           |
| `dispatchInbound()` | Forward to kernel for processing |
| `buildSessionKey()` | Create session identifier        |

### Lifecycle

```
┌──────────────────────────────────────────────────────────┐
│                    ChannelApp Lifecycle                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  start() called                                          │
│      │                                                   │
│      ▼                                                   │
│  Connect to kernel (IPC)                                 │
│      │                                                   │
│      ▼                                                   │
│  Register manifest                                       │
│      │                                                   │
│      ▼                                                   │
│  Register channel capability                             │
│      │                                                   │
│      ▼                                                   │
│  Subscribe to message_sending hook                       │
│      │                                                   │
│      ▼                                                   │
│  setupChannel() ← Your initialization                    │
│      │                                                   │
│      ▼                                                   │
│  Signal ready                                            │
│      │                                                   │
│      ▼                                                   │
│  Start heartbeat loop                                    │
│      │                                                   │
│      ▼                                                   │
│  ═══════════════ Running ═══════════════                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Message Flow

### Inbound (User → Agent)

```
┌────────────┐    ┌───────────┐    ┌────────────┐    ┌─────────┐
│  Platform  │───▶│  Your App │───▶│   Kernel   │───▶│  Agent  │
│    API     │    │           │    │            │    │         │
└────────────┘    └───────────┘    └────────────┘    └─────────┘
                        │
                  handleInbound()
                        │
                  dispatchInbound()
```

### Outbound (Agent → User)

```
┌─────────┐    ┌────────────┐    ┌───────────┐    ┌────────────┐
│  Agent  │───▶│   Kernel   │───▶│  Your App │───▶│  Platform  │
│         │    │            │    │           │    │    API     │
└─────────┘    └────────────┘    └───────────┘    └────────────┘
                       │
                 hook event:
               message_sending
                       │
                 sendMessage()
```

## Configuration

Apps can read kernel configuration:

```typescript
protected async setupChannel(): Promise<void> {
  // Get config for this channel
  const config = await this.kernel.getConfig("channels.mychannel");

  this.apiToken = config.apiToken;
  this.endpoint = config.endpoint;
}
```

## Error Handling

```typescript
protected async sendMessage(params: SendMessageParams): Promise<void> {
  try {
    await this.api.send(params.target, params.content);
  } catch (error) {
    this.log.error("Failed to send message:", error);
    // Optionally notify kernel of failure
    throw error;
  }
}
```

## Testing

See [Testing Apps](testing.md) for testing strategies.

## Next Steps

- [App Structure](app-structure.md) - Detailed manifest and directory layout
- [Channel Apps](channel-app.md) - Deep dive into channel development
- [Plugin Apps](plugin-app.md) - Building plugin applications
- [UI Contributions](ui-contributions.md) - Adding tabs, components, and settings to the dashboard
- [Message Flow](message-flow.md) - Understanding message routing
- [SDK Reference](../sdk/index.md) - API documentation
