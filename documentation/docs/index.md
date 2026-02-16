# OpenClawOS Documentation

Welcome to the OpenClawOS documentation. OpenClawOS is an OS-like architecture for AI assistants, providing a kernel-based design with process-isolated applications.

## What is OpenClawOS?

OpenClawOS treats AI assistant infrastructure like an operating system:

- **Kernel**: The core gateway that handles routing, sessions, and agent runtime
- **Apps**: Process-isolated applications that communicate via IPC (channels like Telegram, Discord, Slack)
- **Skills**: In-process tools that extend agent capabilities (coding, canvas, memory)
- **Extensions**: Kernel enhancements like auth providers and hooks

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        OpenClawOS                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     Kernel (Gateway)                     │   │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐  │   │
│  │  │ Sessions│  │  Agent   │  │ Memory  │  │ Gateway  │  │   │
│  │  │         │  │ Runtime  │  │         │  │  Server  │  │   │
│  │  └─────────┘  └──────────┘  └─────────┘  └──────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                         IPC (Unix Sockets)                      │
│                              │                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Telegram │  │ Discord  │  │  Slack   │  │ WhatsApp │  ...   │
│  │   App    │  │   App    │  │   App    │  │   App    │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install OpenClaw CLI
npm install -g openclaw@latest

# Run onboarding
openclaw onboard --install-daemon

# Start the gateway
openclaw gateway
```

## Package Ecosystem

| Type           | Isolation  | Description                     | Examples                                  |
| -------------- | ---------- | ------------------------------- | ----------------------------------------- |
| **Apps**       | Process    | Channel and plugin applications | @openclawos/telegram, @openclawos/discord |
| **Skills**     | In-process | Agent tools and capabilities    | coding-agent, canvas, memory              |
| **Agents**     | Config     | Agent templates and personas    | agent-coder, agent-writer                 |
| **Extensions** | In-process | Kernel enhancements             | auth providers, gateway methods           |

## Documentation Sections

<div class="grid cards" markdown>

- :material-architecture-outline: **Architecture**

  ***

  Understand the OS-like design, kernel components, and IPC protocol

  [:octicons-arrow-right-24: Learn more](architecture/index.md)

- :material-application-brackets: **Developing Apps**

  ***

  Build your own channel or plugin applications

  [:octicons-arrow-right-24: Get started](developing-apps/index.md)

- :material-tools: **Developing Skills**

  ***

  Create in-process tools for agents

  [:octicons-arrow-right-24: Explore](developing-skills/index.md)

- :material-code-braces: **SDK Reference**

  ***

  API documentation for the OpenClawOS SDK

  [:octicons-arrow-right-24: Reference](sdk/index.md)

</div>

## Supported Channels

OpenClawOS supports a wide range of messaging platforms:

| Platform        | Status | Package                |
| --------------- | ------ | ---------------------- |
| Telegram        | Stable | @openclawos/telegram   |
| Discord         | Stable | @openclawos/discord    |
| Slack           | Stable | @openclawos/slack      |
| WhatsApp        | Stable | @openclawos/whatsapp   |
| Signal          | Stable | @openclawos/signal     |
| iMessage        | Beta   | @openclawos/imessage   |
| Google Chat     | Beta   | @openclawos/googlechat |
| Microsoft Teams | Beta   | @openclawos/msteams    |
| Matrix          | Beta   | @openclawos/matrix     |
| And more...     |        |                        |

## Contributing

OpenClawOS is open source. Contributions are welcome!

- [GitHub Repository](https://github.com/openclaw/openclaw)
- [Issue Tracker](https://github.com/openclaw/openclaw/issues)
