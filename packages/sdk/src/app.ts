/**
 * OpenClawOS Application Base Classes
 *
 * Base classes for building process-isolated applications.
 */

import type { PackageManifest, HookName } from "@openclawos/protocol";
import { KernelClient, createKernelClient, type KernelClientOptions } from "./client.js";

// =============================================================================
// Base Application
// =============================================================================

/**
 * Base class for all OpenClawOS applications.
 *
 * @example
 * ```typescript
 * class MyApp extends OpenClawApp {
 *   manifest = {
 *     id: "@myorg/my-app",
 *     name: "My App",
 *     version: "1.0.0",
 *     type: "app",
 *     main: "dist/index.js",
 *     protocol: { version: "1.0" },
 *     capabilities: {}
 *   };
 *
 *   protected async setup(): Promise<void> {
 *     // Register capabilities
 *     await this.registerTool({ name: "my_tool", ... });
 *     await this.onHook("message_received", this.handleMessage.bind(this));
 *   }
 *
 *   private async handleMessage(data: unknown): Promise<void> {
 *     console.log("Received message:", data);
 *   }
 * }
 *
 * const app = new MyApp();
 * await app.start();
 * ```
 */
export abstract class OpenClawApp {
  /** Package manifest */
  abstract readonly manifest: PackageManifest;

  /** Kernel client */
  protected kernel: KernelClient;

  /** Logger */
  protected log: AppLogger;

  /** Whether the app is running */
  private running = false;

  constructor(options?: KernelClientOptions) {
    this.kernel = createKernelClient(options);
    this.log = createAppLogger(this.constructor.name);

    // Handle process signals
    process.on("SIGTERM", () => this.stop("SIGTERM"));
    process.on("SIGINT", () => this.stop("SIGINT"));
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /** Start the application */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.log.info(`Starting ${this.manifest.name} v${this.manifest.version}...`);

    try {
      // Connect to kernel
      await this.kernel.connect();
      this.log.debug("Connected to kernel");

      // Register with manifest
      const result = await this.kernel.register(this.manifest);
      this.log.debug(`Registered as ${result.appId}`);

      // Run app-specific setup
      await this.setup();

      // Signal ready
      await this.kernel.ready();
      this.running = true;
      this.log.info(`${this.manifest.name} is ready`);

      // Start heartbeat
      this.startHeartbeat();
    } catch (error) {
      this.log.error("Failed to start:", error);
      throw error;
    }
  }

  /** Stop the application */
  async stop(reason?: string): Promise<void> {
    if (!this.running) {
      return;
    }

    this.log.info(`Stopping ${this.manifest.name}...`, reason ? `(${reason})` : "");
    this.running = false;

    try {
      // Run app-specific teardown
      await this.teardown?.();

      // Notify kernel
      await this.kernel.shutdown(reason);

      // Disconnect
      await this.kernel.disconnect();

      this.log.info(`${this.manifest.name} stopped`);
    } catch (error) {
      this.log.error("Error during shutdown:", error);
    }

    process.exit(0);
  }

  /** Override to set up the application */
  protected abstract setup(): Promise<void>;

  /** Override to tear down the application */
  protected teardown?(): Promise<void>;

  // ===========================================================================
  // Capability Registration Helpers
  // ===========================================================================

  /** Register a channel */
  protected async registerChannel(config: ChannelConfig): Promise<string> {
    const result = await this.kernel.registerCapability("channel", {
      channelId: config.id,
      // Keep legacy key for compatibility with older kernels.
      id: config.id,
      meta: config.meta,
    });
    if (!result.granted) {
      throw new Error(`Channel registration denied: ${result.capabilityId}`);
    }
    return result.capabilityId;
  }

  /** Register a tool */
  protected async registerTool(tool: ToolDefinition): Promise<string> {
    const result = await this.kernel.registerCapability("tool", {
      toolId: tool.name,
      // Keep legacy keys for compatibility with older kernels.
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    });
    if (!result.granted) {
      throw new Error(`Tool registration denied: ${tool.name}`);
    }
    return result.capabilityId;
  }

  /** Register a gateway method */
  protected async registerGatewayMethod(
    method: string,
    handler: GatewayMethodHandler,
  ): Promise<string> {
    // Store handler locally
    this.gatewayMethodHandlers.set(method, handler);

    const result = await this.kernel.registerCapability("gateway_method", {
      methodName: method,
      // Keep legacy key for compatibility with older kernels.
      method,
    });
    if (!result.granted) {
      throw new Error(`Gateway method registration denied: ${method}`);
    }
    return result.capabilityId;
  }

  /** Register an HTTP route */
  protected async registerHttpRoute(path: string, handler: HttpRouteHandler): Promise<string> {
    // Store handler locally
    this.httpRouteHandlers.set(path, handler);

    const result = await this.kernel.registerCapability("http_route", {
      route: path,
      // Keep legacy key for compatibility with older kernels.
      path,
    });
    if (!result.granted) {
      throw new Error(`HTTP route registration denied: ${path}`);
    }
    return result.capabilityId;
  }

  // ===========================================================================
  // Hook Helpers
  // ===========================================================================

  /** Subscribe to a hook event */
  protected async onHook<T = unknown>(hookName: HookName, handler: HookHandler<T>): Promise<void> {
    await this.kernel.subscribeHooks([hookName]);
    this.kernel.onHook(hookName, handler);
  }

  // ===========================================================================
  // Internal
  // ===========================================================================

  private gatewayMethodHandlers = new Map<string, GatewayMethodHandler>();
  private httpRouteHandlers = new Map<string, HttpRouteHandler>();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.kernel.heartbeat({ status: "healthy" });
      } catch (error) {
        this.log.warn("Heartbeat failed:", error);
      }
    }, 30000); // Every 30 seconds
  }
}

// =============================================================================
// Channel Application
// =============================================================================

/**
 * Base class for channel applications (Telegram, Discord, etc.)
 *
 * @example
 * ```typescript
 * class TelegramApp extends ChannelApp {
 *   channelId = "telegram";
 *   manifest = { ... };
 *
 *   protected async setup(): Promise<void> {
 *     // Set up Telegram bot
 *     this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
 *     this.bot.on("message", this.handleInbound.bind(this));
 *   }
 *
 *   protected async handleInbound(event: MessageReceivedEvent): Promise<void> {
 *     // Forward message to kernel
 *     await this.kernel.queueAgent(sessionKey, event.text);
 *   }
 *
 *   protected async sendMessage(params: SendMessageParams): Promise<void> {
 *     await this.bot.sendMessage(params.chatId, params.content);
 *   }
 * }
 * ```
 */
export abstract class ChannelApp extends OpenClawApp {
  /** Channel identifier */
  protected abstract readonly channelId: string;

  /** Handle inbound messages from the channel */
  protected abstract handleInbound(event: MessageReceivedEvent): Promise<void>;

  /** Send a message to the channel */
  protected abstract sendMessage(params: SendMessageParams): Promise<void>;

  protected async setup(): Promise<void> {
    // Register channel capability
    await this.registerChannel({
      id: this.channelId,
      meta: this.getChannelMeta(),
    });

    // Subscribe to outbound message hook
    await this.onHook("message_sending", async (event: MessageSendingEvent) => {
      if (event.channelId === this.channelId) {
        await this.sendMessage({
          target: event.target,
          content: event.content,
          metadata: event.metadata,
        });
      }
    });

    // Run channel-specific setup
    await this.setupChannel();
  }

  /** Override for channel-specific setup */
  protected async setupChannel(): Promise<void> {
    // Default: no-op
  }

  /** Override to provide channel metadata */
  protected getChannelMeta(): ChannelMeta {
    return {
      name: this.manifest.name,
      icon: this.manifest.icon,
    };
  }

  /** Helper to dispatch inbound message to kernel */
  protected async dispatchInbound(
    from: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const sessionKey = this.buildSessionKey(from);
    await this.kernel.queueAgent(sessionKey, content, {
      channelId: this.channelId,
      from,
      ...metadata,
    });
  }

  /** Build a session key for a conversation */
  protected buildSessionKey(conversationId: string): string {
    return `${this.channelId}:${conversationId}`;
  }
}

// =============================================================================
// Types
// =============================================================================

export interface AppLogger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface ChannelConfig {
  id: string;
  meta?: ChannelMeta;
}

export interface ChannelMeta {
  name?: string;
  icon?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters?: unknown;
  handler: (params: unknown) => Promise<unknown>;
}

export type GatewayMethodHandler = (params: unknown) => Promise<unknown>;

export type HttpRouteHandler = (req: unknown, res: unknown) => Promise<void>;

export type HookHandler<T> = (data: T, context: unknown) => void | Promise<unknown>;

export interface MessageReceivedEvent {
  from: string;
  content: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface MessageSendingEvent {
  channelId: string;
  target: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SendMessageParams {
  target: string;
  content: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Helpers
// =============================================================================

function createAppLogger(name: string): AppLogger {
  const prefix = `[${name}]`;
  return {
    debug: (...args) => console.debug(prefix, ...args),
    info: (...args) => console.info(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
  };
}
