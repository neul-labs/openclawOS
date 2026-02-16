# Developing Skills

Skills are in-process tools that extend agent capabilities.

## Overview

Unlike apps (which are process-isolated), skills run **in-process** with the kernel for:

- **Performance**: No IPC overhead
- **Memory access**: Direct access to agent context
- **Simplicity**: No process management

## Built-in Skills

| Skill    | Description                   |
| -------- | ----------------------------- |
| `coding` | File editing, code generation |
| `canvas` | Visual editing, diagrams      |
| `memory` | Semantic search, recall       |

## When to Use Skills vs Apps

| Use Case                     | Choice | Reason                |
| ---------------------------- | ------ | --------------------- |
| Agent tools requiring speed  | Skill  | No IPC latency        |
| Agent tools needing context  | Skill  | Direct memory access  |
| External service integration | App    | Process isolation     |
| Channel connection           | App    | Independent lifecycle |
| Heavy computation            | App    | Won't block kernel    |

## Skill Structure

```
my-skill/
├── openclawos.manifest.json
├── package.json
├── src/
│   └── index.ts
└── dist/
    └── index.js
```

### Manifest

```json
{
  "id": "@myorg/my-skill",
  "name": "My Skill",
  "version": "1.0.0",
  "type": "skill",
  "main": "dist/index.js",
  "protocol": { "version": "1.0" },
  "capabilities": {
    "tools": {
      "provides": ["my_tool", "my_other_tool"]
    }
  }
}
```

### Implementation

```typescript
// src/index.ts
import { SkillPlugin } from "@openclawos/plugin-sdk";

export default {
  name: "my-skill",

  tools: [
    {
      name: "my_tool",
      description: "Does something useful",
      parameters: {
        type: "object",
        properties: {
          input: { type: "string" },
        },
        required: ["input"],
      },
      handler: async (params, context) => {
        // Access agent context
        const { session, memory } = context;

        // Do work
        const result = processInput(params.input);

        return { result };
      },
    },
  ],
} satisfies SkillPlugin;
```

## Skill Context

Skills receive rich context:

```typescript
interface SkillContext {
  /** Current session */
  session: {
    key: string;
    agentId: string;
    messageCount: number;
  };

  /** Memory access */
  memory: {
    search: (query: string) => Promise<Memory[]>;
    store: (content: string) => Promise<void>;
  };

  /** Agent state */
  agent: {
    currentTurn: number;
    tokenUsage: number;
  };

  /** Logging */
  log: Logger;
}
```

## Example: Custom Calculator

```typescript
export default {
  name: "calculator",

  tools: [
    {
      name: "calculate",
      description: "Perform mathematical calculations",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "Math expression to evaluate",
          },
        },
        required: ["expression"],
      },
      handler: async ({ expression }, ctx) => {
        try {
          // Safe eval (use a proper math parser in production)
          const result = evaluateMathExpression(expression);
          return { result, expression };
        } catch (error) {
          ctx.log.error("Calculation failed:", error);
          return { error: error.message };
        }
      },
    },
  ],
};
```

## Enabling Skills

In agent configuration:

```json
{
  "agents": {
    "default": {
      "skills": ["coding", "memory", "my-skill"]
    }
  }
}
```

## Next Steps

- [Skill Structure](skill-structure.md)
- [Examples](examples.md)
