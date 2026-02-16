# Deprecated: Use apps/telegram instead

This extension is deprecated and will be removed in a future version.

## Migration

The Telegram channel has been migrated to an isolated OpenClawOS app at `apps/telegram/`.

To use the new IPC-based app, set `runtime: "ipc"` in your channel config:

```yaml
channels:
  telegram:
    accounts:
      default:
        runtime: "ipc" # Use the new isolated app
        botToken: "your-bot-token"
```

The IPC mode provides better process isolation and crash recovery.

## Why is this still here?

This extension is kept for:

- Backwards compatibility with `runtime: "in-process"` mode
- Tests that depend on extension imports

Once all tests are migrated and IPC mode is the default, this extension will be removed.
