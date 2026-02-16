# Skill Structure

Detailed reference for skill package structure.

## Directory Layout

```
my-skill/
├── openclawos.manifest.json   # Package manifest
├── package.json               # Node.js package
├── tsconfig.json              # TypeScript config
├── src/
│   ├── index.ts              # Main export
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

## Main Export

```typescript
// src/index.ts
import type { SkillPlugin, ToolDefinition } from "@openclawos/plugin-sdk";
import { toolA } from "./tools/tool-a";
import { toolB } from "./tools/tool-b";

const skill: SkillPlugin = {
  name: "my-skill",
  tools: [toolA, toolB],

  // Optional lifecycle hooks
  onLoad: async (ctx) => {
    ctx.log.info("Skill loaded");
  },

  onUnload: async (ctx) => {
    ctx.log.info("Skill unloading");
  },
};

export default skill;
```

## Tool Definition

```typescript
// src/tools/tool-a.ts
import type { ToolDefinition, ToolHandler } from "@openclawos/plugin-sdk";

const handler: ToolHandler = async (params, context) => {
  const { input } = params as { input: string };

  // Use context
  context.log.debug("Processing:", input);

  // Return result
  return {
    processed: input.toUpperCase(),
    timestamp: Date.now(),
  };
};

export const toolA: ToolDefinition = {
  name: "tool_a",
  description: "Processes input text",
  parameters: {
    type: "object",
    properties: {
      input: {
        type: "string",
        description: "Text to process",
      },
    },
    required: ["input"],
  },
  handler,
};
```

## Plugin Interface

```typescript
interface SkillPlugin {
  /** Skill name */
  name: string;

  /** Tools provided by this skill */
  tools: ToolDefinition[];

  /** Called when skill is loaded */
  onLoad?: (context: SkillContext) => Promise<void>;

  /** Called when skill is unloaded */
  onUnload?: (context: SkillContext) => Promise<void>;
}
```

## Tool Handler

```typescript
type ToolHandler = (params: unknown, context: ToolContext) => Promise<unknown>;

interface ToolContext {
  /** Session info */
  session: SessionInfo;

  /** Memory access */
  memory: MemoryAccess;

  /** Agent info */
  agent: AgentInfo;

  /** Logger */
  log: Logger;

  /** Configuration */
  config: SkillConfig;
}
```

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
    "@openclawos/plugin-sdk": "^1.0.0"
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

## Accessing Memory

```typescript
const handler: ToolHandler = async (params, ctx) => {
  // Search memories
  const memories = await ctx.memory.search("relevant topic");

  // Store new memory
  await ctx.memory.store("Important information to remember");

  // Use in response
  return {
    relatedMemories: memories.map((m) => m.content),
  };
};
```

## Configuration

Skills can have configuration:

```json
{
  "capabilities": {
    "tools": { "provides": ["my_tool"] }
  },
  "configSchema": {
    "type": "object",
    "properties": {
      "apiEndpoint": { "type": "string" },
      "maxResults": { "type": "integer", "default": 10 }
    }
  }
}
```

Accessing config:

```typescript
const handler: ToolHandler = async (params, ctx) => {
  const endpoint = ctx.config.apiEndpoint;
  const maxResults = ctx.config.maxResults ?? 10;
  // ...
};
```

## Next Steps

- [Examples](examples.md)
- [Testing](../developing-apps/testing.md)
