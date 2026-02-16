# Hooks

Hooks allow apps to observe and intercept kernel events.

## Overview

```typescript
import { OpenClawApp } from "@openclawos/sdk/app";

class MyApp extends OpenClawApp {
  protected async setup(): Promise<void> {
    // Subscribe to observe events
    await this.onHook("message_received", (data) => {
      console.log("Message received:", data);
    });

    // Intercept to modify events
    await this.onHook("message_sending", async (data) => {
      return { ...data, content: `[Modified] ${data.content}` };
    });
  }
}
```

## Hook Types

### Subscribe (Observe)

Observe events without modifying them:

```typescript
await this.onHook("agent_end", (data, context) => {
  this.log.info(`Agent run completed: ${context.sessionKey}`);
  this.metrics.agentRuns++;
});
```

### Intercept (Modify)

Modify or block events:

```typescript
await this.onHook("message_sending", async (data, context) => {
  // Modify content
  return {
    ...data,
    content: data.content.replace(/badword/gi, "****"),
  };
});

// Or block entirely
await this.onHook("message_sending", async (data, context) => {
  if (data.content.includes("blocked")) {
    return null; // Block the message
  }
  return data;
});
```

## Available Hooks

### Agent Lifecycle

| Hook                 | Type      | Description             |
| -------------------- | --------- | ----------------------- |
| `before_agent_start` | Intercept | Before agent run begins |
| `llm_input`          | Subscribe | LLM prompt being sent   |
| `llm_output`         | Subscribe | LLM response received   |
| `agent_end`          | Subscribe | Agent run completed     |

### Memory & Context

| Hook                | Type      | Description               |
| ------------------- | --------- | ------------------------- |
| `before_compaction` | Subscribe | Before context compaction |
| `after_compaction`  | Subscribe | After context compaction  |
| `before_reset`      | Subscribe | Before session reset      |

### Messages

| Hook               | Type      | Description                    |
| ------------------ | --------- | ------------------------------ |
| `message_received` | Subscribe | Inbound message received       |
| `message_sending`  | Intercept | Outbound message about to send |
| `message_sent`     | Subscribe | Outbound message sent          |

### Tools

| Hook                  | Type      | Description             |
| --------------------- | --------- | ----------------------- |
| `before_tool_call`    | Intercept | Before tool execution   |
| `after_tool_call`     | Subscribe | After tool execution    |
| `tool_result_persist` | Intercept | Tool result being saved |

### Sessions

| Hook            | Type      | Description         |
| --------------- | --------- | ------------------- |
| `session_start` | Subscribe | New session created |
| `session_end`   | Subscribe | Session ended       |

### Gateway

| Hook            | Type      | Description             |
| --------------- | --------- | ----------------------- |
| `gateway_start` | Subscribe | Gateway server started  |
| `gateway_stop`  | Subscribe | Gateway server stopping |

## Hook Payloads

### before_agent_start

```typescript
interface BeforeAgentStartData {
  sessionKey: string;
  agentId: string;
  input: string;
  metadata: Record<string, unknown>;
}
```

### message_received

```typescript
interface MessageReceivedData {
  sessionKey: string;
  content: string;
  channelId?: string;
  from?: string;
  metadata: Record<string, unknown>;
}
```

### message_sending

```typescript
interface MessageSendingData {
  channelId: string;
  target: string;
  content: string;
  metadata: Record<string, unknown>;
}
```

### before_tool_call

```typescript
interface BeforeToolCallData {
  toolName: string;
  toolInput: unknown;
  sessionKey: string;
  runId: string;
}
```

### agent_end

```typescript
interface AgentEndData {
  sessionKey: string;
  agentId: string;
  runId: string;
  success: boolean;
  error?: string;
  duration: number;
  tokenUsage?: {
    input: number;
    output: number;
  };
}
```

## Hook Context

Every hook handler receives context:

```typescript
interface HookContext {
  /** Event ID for correlation */
  eventId: string;
  /** Agent ID */
  agentId?: string;
  /** Session key */
  sessionKey?: string;
  /** Channel ID */
  channelId?: string;
  /** Account ID */
  accountId?: string;
  /** Event timestamp */
  timestamp: number;
}
```

## Manifest Declaration

Declare hooks in your manifest:

```json
{
  "capabilities": {
    "hooks": {
      "subscribes": ["message_received", "agent_end"],
      "intercepts": ["message_sending", "before_tool_call"]
    }
  }
}
```

## Examples

### Logging All Agent Runs

```typescript
await this.onHook("before_agent_start", (data, ctx) => {
  this.log.info(`[${ctx.sessionKey}] Agent starting`);
});

await this.onHook("agent_end", (data, ctx) => {
  this.log.info(`[${ctx.sessionKey}] Agent completed`, {
    success: data.success,
    duration: data.duration,
    tokens: data.tokenUsage,
  });
});
```

### Content Moderation

```typescript
await this.onHook("message_sending", async (data) => {
  // Check content against moderation rules
  const result = await this.moderator.check(data.content);

  if (result.blocked) {
    this.log.warn(`Blocked message: ${result.reason}`);
    return null; // Block the message
  }

  if (result.modified) {
    return { ...data, content: result.content };
  }

  return data;
});
```

### Tool Auditing

```typescript
await this.onHook("before_tool_call", (data, ctx) => {
  this.audit.log({
    type: "tool_call",
    tool: data.toolName,
    session: ctx.sessionKey,
    timestamp: ctx.timestamp,
  });
  return data;
});

await this.onHook("after_tool_call", (data, ctx) => {
  this.audit.log({
    type: "tool_result",
    tool: data.toolName,
    success: data.success,
    session: ctx.sessionKey,
    timestamp: ctx.timestamp,
  });
});
```

### Rate Limiting

```typescript
const rateLimiter = new Map<string, number[]>();

await this.onHook("before_agent_start", (data, ctx) => {
  const key = ctx.sessionKey || "unknown";
  const now = Date.now();
  const window = 60000; // 1 minute
  const limit = 10;

  const timestamps = rateLimiter.get(key) || [];
  const recent = timestamps.filter((t) => now - t < window);

  if (recent.length >= limit) {
    throw new Error("Rate limit exceeded");
  }

  recent.push(now);
  rateLimiter.set(key, recent);
  return data;
});
```

### Message Enrichment

```typescript
await this.onHook("message_sending", async (data) => {
  // Add signature to outgoing messages
  const signature = await this.getSignature();

  return {
    ...data,
    content: `${data.content}\n\n---\n${signature}`,
  };
});
```

## Error Handling

```typescript
await this.onHook("message_sending", async (data, ctx) => {
  try {
    // Your hook logic
    return await this.processMessage(data);
  } catch (error) {
    this.log.error("Hook error:", error);
    // Return original data on error
    return data;
  }
});
```

## Hook Order

When multiple apps subscribe to the same hook:

1. Subscribe hooks run in parallel (order not guaranteed)
2. Intercept hooks run in sequence (registration order)
3. Any intercept returning `null` blocks the event

## Performance

- Keep hook handlers fast (< 100ms)
- Use async handlers for I/O operations
- Avoid blocking operations
- Consider batching for high-volume hooks

## Next Steps

- [OpenClawApp](openclaw-app.md) - Application base class
- [Capabilities](../architecture/capabilities.md) - Declaring hooks
- [Hook Events Reference](../reference/hook-events.md) - All hook details
