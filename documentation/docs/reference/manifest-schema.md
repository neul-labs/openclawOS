# Manifest Schema

Complete reference for `openclawos.manifest.json`.

## Full Schema

```json
{
  "$schema": "https://openclawos.dev/schemas/manifest.json",

  // === Identity (Required) ===
  "id": "@scope/package-name",
  "name": "Package Display Name",
  "version": "1.0.0",

  // === Identity (Optional) ===
  "description": "Short description of the package",
  "author": "Author Name or Organization",
  "license": "MIT",
  "repository": "https://github.com/org/repo",
  "icon": "https://example.com/icon.png",
  "tags": ["channel", "messaging"],

  // === Package Type (Required) ===
  "type": "app",
  "main": "dist/index.js",

  // === Protocol (Required) ===
  "protocol": {
    "version": "1.0",
    "minKernelVersion": "2026.2.0"
  },

  // === Capabilities (Required) ===
  "capabilities": {
    "channels": { ... },
    "tools": { ... },
    "hooks": { ... },
    "gateway": { ... },
    "providers": { ... },
    "agent": { ... },
    "resources": { ... },
    "security": { ... }
  },

  // === Configuration (Optional) ===
  "configSchema": { ... },
  "configUiHints": { ... },

  // === Dependencies (Optional) ===
  "dependencies": {
    "apps": ["@openclawos/other-app"],
    "skills": ["memory"],
    "agents": []
  }
}
```

## Field Reference

### Identity

| Field         | Type     | Required | Description                       |
| ------------- | -------- | -------- | --------------------------------- |
| `id`          | string   | Yes      | Unique package ID (`@scope/name`) |
| `name`        | string   | Yes      | Display name                      |
| `version`     | string   | Yes      | Semantic version                  |
| `description` | string   | No       | Short description                 |
| `author`      | string   | No       | Author/organization               |
| `license`     | string   | No       | SPDX license ID                   |
| `repository`  | string   | No       | Source code URL                   |
| `icon`        | string   | No       | Icon URL                          |
| `tags`        | string[] | No       | Categorization tags               |

### Package Type

| Field  | Type   | Required    | Description                                         |
| ------ | ------ | ----------- | --------------------------------------------------- |
| `type` | enum   | Yes         | `app`, `skill`, `agent`, `extension`                |
| `main` | string | Conditional | Entry point file (required for app/skill/extension) |

### Protocol

| Field                       | Type   | Required | Description            |
| --------------------------- | ------ | -------- | ---------------------- |
| `protocol.version`          | string | Yes      | IPC protocol version   |
| `protocol.minKernelVersion` | string | No       | Minimum kernel version |

### Capabilities

See [Capabilities](../architecture/capabilities.md) for full details.

#### channels

```json
{
  "channels": {
    "provides": ["telegram", "discord"],
    "requires": []
  }
}
```

#### tools

```json
{
  "tools": {
    "provides": ["my_tool"],
    "requires": ["memory_search"]
  }
}
```

#### hooks

```json
{
  "hooks": {
    "subscribes": ["message_received", "agent_end"],
    "intercepts": ["message_sending"]
  }
}
```

#### gateway

```json
{
  "gateway": {
    "methods": ["myapp.getStatus"],
    "httpRoutes": ["/api/myapp/*"]
  }
}
```

#### ui

UI elements contributed to the dashboard:

```json
{
  "ui": {
    "tabs": [
      {
        "id": "dashboard",
        "title": "My Dashboard",
        "icon": "layout-dashboard",
        "render": {
          "type": "iframe",
          "src": "/app/@myorg/myapp/dashboard"
        },
        "position": "bottom",
        "badge": {
          "method": "myapp.getBadgeCount",
          "interval": 30
        }
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
        "render": {
          "type": "component",
          "tag": "myapp-settings"
        }
      }
    ]
  }
}
```

**Tab Fields:**

| Field      | Type   | Required | Description                                               |
| ---------- | ------ | -------- | --------------------------------------------------------- |
| `id`       | string | Yes      | Unique identifier                                         |
| `title`    | string | Yes      | Display name                                              |
| `icon`     | string | No       | Lucide icon name                                          |
| `render`   | object | Yes      | `{ type: "iframe", src }` or `{ type: "component", tag }` |
| `position` | string | No       | `top`, `bottom`, `after:chat`, `after:channels`           |
| `badge`    | object | No       | `{ method, interval }` for badge counts                   |

**Component Fields:**

| Field    | Type   | Required | Description                              |
| -------- | ------ | -------- | ---------------------------------------- |
| `tag`    | string | Yes      | Custom element tag (must include hyphen) |
| `module` | string | Yes      | Path to JavaScript module                |
| `scope`  | string | Yes      | `tab`, `widget`, `settings`, or `global` |

See [UI Contributions](../developing-apps/ui-contributions.md) for detailed documentation.

#### providers

```json
{
  "providers": {
    "provides": ["my-llm"],
    "models": ["my-model-v1"]
  }
}
```

#### agent

```json
{
  "agent": {
    "systemPrompt": "You are a helpful assistant.",
    "systemPromptFile": "prompts/system.md",
    "skills": ["coding", "memory"],
    "model": {
      "default": "claude-3-opus",
      "fallback": ["claude-3-sonnet"]
    },
    "behavior": {
      "compaction": "balanced",
      "memoryEnabled": true,
      "sandboxed": false,
      "maxTurns": 100
    }
  }
}
```

#### resources

```json
{
  "resources": {
    "env": ["API_TOKEN", "DATABASE_URL"],
    "fs": {
      "read": ["/var/data/*"],
      "write": ["/var/cache/myapp/*"]
    },
    "network": {
      "hosts": ["api.example.com", "*.googleapis.com"]
    }
  }
}
```

#### security

```json
{
  "security": {
    "sandboxed": true,
    "trustLevel": "community"
  }
}
```

### Configuration Schema

JSON Schema for package configuration:

```json
{
  "configSchema": {
    "type": "object",
    "properties": {
      "apiToken": {
        "type": "string",
        "minLength": 10
      },
      "debug": {
        "type": "boolean",
        "default": false
      },
      "maxRetries": {
        "type": "integer",
        "minimum": 0,
        "maximum": 10,
        "default": 3
      }
    },
    "required": ["apiToken"]
  }
}
```

### Configuration UI Hints

UI customization for config fields:

```json
{
  "configUiHints": {
    "apiToken": {
      "label": "API Token",
      "description": "Your API token",
      "placeholder": "Enter token...",
      "sensitive": true,
      "type": "text"
    },
    "debug": {
      "label": "Debug Mode",
      "advanced": true,
      "type": "boolean"
    },
    "region": {
      "label": "Region",
      "type": "select",
      "options": [
        { "label": "US East", "value": "us-east" },
        { "label": "EU West", "value": "eu-west" }
      ]
    }
  }
}
```

### Dependencies

```json
{
  "dependencies": {
    "apps": ["@openclawos/diagnostics"],
    "skills": ["memory", "coding"],
    "agents": []
  }
}
```

## Validation

Validate a manifest:

```bash
openclaw manifest validate openclawos.manifest.json
```

## Examples

### Channel App

```json
{
  "id": "@openclawos/telegram",
  "name": "Telegram",
  "version": "1.0.0",
  "type": "app",
  "main": "dist/index.js",
  "protocol": { "version": "1.0" },
  "capabilities": {
    "channels": { "provides": ["telegram"] },
    "hooks": { "intercepts": ["message_sending"] },
    "resources": {
      "env": ["TELEGRAM_BOT_TOKEN"],
      "network": { "hosts": ["api.telegram.org"] }
    }
  }
}
```

### Plugin App

```json
{
  "id": "@openclawos/diagnostics",
  "name": "Diagnostics",
  "version": "1.0.0",
  "type": "app",
  "main": "dist/index.js",
  "protocol": { "version": "1.0" },
  "capabilities": {
    "tools": { "provides": ["diagnostics_health"] },
    "hooks": { "subscribes": ["agent_end"] },
    "gateway": { "methods": ["diagnostics.status"] }
  }
}
```

### Agent Template

```json
{
  "id": "@myorg/agent-coder",
  "name": "Coder Agent",
  "version": "1.0.0",
  "type": "agent",
  "protocol": { "version": "1.0" },
  "capabilities": {
    "agent": {
      "systemPromptFile": "prompts/coder.md",
      "skills": ["coding", "memory"],
      "model": { "default": "claude-3-opus" }
    }
  }
}
```

## Next Steps

- [IPC Methods](ipc-methods.md)
- [Hook Events](hook-events.md)
- [Configuration](config-schema.md)
