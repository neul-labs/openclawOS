# Configuration Reference

Complete reference for OpenClawOS configuration.

## Config File Location

- **macOS/Linux:** `~/.config/openclaw/config.json`
- **Windows:** `%APPDATA%\openclaw\config.json`

## Full Schema

```json
{
  // Gateway settings
  "gateway": {
    "port": 8080,
    "host": "localhost",
    "cors": {
      "enabled": true,
      "origins": ["http://localhost:3000"]
    }
  },

  // Agent settings
  "agents": {
    "default": {
      "model": "claude-3-opus",
      "systemPrompt": "You are a helpful assistant.",
      "skills": ["coding", "memory"],
      "maxTurns": 100
    }
  },

  // Channel settings
  "channels": {
    "telegram": { ... },
    "discord": { ... },
    "slack": { ... }
  },

  // App settings
  "apps": {
    "runtime": "ipc",
    "@openclawos/diagnostics": { ... }
  },

  // Memory settings
  "memory": {
    "enabled": true,
    "provider": "lancedb"
  },

  // Security settings
  "security": {
    "sandbox": true
  }
}
```

## Gateway

```json
{
  "gateway": {
    "port": 8080,
    "host": "localhost",
    "cors": {
      "enabled": true,
      "origins": ["http://localhost:3000"]
    },
    "rateLimit": {
      "enabled": true,
      "maxRequests": 100,
      "windowMs": 60000
    }
  }
}
```

| Field                   | Type     | Default   | Description             |
| ----------------------- | -------- | --------- | ----------------------- |
| `port`                  | number   | 8080      | Server port             |
| `host`                  | string   | localhost | Server host             |
| `cors.enabled`          | boolean  | true      | Enable CORS             |
| `cors.origins`          | string[] | ["*"]     | Allowed origins         |
| `rateLimit.enabled`     | boolean  | false     | Enable rate limiting    |
| `rateLimit.maxRequests` | number   | 100       | Max requests per window |
| `rateLimit.windowMs`    | number   | 60000     | Window size (ms)        |

## Agents

```json
{
  "agents": {
    "default": {
      "model": "claude-3-opus",
      "fallbackModels": ["claude-3-sonnet"],
      "systemPrompt": "You are a helpful assistant.",
      "systemPromptFile": "./prompts/system.md",
      "skills": ["coding", "memory"],
      "maxTurns": 100,
      "compaction": "balanced",
      "memoryEnabled": true
    },
    "coder": {
      "model": "claude-3-opus",
      "systemPromptFile": "./prompts/coder.md",
      "skills": ["coding"]
    }
  }
}
```

| Field              | Type     | Default  | Description            |
| ------------------ | -------- | -------- | ---------------------- |
| `model`            | string   | -        | Default model          |
| `fallbackModels`   | string[] | []       | Fallback models        |
| `systemPrompt`     | string   | -        | Inline system prompt   |
| `systemPromptFile` | string   | -        | System prompt file     |
| `skills`           | string[] | []       | Enabled skills         |
| `maxTurns`         | number   | 100      | Max conversation turns |
| `compaction`       | string   | balanced | Compaction strategy    |
| `memoryEnabled`    | boolean  | true     | Enable memory          |

## Channels

### Telegram

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "123:abc",
      "allowUnmentionedGroups": false,
      "allowedGroups": ["-1001234567890"],
      "accounts": {
        "default": {
          "botToken": "123:abc",
          "name": "Main Bot"
        }
      }
    }
  }
}
```

### Discord

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "xxx",
      "allowedGuilds": ["123456789"],
      "allowedChannels": ["987654321"],
      "respondToMentions": true,
      "respondToDMs": true
    }
  }
}
```

### Slack

```json
{
  "channels": {
    "slack": {
      "enabled": true,
      "botToken": "xoxb-xxx",
      "appToken": "xapp-xxx",
      "signingSecret": "xxx"
    }
  }
}
```

### WhatsApp

```json
{
  "channels": {
    "whatsapp": {
      "enabled": true,
      "phoneNumberId": "123",
      "accessToken": "xxx"
    }
  }
}
```

### Signal

```json
{
  "channels": {
    "signal": {
      "enabled": true,
      "account": "+1234567890",
      "signalCliPath": "/usr/local/bin/signal-cli"
    }
  }
}
```

## Apps

```json
{
  "apps": {
    "runtime": "ipc",
    "supervisor": {
      "heartbeatInterval": 30000,
      "heartbeatTimeout": 90000,
      "shutdownTimeout": 5000,
      "maxRestarts": 5,
      "restartWindow": 300000
    },
    "@openclawos/diagnostics": {
      "enabled": true,
      "endpoint": "http://localhost:4318"
    }
  }
}
```

| Field          | Type   | Default | Description         |
| -------------- | ------ | ------- | ------------------- |
| `runtime`      | string | ipc     | Runtime mode (ipc)  |
| `supervisor.*` | object | -       | Supervisor settings |

## Memory

```json
{
  "memory": {
    "enabled": true,
    "provider": "lancedb",
    "path": "~/.openclaw/memory",
    "embedding": {
      "model": "text-embedding-3-small",
      "dimensions": 1536
    }
  }
}
```

| Field      | Type    | Default            | Description           |
| ---------- | ------- | ------------------ | --------------------- |
| `enabled`  | boolean | true               | Enable memory         |
| `provider` | string  | lancedb            | Vector store provider |
| `path`     | string  | ~/.openclaw/memory | Storage path          |

## Security

```json
{
  "security": {
    "sandbox": true,
    "allowedHosts": ["api.anthropic.com"],
    "blockedCommands": ["rm -rf"]
  }
}
```

## Environment Variables

Override config with environment variables:

| Variable             | Config Path                | Description       |
| -------------------- | -------------------------- | ----------------- |
| `OPENCLAW_PORT`      | gateway.port               | Server port       |
| `OPENCLAW_HOST`      | gateway.host               | Server host       |
| `ANTHROPIC_API_KEY`  | -                          | Anthropic API key |
| `OPENAI_API_KEY`     | -                          | OpenAI API key    |
| `TELEGRAM_BOT_TOKEN` | channels.telegram.botToken | Telegram token    |
| `DISCORD_TOKEN`      | channels.discord.token     | Discord token     |

## Config Validation

Validate your config:

```bash
openclaw config validate
```

## Example Configurations

### Minimal

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "123:abc"
    }
  }
}
```

### Multi-Channel

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "123:abc"
    },
    "discord": {
      "enabled": true,
      "token": "xxx"
    },
    "slack": {
      "enabled": true,
      "botToken": "xoxb-xxx",
      "appToken": "xapp-xxx"
    }
  }
}
```

### Enterprise

```json
{
  "gateway": {
    "port": 443,
    "host": "0.0.0.0"
  },
  "agents": {
    "default": {
      "model": "claude-3-opus",
      "skills": ["coding", "memory"]
    }
  },
  "channels": {
    "slack": { "enabled": true },
    "msteams": { "enabled": true }
  },
  "apps": {
    "@openclawos/diagnostics": { "enabled": true }
  },
  "security": {
    "sandbox": true
  }
}
```

## Next Steps

- [Manifest Schema](manifest-schema.md)
- [IPC Methods](ipc-methods.md)
