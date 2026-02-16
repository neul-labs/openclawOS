# Architecture Overview

OpenClawOS is designed as an **OS-like architecture** for AI assistants. This design provides process isolation, capability-based security, and a clear separation between the kernel and applications.

## The OS Analogy

Like a traditional operating system:

| OS Concept           | OpenClawOS Equivalent                     |
| -------------------- | ----------------------------------------- |
| Kernel               | Gateway (sessions, agent runtime, memory) |
| User-space processes | Apps (channels, plugins)                  |
| System calls         | IPC protocol over Unix sockets            |
| Device drivers       | Channel apps (Telegram, Discord, etc.)    |
| Executables          | Package manifests + entry points          |
| Permissions          | Capabilities system                       |

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            OpenClawOS                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                         KERNEL                                     │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │ │
│  │  │   Gateway   │  │   Agent     │  │   Memory    │  │ Sessions │ │ │
│  │  │   Server    │  │   Runtime   │  │  (Vectors)  │  │          │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘ │ │
│  │                                                                    │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐│ │
│  │  │ Supervisor  │  │ IPC Server  │  │ Skills (in-process tools)  ││ │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────────┘│ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                    │                                    │
│                            IPC (Unix Sockets)                           │
│                                    │                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      APPS (Process Isolated)                      │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │  │
│  │  │ Telegram │  │ Discord  │  │  Slack   │  │ WhatsApp │   ...   │  │
│  │  │   App    │  │   App    │  │   App    │  │   App    │         │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Components

### Kernel

The kernel is the core of OpenClawOS. It runs as a single process and manages:

- **Gateway Server**: HTTP/WebSocket server for external communication
- **Agent Runtime**: LLM interaction, tool execution, conversation management
- **Memory**: Vector embeddings, semantic search, file synchronization
- **Sessions**: Conversation state and history
- **Supervisor**: Process lifecycle management for apps
- **IPC Server**: Communication with external apps

See [Kernel Components](kernel.md) for details.

### Apps

Apps are **process-isolated** applications that communicate with the kernel via IPC. They include:

- **Channel Apps**: Connect messaging platforms (Telegram, Discord, Slack, etc.)
- **Plugin Apps**: Add capabilities (diagnostics, voice calls, etc.)

Apps are spawned and supervised by the kernel. If an app crashes, it doesn't bring down the kernel.

### Skills

Skills are **in-process** tools that extend agent capabilities. Unlike apps, they run inside the kernel process for performance:

- `coding-agent`: File editing, code generation
- `canvas`: Visual editing
- `memory`: Semantic search, recall

### Extensions

Extensions are kernel enhancements that run in-process:

- **Auth providers**: OAuth integrations (Google, GitHub)
- **Gateway methods**: Custom API endpoints
- **Hooks**: Event handlers for customization

## Data Flow

### Inbound Message Flow

```
┌────────────┐    ┌───────────────┐    ┌────────────────┐    ┌─────────────┐
│  Telegram  │───▶│ Telegram App  │───▶│ Kernel Gateway │───▶│    Agent    │
│   Server   │    │  (process)    │    │     (IPC)      │    │   Runtime   │
└────────────┘    └───────────────┘    └────────────────┘    └─────────────┘
                         │
                    IPC Message:
                   agent.queue
```

1. User sends message to Telegram
2. Telegram app receives via bot API
3. App dispatches to kernel via `agent.queue` IPC call
4. Kernel queues message for agent processing
5. Agent generates response
6. Response dispatched back via `message_sending` hook

### Outbound Message Flow

```
┌─────────────┐    ┌────────────────┐    ┌───────────────┐    ┌────────────┐
│    Agent    │───▶│ Kernel Gateway │───▶│ Telegram App  │───▶│  Telegram  │
│   Runtime   │    │  (hook event)  │    │  (process)    │    │   Server   │
└─────────────┘    └────────────────┘    └───────────────┘    └────────────┘
                         │
                    Hook Event:
                  message_sending
```

1. Agent generates response content
2. Kernel dispatches `message_sending` hook event
3. Subscribed channel app receives event
4. App sends message via platform API

## Why Process Isolation?

Process isolation provides several benefits:

| Benefit               | Description                                   |
| --------------------- | --------------------------------------------- |
| **Stability**         | App crash doesn't take down the kernel        |
| **Security**          | Apps can't access kernel memory directly      |
| **Updates**           | Apps can be updated without restarting kernel |
| **Resource Limits**   | Each app can have CPU/memory limits           |
| **Language Agnostic** | Apps can be written in any language           |

## Package Types

OpenClawOS supports four package types:

| Type        | Isolation   | Entry Point  | Purpose             |
| ----------- | ----------- | ------------ | ------------------- |
| `app`       | Process     | `main` field | Channels, plugins   |
| `skill`     | In-process  | `main` field | Agent tools         |
| `agent`     | Config only | N/A          | Agent templates     |
| `extension` | In-process  | `main` field | Kernel enhancements |

## Next Steps

- [Kernel Components](kernel.md) - Deep dive into kernel internals
- [IPC Protocol](ipc-protocol.md) - Message format and methods
- [Process Supervision](process-supervision.md) - App lifecycle management
- [Capabilities](capabilities.md) - Permission system
