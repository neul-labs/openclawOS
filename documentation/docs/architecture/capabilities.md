# Capabilities

OpenClawOS uses a capability-based security model. Packages declare what they provide and require in their manifest.

## Overview

Capabilities define:

- **What a package provides**: Channels, tools, hooks, gateway methods
- **What a package requires**: Environment variables, network access, file system access
- **Trust level**: How much access the package receives

## Capability Types

### Channel Capabilities

For apps that implement messaging channels:

```json
{
  "capabilities": {
    "channels": {
      "provides": ["telegram"],
      "requires": []
    }
  }
}
```

### Tool Capabilities

For packages that provide agent tools:

```json
{
  "capabilities": {
    "tools": {
      "provides": ["my_custom_tool"],
      "requires": ["memory_search"]
    }
  }
}
```

### Hook Capabilities

For packages that react to system events:

```json
{
  "capabilities": {
    "hooks": {
      "subscribes": ["message_received", "agent_end"],
      "intercepts": ["message_sending"]
    }
  }
}
```

#### Available Hooks

| Hook Name             | Type      | Description                    |
| --------------------- | --------- | ------------------------------ |
| `before_agent_start`  | Intercept | Before agent run begins        |
| `llm_input`           | Subscribe | LLM prompt being sent          |
| `llm_output`          | Subscribe | LLM response received          |
| `agent_end`           | Subscribe | Agent run completed            |
| `before_compaction`   | Subscribe | Before context compaction      |
| `after_compaction`    | Subscribe | After context compaction       |
| `before_reset`        | Subscribe | Before session reset           |
| `message_received`    | Subscribe | Inbound message received       |
| `message_sending`     | Intercept | Outbound message about to send |
| `message_sent`        | Subscribe | Outbound message sent          |
| `before_tool_call`    | Intercept | Before tool execution          |
| `after_tool_call`     | Subscribe | After tool execution           |
| `tool_result_persist` | Intercept | Tool result being saved        |
| `session_start`       | Subscribe | New session created            |
| `session_end`         | Subscribe | Session ended                  |
| `gateway_start`       | Subscribe | Gateway server started         |
| `gateway_stop`        | Subscribe | Gateway server stopping        |

#### Intercept vs Subscribe

- **Subscribe**: Read-only observation of events
- **Intercept**: Can modify or block the event

```typescript
// Subscribe - just observe
hooks.subscribes: ["message_received"]

// Intercept - can modify/block
hooks.intercepts: ["message_sending"]
```

### Gateway Capabilities

For packages that extend the gateway API:

```json
{
  "capabilities": {
    "gateway": {
      "methods": ["myapp.customMethod"],
      "httpRoutes": ["/api/myapp/*"]
    }
  }
}
```

### UI Capabilities

For packages that contribute UI elements to the dashboard:

```json
{
  "capabilities": {
    "ui": {
      "tabs": [
        {
          "id": "dashboard",
          "title": "My Dashboard",
          "icon": "layout-dashboard",
          "render": { "type": "iframe", "src": "/app/@myorg/myapp/dashboard" },
          "position": "bottom",
          "badge": { "method": "myapp.getBadgeCount", "interval": 30 }
        }
      ],
      "components": [
        {
          "tag": "myapp-widget",
          "module": "./components/widget.js",
          "scope": "tab"
        }
      ],
      "settings": [
        {
          "id": "config",
          "title": "My App Settings",
          "render": { "type": "component", "tag": "myapp-settings" }
        }
      ]
    }
  }
}
```

#### UI Elements

| Element      | Description                          |
| ------------ | ------------------------------------ |
| `tabs`       | Sidebar navigation tabs              |
| `components` | Web components for dynamic rendering |
| `settings`   | Settings panel sections              |

See [UI Contributions](../developing-apps/ui-contributions.md) for detailed documentation.

### Provider Capabilities

For packages that implement LLM providers:

```json
{
  "capabilities": {
    "providers": {
      "provides": ["my-llm-provider"],
      "models": ["my-model-v1", "my-model-v2"]
    }
  }
}
```

### Resource Capabilities

Declare resource requirements:

```json
{
  "capabilities": {
    "resources": {
      "env": ["TELEGRAM_BOT_TOKEN", "DATABASE_URL"],
      "fs": {
        "read": ["/var/data/*"],
        "write": ["/var/cache/myapp/*"]
      },
      "network": {
        "hosts": ["api.telegram.org", "*.example.com"]
      }
    }
  }
}
```

### Security Capabilities

Security settings:

```json
{
  "capabilities": {
    "security": {
      "sandboxed": true,
      "trustLevel": "community"
    }
  }
}
```

#### Trust Levels

| Level       | Description              | Access             |
| ----------- | ------------------------ | ------------------ |
| `core`      | Built-in packages        | Full access        |
| `verified`  | Signed registry packages | Standard access    |
| `community` | Community packages       | Limited access     |
| `untrusted` | Unknown packages         | Sandboxed, minimal |

## Capability Validation

When a package is installed:

1. **Parse manifest**: Extract declared capabilities
2. **Validate requirements**: Check if dependencies are met
3. **Grant capabilities**: Based on trust level and user consent
4. **Register with kernel**: Enable granted capabilities

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Install   │────▶│   Validate   │────▶│   Grant     │
│   Package   │     │  Capabilities │     │ Permissions │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ User Consent │
                    │  (if needed) │
                    └──────────────┘
```

## Manifest Example

Complete capabilities section:

```json
{
  "id": "@openclawos/telegram",
  "name": "Telegram Channel",
  "version": "1.0.0",
  "type": "app",
  "main": "dist/index.js",
  "protocol": {
    "version": "1.0",
    "minKernelVersion": "2026.2.0"
  },
  "capabilities": {
    "channels": {
      "provides": ["telegram"]
    },
    "hooks": {
      "subscribes": ["message_received"],
      "intercepts": ["message_sending"]
    },
    "resources": {
      "env": ["TELEGRAM_BOT_TOKEN"],
      "network": {
        "hosts": ["api.telegram.org"]
      }
    },
    "security": {
      "trustLevel": "verified"
    }
  }
}
```

## Runtime Capability Checks

The kernel validates capabilities at runtime:

```typescript
// App tries to register a channel
await kernel.registerCapability("channel", { id: "telegram" });

// Kernel checks:
// 1. Does manifest declare channels.provides: ["telegram"]?
// 2. Does app have permission to provide channels?
// 3. Is this channel not already claimed?

// If all pass: { granted: true }
// If any fail: { granted: false, reason: "..." }
```

## Best Practices

1. **Minimal Permissions**: Only request what you need
2. **Document Requirements**: Explain why each capability is needed
3. **Handle Denials**: Gracefully handle capability denials
4. **Use Intercepts Sparingly**: Only intercept when modification is needed

## Next Steps

- [Developing Apps](../developing-apps/index.md) - Build your first app
- [Manifest Schema](../reference/manifest-schema.md) - Full manifest reference
