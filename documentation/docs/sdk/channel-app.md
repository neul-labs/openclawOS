# ChannelApp

`ChannelApp` extends `OpenClawApp` for building channel applications that connect messaging platforms.

## Overview

```typescript
import { ChannelApp } from "@openclawos/sdk/app";

class TelegramApp extends ChannelApp {
  protected channelId = "telegram";
  manifest = { ... };

  protected async setupChannel(): Promise<void> {
    // Connect to Telegram API
  }

  protected async handleInbound(event: MessageReceivedEvent): Promise<void> {
    // Forward to kernel
    await this.dispatchInbound(event.from, event.content);
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    // Send via Telegram API
  }
}
```

## Properties

### channelId

**Required.** The channel identifier:

```typescript
protected abstract readonly channelId: string;
```

Must match what's declared in `capabilities.channels.provides`.

## Abstract Methods

### handleInbound()

**Required.** Handle incoming messages:

```typescript
protected abstract handleInbound(event: MessageReceivedEvent): Promise<void>;
```

Called when your platform receives a message. You should:

1. Process/normalize the message
2. Call `dispatchInbound()` to forward to kernel

### sendMessage()

**Required.** Send outgoing messages:

```typescript
protected abstract sendMessage(params: SendMessageParams): Promise<void>;
```

Called when the agent sends a response. You should:

1. Format the message for your platform
2. Send via your platform's API

## Optional Methods

### setupChannel()

Initialize channel-specific resources:

```typescript
protected async setupChannel(): Promise<void> {
  // Default: no-op
}
```

Called after channel is registered but before app is ready.

### getChannelMeta()

Provide channel metadata:

```typescript
protected getChannelMeta(): ChannelMeta {
  return {
    name: this.manifest.name,
    icon: this.manifest.icon,
  };
}
```

## Helper Methods

### dispatchInbound()

Forward a message to the kernel:

```typescript
protected async dispatchInbound(
  from: string,
  content: string,
  metadata?: Record<string, unknown>
): Promise<void>;

// Usage
await this.dispatchInbound("123456", "Hello!", {
  messageId: "msg_abc",
  username: "john_doe",
});
```

### buildSessionKey()

Create a session identifier:

```typescript
protected buildSessionKey(conversationId: string): string;

// Default implementation
buildSessionKey("123456"); // Returns "telegram:123456"
```

Override for custom key formats:

```typescript
protected buildSessionKey(conversationId: string, accountId?: string): string {
  if (accountId) {
    return `${this.channelId}:${accountId}:${conversationId}`;
  }
  return `${this.channelId}:${conversationId}`;
}
```

## Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    ChannelApp Lifecycle                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  start()                                                        │
│      │                                                          │
│      ▼                                                          │
│  Connect to kernel                                              │
│      │                                                          │
│      ▼                                                          │
│  Register manifest                                              │
│      │                                                          │
│      ▼                                                          │
│  setup() [inherited from OpenClawApp]                           │
│      │                                                          │
│      ├──▶ registerChannel()                                     │
│      │                                                          │
│      ├──▶ onHook("message_sending")                             │
│      │         │                                                │
│      │         └──▶ Calls sendMessage() when hook fires         │
│      │                                                          │
│      └──▶ setupChannel() ← Your initialization                  │
│                                                                 │
│      ▼                                                          │
│  Signal ready                                                   │
│      │                                                          │
│      ▼                                                          │
│  ═══════════════════ Running ═══════════════════               │
│                                                                 │
│  Platform message ──▶ handleInbound() ──▶ dispatchInbound()     │
│                                                                 │
│  Kernel hook ──▶ sendMessage() ──▶ Platform API                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Complete Example

```typescript
import { ChannelApp, MessageReceivedEvent, SendMessageParams } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";

interface SlackMessage {
  channel: string;
  user: string;
  text: string;
  ts: string;
}

class SlackApp extends ChannelApp {
  protected channelId = "slack";
  private client!: SlackClient;

  manifest: PackageManifest = {
    id: "@openclawos/slack",
    name: "Slack",
    version: "1.0.0",
    type: "app",
    main: "dist/index.js",
    protocol: { version: "1.0" },
    capabilities: {
      channels: { provides: ["slack"] },
      hooks: { intercepts: ["message_sending"] },
      resources: {
        env: ["SLACK_BOT_TOKEN", "SLACK_APP_TOKEN"],
        network: { hosts: ["slack.com", "*.slack.com"] },
      },
    },
  };

  protected async setupChannel(): Promise<void> {
    const botToken = process.env.SLACK_BOT_TOKEN;
    const appToken = process.env.SLACK_APP_TOKEN;

    if (!botToken || !appToken) {
      throw new Error("SLACK_BOT_TOKEN and SLACK_APP_TOKEN required");
    }

    this.client = new SlackClient({ botToken, appToken });

    this.client.on("message", async (msg: SlackMessage) => {
      // Ignore bot messages
      if (msg.user === this.client.botId) return;

      await this.handleInbound({
        from: msg.channel,
        content: msg.text,
        metadata: {
          userId: msg.user,
          timestamp: msg.ts,
        },
      });
    });

    await this.client.connect();
    this.log.info("Slack app connected");
  }

  protected async handleInbound(event: MessageReceivedEvent): Promise<void> {
    this.log.debug(`Message from ${event.from}: ${event.content}`);

    await this.dispatchInbound(event.from, event.content, {
      platform: "slack",
      ...event.metadata,
    });
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    await this.client.chat.postMessage({
      channel: params.target,
      text: params.content,
      mrkdwn: true,
    });
  }

  protected async teardown(): Promise<void> {
    await this.client.disconnect();
    this.log.info("Slack app disconnected");
  }
}

new SlackApp().start().catch(console.error);
```

## Type Definitions

### MessageReceivedEvent

```typescript
interface MessageReceivedEvent {
  /** Conversation/chat identifier */
  from: string;
  /** Message content */
  content: string;
  /** Optional timestamp */
  timestamp?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}
```

### SendMessageParams

```typescript
interface SendMessageParams {
  /** Target conversation/chat identifier */
  target: string;
  /** Message content */
  content: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}
```

### ChannelConfig

```typescript
interface ChannelConfig {
  /** Channel identifier */
  id: string;
  /** Channel metadata */
  meta?: ChannelMeta;
}
```

### ChannelMeta

```typescript
interface ChannelMeta {
  /** Display name */
  name?: string;
  /** Icon URL */
  icon?: string;
}
```

## Multi-Account Support

For channels supporting multiple accounts:

```typescript
class MultiAccountSlackApp extends ChannelApp {
  protected channelId = "slack";
  private accounts = new Map<string, SlackClient>();

  protected async setupChannel(): Promise<void> {
    const config = await this.kernel.getConfig("channels.slack");

    for (const [accountId, accountConfig] of Object.entries(config.accounts)) {
      const client = new SlackClient(accountConfig);

      client.on("message", (msg) => {
        this.onMessage(accountId, msg);
      });

      await client.connect();
      this.accounts.set(accountId, client);
    }
  }

  private async onMessage(accountId: string, msg: SlackMessage): Promise<void> {
    const sessionKey = this.buildSessionKey(msg.channel, accountId);

    await this.kernel.queueAgent(sessionKey, msg.text, {
      channelId: this.channelId,
      accountId,
      from: msg.channel,
    });
  }

  protected buildSessionKey(conversationId: string, accountId?: string): string {
    if (accountId) {
      return `${this.channelId}:${accountId}:${conversationId}`;
    }
    return `${this.channelId}:${conversationId}`;
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    // Extract account from metadata or use default
    const accountId = (params.metadata?.accountId as string) || "default";
    const client = this.accounts.get(accountId);

    if (!client) {
      throw new Error(`Unknown account: ${accountId}`);
    }

    await client.chat.postMessage({
      channel: params.target,
      text: params.content,
    });
  }
}
```

## Error Handling

```typescript
protected async handleInbound(event: MessageReceivedEvent): Promise<void> {
  try {
    await this.dispatchInbound(event.from, event.content, event.metadata);
  } catch (error) {
    this.log.error("Failed to dispatch message:", error);

    // Optionally notify user
    try {
      await this.sendMessage({
        target: event.from,
        content: "Sorry, I encountered an error processing your message.",
      });
    } catch {
      // Ignore send errors
    }
  }
}

protected async sendMessage(params: SendMessageParams): Promise<void> {
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await this.client.send(params.target, params.content);
      return;
    } catch (error) {
      if (error.code === "rate_limited") {
        await this.delay(error.retryAfter * 1000);
        continue;
      }
      throw error;
    }
  }

  throw new Error("Max retries exceeded");
}
```

## Next Steps

- [Message Flow](../developing-apps/message-flow.md) - Understand routing
- [OpenClawApp](openclaw-app.md) - Base class reference
- [Hooks](hooks.md) - Hook system reference
