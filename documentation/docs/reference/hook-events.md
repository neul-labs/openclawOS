# Hook Events

Complete reference for all hook events.

## Overview

Hooks allow apps to observe or intercept kernel events.

| Type          | Description                |
| ------------- | -------------------------- |
| **Subscribe** | Observe events (read-only) |
| **Intercept** | Modify or block events     |

## Agent Lifecycle

### before_agent_start

**Type:** Intercept

Fired before an agent run begins.

```typescript
interface BeforeAgentStartData {
  sessionKey: string;
  agentId: string;
  input: string;
  metadata: Record<string, unknown>;
}
```

**Use cases:**

- Validate input
- Add context
- Block spam

### llm_input

**Type:** Subscribe

Fired when sending prompt to LLM.

```typescript
interface LlmInputData {
  sessionKey: string;
  agentId: string;
  messages: Message[];
  model: string;
}
```

**Use cases:**

- Logging
- Analytics

### llm_output

**Type:** Subscribe

Fired when receiving LLM response.

```typescript
interface LlmOutputData {
  sessionKey: string;
  agentId: string;
  response: string;
  tokenUsage: {
    input: number;
    output: number;
  };
}
```

**Use cases:**

- Logging
- Token tracking

### agent_end

**Type:** Subscribe

Fired when agent run completes.

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

**Use cases:**

- Metrics
- Error tracking

## Context Management

### before_compaction

**Type:** Subscribe

Fired before context compaction.

```typescript
interface BeforeCompactionData {
  sessionKey: string;
  messageCount: number;
  tokenCount: number;
}
```

### after_compaction

**Type:** Subscribe

Fired after context compaction.

```typescript
interface AfterCompactionData {
  sessionKey: string;
  originalCount: number;
  compactedCount: number;
  tokensSaved: number;
}
```

### before_reset

**Type:** Subscribe

Fired before session reset.

```typescript
interface BeforeResetData {
  sessionKey: string;
  reason: string;
}
```

## Messages

### message_received

**Type:** Subscribe

Fired when inbound message is received.

```typescript
interface MessageReceivedData {
  sessionKey: string;
  content: string;
  channelId?: string;
  from?: string;
  metadata: Record<string, unknown>;
}
```

**Use cases:**

- Logging
- Analytics
- Content filtering

### message_sending

**Type:** Intercept

Fired before outbound message is sent.

```typescript
interface MessageSendingData {
  channelId: string;
  target: string;
  content: string;
  metadata: Record<string, unknown>;
}
```

**Use cases:**

- Content moderation
- Message transformation
- Blocking

**Intercepting:**

```typescript
await this.onHook("message_sending", async (data) => {
  // Modify
  return { ...data, content: data.content.toUpperCase() };

  // Or block
  return null;
});
```

### message_sent

**Type:** Subscribe

Fired after message is delivered.

```typescript
interface MessageSentData {
  channelId: string;
  target: string;
  content: string;
  deliveredAt: number;
}
```

## Tools

### before_tool_call

**Type:** Intercept

Fired before tool execution.

```typescript
interface BeforeToolCallData {
  toolName: string;
  toolInput: unknown;
  sessionKey: string;
  runId: string;
}
```

**Use cases:**

- Tool auditing
- Input validation
- Blocking dangerous calls

### after_tool_call

**Type:** Subscribe

Fired after tool execution.

```typescript
interface AfterToolCallData {
  toolName: string;
  toolInput: unknown;
  toolOutput: unknown;
  success: boolean;
  duration: number;
  sessionKey: string;
  runId: string;
}
```

### tool_result_persist

**Type:** Intercept

Fired when tool result is being saved.

```typescript
interface ToolResultPersistData {
  toolName: string;
  result: unknown;
  sessionKey: string;
}
```

**Use cases:**

- Filter sensitive data
- Transform output

## Sessions

### session_start

**Type:** Subscribe

Fired when new session is created.

```typescript
interface SessionStartData {
  sessionKey: string;
  agentId: string;
  channelId?: string;
  metadata: Record<string, unknown>;
}
```

### session_end

**Type:** Subscribe

Fired when session ends.

```typescript
interface SessionEndData {
  sessionKey: string;
  reason: string;
  duration: number;
  messageCount: number;
}
```

## Gateway

### gateway_start

**Type:** Subscribe

Fired when gateway starts.

```typescript
interface GatewayStartData {
  port: number;
  host: string;
}
```

### gateway_stop

**Type:** Subscribe

Fired when gateway is stopping.

```typescript
interface GatewayStopData {
  reason: string;
}
```

## Hook Context

All handlers receive context:

```typescript
interface HookContext {
  eventId: string;
  agentId?: string;
  sessionKey?: string;
  channelId?: string;
  accountId?: string;
  timestamp: number;
}
```

## Manifest Declaration

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

## Next Steps

- [SDK Hooks](../sdk/hooks.md)
- [Capabilities](../architecture/capabilities.md)
