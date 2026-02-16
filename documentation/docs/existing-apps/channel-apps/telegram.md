# Telegram Channel

The Telegram channel app is the reference implementation for OpenClawOS channels.

## Overview

| Property | Value                              |
| -------- | ---------------------------------- |
| Package  | `@openclawos/telegram`             |
| API      | Telegram Bot API                   |
| Features | Groups, private chats, inline mode |
| Status   | Production Ready                   |

## Quick Start

### 1. Create a Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy the bot token

### 2. Configure

```bash
openclaw channels add telegram --token "YOUR_BOT_TOKEN"
```

Or edit `config.json`:

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
    }
  }
}
```

### 3. Start

```bash
openclaw gateway
```

Your bot is now active!

## Configuration

### Basic

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

### Multi-Account

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

### Advanced Options

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "123:abc",
      "allowUnmentionedGroups": false,
      "allowedGroups": ["-1001234567890"],
      "blockedUsers": ["123456789"]
    }
  }
}
```

| Option                   | Type     | Description                        |
| ------------------------ | -------- | ---------------------------------- |
| `enabled`                | boolean  | Enable/disable channel             |
| `botToken`               | string   | Bot API token                      |
| `allowUnmentionedGroups` | boolean  | Respond in groups without @mention |
| `allowedGroups`          | string[] | Whitelist of group IDs             |
| `blockedUsers`           | string[] | Blacklist of user IDs              |

## Features

### Private Chats

Direct messages to your bot:

```
User: Hello!
Bot: Hi there! How can I help you today?
```

### Group Chats

In groups, the bot responds to:

- Direct @mentions: `@YourBot what's the weather?`
- Replies to bot messages
- All messages (if `allowUnmentionedGroups: true`)

### Commands

Built-in commands:

| Command  | Description        |
| -------- | ------------------ |
| `/start` | Welcome message    |
| `/help`  | Help information   |
| `/reset` | Reset conversation |

### Markdown Formatting

Messages support Telegram Markdown:

````markdown
_bold_ _italic_ `code`
`code block`
[link](https://example.com)
````

### File Attachments

The bot can send:

- Photos
- Documents
- Voice messages
- Videos

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Telegram App                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐  │
│   │  Telegram   │───▶│   Message    │───▶│    Kernel       │  │
│   │  Bot API    │    │   Handler    │    │  (IPC Queue)    │  │
│   └─────────────┘    └──────────────┘    └─────────────────┘  │
│         ▲                                        │             │
│         │                                        │             │
│   ┌─────┴─────────────────────────────────────────┐            │
│   │               Send Handler                     │            │
│   │     (Receives message_sending hook)           │            │
│   └───────────────────────────────────────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Message Flow

### Inbound

1. User sends message to bot
2. Telegram API delivers to app via long polling
3. App extracts chat ID and text
4. App calls `agent.queue` via IPC
5. Kernel processes with agent

### Outbound

1. Agent generates response
2. Kernel fires `message_sending` hook
3. App receives hook event
4. App calls Telegram `sendMessage` API
5. User receives message

## Session Keys

Format: `telegram:{chat_id}`

Examples:

- `telegram:123456789` - Private chat
- `telegram:-1001234567890` - Group chat

## Error Handling

### Rate Limits

Telegram limits:

- 30 messages/second per bot
- 1 message/second per chat

The app handles rate limits automatically with exponential backoff.

### Network Errors

Connection errors trigger automatic reconnection with backoff.

### Blocked Users

If a user blocks the bot, send attempts are silently dropped.

## Privacy Mode

In groups, bots only receive:

- Messages starting with `/`
- Messages mentioning the bot
- Replies to bot messages

To receive all messages, disable privacy mode via BotFather:

1. Message [@BotFather](https://t.me/BotFather)
2. Send `/setprivacy`
3. Select your bot
4. Choose `Disable`

## Monitoring

### Health Check

```bash
openclaw channels status telegram
```

### Logs

```bash
openclaw logs --channel telegram
```

## Source Code

Location: `apps/telegram/`

Key files:

- `src/app.ts` - Main application
- `src/handlers/` - Message handlers
- `openclawos.manifest.json` - Package manifest

## Troubleshooting

### Bot not responding

1. Check token: `openclaw channels status telegram`
2. Verify bot is not disabled in BotFather
3. Check logs for errors

### Messages not delivered

1. Check if user blocked the bot
2. Verify group permissions
3. Check rate limit status

### Group messages ignored

1. Enable `allowUnmentionedGroups` or use @mentions
2. Disable privacy mode in BotFather
3. Check `allowedGroups` whitelist

## Next Steps

- [Discord Channel](discord.md)
- [Building Channel Apps](../../developing-apps/channel-app.md)
- [Configuration Reference](../../reference/config-schema.md)
