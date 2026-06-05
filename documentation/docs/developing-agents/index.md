# Developing Agents

Agent templates define personalities, behaviors, and capabilities for AI assistants.

## Overview

Agents in OpenClawOS are defined by:

- **System prompt**: The agent's instructions and personality
- **Skills**: Tools available to the agent
- **Model preferences**: Which LLM to use
- **Behavior settings**: Compaction, memory, limits

## Quick Start

### 1. Create Agent Package

```
my-agent/
├── openclawos.manifest.json
├── prompts/
│   └── system.md
└── package.json
```

### 2. Define Manifest

```json
{
  "id": "@myorg/agent-coder",
  "name": "Coder Agent",
  "version": "1.0.0",
  "type": "agent",
  "protocol": { "version": "1.0" },
  "capabilities": {
    "agent": {
      "systemPromptFile": "prompts/system.md",
      "skills": ["coding", "memory"],
      "model": {
        "default": "claude-opus-4-6",
        "fallback": ["claude-sonnet-4-6"]
      },
      "behavior": {
        "compaction": "balanced",
        "memoryEnabled": true,
        "maxTurns": 100
      }
    }
  }
}
```

### 3. Write System Prompt

```markdown
# Coder Agent

You are an expert software engineer who helps users write, debug, and improve code.

## Capabilities

- Write clean, well-documented code
- Debug issues and explain solutions
- Suggest best practices and improvements
- Work with multiple programming languages

## Guidelines

1. Always explain your reasoning
2. Write tests when appropriate
3. Follow language-specific conventions
4. Ask clarifying questions when needed

## Response Style

- Be concise but thorough
- Use code blocks with syntax highlighting
- Provide examples when helpful
```

### 4. Install Agent

```bash
openclaw agents install ./my-agent
```

## Agent Configuration

### System Prompt

Inline or file-based:

```json
{
  "capabilities": {
    "agent": {
      "systemPrompt": "You are a helpful assistant.",
      // OR
      "systemPromptFile": "prompts/system.md"
    }
  }
}
```

### Skills

Enable built-in or custom skills:

```json
{
  "capabilities": {
    "agent": {
      "skills": ["coding", "memory", "@myorg/web-search"]
    }
  }
}
```

### Model Preferences

```json
{
  "capabilities": {
    "agent": {
      "model": {
        "default": "claude-opus-4-6",
        "fallback": ["claude-sonnet-4-6", "gpt-4"]
      }
    }
  }
}
```

### Behavior Settings

```json
{
  "capabilities": {
    "agent": {
      "behavior": {
        "compaction": "aggressive",
        "memoryEnabled": true,
        "sandboxed": true,
        "maxTurns": 50
      }
    }
  }
}
```

| Setting         | Options                       | Description            |
| --------------- | ----------------------------- | ---------------------- |
| `compaction`    | aggressive, balanced, minimal | Context management     |
| `memoryEnabled` | boolean                       | Long-term memory       |
| `sandboxed`     | boolean                       | Restrict file access   |
| `maxTurns`      | number                        | Max conversation turns |

## Using Agents

### Default Agent

Configure the default agent:

```json
{
  "agents": {
    "default": "@myorg/agent-coder"
  }
}
```

### Per-Channel Agents

Different agents per channel:

```json
{
  "channels": {
    "telegram": {
      "agent": "@myorg/agent-chat"
    },
    "discord": {
      "agent": "@myorg/agent-coder"
    }
  }
}
```

### CLI Selection

```bash
openclaw chat --agent @myorg/agent-coder
```

## Built-in Agents

| Agent          | Description               |
| -------------- | ------------------------- |
| `default`      | General-purpose assistant |
| `agent-coder`  | Software development      |
| `agent-writer` | Writing and editing       |

## Next Steps

- [Examples](examples.md)
- [SDK: Agent helpers](../sdk/index.md) - `defineAgent`, `AgentTemplateBuilder`,
  `loadPromptFile`
- [Hook Events](../reference/hook-events.md) - hooks an agent can react to via
  its enabled skills
