# Deprecated: Use apps/slack instead

This extension is deprecated and will be removed in a future version.

## Migration

The Slack channel has been migrated to an isolated OpenClawOS app at `apps/slack/`.

To use the new IPC-based app, set `runtime: "ipc"` in your channel config:

```yaml
channels:
  slack:
    accounts:
      default:
        runtime: "ipc" # Use the new isolated app
        appToken: "xapp-..."
        botToken: "xoxb-..."
```

The IPC mode provides better process isolation and crash recovery.

## Why is this still here?

This extension is kept for:

- Backwards compatibility with `runtime: "in-process"` mode
- Tests that depend on extension imports

Once all tests are migrated and IPC mode is the default, this extension will be removed.
