# Existing Apps

OpenClawOS includes a comprehensive set of channel and plugin apps.

## Overview

| Category     | Count  | Description                     |
| ------------ | ------ | ------------------------------- |
| Channel Apps | 20     | Messaging platform integrations |
| Plugin Apps  | 6      | System extensions               |
| **Total**    | **26** |                                 |

## Channel Apps

Channel apps connect messaging platforms to OpenClawOS:

### Tier 1: Production Ready

| App                                  | Package                | Description             |
| ------------------------------------ | ---------------------- | ----------------------- |
| [Telegram](channel-apps/telegram.md) | `@openclawos/telegram` | Telegram Bot API        |
| [Discord](channel-apps/discord.md)   | `@openclawos/discord`  | Discord bot integration |
| Slack                                | `@openclawos/slack`    | Slack Bolt framework    |
| WhatsApp                             | `@openclawos/whatsapp` | WhatsApp Business API   |
| Signal                               | `@openclawos/signal`   | Signal via signal-cli   |

### Tier 2: Beta

| App                              | Package                   | Description              |
| -------------------------------- | ------------------------- | ------------------------ |
| iMessage                         | `@openclawos/imessage`    | macOS iMessage           |
| BlueBubbles                      | `@openclawos/bluebubbles` | iMessage via BlueBubbles |
| Google Chat                      | `@openclawos/googlechat`  | Google Workspace         |
| Microsoft Teams                  | `@openclawos/msteams`     | Microsoft 365            |
| [Matrix](channel-apps/matrix.md) | `@openclawos/matrix`      | Self-hosted Matrix       |

### Tier 3: Community

| App            | Package                      | Description            |
| -------------- | ---------------------------- | ---------------------- |
| Feishu         | `@openclawos/feishu`         | Lark/Feishu            |
| IRC            | `@openclawos/irc`            | IRC networks           |
| LINE           | `@openclawos/line`           | LINE Messaging API     |
| Mattermost     | `@openclawos/mattermost`     | Self-hosted Mattermost |
| Nextcloud Talk | `@openclawos/nextcloud-talk` | Nextcloud Talk         |
| Nostr          | `@openclawos/nostr`          | Nostr protocol         |
| Tlon           | `@openclawos/tlon`           | Urbit/Tlon             |
| Twitch         | `@openclawos/twitch`         | Twitch chat            |
| Zalo           | `@openclawos/zalo`           | Zalo Official Account  |
| Zalo User      | `@openclawos/zalouser`       | Zalo user accounts     |

## Plugin Apps

Plugin apps extend system capabilities:

| App                                       | Package                     | Description                  |
| ----------------------------------------- | --------------------------- | ---------------------------- |
| [Diagnostics](plugin-apps/diagnostics.md) | `@openclawos/diagnostics`   | OpenTelemetry metrics/traces |
| [Voice Call](plugin-apps/voice-call.md)   | `@openclawos/voice-call`    | Twilio voice calls           |
| Copilot Proxy                             | `@openclawos/copilot-proxy` | GitHub Copilot proxy         |
| LLM Task                                  | `@openclawos/llm-task`      | LLM task execution           |
| Lobster                                   | `@openclawos/lobster`       | Lobster integration          |
| Open Prose                                | `@openclawos/open-prose`    | Prose editing skills         |

## Architecture

All apps share the same architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                        Kernel                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    IPC Server                        │   │
│  └───────────────────────┬─────────────────────────────┘   │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │ Unix Socket
    ┌──────────────────────┼──────────────────────────┐
    │                      │                          │
┌───┴───┐  ┌───────┐  ┌───┴───┐  ┌─────────┐  ┌─────┴─────┐
│ Tele- │  │Discord│  │ Slack │  │Diagnos- │  │  Voice    │
│ gram  │  │       │  │       │  │  tics   │  │   Call    │
└───────┘  └───────┘  └───────┘  └─────────┘  └───────────┘
```

## Installation

Apps are installed via the CLI:

```bash
# List available apps
openclaw apps list

# Install an app
openclaw apps install @openclawos/telegram

# Enable an app
openclaw apps enable @openclawos/telegram

# Configure an app
openclaw apps configure @openclawos/telegram
```

## Configuration

Apps are configured in `~/.config/openclaw/config.json`:

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
    }
  },
  "apps": {
    "@openclawos/diagnostics": {
      "enabled": true,
      "endpoint": "http://localhost:4318"
    }
  }
}
```

## Development

To modify or extend existing apps:

1. Clone the repository
2. Navigate to `apps/{app-name}/`
3. Make changes
4. Build: `pnpm --filter @openclawos/{app-name} build`
5. Test locally

See [Developing Apps](../developing-apps/index.md) for building your own.

## Next Steps

- [Channel Apps Overview](channel-apps/index.md)
- [Plugin Apps Overview](plugin-apps/index.md)
- [Telegram Reference](channel-apps/telegram.md) - Example implementation
