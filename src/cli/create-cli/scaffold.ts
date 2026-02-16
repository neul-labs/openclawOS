import fs from "node:fs/promises";
import path from "node:path";

export type AppType = "channel" | "plugin" | "skill" | "agent";

export interface ScaffoldOptions {
  type: AppType;
  name: string;
  org: string;
  description?: string;
  outputDir: string;
}

export interface TemplateContext {
  packageId: string;
  packageName: string;
  displayName: string;
  className: string;
  org: string;
  description: string;
  channelId: string;
  envPrefix: string;
  toolName: string;
  toolNameCamel: string;
  toolDescription: string;
  year: number;
}

interface TemplateFile {
  path: string;
  content: string;
}

function toTitleCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toSnakeCase(str: string): string {
  return str
    .replace(/[-\s]+/g, "_")
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "")
    .replace(/_+/g, "_")
    .toUpperCase();
}

function buildContext(options: ScaffoldOptions): TemplateContext {
  const displayName = toTitleCase(options.name);
  const className = toPascalCase(options.name);
  const channelId = options.name.replace(/[-_\s]+/g, "").toLowerCase();
  const toolName = `${options.name.replace(/[-\s]+/g, "_").toLowerCase()}_action`;

  return {
    packageId: `@${options.org}/${options.name}`,
    packageName: options.name,
    displayName,
    className,
    org: options.org,
    description: options.description || `${displayName} for OpenClawOS`,
    channelId,
    envPrefix: toSnakeCase(options.name),
    toolName,
    toolNameCamel: toCamelCase(toolName.replace(/_/g, "-")),
    toolDescription: `Performs an action for ${displayName}`,
    year: new Date().getFullYear(),
  };
}

function applyTemplate(content: string, context: TemplateContext): string {
  let result = content;
  for (const [key, value] of Object.entries(context)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(regex, String(value));
  }
  return result;
}

// Embedded templates - these are inlined at build time
const TEMPLATES: Record<AppType, TemplateFile[]> = {
  channel: [
    {
      path: "openclawos.manifest.json",
      content: `{
  "id": "{{packageId}}",
  "name": "{{displayName}}",
  "version": "0.1.0",
  "description": "{{description}}",
  "type": "app",
  "main": "dist/index.js",
  "protocol": {
    "version": "1.0"
  },
  "capabilities": {
    "channels": {
      "provides": ["{{channelId}}"]
    },
    "hooks": {
      "intercepts": ["message_sending"]
    },
    "resources": {
      "env": ["{{envPrefix}}_API_TOKEN"]
    }
  },
  "configSchema": {
    "type": "object",
    "properties": {
      "apiToken": {
        "type": "string",
        "description": "API token for authentication"
      }
    },
    "required": ["apiToken"]
  },
  "configUiHints": {
    "apiToken": {
      "label": "API Token",
      "description": "Your API token",
      "sensitive": true,
      "type": "text"
    }
  }
}
`,
    },
    {
      path: "package.json",
      content: `{
  "name": "{{packageId}}",
  "version": "0.1.0",
  "description": "{{description}}",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@openclawos/sdk": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  },
  "license": "MIT"
}
`,
    },
    {
      path: "tsconfig.json",
      content: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
`,
    },
    {
      path: "src/index.ts",
      content: `import { {{className}}App } from "./app.js";

const app = new {{className}}App();
app.start().catch(console.error);
`,
    },
    {
      path: "src/app.ts",
      content: `import { ChannelApp, type SendMessageParams, type MessageReceivedEvent } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";

// Import manifest at runtime - adjust path as needed after build
const manifest = {
  id: "{{packageId}}",
  name: "{{displayName}}",
  version: "0.1.0",
  type: "app" as const,
  main: "dist/index.js",
  protocol: { version: "1.0" },
  capabilities: {
    channels: { provides: ["{{channelId}}"] },
    hooks: { intercepts: ["message_sending"] },
  },
};

export class {{className}}App extends ChannelApp {
  protected readonly channelId = "{{channelId}}";
  readonly manifest = manifest as unknown as PackageManifest;

  protected async setupChannel(): Promise<void> {
    const config = await this.kernel.getConfig();
    this.log.info("{{displayName}} channel setup complete");

    // TODO: Initialize your channel SDK/API client here
    // Example: this.client = new MyChannelClient(config.apiToken);
  }

  protected async handleInbound(event: MessageReceivedEvent): Promise<void> {
    // Handle incoming messages from your platform
    // Forward to OpenClawOS for processing:
    // await this.dispatchInbound(event.from, event.content, event.metadata);
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    this.log.info(\`Sending to \${params.target}: \${params.content}\`);

    // TODO: Send message via your platform's API
    // Example: await this.client.sendMessage(params.target, params.content);
  }
}
`,
    },
  ],
  plugin: [
    {
      path: "openclawos.manifest.json",
      content: `{
  "id": "{{packageId}}",
  "name": "{{displayName}}",
  "version": "0.1.0",
  "description": "{{description}}",
  "type": "app",
  "main": "dist/index.js",
  "protocol": {
    "version": "1.0"
  },
  "capabilities": {
    "tools": {
      "provides": ["{{toolName}}"]
    },
    "hooks": {
      "subscribes": []
    }
  },
  "configSchema": {
    "type": "object",
    "properties": {}
  }
}
`,
    },
    {
      path: "package.json",
      content: `{
  "name": "{{packageId}}",
  "version": "0.1.0",
  "description": "{{description}}",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@openclawos/sdk": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  },
  "license": "MIT"
}
`,
    },
    {
      path: "tsconfig.json",
      content: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
`,
    },
    {
      path: "src/index.ts",
      content: `import { {{className}}App } from "./app.js";

const app = new {{className}}App();
app.start().catch(console.error);
`,
    },
    {
      path: "src/app.ts",
      content: `import { OpenClawApp } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";

const manifest = {
  id: "{{packageId}}",
  name: "{{displayName}}",
  version: "0.1.0",
  type: "app" as const,
  main: "dist/index.js",
  protocol: { version: "1.0" },
  capabilities: {
    tools: { provides: ["{{toolName}}"] },
  },
};

export class {{className}}App extends OpenClawApp {
  readonly manifest = manifest as unknown as PackageManifest;

  protected async setup(): Promise<void> {
    // Register your tools
    await this.registerTool({
      name: "{{toolName}}",
      description: "{{toolDescription}}",
      parameters: {
        type: "object",
        properties: {
          input: {
            type: "string",
            description: "Input parameter",
          },
        },
        required: ["input"],
      },
      handler: async (params: { input: string }) => {
        this.log.info(\`Executing {{toolName}} with: \${params.input}\`);

        // TODO: Implement your tool logic
        return { result: \`Processed: \${params.input}\` };
      },
    });

    this.log.info("{{displayName}} plugin setup complete");
  }
}
`,
    },
  ],
  skill: [
    {
      path: "openclawos.manifest.json",
      content: `{
  "id": "{{packageId}}",
  "name": "{{displayName}}",
  "version": "0.1.0",
  "description": "{{description}}",
  "type": "skill",
  "main": "dist/index.js",
  "protocol": {
    "version": "1.0"
  },
  "capabilities": {
    "tools": {
      "provides": ["{{toolName}}"]
    }
  }
}
`,
    },
    {
      path: "package.json",
      content: `{
  "name": "{{packageId}}",
  "version": "0.1.0",
  "description": "{{description}}",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@openclawos/sdk": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  },
  "license": "MIT"
}
`,
    },
    {
      path: "tsconfig.json",
      content: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
`,
    },
    {
      path: "src/index.ts",
      content: `import type { SkillDefinition, ToolDefinition } from "@openclawos/sdk/skill";

/**
 * {{displayName}} Skill
 *
 * This skill provides the {{toolName}} tool for agent use.
 */

const {{toolNameCamel}}Tool: ToolDefinition = {
  name: "{{toolName}}",
  description: "{{toolDescription}}",
  parameters: {
    type: "object",
    properties: {
      input: {
        type: "string",
        description: "Input parameter",
      },
    },
    required: ["input"],
  },
  handler: async (params: { input: string }, context) => {
    context.log.info(\`Executing {{toolName}} with: \${params.input}\`);

    // TODO: Implement your tool logic
    return { result: \`Processed: \${params.input}\` };
  },
};

const skill: SkillDefinition = {
  id: "{{packageId}}",
  name: "{{displayName}}",
  description: "{{description}}",
  tools: [{{toolNameCamel}}Tool],
};

export default skill;
`,
    },
  ],
  agent: [
    {
      path: "openclawos.manifest.json",
      content: `{
  "id": "{{packageId}}",
  "name": "{{displayName}}",
  "version": "0.1.0",
  "description": "{{description}}",
  "type": "agent",
  "protocol": {
    "version": "1.0"
  },
  "capabilities": {
    "agent": {
      "systemPromptFile": "prompts/system.md",
      "skills": [],
      "model": {
        "default": "claude-sonnet-4-20250514"
      },
      "behavior": {
        "compaction": "balanced",
        "memoryEnabled": true
      }
    }
  }
}
`,
    },
    {
      path: "package.json",
      content: `{
  "name": "{{packageId}}",
  "version": "0.1.0",
  "description": "{{description}}",
  "type": "module",
  "license": "MIT"
}
`,
    },
    {
      path: "prompts/system.md",
      content: `# {{displayName}}

{{description}}

## Capabilities

You are an AI assistant with the following capabilities:

- Conversational interaction
- Task completion
- Information retrieval

## Guidelines

1. Be helpful and accurate
2. Ask clarifying questions when needed
3. Provide clear and concise responses

## Personality

Respond in a friendly and professional manner.
`,
    },
  ],
};

async function writeTemplateFiles(
  templates: TemplateFile[],
  outputDir: string,
  context: TemplateContext,
): Promise<string[]> {
  const files: string[] = [];

  for (const template of templates) {
    const content = applyTemplate(template.content, context);
    const filePath = path.join(outputDir, template.path);

    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");
    files.push(template.path);
  }

  return files;
}

export async function scaffoldApp(options: ScaffoldOptions): Promise<{ files: string[] }> {
  const context = buildContext(options);
  const templates = TEMPLATES[options.type];

  if (!templates) {
    throw new Error(`Unknown app type: ${options.type}`);
  }

  // Create output directory
  await fs.mkdir(options.outputDir, { recursive: true });

  // Write template files
  const files = await writeTemplateFiles(templates, options.outputDir, context);

  return { files };
}

export function getAppTypeLabel(type: AppType): string {
  const labels: Record<AppType, string> = {
    channel: "Channel App",
    plugin: "Plugin App",
    skill: "Skill",
    agent: "Agent",
  };
  return labels[type];
}

export function getAppTypeDescription(type: AppType): string {
  const descriptions: Record<AppType, string> = {
    channel: "Connect a messaging platform (Telegram, Discord, etc.)",
    plugin: "Add tools and capabilities to the agent",
    skill: "In-process agent skill with tools",
    agent: "Agent template with system prompt and behavior",
  };
  return descriptions[type];
}
