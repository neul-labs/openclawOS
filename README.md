# OpenClawOS

**OS-like architecture for self-hosted AI assistants** — a kernel-based design with process-isolated applications for reliable, multi-channel AI assistant infrastructure.

<p align="center">
  <a href="https://github.com/neul-labs/openclawOS/stargazers"><img src="https://img.shields.io/github/stars/neul-labs/openclawOS?style=for-the-badge" alt="GitHub stars"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

**[Website](https://openclawos.neullabs.com)** · **[Documentation](https://docs.neullabs.com/openclawos)** · **[GitHub](https://github.com/neul-labs/openclawOS)** · **[Neul Labs](https://www.neullabs.com)**

OpenClawOS is a community fork of [OpenClaw](https://github.com/openclaw/openclaw) maintained by [Neul Labs](https://www.neullabs.com). It provides a kernel-based design with process-isolated applications, enabling reliable multi-channel AI assistant infrastructure.

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
npm install -g openclawos@latest

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
git clone https://github.com/neul-labs/openclawOS.git
cd openclawOS

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

- [Website](https://openclawos.neullabs.com)
- [Documentation](https://docs.neullabs.com/openclawos)
- [GitHub](https://github.com/neul-labs/openclawOS)
- [GitHub Issues](https://github.com/neul-labs/openclawOS/issues)
- [Neul Labs](https://www.neullabs.com)
- [Upstream OpenClaw](https://github.com/openclaw/openclaw)

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Part of the Neul Labs toolchain

OpenClawOS is part of the OpenClaw cluster at [Neul Labs](https://www.neullabs.com):

| Project | Description |
|---------|-------------|
| [openclaw-rs](https://github.com/neul-labs/openclaw-rs) | A community Rust implementation of OpenClaw. |
| [openclawMU](https://github.com/neul-labs/openclawMU) | Multi-tenant fork of OpenClaw with strict data isolation. |
| [ukkin](https://github.com/neul-labs/ukkin) | Create AI agents on your phone that automate your daily tasks. |

Explore all projects at [neullabs.com](https://www.neullabs.com).
