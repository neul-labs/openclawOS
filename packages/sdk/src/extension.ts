/**
 * OpenClawOS Kernel Extension SDK
 *
 * Base classes for building kernel extensions.
 * Extensions run in-process with the kernel and can extend core functionality.
 */

import type { PackageManifest, HookName } from "@openclawos/protocol";

// =============================================================================
// Kernel Extension
// =============================================================================

/**
 * Kernel extension definition.
 *
 * Extensions can add gateway methods, LLM providers, and core hooks.
 * They run in-process with the kernel for deep integration.
 *
 * @example
 * ```typescript
 * export const otelExtension: KernelExtension = {
 *   manifest: {
 *     id: "@openclawos/otel",
 *     name: "OpenTelemetry",
 *     version: "1.0.0",
 *     type: "extension",
 *     main: "dist/index.js",
 *     protocol: { version: "1.0" },
 *     capabilities: {
 *       hooks: { subscribes: ["llm_input", "llm_output", "agent_end"] }
 *     }
 *   },
 *
 *   async setup(ctx) {
 *     this.tracer = trace.getTracer("openclawos");
 *   },
 *
 *   hooks: [
 *     {
 *       event: "llm_input",
 *       handler: async (data, ctx) => {
 *         // Create span for LLM call
 *       }
 *     }
 *   ]
 * };
 * ```
 */
export interface KernelExtension {
  /** Package manifest (type must be "extension") */
  manifest: PackageManifest;

  /**
   * Set up the extension.
   * Called once when the extension is loaded by the kernel.
   */
  setup?(ctx: ExtensionContext): Promise<void>;

  /**
   * Optional teardown when extension is unloaded.
   */
  teardown?(): Promise<void>;

  /**
   * Gateway methods to register.
   */
  gatewayMethods?: GatewayMethodDefinition[];

  /**
   * LLM providers to register.
   */
  providers?: ProviderDefinition[];

  /**
   * Core hooks to register.
   */
  hooks?: ExtensionHookDefinition[];
}

// =============================================================================
// Extension Context
// =============================================================================

/** Context provided to extensions during setup */
export interface ExtensionContext {
  /** Extension's data directory */
  dataDir: string;

  /** OpenClawOS configuration */
  config: unknown;

  /** Logger for the extension */
  logger: ExtensionLogger;

  /** Kernel services */
  kernel: KernelServices;
}

/** Services available to extensions */
export interface KernelServices {
  /** Get configuration value */
  getConfig(path?: string): unknown;

  /** Watch for config changes */
  watchConfig(paths: string[], callback: (changes: ConfigChange[]) => void): () => void;

  /** Get session */
  getSession(key: string): Promise<unknown>;

  /** List sessions */
  listSessions(filter?: unknown): Promise<unknown[]>;

  /** Emit a diagnostic event */
  emitDiagnostic(event: DiagnosticEvent): void;
}

export interface ConfigChange {
  path: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface DiagnosticEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp?: number;
}

// =============================================================================
// Gateway Methods
// =============================================================================

/** Gateway method definition */
export interface GatewayMethodDefinition {
  /** Method name (e.g., "otel.getTraces") */
  method: string;

  /** Method description */
  description?: string;

  /** Parameter schema (JSON Schema) */
  paramsSchema?: unknown;

  /** Result schema (JSON Schema) */
  resultSchema?: unknown;

  /** Handler function */
  handler: GatewayMethodHandler;
}

export type GatewayMethodHandler = (
  params: unknown,
  context: GatewayMethodContext,
) => Promise<unknown>;

export interface GatewayMethodContext {
  /** Client ID making the request */
  clientId: string;

  /** Request ID */
  requestId: string;

  /** Logger */
  logger: ExtensionLogger;
}

// =============================================================================
// LLM Providers
// =============================================================================

/** LLM provider definition */
export interface ProviderDefinition {
  /** Provider ID (e.g., "anthropic", "openai") */
  id: string;

  /** Display label */
  label: string;

  /** Provider aliases */
  aliases?: string[];

  /** Documentation path */
  docsPath?: string;

  /** Environment variables for this provider */
  envVars?: string[];

  /** Available models */
  models?: ModelDefinition[];

  /** Authentication methods */
  auth: ProviderAuthMethod[];

  /** Format API key from credential */
  formatApiKey?: (credential: unknown) => string;

  /** Refresh OAuth token */
  refreshOAuth?: (credential: unknown) => Promise<unknown>;
}

/** Model definition */
export interface ModelDefinition {
  /** Model ID */
  id: string;

  /** Display name */
  name: string;

  /** Context window size */
  contextWindow?: number;

  /** Maximum output tokens */
  maxOutput?: number;

  /** Whether model supports vision */
  vision?: boolean;

  /** Whether model supports tools */
  tools?: boolean;

  /** Cost per million input tokens (USD) */
  inputCostPerMillion?: number;

  /** Cost per million output tokens (USD) */
  outputCostPerMillion?: number;
}

/** Provider authentication method */
export interface ProviderAuthMethod {
  /** Auth method ID */
  id: string;

  /** Display label */
  label: string;

  /** Hint text */
  hint?: string;

  /** Auth type */
  kind: "oauth" | "api_key" | "token" | "device_code" | "custom";

  /** Run authentication flow */
  run: (ctx: ProviderAuthContext) => Promise<ProviderAuthResult>;
}

export interface ProviderAuthContext {
  /** Current config */
  config: unknown;

  /** Workspace directory */
  workspaceDir?: string;

  /** Whether running on remote server */
  isRemote: boolean;

  /** Open URL in browser */
  openUrl: (url: string) => Promise<void>;

  /** Logger */
  logger: ExtensionLogger;
}

export interface ProviderAuthResult {
  /** Created auth profiles */
  profiles: Array<{ profileId: string; credential: unknown }>;

  /** Config patches to apply */
  configPatch?: Record<string, unknown>;

  /** Default model to set */
  defaultModel?: string;

  /** Notes to display to user */
  notes?: string[];
}

// =============================================================================
// Extension Hooks
// =============================================================================

/** Extension hook definition */
export interface ExtensionHookDefinition {
  /** Hook event name */
  event: HookName;

  /** Hook handler */
  handler: ExtensionHookHandler;

  /** Priority (higher runs first) */
  priority?: number;
}

export type ExtensionHookHandler = (
  data: unknown,
  context: ExtensionHookContext,
) => void | Promise<unknown>;

export interface ExtensionHookContext {
  /** Event ID (for intercepting hooks) */
  eventId: string;

  /** Agent ID */
  agentId?: string;

  /** Session key */
  sessionKey?: string;

  /** Timestamp */
  timestamp: number;

  /** Logger */
  logger: ExtensionLogger;
}

// =============================================================================
// Extension Logger
// =============================================================================

export interface ExtensionLogger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

// =============================================================================
// Extension Builder
// =============================================================================

/**
 * Builder for creating kernel extensions with a fluent API.
 *
 * @example
 * ```typescript
 * const extension = new ExtensionBuilder("@myorg/my-extension")
 *   .name("My Extension")
 *   .version("1.0.0")
 *   .gatewayMethod("myext.hello", async (params) => {
 *     return { message: "Hello!" };
 *   })
 *   .hook("llm_output", async (data, ctx) => {
 *     console.log("LLM output:", data);
 *   })
 *   .build();
 * ```
 */
export class ExtensionBuilder {
  private _manifest: Partial<PackageManifest> = {
    type: "extension",
    protocol: { version: "1.0" },
    capabilities: {},
  };
  private _gatewayMethods: GatewayMethodDefinition[] = [];
  private _providers: ProviderDefinition[] = [];
  private _hooks: ExtensionHookDefinition[] = [];
  private _setup?: (ctx: ExtensionContext) => Promise<void>;
  private _teardown?: () => Promise<void>;

  constructor(id: string) {
    this._manifest.id = id;
  }

  /** Set the extension name */
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

  /** Set the main entry point */
  main(main: string): this {
    this._manifest.main = main;
    return this;
  }

  /** Add a gateway method */
  gatewayMethod(
    method: string,
    handler: GatewayMethodHandler,
    options?: { description?: string; paramsSchema?: unknown; resultSchema?: unknown },
  ): this {
    this._gatewayMethods.push({
      method,
      handler,
      ...options,
    });
    return this;
  }

  /** Add a provider */
  provider(provider: ProviderDefinition): this {
    this._providers.push(provider);
    return this;
  }

  /** Add a hook */
  hook(event: HookName, handler: ExtensionHookHandler, priority?: number): this {
    this._hooks.push({ event, handler, priority });
    return this;
  }

  /** Set setup function */
  onSetup(fn: (ctx: ExtensionContext) => Promise<void>): this {
    this._setup = fn;
    return this;
  }

  /** Set teardown function */
  onTeardown(fn: () => Promise<void>): this {
    this._teardown = fn;
    return this;
  }

  /** Build the extension */
  build(): KernelExtension {
    const manifest = this._manifest as PackageManifest;

    // Set capabilities
    manifest.capabilities = {
      gateway:
        this._gatewayMethods.length > 0
          ? { methods: this._gatewayMethods.map((m) => m.method) }
          : undefined,
      providers:
        this._providers.length > 0 ? { provides: this._providers.map((p) => p.id) } : undefined,
      hooks: this._hooks.length > 0 ? { subscribes: this._hooks.map((h) => h.event) } : undefined,
    };

    return {
      manifest,
      setup: this._setup,
      teardown: this._teardown,
      gatewayMethods: this._gatewayMethods,
      providers: this._providers,
      hooks: this._hooks,
    };
  }
}

// =============================================================================
// Helpers
// =============================================================================

/** Define a kernel extension */
export function defineExtension(
  id: string,
  config: (builder: ExtensionBuilder) => ExtensionBuilder,
): KernelExtension {
  const builder = new ExtensionBuilder(id);
  return config(builder).build();
}
