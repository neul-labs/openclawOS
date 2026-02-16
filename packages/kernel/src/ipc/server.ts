/**
 * IPC Server
 *
 * Unix domain socket server for kernel-application communication using JSONL protocol.
 */

import type { IPCEvent } from "@openclawos/protocol";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { IPCConnection, type IPCMethodHandler } from "./connection.js";

export interface IPCServerOptions {
  /** Path to Unix socket file (e.g., ~/.openclawos/run/kernel.sock) */
  socketPath: string;
}

export interface IPCServerEvents {
  connection: [conn: IPCConnection];
  disconnection: [conn: IPCConnection];
  registered: [appId: string, conn: IPCConnection];
  ready: [appId: string, conn: IPCConnection];
  error: [error: Error];
  listening: [];
  close: [];
}

export class IPCServer extends EventEmitter<IPCServerEvents> {
  private server: net.Server | null = null;
  private connections = new Map<string, IPCConnection>();
  private unregisteredConnections = new Set<IPCConnection>();
  private methodHandlers = new Map<string, IPCMethodHandler>();
  private running = false;

  readonly socketPath: string;

  constructor(options: IPCServerOptions) {
    super();
    this.socketPath = options.socketPath;
  }

  /**
   * Start the IPC server
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error("IPC server already running");
    }

    // Ensure socket directory exists
    await fs.mkdir(path.dirname(this.socketPath), { recursive: true });

    // Remove stale socket file if it exists
    try {
      await fs.rm(this.socketPath, { force: true });
    } catch {
      // Ignore errors - socket may not exist
    }

    // Create server
    this.server = net.createServer(this.handleConnection.bind(this));

    await new Promise<void>((resolve, reject) => {
      this.server!.on("error", (err) => {
        if (!this.running) {
          reject(err);
        } else {
          this.emit("error", err);
        }
      });

      this.server!.listen(this.socketPath, () => {
        this.running = true;
        this.emit("listening");
        resolve();
      });
    });

    // Set socket permissions (owner read/write only)
    await fs.chmod(this.socketPath, 0o600);
  }

  /**
   * Stop the IPC server
   */
  async stop(): Promise<void> {
    if (!this.server || !this.running) {
      return;
    }

    // Close all connections
    for (const conn of this.connections.values()) {
      conn.close();
    }
    for (const conn of this.unregisteredConnections) {
      conn.close();
    }
    this.connections.clear();
    this.unregisteredConnections.clear();

    // Close server
    await new Promise<void>((resolve) => {
      this.server!.close(() => {
        this.running = false;
        this.emit("close");
        resolve();
      });
    });

    // Remove socket file
    try {
      await fs.rm(this.socketPath, { force: true });
    } catch {
      // Ignore errors
    }

    this.server = null;
  }

  /**
   * Register a method handler
   */
  registerMethod(method: string, handler: IPCMethodHandler): void {
    this.methodHandlers.set(method, handler);
  }

  /**
   * Unregister a method handler
   */
  unregisterMethod(method: string): void {
    this.methodHandlers.delete(method);
  }

  /**
   * Broadcast an event to all connected and registered apps
   */
  broadcast(event: string, payload: unknown, filter?: (conn: IPCConnection) => boolean): void {
    const ipcEvent: IPCEvent = {
      id: crypto.randomUUID(),
      type: "event",
      timestamp: Date.now(),
      event,
      payload,
    };

    for (const conn of this.connections.values()) {
      if (!filter || filter(conn)) {
        conn.send(ipcEvent);
      }
    }
  }

  /**
   * Send an event to a specific app
   */
  sendTo(appId: string, event: string, payload: unknown): boolean {
    const conn = this.connections.get(appId);
    if (!conn) {
      return false;
    }
    conn.sendEvent(event, payload);
    return true;
  }

  /**
   * Get connection by app ID
   */
  getConnection(appId: string): IPCConnection | undefined {
    return this.connections.get(appId);
  }

  /**
   * Get all connected app IDs
   */
  getConnectedAppIds(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Check if an app is connected
   */
  isConnected(appId: string): boolean {
    return this.connections.has(appId);
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.running;
  }

  private handleConnection(socket: net.Socket): void {
    const conn = new IPCConnection(socket, this.methodHandlers);
    this.unregisteredConnections.add(conn);
    this.emit("connection", conn);

    conn.on("registered", (appId: string) => {
      // Move from unregistered to registered
      this.unregisteredConnections.delete(conn);

      // Close existing connection with same appId if any
      const existing = this.connections.get(appId);
      if (existing) {
        existing.close();
      }

      this.connections.set(appId, conn);
      this.emit("registered", appId, conn);
    });

    conn.on("ready", () => {
      if (conn.appId) {
        this.emit("ready", conn.appId, conn);
      }
    });

    conn.on("close", () => {
      if (conn.appId) {
        this.connections.delete(conn.appId);
      }
      this.unregisteredConnections.delete(conn);
      this.emit("disconnection", conn);
    });

    conn.on("error", (err) => {
      this.emit("error", err);
    });
  }
}
