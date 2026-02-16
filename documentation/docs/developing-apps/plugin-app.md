# Building Plugin Apps

Plugin apps extend OpenClawOS with tools, gateway methods, and hooks.

## Overview

Unlike channel apps, plugin apps:

- Add agent tools
- Register gateway API methods
- Subscribe to system hooks
- Integrate external services

## Quick Start

```typescript
import { OpenClawApp } from "@openclawos/sdk/app";

class MyPluginApp extends OpenClawApp {
  manifest = {
    id: "@myorg/my-plugin",
    name: "My Plugin",
    version: "1.0.0",
    type: "app",
    main: "dist/index.js",
    protocol: { version: "1.0" },
    capabilities: {
      tools: { provides: ["my_tool"] },
      hooks: { subscribes: ["agent_end"] },
      gateway: { methods: ["myplugin.status"] },
    },
  };

  protected async setup(): Promise<void> {
    // Register tools
    await this.registerTool({
      name: "my_tool",
      description: "Does something useful",
      handler: async (params) => {
        return { result: "done" };
      },
    });

    // Register gateway methods
    await this.registerGatewayMethod("myplugin.status", async () => {
      return { status: "ok" };
    });

    // Subscribe to hooks
    await this.onHook("agent_end", (data) => {
      this.log.info("Agent run completed:", data);
    });
  }
}

new MyPluginApp().start();
```

## Registering Tools

Tools are functions the agent can call:

```typescript
await this.registerTool({
  name: "weather_lookup",
  description: "Get current weather for a location",
  parameters: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "City name or coordinates",
      },
    },
    required: ["location"],
  },
  handler: async (params) => {
    const weather = await fetchWeather(params.location);
    return {
      temperature: weather.temp,
      conditions: weather.conditions,
    };
  },
});
```

### Tool Definition

```typescript
interface ToolDefinition {
  /** Tool name (used in tool calls) */
  name: string;
  /** Description for the agent */
  description: string;
  /** JSON Schema for parameters */
  parameters?: JSONSchema;
  /** Handler function */
  handler: (params: unknown) => Promise<unknown>;
}
```

### Best Practices

1. **Clear descriptions**: Help the agent understand when to use the tool
2. **Typed parameters**: Use JSON Schema for validation
3. **Structured returns**: Return structured data the agent can use
4. **Error handling**: Return error objects instead of throwing

## Registering Gateway Methods

Gateway methods add API endpoints:

```typescript
await this.registerGatewayMethod("myplugin.getMetrics", async (params) => {
  return {
    requestsTotal: this.metrics.requests,
    errorsTotal: this.metrics.errors,
    uptime: process.uptime(),
  };
});
```

### Calling from UI/CLI

```typescript
// From UI
const metrics = await gateway.call("myplugin.getMetrics", {});

// From CLI
openclaw gateway call myplugin.getMetrics
```

## Subscribing to Hooks

Observe system events:

```typescript
// Agent metrics
await this.onHook("agent_end", (data, ctx) => {
  this.metrics.agentRuns++;
  if (data.error) {
    this.metrics.errors++;
  }
});

// Message logging
await this.onHook("message_received", (data, ctx) => {
  this.log.debug(`[${ctx.channelId}] ${data.content.slice(0, 50)}...`);
});
```

## Complete Example: Analytics Plugin

```typescript
import { OpenClawApp } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";

interface Metrics {
  agentRuns: number;
  messagesReceived: number;
  messagesSent: number;
  toolCalls: number;
  errors: number;
  startTime: number;
}

class AnalyticsPlugin extends OpenClawApp {
  private metrics: Metrics = {
    agentRuns: 0,
    messagesReceived: 0,
    messagesSent: 0,
    toolCalls: 0,
    errors: 0,
    startTime: Date.now(),
  };

  manifest: PackageManifest = {
    id: "@myorg/analytics",
    name: "Analytics Plugin",
    version: "1.0.0",
    type: "app",
    main: "dist/index.js",
    protocol: { version: "1.0" },
    capabilities: {
      tools: { provides: ["analytics_summary"] },
      hooks: {
        subscribes: ["message_received", "message_sent", "agent_end", "after_tool_call"],
      },
      gateway: {
        methods: ["analytics.getMetrics", "analytics.reset"],
      },
    },
  };

  protected async setup(): Promise<void> {
    // Tool for agents to check analytics
    await this.registerTool({
      name: "analytics_summary",
      description: "Get a summary of system analytics",
      handler: async () => this.getSummary(),
    });

    // Gateway methods for API access
    await this.registerGatewayMethod("analytics.getMetrics", async () => this.metrics);

    await this.registerGatewayMethod("analytics.reset", async () => {
      this.metrics = {
        ...this.metrics,
        agentRuns: 0,
        messagesReceived: 0,
        messagesSent: 0,
        toolCalls: 0,
        errors: 0,
      };
      return { ok: true };
    });

    // Hook subscriptions
    await this.onHook("message_received", () => {
      this.metrics.messagesReceived++;
    });

    await this.onHook("message_sent", () => {
      this.metrics.messagesSent++;
    });

    await this.onHook("agent_end", (data) => {
      this.metrics.agentRuns++;
      if (data.error) {
        this.metrics.errors++;
      }
    });

    await this.onHook("after_tool_call", () => {
      this.metrics.toolCalls++;
    });

    this.log.info("Analytics plugin initialized");
  }

  private getSummary() {
    const uptime = Date.now() - this.metrics.startTime;
    return {
      uptime: Math.floor(uptime / 1000),
      ...this.metrics,
      requestsPerMinute: (this.metrics.messagesReceived / uptime) * 60000,
    };
  }
}

new AnalyticsPlugin().start().catch(console.error);
```

## HTTP Routes

Register HTTP endpoints:

```typescript
await this.registerHttpRoute("/api/myplugin/webhook", async (req, res) => {
  const body = await parseBody(req);
  await this.handleWebhook(body);
  res.json({ received: true });
});
```

## State Management

### In-Memory State

```typescript
class StatefulPlugin extends OpenClawApp {
  private state = new Map<string, unknown>();

  protected async setup(): Promise<void> {
    await this.registerTool({
      name: "state_get",
      description: "Get a stored value",
      handler: async ({ key }) => ({
        value: this.state.get(key),
      }),
    });

    await this.registerTool({
      name: "state_set",
      description: "Store a value",
      handler: async ({ key, value }) => {
        this.state.set(key, value);
        return { ok: true };
      },
    });
  }
}
```

### Persistent State

```typescript
import { readFile, writeFile } from "fs/promises";

class PersistentPlugin extends OpenClawApp {
  private statePath = "/var/lib/openclaw/myplugin/state.json";
  private state: Record<string, unknown> = {};

  protected async setup(): Promise<void> {
    // Load state
    try {
      const data = await readFile(this.statePath, "utf-8");
      this.state = JSON.parse(data);
    } catch {
      this.state = {};
    }

    // ... register tools
  }

  protected async teardown(): Promise<void> {
    // Save state
    await writeFile(this.statePath, JSON.stringify(this.state));
  }
}
```

## Error Handling

```typescript
await this.registerTool({
  name: "risky_operation",
  description: "An operation that might fail",
  handler: async (params) => {
    try {
      const result = await riskyOperation(params);
      return { success: true, result };
    } catch (error) {
      this.log.error("Operation failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});
```

## Next Steps

- [SDK Reference](../sdk/openclaw-app.md)
- [Hooks Reference](../sdk/hooks.md)
- [Testing Apps](testing.md)
