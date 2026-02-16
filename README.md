# OpenClawOS

<p align="center">
    <picture>
        <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/openclaw/openclaw/main/docs/assets/openclaw-logo-text-dark.png">
        <img src="https://raw.githubusercontent.com/openclaw/openclaw/main/docs/assets/openclaw-logo-text.png" alt="OpenClaw" width="500">
    </picture>
</p>

<p align="center">
  <a href="https://github.com/openclaw/openclaw/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/openclaw/openclaw/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/openclaw/openclaw/releases"><img src="https://img.shields.io/github/v/release/openclaw/openclaw?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="https://discord.gg/clawd"><img src="https://img.shields.io/discord/1456350064065904867?label=Discord&logo=discord&logoColor=white&color=5865F2&style=for-the-badge" alt="Discord"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

**OpenClawOS** is an OS-like architecture for AI assistants. It provides a kernel-based design with process-isolated applications, enabling reliable multi-channel AI assistant infrastructure.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          OpenClawOS                                 │
├─────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                         KERNEL                                 │ │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌──────────────────┐ │ │
│  │  │ Gateway │  │  Agent   │  │ Memory  │  │     Sessions     │ │ │
│  │  │ Server  │  │ Runtime  │  │ (Embed) │  │                  │ │ │
│  │  └─────────┘  └──────────┘  └─────────┘  └──────────────────┘ │ │
│  │                           │                                    │ │
│  │                      IPC Server                                │ │
│  └───────────────────────────┼───────────────────────────────────┘ │
│                              │                                      │
│                     Unix Socket (JSONL)                             │
│                              │                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     APPS (Process Isolated)                   │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │  │
│  │  │ Telegram │  │ Discord  │  │  Slack   │  │ WhatsApp │ ... │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Concepts

| Component      | Description                                               |
| -------------- | --------------------------------------------------------- |
| **Kernel**     | Core gateway: routing, sessions, agent runtime, memory    |
| **Apps**       | Process-isolated channels and plugins (IPC communication) |
| **Skills**     | In-process agent tools (coding, canvas, memory)           |
| **Extensions** | Kernel enhancements (auth providers, hooks)               |

## Quick Start

```bash
# Install
npm install -g openclaw@latest

# Run onboarding wizard
openclaw onboard --install-daemon

# Start the gateway
openclaw gateway
```

## Package Ecosystem

| Type           | Isolation  | Examples                                                     |
| -------------- | ---------- | ------------------------------------------------------------ |
| **Apps**       | Process    | @openclawos/telegram, @openclawos/discord, @openclawos/slack |
| **Skills**     | In-process | coding-agent, canvas, memory                                 |
| **Agents**     | Config     | agent-coder, agent-writer                                    |
| **Extensions** | In-process | auth providers, gateway methods                              |

## Supported Channels

### Production Ready

- **Telegram** - Bot API integration
- **Discord** - Full guild and thread support
- **Slack** - Bolt framework
- **WhatsApp** - Business API
- **Signal** - via signal-cli

### Beta

- **iMessage** - macOS native
- **Google Chat** - Workspace API
- **Microsoft Teams** - Bot Framework
- **Matrix** - Self-hosted, federated

### Community

- IRC, LINE, Twitch, Nostr, and more

## Models

OpenClawOS supports multiple LLM providers:

- **Anthropic** - Claude (recommended: Claude Opus 4.6)
- **OpenAI** - GPT-4, Codex
- **Google** - Gemini
- **Custom** - Any OpenAI-compatible API

## Development

### From Source

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw

pnpm install
pnpm build

pnpm openclaw gateway
```

### Building Apps

```typescript
import { ChannelApp } from "@openclawos/sdk/app";

class MyChannelApp extends ChannelApp {
  protected channelId = "mychannel";
  manifest = { ... };

  protected async setupChannel(): Promise<void> {
    // Initialize channel connection
  }

  protected async handleInbound(event): Promise<void> {
    await this.dispatchInbound(event.from, event.content);
  }

  protected async sendMessage(params): Promise<void> {
    // Send via platform API
  }
}

new MyChannelApp().start();
```

See [Developing Apps](./documentation/docs/developing-apps/index.md) for the full guide.

## Documentation

Comprehensive documentation is available in the `documentation/` directory:

- [Architecture Overview](./documentation/docs/architecture/index.md)
- [Developing Apps](./documentation/docs/developing-apps/index.md)
- [SDK Reference](./documentation/docs/sdk/index.md)
- [Configuration Reference](./documentation/docs/reference/config-schema.md)

### Build Documentation

```bash
cd documentation
pip install mkdocs-material
mkdocs serve
```

## Project Structure

```
openclaw/
├── packages/
│   ├── kernel/         # Supervisor, IPC server
│   ├── protocol/       # IPC message types, manifest schema
│   └── sdk/            # App SDK (ChannelApp, KernelClient)
├── apps/               # Process-isolated channel apps
│   ├── telegram/
│   ├── discord/
│   ├── slack/
│   └── ...
├── src/                # Kernel source
│   ├── gateway/        # HTTP/WS server
│   ├── agent/          # Agent runtime
│   ├── memory/         # Vector memory
│   └── sessions/       # Session management
├── extensions/         # Kernel enhancements
├── documentation/      # MkDocs documentation
└── ui/                 # Web UI
```

## Links

- [Website](https://openclaw.ai)
- [Documentation](https://docs.openclaw.ai)
- [Discord Community](https://discord.gg/clawd)
- [GitHub Issues](https://github.com/openclaw/openclaw/issues)

## License

MIT License - see [LICENSE](LICENSE) for details.
