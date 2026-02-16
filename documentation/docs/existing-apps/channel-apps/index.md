# Channel Apps

Channel apps connect messaging platforms to OpenClawOS, enabling your AI assistant to communicate across different services.

## Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Channel Apps                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Platform API ──▶ Channel App ──▶ Kernel ──▶ Agent                │
│                                                                     │
│   Agent Response ──▶ Kernel ──▶ Channel App ──▶ Platform API       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Available Channels

### Enterprise Messaging

| Channel         | Package                  | API           | Features                  |
| --------------- | ------------------------ | ------------- | ------------------------- |
| **Slack**       | `@openclawos/slack`      | Bolt SDK      | Threads, reactions, files |
| **Discord**     | `@openclawos/discord`    | discord.js    | Guilds, threads, embeds   |
| **MS Teams**    | `@openclawos/msteams`    | Bot Framework | Channels, 1:1 chats       |
| **Google Chat** | `@openclawos/googlechat` | Workspace API | Spaces, DMs               |
| **Mattermost**  | `@openclawos/mattermost` | REST + WS     | Self-hosted               |

### Consumer Messaging

| Channel      | Package                | API           | Features                 |
| ------------ | ---------------------- | ------------- | ------------------------ |
| **Telegram** | `@openclawos/telegram` | Bot API       | Groups, inline, payments |
| **WhatsApp** | `@openclawos/whatsapp` | Cloud API     | Business messaging       |
| **Signal**   | `@openclawos/signal`   | signal-cli    | E2E encrypted            |
| **LINE**     | `@openclawos/line`     | Messaging API | Rich menus, flex         |

### Apple Ecosystem

| Channel         | Package                   | Method      | Features       |
| --------------- | ------------------------- | ----------- | -------------- |
| **iMessage**    | `@openclawos/imessage`    | AppleScript | macOS only     |
| **BlueBubbles** | `@openclawos/bluebubbles` | BlueBubbles | Cross-platform |

### Protocol-Based

| Channel    | Package              | Protocol | Features       |
| ---------- | -------------------- | -------- | -------------- |
| **Matrix** | `@openclawos/matrix` | Matrix   | Federated, E2E |
| **IRC**    | `@openclawos/irc`    | IRC      | Classic chat   |
| **Nostr**  | `@openclawos/nostr`  | Nostr    | Decentralized  |
| **Tlon**   | `@openclawos/tlon`   | Urbit    | P2P networking |

### Regional

| Channel       | Package                | Region  | Features         |
| ------------- | ---------------------- | ------- | ---------------- |
| **Feishu**    | `@openclawos/feishu`   | China   | Lark integration |
| **Zalo**      | `@openclawos/zalo`     | Vietnam | OA messaging     |
| **Zalo User** | `@openclawos/zalouser` | Vietnam | User accounts    |

### Entertainment

| Channel            | Package                      | Platform  | Features         |
| ------------------ | ---------------------------- | --------- | ---------------- |
| **Twitch**         | `@openclawos/twitch`         | Twitch    | Chat integration |
| **Nextcloud Talk** | `@openclawos/nextcloud-talk` | Nextcloud | Video, chat      |

## Common Features

All channel apps support:

- **Text Messages**: Basic text communication
- **Session Management**: Persistent conversations
- **Multi-Account**: Multiple bot accounts per channel
- **Error Handling**: Graceful failure recovery
- **Rate Limiting**: Platform-compliant throttling

## Configuration Pattern

Each channel follows the same config pattern:

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "accounts": {
        "default": {
          "botToken": "123:abc",
          "name": "Main Bot"
        },
        "support": {
          "botToken": "456:def",
          "name": "Support Bot"
        }
      }
    }
  }
}
```

## Enabling Channels

### Via CLI

```bash
# Add a channel
openclaw channels add telegram --token "123:abc"

# List configured channels
openclaw channels list

# Remove a channel
openclaw channels remove telegram
```

### Via Configuration

Edit `~/.config/openclaw/config.json`:

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

## Reference Implementations

- **[Telegram](telegram.md)** - Simple, well-documented Bot API
- **[Discord](discord.md)** - Complex with guilds, threads, permissions
- **[Matrix](matrix.md)** - Self-hosted, federated example

## Building Custom Channels

See [Building Channel Apps](../../developing-apps/channel-app.md) to create your own.

## Next Steps

- [Telegram Reference](telegram.md)
- [Discord Reference](discord.md)
- [Matrix Reference](matrix.md)
