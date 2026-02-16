# Discord Channel

Discord integration with full support for guilds, threads, and rich embeds.

## Overview

| Property | Value                              |
| -------- | ---------------------------------- |
| Package  | `@openclawos/discord`              |
| API      | discord.js                         |
| Features | Guilds, threads, embeds, reactions |
| Status   | Production Ready                   |

## Quick Start

### 1. Create a Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to Bot settings, create a bot
4. Copy the bot token
5. Enable required intents (Message Content)

### 2. Generate Invite URL

In OAuth2 > URL Generator:

- Scopes: `bot`, `applications.commands`
- Bot Permissions: `Send Messages`, `Read Message History`, `Add Reactions`

### 3. Configure

```bash
openclaw channels add discord --token "YOUR_BOT_TOKEN"
```

Or edit `config.json`:

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "YOUR_BOT_TOKEN"
    }
  }
}
```

### 4. Start

```bash
openclaw gateway
```

## Configuration

### Basic

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.GAbCdE.xxxxx"
    }
  }
}
```

### Advanced Options

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "...",
      "allowedGuilds": ["123456789012345678"],
      "allowedChannels": ["987654321098765432"],
      "respondToMentions": true,
      "respondToDMs": true
    }
  }
}
```

| Option              | Type     | Description                          |
| ------------------- | -------- | ------------------------------------ |
| `token`             | string   | Bot token                            |
| `allowedGuilds`     | string[] | Whitelist of guild IDs               |
| `allowedChannels`   | string[] | Whitelist of channel IDs             |
| `respondToMentions` | boolean  | Respond to @mentions (default: true) |
| `respondToDMs`      | boolean  | Respond to DMs (default: true)       |

## Required Intents

In the Discord Developer Portal, enable:

- **Message Content Intent** (Privileged) - Required to read message text
- **Server Members Intent** (Privileged) - Optional, for member info

## Bot Permissions

Minimum permissions:

- View Channels
- Send Messages
- Read Message History
- Add Reactions

Recommended:

- Embed Links
- Attach Files
- Use External Emojis

## Features

### Guild Channels

Bot responds to:

- Direct @mentions
- Replies to bot messages

### Direct Messages

Bot responds to all DMs by default.

### Threads

Full thread support:

- Creates threads for long conversations
- Responds in existing threads

### Rich Embeds

Responses can include embeds:

- Titles and descriptions
- Color-coded messages
- Links and images

## Session Keys

Format: `discord:{guild_id}:{channel_id}`

Examples:

- `discord:123456789012345678:987654321098765432` - Guild channel
- `discord:dm:123456789012345678` - Direct message

## Troubleshooting

### "Message Content Intent required"

1. Go to Discord Developer Portal
2. Select your application
3. Go to Bot settings
4. Enable "Message Content Intent"

### Bot not responding in server

1. Check bot has permission to view and send in the channel
2. Run `openclaw doctor` to diagnose issues
3. Verify `allowedGuilds` doesn't exclude the server

### Rate limited

Discord has strict rate limits. The app handles these automatically.

## Next Steps

- [Telegram Channel](telegram.md)
- [Matrix Channel](matrix.md)
