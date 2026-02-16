# Matrix Channel

Matrix integration for self-hosted, federated messaging.

## Overview

| Property | Value                         |
| -------- | ----------------------------- |
| Package  | `@openclawos/matrix`          |
| Protocol | Matrix (E2E optional)         |
| Features | Federated, self-hosted, rooms |
| Status   | Beta                          |

## Quick Start

### 1. Create a Bot Account

On your Matrix homeserver, create a new user for the bot:

```bash
# Synapse example
register_new_matrix_user -c /etc/synapse/homeserver.yaml
```

### 2. Get Access Token

```bash
curl -X POST "https://matrix.example.com/_matrix/client/r0/login" \
  -H "Content-Type: application/json" \
  -d '{"type":"m.login.password","user":"@bot:example.com","password":"password"}'
```

### 3. Configure

```json
{
  "channels": {
    "matrix": {
      "enabled": true,
      "homeserver": "https://matrix.example.com",
      "userId": "@bot:example.com",
      "accessToken": "YOUR_ACCESS_TOKEN"
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
    "matrix": {
      "enabled": true,
      "homeserver": "https://matrix.example.com",
      "userId": "@bot:example.com",
      "accessToken": "syt_xxxx"
    }
  }
}
```

### With E2E Encryption

```json
{
  "channels": {
    "matrix": {
      "enabled": true,
      "homeserver": "https://matrix.example.com",
      "userId": "@bot:example.com",
      "accessToken": "syt_xxxx",
      "encryption": {
        "enabled": true,
        "deviceId": "BOTDEVICE",
        "storeDir": "/var/lib/openclaw/matrix"
      }
    }
  }
}
```

### Advanced Options

```json
{
  "channels": {
    "matrix": {
      "enabled": true,
      "homeserver": "https://matrix.example.com",
      "userId": "@bot:example.com",
      "accessToken": "syt_xxxx",
      "allowedRooms": ["!abc:example.com"],
      "autoJoin": true,
      "displayName": "AI Assistant",
      "avatarUrl": "mxc://example.com/avatar"
    }
  }
}
```

| Option         | Type     | Description           |
| -------------- | -------- | --------------------- |
| `homeserver`   | string   | Matrix homeserver URL |
| `userId`       | string   | Bot user ID           |
| `accessToken`  | string   | Access token          |
| `allowedRooms` | string[] | Whitelist of room IDs |
| `autoJoin`     | boolean  | Auto-join on invite   |
| `displayName`  | string   | Bot display name      |
| `avatarUrl`    | string   | Avatar MXC URL        |

## Features

### Room Support

- Public rooms
- Private rooms
- Encrypted rooms (with E2E enabled)

### Federation

Bot can communicate across federated homeservers.

### Replies

Bot responds to:

- Direct mentions
- Replies to bot messages

## Session Keys

Format: `matrix:{room_id}`

Example: `matrix:!abc123:example.com`

## Self-Hosting

Matrix is ideal for self-hosted deployments:

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Infrastructure                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────────┐    ┌──────────────┐    ┌─────────────┐  │
│   │   Synapse    │◄──▶│  OpenClawOS  │◄──▶│   Your AI   │  │
│   │  Homeserver  │    │   Gateway    │    │    Model    │  │
│   └──────────────┘    └──────────────┘    └─────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Encryption

For E2E encryption:

1. Enable encryption in config
2. Verify the bot's device in your Matrix client
3. Store crypto state in a persistent directory

## Troubleshooting

### "Access token invalid"

1. Generate a new access token
2. Update config
3. Restart gateway

### Bot not joining rooms

1. Enable `autoJoin: true`
2. Or manually invite and accept

### Encrypted messages not decrypted

1. Verify encryption is enabled
2. Check device is verified
3. Ensure crypto store is persistent

## Next Steps

- [Telegram Channel](telegram.md)
- [Discord Channel](discord.md)
