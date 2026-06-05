# Skill Structure

Detailed reference for skill package structure. Skills are in-process tools
loaded by the agent runtime; the SDK base class is `OpenClawSkill` from
`@openclawos/sdk`.

## Directory Layout

```
my-skill/
├── openclawos.manifest.json   # Package manifest
├── package.json               # Node.js package
├── tsconfig.json              # TypeScript config
├── src/
│   ├── index.ts              # Main export (default-exported class)
│   ├── tools/                # Tool implementations
│   │   ├── tool-a.ts
│   │   └── tool-b.ts
│   └── utils/                # Utilities
│       └── helpers.ts
└── dist/                      # Compiled output
    └── index.js
```

## Manifest

```json
{
  "id": "@myorg/my-skill",
  "name": "My Skill",
  "version": "1.0.0",
  "description": "A custom skill for agents",
  "type": "skill",
  "main": "dist/index.js",
  "protocol": {
    "version": "1.0"
  },
  "capabilities": {
    "tools": {
      "provides": ["tool_a", "tool_b"]
    }
  }
}
```

See the [Manifest Schema](../reference/manifest-schema.md) for the complete
field reference (it is enforced by `@openclawos/protocol`).

## Main Export

```typescript
// src/index.ts
import { OpenClawSkill } from "@openclawos/sdk";
import type { PackageManifest, SkillContext, SkillTool } from "@openclawos/sdk";
import { toolA } from "./tools/tool-a.js";
import { toolB } from "./tools/tool-b.js";

export default class MySkill extends OpenClawSkill {
  manifest: PackageManifest = {
    id: "@myorg/my-skill",
    name: "My Skill",
    version: "1.0.0",
    type: "skill",
    main: "dist/index.js",
    protocol: { version: "1.0" },
    capabilities: { tools: { provides: ["tool_a", "tool_b"] } },
  };

  private ctx!: SkillContext;

  async setup(ctx: SkillContext): Promise<void> {
    this.ctx = ctx;
    ctx.logger.info("Skill loaded");
  }

  async teardown(): Promise<void> {
    this.ctx?.logger.info("Skill unloading");
  }

  getTools(): SkillTool[] {
    return [toolA, toolB];
  }
}
```

## Tool Definition

```typescript
// src/tools/tool-a.ts
import { toolSuccess, toolError } from "@openclawos/sdk";
import type { SkillTool } from "@openclawos/sdk";

export const toolA: SkillTool = {
  name: "tool_a",
  description: "Processes input text",
  parameters: {
    type: "object",
    properties: {
      input: { type: "string", description: "Text to process" },
    },
    required: ["input"],
  },
  execute: async (params, ctx) => {
    const input = String(params.input ?? "");
    if (!input) return toolError("input is required");

    return toolSuccess({
      processed: input.toUpperCase(),
      timestamp: Date.now(),
    });
  },
};
```

## Skill Interface

`OpenClawSkill` is an abstract class. Concrete skills implement:

| Member              | Required | Purpose                                                    |
| ------------------- | -------- | ---------------------------------------------------------- |
| `manifest`          | yes      | `PackageManifest` for the package                          |
| `setup(ctx)`        | yes      | Called once when the agent runtime loads the skill         |
| `getTools()`        | yes      | Returns the `SkillTool[]` exposed by this skill            |
| `teardown()`        | no       | Called when the skill is unloaded                          |

## SkillContext

`SkillContext` is passed to `setup()`:

```typescript
interface SkillContext {
  /** Skill's data directory for persistence */
  dataDir: string;
  /** Workspace directory (user's project) */
  workspaceDir?: string;
  /** Current agent ID */
  agentId?: string;
  /** Current session key */
  sessionKey?: string;
  /** OpenClawOS configuration */
  config: unknown;
  /** Logger for the skill */
  logger: SkillLogger;
}
```

## Tool Executor

```typescript
type ToolExecutor = (
  params: Record<string, unknown>,
  context: ToolContext,
) => Promise<ToolResult>;

interface ToolContext {
  agentId?: string;
  sessionKey?: string;
  workspaceDir?: string;
  sandboxed?: boolean;
  signal?: AbortSignal; // honour this for long-running work
}

type ToolResult =
  | { success: true; output: unknown }
  | { success: false; error: string };
```

Use the helpers `toolSuccess(output)` and `toolError(message)` to build
`ToolResult` values. `validateToolParams(params, schema)` performs the same
required/type checks the runtime would perform itself.

## Package.json

```json
{
  "name": "@myorg/my-skill",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@openclawos/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

## TypeScript Config

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

## Persistence

Skills get a private `dataDir` from `SkillContext`. Use it for SQLite files,
caches, vector indexes, or anything else the skill owns. Do not write outside
`dataDir` unless you are intentionally operating on `workspaceDir`.

```typescript
async setup(ctx: SkillContext): Promise<void> {
  this.dbPath = path.join(ctx.dataDir, "memory.sqlite");
  await fs.mkdir(ctx.dataDir, { recursive: true });
}
```

## Cancellation

Long-running tools should honour `ToolContext.signal`:

```typescript
execute: async (params, ctx) => {
  const res = await fetch(url, { signal: ctx.signal });
  if (ctx.signal?.aborted) return toolError("cancelled");
  return toolSuccess(await res.json());
};
```

## Next Steps

- [Examples](examples.md)
- [Testing](../developing-apps/testing.md)
- [SDK Reference](../sdk/index.md)
