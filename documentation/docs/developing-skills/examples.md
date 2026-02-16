# Skill Examples

Example skill implementations.

## Time & Date Skill

```typescript
import type { SkillPlugin } from "@openclawos/plugin-sdk";

export default {
  name: "time-utils",

  tools: [
    {
      name: "current_time",
      description: "Get the current date and time",
      parameters: {
        type: "object",
        properties: {
          timezone: {
            type: "string",
            description: "Timezone (e.g., 'America/New_York')",
          },
        },
      },
      handler: async ({ timezone }) => {
        const now = new Date();
        const options: Intl.DateTimeFormatOptions = {
          timeZone: timezone || "UTC",
          dateStyle: "full",
          timeStyle: "long",
        };
        return {
          formatted: now.toLocaleString("en-US", options),
          iso: now.toISOString(),
          timestamp: now.getTime(),
        };
      },
    },

    {
      name: "parse_date",
      description: "Parse a natural language date",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "Date text to parse",
          },
        },
        required: ["text"],
      },
      handler: async ({ text }) => {
        // Simple parsing (use a library like chrono-node in production)
        const date = new Date(text);
        if (isNaN(date.getTime())) {
          return { error: "Could not parse date" };
        }
        return {
          iso: date.toISOString(),
          formatted: date.toLocaleDateString("en-US", {
            dateStyle: "full",
          }),
        };
      },
    },
  ],
} satisfies SkillPlugin;
```

## JSON Utilities Skill

```typescript
import type { SkillPlugin } from "@openclawos/plugin-sdk";

export default {
  name: "json-utils",

  tools: [
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
      handler: async ({ json }) => {
        try {
          const parsed = JSON.parse(json);
          return {
            valid: true,
            data: parsed,
            type: Array.isArray(parsed) ? "array" : typeof parsed,
          };
        } catch (e) {
          return {
            valid: false,
            error: e.message,
          };
        }
      },
    },

    {
      name: "json_query",
      description: "Query JSON with a path expression",
      parameters: {
        type: "object",
        properties: {
          json: { type: "string", description: "JSON string" },
          path: { type: "string", description: "Path like 'users[0].name'" },
        },
        required: ["json", "path"],
      },
      handler: async ({ json, path }) => {
        try {
          const data = JSON.parse(json);
          const value = getByPath(data, path);
          return { value };
        } catch (e) {
          return { error: e.message };
        }
      },
    },
  ],
} satisfies SkillPlugin;

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
import type { SkillPlugin } from "@openclawos/plugin-sdk";

export default {
  name: "web-search",

  tools: [
    {
      name: "web_search",
      description: "Search the web for information",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query",
          },
          limit: {
            type: "integer",
            description: "Maximum results",
            default: 5,
          },
        },
        required: ["query"],
      },
      handler: async ({ query, limit = 5 }, ctx) => {
        const endpoint = ctx.config.searchEndpoint;
        const apiKey = ctx.config.apiKey;

        const response = await fetch(`${endpoint}?q=${encodeURIComponent(query)}&limit=${limit}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!response.ok) {
          return { error: `Search failed: ${response.status}` };
        }

        const data = await response.json();
        return {
          results: data.results.map((r: any) => ({
            title: r.title,
            url: r.url,
            snippet: r.snippet,
          })),
        };
      },
    },
  ],
} satisfies SkillPlugin;
```

## Memory Enhancement Skill

```typescript
import type { SkillPlugin } from "@openclawos/plugin-sdk";

export default {
  name: "memory-enhanced",

  tools: [
    {
      name: "remember",
      description: "Store information in long-term memory",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "Information to remember",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Tags for categorization",
          },
        },
        required: ["content"],
      },
      handler: async ({ content, tags }, ctx) => {
        const taggedContent = tags?.length ? `[${tags.join(", ")}] ${content}` : content;

        await ctx.memory.store(taggedContent);

        return {
          stored: true,
          content: taggedContent,
        };
      },
    },

    {
      name: "recall",
      description: "Recall information from memory",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "What to recall",
          },
          limit: {
            type: "integer",
            default: 5,
          },
        },
        required: ["query"],
      },
      handler: async ({ query, limit = 5 }, ctx) => {
        const memories = await ctx.memory.search(query, { limit });

        return {
          found: memories.length,
          memories: memories.map((m) => ({
            content: m.content,
            relevance: m.score,
            timestamp: m.timestamp,
          })),
        };
      },
    },
  ],
} satisfies SkillPlugin;
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
