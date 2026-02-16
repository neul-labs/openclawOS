# Building Channel Apps

Channel apps connect messaging platforms to OpenClawOS. This guide covers building production-ready channel apps.

## Overview

A channel app:

1. Connects to a messaging platform (Telegram, Discord, etc.)
2. Receives incoming messages and forwards to kernel
3. Sends outgoing messages from agent to users

## The ChannelApp Base Class

```typescript
import { ChannelApp } from "@openclawos/sdk/app";

class MyChannelApp extends ChannelApp {
  // Channel identifier (must match manifest)
  protected channelId = "mychannel";

  // Package manifest
  manifest = { ... };

  // Initialize channel connection
  protected async setupChannel(): Promise<void> { }

  // Handle inbound messages
  protected async handleInbound(event: MessageReceivedEvent): Promise<void> { }

  // Send outbound messages
  protected async sendMessage(params: SendMessageParams): Promise<void> { }
}
```

## Complete Example: Telegram App

```typescript
import { ChannelApp, MessageReceivedEvent, SendMessageParams } from "@openclawos/sdk/app";
import TelegramBot from "node-telegram-bot-api";

class TelegramApp extends ChannelApp {
  protected channelId = "telegram";
  private bot!: TelegramBot;

  manifest = {
    id: "@openclawos/telegram",
    name: "Telegram",
    version: "1.0.0",
    type: "app" as const,
    main: "dist/index.js",
    protocol: { version: "1.0" },
    capabilities: {
      channels: { provides: ["telegram"] },
      hooks: { intercepts: ["message_sending"] },
      resources: {
        env: ["TELEGRAM_BOT_TOKEN"],
        network: { hosts: ["api.telegram.org"] },
      },
    },
  };

  protected async setupChannel(): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error("TELEGRAM_BOT_TOKEN required");
    }

    this.bot = new TelegramBot(token, { polling: true });

    this.bot.on("message", async (msg) => {
      if (!msg.text) return;

      await this.handleInbound({
        from: String(msg.chat.id),
        content: msg.text,
        metadata: {
          messageId: msg.message_id,
          username: msg.from?.username,
          firstName: msg.from?.first_name,
        },
      });
    });

    this.log.info("Telegram bot connected");
  }

  protected async handleInbound(event: MessageReceivedEvent): Promise<void> {
    // Forward to kernel for agent processing
    await this.dispatchInbound(event.from, event.content, event.metadata);
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    await this.bot.sendMessage(params.target, params.content, {
      parse_mode: "Markdown",
    });
  }

  protected async teardown(): Promise<void> {
    this.bot.stopPolling();
  }
}

new TelegramApp().start();
```

## Key Methods

### setupChannel()

Called during app initialization. Set up your platform connection here:

```typescript
protected async setupChannel(): Promise<void> {
  // Initialize API client
  this.client = new MyPlatformClient({
    token: process.env.API_TOKEN,
  });

  // Set up event handlers
  this.client.on("message", this.onMessage.bind(this));

  // Connect
  await this.client.connect();
}
```

### handleInbound()

Called when you receive a message from the platform:

```typescript
protected async handleInbound(event: MessageReceivedEvent): Promise<void> {
  this.log.debug(`Received from ${event.from}: ${event.content}`);

  // Forward to kernel
  await this.dispatchInbound(event.from, event.content, {
    platform: "myplatform",
    ...event.metadata,
  });
}
```

### sendMessage()

Called when the agent sends a response:

```typescript
protected async sendMessage(params: SendMessageParams): Promise<void> {
  try {
    await this.client.send(params.target, params.content);
    this.log.debug(`Sent to ${params.target}: ${params.content.slice(0, 50)}...`);
  } catch (error) {
    this.log.error(`Failed to send to ${params.target}:`, error);
    throw error;
  }
}
```

### dispatchInbound()

Helper to forward messages to the kernel:

```typescript
// Simple usage
await this.dispatchInbound(chatId, messageText);

// With metadata
await this.dispatchInbound(chatId, messageText, {
  messageId: "123",
  username: "john_doe",
  isGroup: true,
});
```

### buildSessionKey()

Create session identifiers:

```typescript
// Default: "mychannel:conversationId"
const key = this.buildSessionKey("123456");
// Result: "mychannel:123456"
```

## Handling Different Message Types

### Text Messages

```typescript
this.client.on("text", async (msg) => {
  await this.handleInbound({
    from: msg.chatId,
    content: msg.text,
  });
});
```

### Media Messages

```typescript
this.client.on("image", async (msg) => {
  // Download and describe the image
  const url = await this.client.getMediaUrl(msg.mediaId);

  await this.handleInbound({
    from: msg.chatId,
    content: `[User sent an image: ${url}]`,
    metadata: { mediaType: "image", mediaUrl: url },
  });
});
```

### Commands

```typescript
this.client.on("command", async (msg) => {
  if (msg.command === "/start") {
    await this.client.send(msg.chatId, "Welcome! I'm your AI assistant.");
    return;
  }

  // Pass other commands to agent
  await this.handleInbound({
    from: msg.chatId,
    content: msg.fullText,
    metadata: { isCommand: true, command: msg.command },
  });
});
```

## Rich Message Formatting

### Markdown

```typescript
protected async sendMessage(params: SendMessageParams): Promise<void> {
  // Convert markdown to platform format
  const formatted = this.formatMarkdown(params.content);
  await this.client.send(params.target, formatted);
}

private formatMarkdown(text: string): string {
  // Platform-specific markdown conversion
  return text
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.*?)\*/g, "<i>$1</i>");
}
```

### Message Splitting

For long messages:

```typescript
protected async sendMessage(params: SendMessageParams): Promise<void> {
  const MAX_LENGTH = 4096;
  const content = params.content;

  if (content.length <= MAX_LENGTH) {
    await this.client.send(params.target, content);
    return;
  }

  // Split at paragraph boundaries
  const chunks = this.splitMessage(content, MAX_LENGTH);
  for (const chunk of chunks) {
    await this.client.send(params.target, chunk);
    await this.delay(100); // Rate limiting
  }
}
```

## Multi-Account Support

For apps that support multiple accounts:

```typescript
class MultiAccountApp extends ChannelApp {
  private accounts = new Map<string, PlatformClient>();

  protected async setupChannel(): Promise<void> {
    // Get config for all accounts
    const config = await this.kernel.getConfig("channels.myplatform");

    for (const [accountId, accountConfig] of Object.entries(config.accounts)) {
      const client = new PlatformClient(accountConfig.token);
      client.on("message", (msg) => this.onMessage(accountId, msg));
      await client.connect();
      this.accounts.set(accountId, client);
    }
  }

  protected buildSessionKey(conversationId: string, accountId?: string): string {
    // Include account in session key
    return `${this.channelId}:${accountId}:${conversationId}`;
  }
}
```

## Error Handling

### Connection Errors

```typescript
protected async setupChannel(): Promise<void> {
  try {
    await this.client.connect();
  } catch (error) {
    this.log.error("Failed to connect:", error);
    throw error; // App will restart
  }

  this.client.on("disconnect", async () => {
    this.log.warn("Disconnected, attempting reconnect...");
    await this.reconnect();
  });
}

private async reconnect(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    try {
      await this.client.connect();
      this.log.info("Reconnected successfully");
      return;
    } catch {
      await this.delay(1000 * Math.pow(2, i));
    }
  }
  throw new Error("Failed to reconnect after 5 attempts");
}
```

### Send Errors

```typescript
protected async sendMessage(params: SendMessageParams): Promise<void> {
  try {
    await this.client.send(params.target, params.content);
  } catch (error) {
    if (error.code === "RATE_LIMITED") {
      await this.delay(error.retryAfter * 1000);
      await this.client.send(params.target, params.content);
    } else if (error.code === "USER_BLOCKED") {
      this.log.warn(`User ${params.target} has blocked the bot`);
      // Don't throw - message is "delivered" (to blocked user)
    } else {
      throw error;
    }
  }
}
```

## Testing

See [Testing Apps](testing.md) for testing strategies.

## Next Steps

- [Plugin Apps](plugin-app.md) - Build plugin apps
- [Message Flow](message-flow.md) - Understanding message routing
- [SDK Reference](../sdk/channel-app.md) - ChannelApp API
