# Message Flow

Understanding how messages flow through OpenClawOS is essential for building reliable apps.

## Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Message Flow                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Inbound (User → Agent):                                           │
│                                                                     │
│  ┌──────────┐   ┌─────────┐   ┌────────┐   ┌───────────┐          │
│  │ Platform │──▶│   App   │──▶│ Kernel │──▶│   Agent   │          │
│  │  (API)   │   │(process)│   │        │   │  Runtime  │          │
│  └──────────┘   └─────────┘   └────────┘   └───────────┘          │
│                      │             │                                │
│               handleInbound()  agent.queue                          │
│               dispatchInbound()    IPC                              │
│                                                                     │
│  Outbound (Agent → User):                                          │
│                                                                     │
│  ┌───────────┐   ┌────────┐   ┌─────────┐   ┌──────────┐          │
│  │   Agent   │──▶│ Kernel │──▶│   App   │──▶│ Platform │          │
│  │  Runtime  │   │        │   │(process)│   │  (API)   │          │
│  └───────────┘   └────────┘   └─────────┘   └──────────┘          │
│                      │             │                                │
│               message_sending  sendMessage()                        │
│                hook event                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Inbound Flow (User → Agent)

### Step 1: Platform Receives Message

Your messaging platform's API receives a message from a user.

```typescript
// Platform SDK event
telegramBot.on("message", async (msg) => {
  // msg = { chat: { id: 123 }, text: "Hello", from: { ... } }
});
```

### Step 2: App Handles Inbound

Your app processes the raw platform event:

```typescript
protected async handleInbound(event: MessageReceivedEvent): Promise<void> {
  // Validate and normalize the message
  if (!event.content.trim()) {
    return; // Skip empty messages
  }

  // Forward to kernel
  await this.dispatchInbound(event.from, event.content, {
    platform: "telegram",
    messageId: event.metadata?.messageId,
  });
}
```

### Step 3: App Dispatches to Kernel

`dispatchInbound()` calls the kernel's `agent.queue` IPC method:

```typescript
// Inside dispatchInbound()
const sessionKey = this.buildSessionKey(from); // "telegram:123456"

await this.kernel.queueAgent(sessionKey, content, {
  channelId: this.channelId,
  from,
  ...metadata,
});
```

### Step 4: Kernel Queues for Agent

The kernel:

1. Creates or retrieves the session
2. Queues the message for agent processing
3. Returns a run ID for tracking

```typescript
// Kernel response
{
  runId: "run_abc123",
  queued: true
}
```

### Step 5: Agent Processes

The agent runtime:

1. Loads conversation history
2. Sends to LLM with tools
3. Executes any tool calls
4. Generates response

## Outbound Flow (Agent → User)

### Step 1: Agent Generates Response

The agent creates a response to send to the user.

### Step 2: Kernel Dispatches Hook

The kernel fires the `message_sending` hook:

```typescript
// Hook event payload
{
  eventId: "evt_123",
  hookName: "message_sending",
  data: {
    channelId: "telegram",
    target: "123456",
    content: "Hello! How can I help you?",
    metadata: { ... }
  },
  context: {
    sessionKey: "telegram:123456",
    agentId: "default",
    timestamp: 1707000000000
  }
}
```

### Step 3: App Receives Hook

Your app receives the hook event because it subscribed during setup:

```typescript
// Inside ChannelApp.setup()
await this.onHook("message_sending", async (event: MessageSendingEvent) => {
  if (event.channelId === this.channelId) {
    await this.sendMessage({
      target: event.target,
      content: event.content,
      metadata: event.metadata,
    });
  }
});
```

### Step 4: App Sends Message

Your `sendMessage()` implementation sends via the platform API:

```typescript
protected async sendMessage(params: SendMessageParams): Promise<void> {
  await this.telegramBot.sendMessage(
    Number(params.target),
    params.content,
    { parse_mode: "Markdown" }
  );
}
```

### Step 5: Platform Delivers

The platform delivers the message to the user.

## Session Keys

Session keys identify conversations:

```
Format: {channelId}:{conversationId}

Examples:
- telegram:123456789        (Telegram chat ID)
- discord:guild:channel     (Discord server + channel)
- slack:C12345              (Slack channel)
```

### Building Session Keys

```typescript
// Default implementation
protected buildSessionKey(conversationId: string): string {
  return `${this.channelId}:${conversationId}`;
}

// Custom for multi-account
protected buildSessionKey(conversationId: string, accountId?: string): string {
  if (accountId) {
    return `${this.channelId}:${accountId}:${conversationId}`;
  }
  return `${this.channelId}:${conversationId}`;
}
```

## Hook Events

### message_received

Fired when kernel receives an inbound message:

```typescript
{
  hookName: "message_received",
  data: {
    sessionKey: "telegram:123",
    content: "Hello",
    metadata: { ... }
  }
}
```

Apps subscribe to observe (not modify) inbound messages.

### message_sending

Fired when agent sends a response:

```typescript
{
  hookName: "message_sending",
  data: {
    channelId: "telegram",
    target: "123",
    content: "Hi there!",
    metadata: { ... }
  }
}
```

Channel apps intercept this to deliver messages.

### message_sent

Fired after message is delivered:

```typescript
{
  hookName: "message_sent",
  data: {
    channelId: "telegram",
    target: "123",
    content: "Hi there!",
    deliveredAt: 1707000001000
  }
}
```

## Error Handling

### Inbound Errors

```typescript
protected async handleInbound(event: MessageReceivedEvent): Promise<void> {
  try {
    await this.dispatchInbound(event.from, event.content, event.metadata);
  } catch (error) {
    this.log.error("Failed to dispatch inbound:", error);
    // Optionally send error message to user
    await this.sendErrorMessage(event.from, "Sorry, I encountered an error.");
  }
}
```

### Outbound Errors

```typescript
protected async sendMessage(params: SendMessageParams): Promise<void> {
  try {
    await this.platform.send(params.target, params.content);
  } catch (error) {
    this.log.error(`Send failed to ${params.target}:`, error);

    // Re-throw to notify kernel of delivery failure
    throw error;
  }
}
```

## Message Metadata

### Inbound Metadata

Include useful context:

```typescript
await this.dispatchInbound(chatId, text, {
  // Platform info
  platform: "telegram",
  messageId: msg.message_id,

  // Sender info
  username: msg.from?.username,
  firstName: msg.from?.first_name,
  isBot: msg.from?.is_bot,

  // Chat info
  chatType: msg.chat.type, // "private" | "group" | "supergroup"
  chatTitle: msg.chat.title,

  // Message info
  replyToMessageId: msg.reply_to_message?.message_id,
  hasMedia: !!msg.photo || !!msg.document,
});
```

### Outbound Metadata

Kernel may include:

```typescript
{
  target: "123456",
  content: "Hello!",
  metadata: {
    agentId: "default",
    runId: "run_abc",
    replyToMessageId: "msg_xyz",
    format: "markdown"
  }
}
```

## Rate Limiting

Handle platform rate limits gracefully:

```typescript
protected async sendMessage(params: SendMessageParams): Promise<void> {
  while (true) {
    try {
      await this.platform.send(params.target, params.content);
      return;
    } catch (error) {
      if (error.code === "RATE_LIMITED") {
        this.log.warn(`Rate limited, waiting ${error.retryAfter}s`);
        await this.delay(error.retryAfter * 1000);
        continue;
      }
      throw error;
    }
  }
}
```

## Batching

For high-volume channels:

```typescript
class BatchingChannelApp extends ChannelApp {
  private messageQueue: SendMessageParams[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    this.messageQueue.push(params);

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), 100);
    }
  }

  private async flush(): Promise<void> {
    this.flushTimer = null;
    const batch = this.messageQueue.splice(0, 20);

    await Promise.all(batch.map((p) => this.platform.send(p.target, p.content)));

    if (this.messageQueue.length > 0) {
      this.flushTimer = setTimeout(() => this.flush(), 100);
    }
  }
}
```

## Next Steps

- [Testing Apps](testing.md) - Test your message handling
- [SDK Reference](../sdk/channel-app.md) - ChannelApp API details
