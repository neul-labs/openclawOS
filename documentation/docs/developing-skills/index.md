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
import { OpenClawSkill, toolSuccess, toolError } from "@openclawos/sdk";
import type { PackageManifest, SkillContext, SkillTool } from "@openclawos/sdk";

export default class MySkill extends OpenClawSkill {
  manifest: PackageManifest = {
    id: "@myorg/my-skill",
    name: "My Skill",
    version: "1.0.0",
    type: "skill",
    main: "dist/index.js",
    protocol: { version: "1.0" },
    capabilities: { tools: { provides: ["my_tool"] } },
  };

  async setup(ctx: SkillContext): Promise<void> {
    this.ctx = ctx;
  }

  getTools(): SkillTool[] {
    return [
      {
        name: "my_tool",
        description: "Does something useful",
        parameters: {
          input: { type: "string", description: "The input value" },
        },
        execute: async (params, toolCtx) => {
          try {
            const result = processInput(String(params.input));
            return toolSuccess({ result });
          } catch (err) {
            return toolError((err as Error).message);
          }
        },
      },
    ];
  }
}
```

## Skill Context

`SkillContext` is passed to `setup()` and exposes kernel services available to
in-process skills (data directory, logger, session/memory access, etc.). See
the [SDK Reference](../sdk/index.md) for the full type and helpers
(`toolSuccess`, `toolError`, `validateToolParams`).

Per-call context is `ToolContext`, passed as the second argument to `execute`:
session identifiers, an abort signal, and a tool-scoped logger.

## Example: Custom Calculator

```typescript
import { OpenClawSkill, toolSuccess, toolError } from "@openclawos/sdk";
import type { PackageManifest, SkillContext, SkillTool } from "@openclawos/sdk";

export default class CalculatorSkill extends OpenClawSkill {
  manifest: PackageManifest = {
    id: "@myorg/calculator",
    name: "Calculator",
    version: "1.0.0",
    type: "skill",
    main: "dist/index.js",
    protocol: { version: "1.0" },
    capabilities: { tools: { provides: ["calculate"] } },
  };

  async setup(_ctx: SkillContext): Promise<void> {}

  getTools(): SkillTool[] {
    return [
      {
        name: "calculate",
        description: "Perform mathematical calculations",
        parameters: {
          expression: {
            type: "string",
            description: "Math expression to evaluate",
          },
        },
        execute: async ({ expression }, ctx) => {
          try {
            const result = evaluateMathExpression(String(expression));
            return toolSuccess({ result, expression });
          } catch (error) {
            ctx.log.error("Calculation failed", { error });
            return toolError((error as Error).message);
          }
        },
      },
    ];
  }
}
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
