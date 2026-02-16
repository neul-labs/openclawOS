# Plugin Apps

Plugin apps extend OpenClawOS with additional capabilities.

## Overview

Unlike channel apps that connect messaging platforms, plugin apps:

- Add new agent tools
- Provide observability/monitoring
- Integrate external services
- Extend gateway functionality

## Available Plugins

| Plugin                        | Package                     | Description                  |
| ----------------------------- | --------------------------- | ---------------------------- |
| [Diagnostics](diagnostics.md) | `@openclawos/diagnostics`   | OpenTelemetry metrics/traces |
| [Voice Call](voice-call.md)   | `@openclawos/voice-call`    | Twilio voice integration     |
| Copilot Proxy                 | `@openclawos/copilot-proxy` | GitHub Copilot proxy         |
| LLM Task                      | `@openclawos/llm-task`      | LLM task execution           |
| Lobster                       | `@openclawos/lobster`       | Lobster integration          |
| Open Prose                    | `@openclawos/open-prose`    | Prose editing skills         |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Kernel                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐  │
│   │   Agent     │──▶│    Tools    │◀──│    Plugin App       │  │
│   │   Runtime   │   │   Registry  │   │   (via IPC)         │  │
│   └─────────────┘   └─────────────┘   └─────────────────────┘  │
│                                                                 │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐  │
│   │   Gateway   │──▶│   Methods   │◀──│    Plugin App       │  │
│   │   Server    │   │   Registry  │   │   (via IPC)         │  │
│   └─────────────┘   └─────────────┘   └─────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Common Capabilities

### Tools

Plugins can register agent tools:

```typescript
await this.registerTool({
  name: "my_tool",
  description: "Does something useful",
  parameters: { ... },
  handler: async (params) => {
    return { result: "done" };
  },
});
```

### Gateway Methods

Plugins can add API endpoints:

```typescript
await this.registerGatewayMethod("plugin.myMethod", async (params) => {
  return { status: "ok" };
});
```

### Hooks

Plugins can observe/intercept events:

```typescript
await this.onHook("agent_end", (data) => {
  this.metrics.recordAgentRun(data);
});
```

## Installation

```bash
# Install a plugin
openclaw apps install @openclawos/diagnostics

# Enable
openclaw apps enable @openclawos/diagnostics

# Configure
openclaw apps configure @openclawos/diagnostics
```

## Configuration

Plugins are configured in `apps` section:

```json
{
  "apps": {
    "@openclawos/diagnostics": {
      "enabled": true,
      "endpoint": "http://localhost:4318"
    },
    "@openclawos/voice-call": {
      "enabled": true,
      "twilioAccountSid": "AC...",
      "twilioAuthToken": "..."
    }
  }
}
```

## Building Plugins

See [Developing Apps](../../developing-apps/plugin-app.md) for building your own.

## Next Steps

- [Diagnostics Plugin](diagnostics.md)
- [Voice Call Plugin](voice-call.md)
