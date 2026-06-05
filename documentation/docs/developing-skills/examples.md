# Skill Examples

Example skill implementations using `OpenClawSkill` from `@openclawos/sdk`.
The runtime executes `setup(ctx)` once, then calls `getTools()` and invokes
each `SkillTool.execute(params, toolCtx)` per tool call.

The skills shipped in this repo under `skills/` (for example
`skills/coding-agent`, `skills/canvas`, `skills/memory-core` via the
`memory-core` extension) follow the same shape.

## Time & Date Skill

```typescript
import { OpenClawSkill, toolSuccess, toolError } from "@openclawos/sdk";
import type { PackageManifest, SkillContext, SkillTool } from "@openclawos/sdk";

export default class TimeSkill extends OpenClawSkill {
  manifest: PackageManifest = {
    id: "@myorg/time-utils",
    name: "Time Utilities",
    version: "1.0.0",
    type: "skill",
    main: "dist/index.js",
    protocol: { version: "1.0" },
    capabilities: { tools: { provides: ["current_time", "parse_date"] } },
  };

  async setup(_ctx: SkillContext): Promise<void> {}

  getTools(): SkillTool[] {
    return [
      {
        name: "current_time",
        description: "Get the current date and time",
        parameters: {
          type: "object",
          properties: {
            timezone: {
              type: "string",
              description: "IANA timezone, e.g. 'America/New_York'",
            },
          },
        },
        execute: async (params) => {
          const tz = (params.timezone as string) || "UTC";
          const now = new Date();
          return toolSuccess({
            formatted: now.toLocaleString("en-US", {
              timeZone: tz,
              dateStyle: "full",
              timeStyle: "long",
            }),
            iso: now.toISOString(),
            timestamp: now.getTime(),
          });
        },
      },
      {
        name: "parse_date",
        description: "Parse a date string",
        parameters: {
          type: "object",
          properties: {
            text: { type: "string", description: "Date text to parse" },
          },
          required: ["text"],
        },
        execute: async (params) => {
          const text = String(params.text ?? "");
          const date = new Date(text);
          if (isNaN(date.getTime())) return toolError("Could not parse date");
          return toolSuccess({
            iso: date.toISOString(),
            formatted: date.toLocaleDateString("en-US", { dateStyle: "full" }),
          });
        },
      },
    ];
  }
}
```

## JSON Utilities Skill

```typescript
import { OpenClawSkill, toolSuccess, toolError } from "@openclawos/sdk";
import type { PackageManifest, SkillContext, SkillTool } from "@openclawos/sdk";

export default class JsonSkill extends OpenClawSkill {
  manifest: PackageManifest = {
    id: "@myorg/json-utils",
    name: "JSON Utilities",
    version: "1.0.0",
    type: "skill",
    main: "dist/index.js",
    protocol: { version: "1.0" },
    capabilities: { tools: { provides: ["json_parse", "json_query"] } },
  };

  async setup(_ctx: SkillContext): Promise<void> {}

  getTools(): SkillTool[] {
    return [
      {
        name: "json_parse",
        description: "Parse and validate JSON",
        parameters: {
          type: "object",
          properties: {
            json: { type: "string", description: "JSON string to parse" },
          },
          required: ["json"],
        },
        execute: async (params) => {
          try {
            const parsed = JSON.parse(String(params.json));
            return toolSuccess({
              valid: true,
              data: parsed,
              type: Array.isArray(parsed) ? "array" : typeof parsed,
            });
          } catch (e) {
            return toolError((e as Error).message);
          }
        },
      },
      {
        name: "json_query",
        description: "Read a value from a JSON document by dotted path",
        parameters: {
          type: "object",
          properties: {
            json: { type: "string", description: "JSON string" },
            path: {
              type: "string",
              description: "Dotted path, e.g. 'users[0].name'",
            },
          },
          required: ["json", "path"],
        },
        execute: async (params) => {
          try {
            const data = JSON.parse(String(params.json));
            const value = getByPath(data, String(params.path));
            return toolSuccess({ value });
          } catch (e) {
            return toolError((e as Error).message);
          }
        },
      },
    ];
  }
}

function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split(/[\.\[\]]/).filter(Boolean);
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
```

## Web Search Skill

```typescript
import { OpenClawSkill, toolSuccess, toolError } from "@openclawos/sdk";
import type { PackageManifest, SkillContext, SkillTool } from "@openclawos/sdk";

interface SearchConfig {
  searchEndpoint: string;
  apiKey: string;
}

export default class WebSearchSkill extends OpenClawSkill {
  manifest: PackageManifest = {
    id: "@myorg/web-search",
    name: "Web Search",
    version: "1.0.0",
    type: "skill",
    main: "dist/index.js",
    protocol: { version: "1.0" },
    capabilities: { tools: { provides: ["web_search"] } },
  };

  private cfg!: SearchConfig;

  async setup(ctx: SkillContext): Promise<void> {
    this.cfg = (ctx.config ?? {}) as SearchConfig;
  }

  getTools(): SkillTool[] {
    return [
      {
        name: "web_search",
        description: "Search the web for information",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            limit: {
              type: "integer",
              description: "Maximum results",
              default: 5,
            },
          },
          required: ["query"],
        },
        execute: async (params, toolCtx) => {
          const query = String(params.query);
          const limit = Number(params.limit ?? 5);
          const url = `${this.cfg.searchEndpoint}?q=${encodeURIComponent(query)}&limit=${limit}`;

          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${this.cfg.apiKey}` },
            signal: toolCtx.signal,
          });
          if (!response.ok) {
            return toolError(`Search failed: ${response.status}`);
          }
          const data = (await response.json()) as {
            results: Array<{ title: string; url: string; snippet: string }>;
          };
          return toolSuccess({
            results: data.results.map((r) => ({
              title: r.title,
              url: r.url,
              snippet: r.snippet,
            })),
          });
        },
      },
    ];
  }
}
```

## Tags Skill (using `dataDir`)

```typescript
import path from "node:path";
import fs from "node:fs/promises";
import { OpenClawSkill, toolSuccess } from "@openclawos/sdk";
import type { PackageManifest, SkillContext, SkillTool } from "@openclawos/sdk";

export default class TagsSkill extends OpenClawSkill {
  manifest: PackageManifest = {
    id: "@myorg/tags",
    name: "Tags",
    version: "1.0.0",
    type: "skill",
    main: "dist/index.js",
    protocol: { version: "1.0" },
    capabilities: { tools: { provides: ["tag", "list_tags"] } },
  };

  private file!: string;

  async setup(ctx: SkillContext): Promise<void> {
    await fs.mkdir(ctx.dataDir, { recursive: true });
    this.file = path.join(ctx.dataDir, "tags.json");
  }

  private async load(): Promise<string[]> {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8")) as string[];
    } catch {
      return [];
    }
  }

  private async save(tags: string[]): Promise<void> {
    await fs.writeFile(this.file, JSON.stringify(tags));
  }

  getTools(): SkillTool[] {
    return [
      {
        name: "tag",
        description: "Add a tag",
        parameters: {
          type: "object",
          properties: { tag: { type: "string" } },
          required: ["tag"],
        },
        execute: async (params) => {
          const tags = new Set(await this.load());
          tags.add(String(params.tag));
          await this.save([...tags]);
          return toolSuccess({ count: tags.size });
        },
      },
      {
        name: "list_tags",
        description: "List all tags",
        execute: async () => toolSuccess({ tags: await this.load() }),
      },
    ];
  }
}
```

## Using Skills

Enable in agent configuration:

```json
{
  "agents": {
    "default": {
      "skills": ["coding", "memory", "@myorg/time-utils", "@myorg/json-utils"]
    }
  }
}
```

## Next Steps

- [Skill Structure](skill-structure.md)
- [Testing](../developing-apps/testing.md)
- [SDK Reference](../sdk/index.md)
