/**
 * OpenClawOS Skill SDK
 *
 * Base classes for building in-process skills (agent tools).
 * Skills are loaded directly by the agent runtime for low-latency tool execution.
 */

import type { PackageManifest } from "@openclawos/protocol";

// =============================================================================
// Skill Base Class
// =============================================================================

/**
 * Base class for OpenClawOS skills.
 *
 * Skills provide tools and capabilities to agents. Unlike apps, skills run
 * in-process with the agent runtime for low-latency tool execution.
 *
 * @example
 * ```typescript
 * class MemorySkill extends OpenClawSkill {
 *   manifest = {
 *     id: "@openclawos/memory",
 *     name: "Memory Skill",
 *     version: "1.0.0",
 *     type: "skill",
 *     main: "dist/index.js",
 *     protocol: { version: "1.0" },
 *     capabilities: {
 *       tools: { provides: ["memory_search", "memory_store"] }
 *     }
 *   };
 *
 *   async setup(ctx: SkillContext): Promise<void> {
 *     this.db = await initDatabase(ctx.dataDir);
 *   }
 *
 *   getTools(): SkillTool[] {
 *     return [
 *       {
 *         name: "memory_search",
 *         description: "Search stored memories",
 *         parameters: { query: { type: "string" } },
 *         execute: this.search.bind(this)
 *       },
 *       {
 *         name: "memory_store",
 *         description: "Store a memory",
 *         parameters: { content: { type: "string" } },
 *         execute: this.store.bind(this)
 *       }
 *     ];
 *   }
 * }
 * ```
 */
export abstract class OpenClawSkill {
  /** Package manifest */
  abstract readonly manifest: PackageManifest;

  /**
   * Set up the skill.
   * Called once when the skill is loaded by the agent runtime.
   */
  abstract setup(ctx: SkillContext): Promise<void>;

  /**
   * Get the tools provided by this skill.
   * Called after setup to register tools with the agent.
   */
  abstract getTools(): SkillTool[];

  /**
   * Optional teardown when skill is unloaded.
   */
  teardown?(): Promise<void>;
}

// =============================================================================
// Skill Context
// =============================================================================

/** Context provided to skills during setup */
export interface SkillContext {
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

// =============================================================================
// Skill Tool
// =============================================================================

/** Tool definition for a skill */
export interface SkillTool {
  /** Tool name (unique identifier) */
  name: string;

  /** Human-readable description */
  description: string;

  /** JSON Schema for parameters */
  parameters?: ToolParameters;

  /** Tool execution function */
  execute: ToolExecutor;

  /** Optional: whether tool requires confirmation */
  requiresConfirmation?: boolean;

  /** Optional: tool category for organization */
  category?: string;
}

/** Tool parameters schema (JSON Schema subset) */
export interface ToolParameters {
  type?: "object";
  properties?: Record<string, ToolParameterProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export type ToolParameterProperty =
  | { type: "string"; description?: string; enum?: string[]; default?: string }
  | { type: "number"; description?: string; minimum?: number; maximum?: number; default?: number }
  | { type: "integer"; description?: string; minimum?: number; maximum?: number; default?: number }
  | { type: "boolean"; description?: string; default?: boolean }
  | { type: "array"; description?: string; items: ToolParameterProperty }
  | { type: "object"; description?: string; properties?: Record<string, ToolParameterProperty> };

/** Tool execution function */
export type ToolExecutor = (
  params: Record<string, unknown>,
  context: ToolContext,
) => Promise<ToolResult>;

/** Context passed to tool execution */
export interface ToolContext {
  /** Current agent ID */
  agentId?: string;

  /** Current session key */
  sessionKey?: string;

  /** Workspace directory */
  workspaceDir?: string;

  /** Whether running in sandbox */
  sandboxed?: boolean;

  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/** Result from tool execution */
export type ToolResult = { success: true; output: unknown } | { success: false; error: string };

// =============================================================================
// Skill Logger
// =============================================================================

export interface SkillLogger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

// =============================================================================
// Skill Utilities
// =============================================================================

/** Create a successful tool result */
export function toolSuccess(output: unknown): ToolResult {
  return { success: true, output };
}

/** Create a failed tool result */
export function toolError(error: string): ToolResult {
  return { success: false, error };
}

/** Validate tool parameters against schema */
export function validateToolParams(
  params: Record<string, unknown>,
  schema: ToolParameters,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (schema.required) {
    for (const key of schema.required) {
      if (!(key in params)) {
        errors.push(`Missing required parameter: ${key}`);
      }
    }
  }

  // Basic type validation
  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (key in params) {
        const value = params[key];
        const propType = (prop as { type?: string }).type;

        if (propType === "string" && typeof value !== "string") {
          errors.push(`Parameter ${key} must be a string`);
        } else if (propType === "number" && typeof value !== "number") {
          errors.push(`Parameter ${key} must be a number`);
        } else if (propType === "integer" && !Number.isInteger(value)) {
          errors.push(`Parameter ${key} must be an integer`);
        } else if (propType === "boolean" && typeof value !== "boolean") {
          errors.push(`Parameter ${key} must be a boolean`);
        } else if (propType === "array" && !Array.isArray(value)) {
          errors.push(`Parameter ${key} must be an array`);
        } else if (propType === "object" && (typeof value !== "object" || value === null)) {
          errors.push(`Parameter ${key} must be an object`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
