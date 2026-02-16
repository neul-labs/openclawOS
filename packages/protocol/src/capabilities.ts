/**
 * OpenClawOS Package Capabilities
 *
 * Defines what packages can provide and require.
 */

// =============================================================================
// Package Capabilities
// =============================================================================

export interface PackageCapabilities {
  /** Channel capabilities (for Apps) */
  channels?: ChannelCapabilities;

  /** Tool capabilities */
  tools?: ToolCapabilities;

  /** Hook capabilities */
  hooks?: HookCapabilities;

  /** Gateway capabilities (for Apps/Extensions) */
  gateway?: GatewayCapabilities;

  /** Provider capabilities (for Extensions) */
  providers?: ProviderCapabilities;

  /** Agent capabilities (for Agent Templates) */
  agent?: AgentCapabilities;

  /** Resource requirements */
  resources?: ResourceCapabilities;

  /** Security settings */
  security?: SecurityCapabilities;
}

// =============================================================================
// Channel Capabilities
// =============================================================================

export interface ChannelCapabilities {
  /** Channels this package implements */
  provides?: string[];
  /** Channels required from other packages */
  requires?: string[];
}

// =============================================================================
// Tool Capabilities
// =============================================================================

export interface ToolCapabilities {
  /** Tools this package provides */
  provides?: string[];
  /** Tools required from other packages */
  requires?: string[];
}

// =============================================================================
// Hook Capabilities
// =============================================================================

export interface HookCapabilities {
  /** Hook events to receive (read-only observation) */
  subscribes?: HookName[];
  /** Hooks that can modify/block behavior */
  intercepts?: InterceptingHookName[];
}

/** All hook event names */
export type HookName =
  | "before_agent_start"
  | "llm_input"
  | "llm_output"
  | "agent_end"
  | "before_compaction"
  | "after_compaction"
  | "before_reset"
  | "message_received"
  | "message_sending"
  | "message_sent"
  | "before_tool_call"
  | "after_tool_call"
  | "tool_result_persist"
  | "session_start"
  | "session_end"
  | "gateway_start"
  | "gateway_stop";

/** Hooks that can intercept and modify behavior */
export type InterceptingHookName =
  | "before_agent_start"
  | "message_sending"
  | "before_tool_call"
  | "tool_result_persist";

// =============================================================================
// Gateway Capabilities
// =============================================================================

export interface GatewayCapabilities {
  /** Gateway methods to register */
  methods?: string[];
  /** HTTP routes to handle (glob patterns) */
  httpRoutes?: string[];
}

// =============================================================================
// Provider Capabilities
// =============================================================================

export interface ProviderCapabilities {
  /** LLM providers this package implements */
  provides?: string[];
  /** Specific models provided */
  models?: string[];
}

// =============================================================================
// Agent Capabilities (for Agent Templates)
// =============================================================================

export interface AgentCapabilities {
  /** Base system prompt (inline) */
  systemPrompt?: string;
  /** System prompt file reference */
  systemPromptFile?: string;
  /** Skills to enable */
  skills?: string[];
  /** Model preferences */
  model?: AgentModelConfig;
  /** Behavioral settings */
  behavior?: AgentBehaviorConfig;
}

export interface AgentModelConfig {
  /** Default model to use */
  default?: string;
  /** Fallback models in order of preference */
  fallback?: string[];
}

export interface AgentBehaviorConfig {
  /** Compaction strategy */
  compaction?: "aggressive" | "balanced" | "minimal";
  /** Whether memory is enabled */
  memoryEnabled?: boolean;
  /** Whether to run in sandbox */
  sandboxed?: boolean;
  /** Maximum conversation turns */
  maxTurns?: number;
}

// =============================================================================
// Resource Capabilities
// =============================================================================

export interface ResourceCapabilities {
  /** Required environment variables */
  env?: string[];
  /** File system access */
  fs?: FileSystemCapabilities;
  /** Network access */
  network?: NetworkCapabilities;
}

export interface FileSystemCapabilities {
  /** Paths with read access (glob patterns) */
  read?: string[];
  /** Paths with write access (glob patterns) */
  write?: string[];
}

export interface NetworkCapabilities {
  /** Allowed hosts (glob patterns) */
  hosts?: string[];
}

// =============================================================================
// Security Capabilities
// =============================================================================

export interface SecurityCapabilities {
  /** Whether to run in sandbox */
  sandboxed?: boolean;
  /** Trust level */
  trustLevel?: TrustLevel;
}

export type TrustLevel =
  | "core" // Built-in packages, full access
  | "verified" // Signed packages from registry
  | "community" // Community packages
  | "untrusted"; // Sandboxed, minimal permissions

// =============================================================================
// Capability Validation
// =============================================================================

export interface CapabilityGrant {
  /** Package ID this grant belongs to */
  packageId: string;
  /** Capability type */
  capability: CapabilityType;
  /** When the capability was granted */
  grantedAt: number;
  /** How the capability was granted */
  grantedBy: "manifest" | "user" | "auto";
}

export type CapabilityType =
  | { type: "channel"; id: string }
  | { type: "tool"; name: string }
  | { type: "hook"; event: string; intercept: boolean }
  | { type: "gateway_method"; method: string }
  | { type: "http_route"; pattern: string }
  | { type: "provider"; id: string }
  | { type: "fs_read"; path: string }
  | { type: "fs_write"; path: string }
  | { type: "network"; host: string }
  | { type: "env"; name: string };

// =============================================================================
// Capability Helpers
// =============================================================================

/** Check if a hook can intercept (modify/block) */
export function isInterceptingHook(hook: HookName): hook is InterceptingHookName {
  const intercepting: Set<string> = new Set([
    "before_agent_start",
    "message_sending",
    "before_tool_call",
    "tool_result_persist",
  ]);
  return intercepting.has(hook);
}

/** Extract all required capabilities from a package */
export function extractRequiredCapabilities(capabilities: PackageCapabilities): CapabilityType[] {
  const required: CapabilityType[] = [];

  if (capabilities.channels?.requires) {
    for (const id of capabilities.channels.requires) {
      required.push({ type: "channel", id });
    }
  }

  if (capabilities.tools?.requires) {
    for (const name of capabilities.tools.requires) {
      required.push({ type: "tool", name });
    }
  }

  if (capabilities.resources?.env) {
    for (const name of capabilities.resources.env) {
      required.push({ type: "env", name });
    }
  }

  if (capabilities.resources?.fs?.read) {
    for (const path of capabilities.resources.fs.read) {
      required.push({ type: "fs_read", path });
    }
  }

  if (capabilities.resources?.fs?.write) {
    for (const path of capabilities.resources.fs.write) {
      required.push({ type: "fs_write", path });
    }
  }

  if (capabilities.resources?.network?.hosts) {
    for (const host of capabilities.resources.network.hosts) {
      required.push({ type: "network", host });
    }
  }

  return required;
}

/** Extract all provided capabilities from a package */
export function extractProvidedCapabilities(capabilities: PackageCapabilities): CapabilityType[] {
  const provided: CapabilityType[] = [];

  if (capabilities.channels?.provides) {
    for (const id of capabilities.channels.provides) {
      provided.push({ type: "channel", id });
    }
  }

  if (capabilities.tools?.provides) {
    for (const name of capabilities.tools.provides) {
      provided.push({ type: "tool", name });
    }
  }

  if (capabilities.hooks?.subscribes) {
    for (const event of capabilities.hooks.subscribes) {
      provided.push({ type: "hook", event, intercept: false });
    }
  }

  if (capabilities.hooks?.intercepts) {
    for (const event of capabilities.hooks.intercepts) {
      provided.push({ type: "hook", event, intercept: true });
    }
  }

  if (capabilities.gateway?.methods) {
    for (const method of capabilities.gateway.methods) {
      provided.push({ type: "gateway_method", method });
    }
  }

  if (capabilities.gateway?.httpRoutes) {
    for (const pattern of capabilities.gateway.httpRoutes) {
      provided.push({ type: "http_route", pattern });
    }
  }

  if (capabilities.providers?.provides) {
    for (const id of capabilities.providers.provides) {
      provided.push({ type: "provider", id });
    }
  }

  return provided;
}
