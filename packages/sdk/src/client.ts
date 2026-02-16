/**
 * OpenClawOS Kernel Client
 *
 * IPC client for communicating with the kernel from applications.
 */

import type {
  IPCRequest,
  IPCEvent,
  IPCMessage,
  IPCMethodName,
  MethodParams,
  MethodResult,
  IPCErrorCode,
  PackageManifest,
  AppRegisterResult,
} from "@openclawos/protocol";
import { EventEmitter } from "node:events";
import net from "node:net";

// =============================================================================
// Client Options
// =============================================================================

export interface KernelClientOptions {
  /** Unix socket path to connect to */
  socketPath?: string;
  /** Connection timeout in ms */
  connectTimeout?: number;
  /** Request timeout in ms */
  requestTimeout?: number;
  /** Whether to auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect delay in ms */
  reconnectDelay?: number;
  /** Maximum reconnect attempts */
  maxReconnectAttempts?: number;
}

const DEFAULT_OPTIONS: Required<KernelClientOptions> = {
  socketPath: process.env.OPENCLAW_KERNEL_SOCKET || "/tmp/openclawos/kernel.sock",
  connectTimeout: 5000,
  requestTimeout: 30000,
  autoReconnect: true,
  reconnectDelay: 1000,
  maxReconnectAttempts: 10,
};

// =============================================================================
// Client Events
// =============================================================================

export interface KernelClientEvents {
  connected: [];
  disconnected: [reason: string];
  error: [error: Error];
  event: [event: IPCEvent];
  reconnecting: [attempt: number];
}

// =============================================================================
// Kernel Client
// =============================================================================

export class KernelClient extends EventEmitter<KernelClientEvents> {
  private options: Required<KernelClientOptions>;
  private socket: net.Socket | null = null;
  private buffer = "";
  private pendingRequests = new Map<string, PendingRequest>();
  private connected = false;
  private registered = false;
  private appId: string | null = null;
  private token: string | null = null;
  private reconnectAttempts = 0;

  constructor(options: KernelClientOptions = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  /** Connect to the kernel */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Connection timeout after ${this.options.connectTimeout}ms`));
      }, this.options.connectTimeout);

      this.socket = new net.Socket();

      this.socket.on("connect", () => {
        clearTimeout(timer);
        this.connected = true;
        this.reconnectAttempts = 0;
        this.emit("connected");
        resolve();
      });

      this.socket.on("error", (err) => {
        clearTimeout(timer);
        this.emit("error", err);
        if (!this.connected) {
          reject(err);
        }
      });

      this.socket.on("close", () => {
        this.handleDisconnect("Socket closed");
      });

      this.socket.on("data", (data) => {
        this.handleData(Buffer.isBuffer(data) ? data : Buffer.from(data));
      });

      this.socket.connect(this.options.socketPath);
    });
  }

  /** Disconnect from the kernel */
  async disconnect(): Promise<void> {
    if (!this.socket) {
      return;
    }

    return new Promise((resolve) => {
      if (this.socket) {
        this.socket.once("close", () => {
          resolve();
        });
        this.socket.end();
      } else {
        resolve();
      }
    });
  }

  /** Check if connected */
  isConnected(): boolean {
    return this.connected;
  }

  /** Check if registered */
  isRegistered(): boolean {
    return this.registered;
  }

  // ===========================================================================
  // App Lifecycle
  // ===========================================================================

  /** Register this app with the kernel */
  async register(manifest: PackageManifest): Promise<AppRegisterResult> {
    const result = await this.call("app.register", { manifest });
    this.appId = result.appId;
    this.token = result.token;
    this.registered = true;
    return result;
  }

  /** Signal that this app is ready to receive traffic */
  async ready(metadata?: Record<string, unknown>): Promise<void> {
    await this.call("app.ready", { metadata });
  }

  /** Send heartbeat */
  async heartbeat(status?: Record<string, unknown>): Promise<void> {
    await this.call("app.heartbeat", { status });
  }

  /** Request graceful shutdown */
  async shutdown(reason?: string): Promise<void> {
    await this.call("app.shutdown", { reason });
  }

  // ===========================================================================
  // Capability Registration
  // ===========================================================================

  /** Register a capability */
  async registerCapability(
    type: "channel" | "tool" | "hook" | "gateway_method" | "http_route" | "provider",
    config: unknown,
  ): Promise<{ capabilityId: string; granted: boolean }> {
    return await this.call("capability.register", { type, config });
  }

  /** Unregister a capability */
  async unregisterCapability(capabilityId: string): Promise<void> {
    await this.call("capability.unregister", { capabilityId });
  }

  // ===========================================================================
  // Hook System
  // ===========================================================================

  /** Subscribe to hook events */
  async subscribeHooks(events: string[]): Promise<{ subscribed: string[]; denied: string[] }> {
    return await this.call("hook.subscribe", { events });
  }

  /** Unsubscribe from hook events */
  async unsubscribeHooks(events: string[]): Promise<void> {
    await this.call("hook.unsubscribe", { events });
  }

  /** Return result for an intercepting hook */
  async sendHookResult(eventId: string, result: unknown): Promise<void> {
    await this.call("hook.result", { eventId, result });
  }

  // ===========================================================================
  // Config & Sessions
  // ===========================================================================

  /** Get configuration */
  async getConfig(path?: string): Promise<unknown> {
    const result = await this.call("config.get", { path });
    return result.value;
  }

  /** Get a session */
  async getSession(key: string): Promise<unknown> {
    const result = await this.call("session.get", { key });
    return result.session;
  }

  /** List sessions */
  async listSessions(filter?: {
    agentId?: string;
    channelId?: string;
    accountId?: string;
    active?: boolean;
  }): Promise<unknown[]> {
    const result = await this.call("session.list", { filter });
    return result.sessions;
  }

  // ===========================================================================
  // Message Dispatch
  // ===========================================================================

  /** Dispatch a message through the kernel */
  async dispatchMessage(
    sessionKey: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ dispatchId: string; queued: boolean }> {
    return await this.call("message.dispatch", { sessionKey, content, metadata });
  }

  /** Queue an agent invocation */
  async queueAgent(
    sessionKey: string,
    text: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ runId: string; queued: boolean }> {
    return await this.call("agent.queue", { sessionKey, text, metadata });
  }

  // ===========================================================================
  // Generic Method Call
  // ===========================================================================

  /** Call an IPC method */
  async call<M extends IPCMethodName>(
    method: M,
    params: MethodParams<M>,
  ): Promise<MethodResult<M>> {
    if (!this.connected || !this.socket) {
      throw new Error("Not connected to kernel");
    }

    const request: IPCRequest = {
      id: crypto.randomUUID(),
      type: "request",
      timestamp: Date.now(),
      method,
      params,
      // Include token for authenticated requests (all methods except app.register)
      ...(this.token ? { token: this.token } : {}),
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Request timeout after ${this.options.requestTimeout}ms`));
      }, this.options.requestTimeout);

      this.pendingRequests.set(request.id, {
        resolve: (result) => {
          clearTimeout(timer);
          resolve(result as MethodResult<M>);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });

      this.send(request);
    });
  }

  // ===========================================================================
  // Event Handling
  // ===========================================================================

  /** Register an event handler */
  onEvent(handler: (event: IPCEvent) => void | Promise<void>): void {
    this.on("event", handler);
  }

  /** Register a hook event handler */
  onHook<T = unknown>(
    hookName: string,
    handler: (payload: T, context: unknown) => void | Promise<unknown>,
  ): void {
    this.on("event", async (event) => {
      if (event.event === `hook:${hookName}`) {
        const payload = event.payload as { eventId: string; data: T; context: unknown };
        const result = await handler(payload.data, payload.context);

        // If handler returns a value, send it as hook result
        if (result !== undefined) {
          await this.sendHookResult(payload.eventId, result);
        }
      }
    });
  }

  // ===========================================================================
  // Internal Methods
  // ===========================================================================

  private send(message: IPCMessage): void {
    if (this.socket && this.connected) {
      this.socket.write(JSON.stringify(message) + "\n");
    }
  }

  private handleData(data: Buffer): void {
    this.buffer += data.toString("utf8");

    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (!line) {
        continue;
      }

      try {
        const message = JSON.parse(line) as IPCMessage;
        this.handleMessage(message);
      } catch {
        // Ignore parse errors
      }
    }
  }

  private handleMessage(message: IPCMessage): void {
    switch (message.type) {
      case "response": {
        const pending = this.pendingRequests.get(message.requestId);
        if (pending) {
          this.pendingRequests.delete(message.requestId);
          if (message.success) {
            pending.resolve(message.result);
          } else {
            const error = new KernelError(
              message.error?.code || "UNKNOWN_ERROR",
              message.error?.message || "Unknown error",
              message.error?.details,
            );
            pending.reject(error);
          }
        }
        break;
      }

      case "event": {
        this.emit("event", message);
        break;
      }

      case "stream": {
        // Streaming responses not yet implemented in IPC protocol.
        // Would emit incremental chunks for long-running operations.
        break;
      }
    }
  }

  private handleDisconnect(reason: string): void {
    this.connected = false;
    this.registered = false;
    this.emit("disconnected", reason);

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(new Error(`Disconnected: ${reason}`));
      this.pendingRequests.delete(id);
    }

    // Auto-reconnect if enabled
    if (this.options.autoReconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.emit("reconnecting", this.reconnectAttempts);

      setTimeout(() => {
        this.connect().catch((err) => {
          this.emit("error", err);
        });
      }, this.options.reconnectDelay);
    }
  }
}

// =============================================================================
// Helper Types
// =============================================================================

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

// =============================================================================
// Error Class
// =============================================================================

export class KernelError extends Error {
  constructor(
    public readonly code: IPCErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "KernelError";
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/** Create a new kernel client */
export function createKernelClient(options?: KernelClientOptions): KernelClient {
  return new KernelClient(options);
}
