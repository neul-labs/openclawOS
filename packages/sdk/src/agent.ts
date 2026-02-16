/**
 * OpenClawOS Agent Template SDK
 *
 * Base classes for building agent templates (personas).
 * Agent templates define pre-configured agent personalities without code.
 */

import type { PackageManifest, AgentCapabilities } from "@openclawos/protocol";

// =============================================================================
// Agent Template
// =============================================================================

/**
 * Agent template definition.
 *
 * Agent templates define pre-configured personas that users can install.
 * They specify system prompts, enabled skills, model preferences, and behavior.
 *
 * @example
 * ```typescript
 * export const coderAgent: AgentTemplate = {
 *   manifest: {
 *     id: "@openclawos/agent-coder",
 *     name: "Coder Agent",
 *     version: "1.0.0",
 *     type: "agent",
 *     protocol: { version: "1.0" },
 *     capabilities: {
 *       agent: {
 *         systemPrompt: "You are a senior software engineer...",
 *         skills: ["coding-agent", "canvas"],
 *         model: { default: "claude-opus-4-5" },
 *         behavior: { sandboxed: true, memoryEnabled: true }
 *       }
 *     },
 *     dependencies: { skills: ["coding-agent", "canvas"] }
 *   },
 *
 *   getSystemPrompt: () => coderSystemPrompt,
 *
 *   getDefaultConfig: () => ({
 *     skills: ["coding-agent", "canvas"],
 *     model: "claude-opus-4-5",
 *     sandboxed: true
 *   })
 * };
 * ```
 */
export interface AgentTemplate {
  /** Package manifest (type must be "agent") */
  manifest: PackageManifest;

  /**
   * Get the system prompt for this agent.
   * Can be async to load from file or remote.
   */
  getSystemPrompt(): string | Promise<string>;

  /**
   * Get default configuration to merge with user's agent config.
   */
  getDefaultConfig(): Partial<AgentConfig>;

  /**
   * Optional: Validate custom configuration.
   */
  validateConfig?(config: unknown): AgentConfigValidation;

  /**
   * Optional: Transform user config before applying.
   */
  transformConfig?(config: AgentConfig): AgentConfig;
}

// =============================================================================
// Agent Configuration
// =============================================================================

/** Agent configuration (subset that templates can influence) */
export interface AgentConfig {
  /** Agent name */
  name?: string;

  /** System prompt */
  systemPrompt?: string;

  /** Enabled skills */
  skills?: string[];

  /** Default model */
  model?: string;

  /** Fallback models */
  fallbackModels?: string[];

  /** Whether to run in sandbox */
  sandboxed?: boolean;

  /** Whether memory is enabled */
  memoryEnabled?: boolean;

  /** Compaction strategy */
  compaction?: "aggressive" | "balanced" | "minimal";

  /** Maximum conversation turns */
  maxTurns?: number;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/** Result of config validation */
export interface AgentConfigValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// =============================================================================
// Agent Template Builder
// =============================================================================

/**
 * Builder for creating agent templates with a fluent API.
 *
 * @example
 * ```typescript
 * const template = new AgentTemplateBuilder("@myorg/agent-writer")
 *   .name("Writer Agent")
 *   .version("1.0.0")
 *   .description("A creative writing assistant")
 *   .systemPrompt("You are a creative writer...")
 *   .skills(["canvas"])
 *   .model("claude-opus-4-5")
 *   .behavior({ memoryEnabled: true })
 *   .build();
 * ```
 */
export class AgentTemplateBuilder {
  private _manifest: Partial<PackageManifest> = {
    type: "agent",
    protocol: { version: "1.0" },
    capabilities: {},
  };
  private _systemPrompt = "";
  private _config: Partial<AgentConfig> = {};

  constructor(id: string) {
    this._manifest.id = id;
  }

  /** Set the agent name */
  name(name: string): this {
    this._manifest.name = name;
    return this;
  }

  /** Set the version */
  version(version: string): this {
    this._manifest.version = version;
    return this;
  }

  /** Set the description */
  description(description: string): this {
    this._manifest.description = description;
    return this;
  }

  /** Set the author */
  author(author: string): this {
    this._manifest.author = author;
    return this;
  }

  /** Set the icon URL */
  icon(icon: string): this {
    this._manifest.icon = icon;
    return this;
  }

  /** Add tags */
  tags(...tags: string[]): this {
    this._manifest.tags = [...(this._manifest.tags || []), ...tags];
    return this;
  }

  /** Set the system prompt */
  systemPrompt(prompt: string): this {
    this._systemPrompt = prompt;
    return this;
  }

  /** Set enabled skills */
  skills(skills: string[]): this {
    this._config.skills = skills;
    this._manifest.dependencies = {
      ...this._manifest.dependencies,
      skills,
    };
    return this;
  }

  /** Set the default model */
  model(model: string, fallbacks?: string[]): this {
    this._config.model = model;
    if (fallbacks) {
      this._config.fallbackModels = fallbacks;
    }
    return this;
  }

  /** Set behavior options */
  behavior(behavior: {
    sandboxed?: boolean;
    memoryEnabled?: boolean;
    compaction?: "aggressive" | "balanced" | "minimal";
    maxTurns?: number;
  }): this {
    Object.assign(this._config, behavior);
    return this;
  }

  /** Build the agent template */
  build(): AgentTemplate {
    const manifest = this._manifest as PackageManifest;
    const systemPrompt = this._systemPrompt;
    const config = this._config;

    // Set agent capabilities
    manifest.capabilities = {
      agent: {
        systemPrompt,
        skills: config.skills,
        model: config.model
          ? { default: config.model, fallback: config.fallbackModels }
          : undefined,
        behavior: {
          sandboxed: config.sandboxed,
          memoryEnabled: config.memoryEnabled,
          compaction: config.compaction,
          maxTurns: config.maxTurns,
        },
      },
    };

    return {
      manifest,
      getSystemPrompt: () => systemPrompt,
      getDefaultConfig: () => config,
    };
  }
}

// =============================================================================
// Helpers
// =============================================================================

/** Create an agent template from a simple config */
export function defineAgent(config: {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  icon?: string;
  tags?: string[];
  systemPrompt: string;
  skills?: string[];
  model?: string;
  fallbackModels?: string[];
  sandboxed?: boolean;
  memoryEnabled?: boolean;
  compaction?: "aggressive" | "balanced" | "minimal";
  maxTurns?: number;
}): AgentTemplate {
  const builder = new AgentTemplateBuilder(config.id)
    .name(config.name)
    .version(config.version)
    .systemPrompt(config.systemPrompt);

  if (config.description) {
    builder.description(config.description);
  }
  if (config.author) {
    builder.author(config.author);
  }
  if (config.icon) {
    builder.icon(config.icon);
  }
  if (config.tags) {
    builder.tags(...config.tags);
  }
  if (config.skills) {
    builder.skills(config.skills);
  }
  if (config.model) {
    builder.model(config.model, config.fallbackModels);
  }

  builder.behavior({
    sandboxed: config.sandboxed,
    memoryEnabled: config.memoryEnabled,
    compaction: config.compaction,
    maxTurns: config.maxTurns,
  });

  return builder.build();
}

/** Load system prompt from a file (for use in templates) */
export async function loadPromptFile(path: string): Promise<string> {
  const fs = await import("node:fs/promises");
  return await fs.readFile(path, "utf-8");
}
