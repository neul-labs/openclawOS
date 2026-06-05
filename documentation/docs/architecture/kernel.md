# Kernel Components

The kernel is the core of OpenClawOS. It manages all system resources and coordinates communication between apps.

## Overview

The kernel consists of several subsystems:

```
┌─────────────────────────────────────────────────────────────┐
│                         KERNEL                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Gateway   │  │   Agent     │  │       Memory        │ │
│  │   Server    │  │   Runtime   │  │   (Embeddings)      │ │
│  │  (HTTP/WS)  │  │   (LLM)     │  │                     │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │            │
│  ┌──────┴────────────────┴─────────────────────┴──────────┐│
│  │                    Sessions Store                       ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Supervisor  │  │ IPC Server  │  │       Skills        │ │
│  │ (processes) │  │ (Unix sock) │  │   (in-process)      │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Gateway Server

**Location**: `src/gateway/`

The gateway provides HTTP and WebSocket interfaces for:

- UI communication (dashboard, chat)
- External API access
- App communication via IPC bridge

### Key Features

- HTTP REST API for commands and queries
- WebSocket for real-time updates
- Authentication and authorization
- Rate limiting and request validation

## Agent Runtime

**Location**: `src/agent/`

The agent runtime manages LLM interactions:

- Conversation history management
- Tool execution and validation
- Streaming response handling
- Multi-model support (Anthropic, OpenAI, etc.)

### Tool Execution

Tools are functions the agent can call:

```typescript
// Tool definition
{
  name: "read_file",
  description: "Read a file from the filesystem",
  parameters: {
    path: { type: "string", required: true }
  }
}

// Tool execution flow
Agent Request → Tool Validation → Execution → Result → Agent
```

## Memory System

**Location**: `src/memory/`

The memory system provides semantic search and recall:

- **Embeddings**: Convert text to vectors
- **Vector Store**: Store and search embeddings
- **File Sync**: Automatically index workspace files
- **Retrieval**: Find relevant context for conversations

!!! note "In-Process Design"
Memory runs in-process with the kernel for tight integration with the agent runtime. The `memory-core` extension exposes memory as agent tools.

### Memory Tools (via extension)

- `memory_search`: Semantic search across memories
- `memory_get`: Retrieve specific memory by ID
- `memory_store`: Store new memories

## Sessions

**Location**: `src/sessions/`

Sessions track conversation state:

```typescript
interface Session {
  key: string; // Unique session identifier
  agentId: string; // Which agent handles this session
  channelId?: string; // Source channel (telegram, discord, etc.)
  accountId?: string; // Account within the channel
  messageCount: number;
  createdAt: number;
  lastActiveAt: number;
}
```

### Session Keys

Session keys follow the format: `{channelId}:{conversationId}`

Examples:

- `telegram:123456789` - Telegram chat
- `discord:guild:channel` - Discord channel
- `slack:C12345` - Slack channel

## Supervisor

**Location**: `packages/kernel/src/supervisor/`

The supervisor manages app processes:

- **Spawning**: Start apps with proper environment
- **Health Monitoring**: Track heartbeats, restart on failure
- **Graceful Shutdown**: Stop apps cleanly on kernel shutdown
- **Resource Limits**: CPU and memory constraints

### App Lifecycle

```
┌─────────┐    ┌──────────┐    ┌─────────┐    ┌──────────┐
│ Stopped │───▶│ Starting │───▶│  Ready  │───▶│ Stopping │
└─────────┘    └──────────┘    └─────────┘    └──────────┘
                    │               │               │
                    ▼               ▼               ▼
              [Connect IPC]   [Send traffic]  [Cleanup]
```

## IPC Server

**Location**: `packages/kernel/src/ipc/`

The IPC server handles communication with apps:

- **Transport**: Unix domain sockets
- **Format**: JSONL (newline-delimited JSON)
- **Protocol**: Request/response with events

See [IPC Protocol](ipc-protocol.md) for the full protocol reference.

## Skills

Skills are in-process tools that run inside the kernel:

| Skill          | Description                        |
| -------------- | ---------------------------------- |
| `coding-agent` | File editing, code generation, git |
| `canvas`       | Visual editing, diagrams           |
| `memory`       | Semantic search, recall            |

### Why In-Process?

Skills run in-process for:

- **Performance**: No IPC overhead for frequent calls
- **Memory Access**: Direct access to agent context
- **Simplicity**: No process management needed

## Configuration

The kernel reads configuration from:

1. `~/.config/openclaw/config.json` - User config
2. Environment variables - Runtime overrides
3. Command-line flags - Per-invocation settings

### Key Config Sections

```json
{
  "gateway": {
    "port": 8080,
    "host": "localhost"
  },
  "agents": {
    "default": {
      "model": "claude-opus-4-6",
      "systemPrompt": "..."
    }
  },
  "channels": {
    "telegram": { "enabled": true, "botToken": "..." },
    "discord": { "enabled": true, "token": "..." }
  },
  "apps": {
    "runtime": "ipc"
  }
}
```

## Startup Sequence

1. **Load Config**: Read and validate configuration
2. **Initialize Subsystems**: Memory, sessions, agent runtime
3. **Start Gateway**: HTTP/WS server
4. **Start IPC Server**: Unix socket listener
5. **Start Supervisor**: Load and spawn enabled apps
6. **Signal Ready**: Emit ready event

## Next Steps

- [IPC Protocol](ipc-protocol.md) - Communication protocol details
- [Process Supervision](process-supervision.md) - App management
- [Capabilities](capabilities.md) - Permission system
