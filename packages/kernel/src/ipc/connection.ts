/**
 * IPC Connection Handler
 *
 * Manages a single client connection over Unix socket with JSONL protocol.
 */

import type {
  IPCMessage,
  IPCResponse,
  IPCEvent,
  IPCErrorCode,
  PackageManifest,
} from "@openclawos/protocol";
import type net from "node:net";
import { EventEmitter } from "node:events";

export type IPCMethodHandler = (
  appId: string | null,
  params: unknown,
  conn: IPCConnection,
) => Promise<unknown>;

export interface IPCConnectionEvents {
  registered: [appId: string];
  ready: [];
  close: [];
  error: [error: Error];
  message: [message: IPCMessage];
}

export class IPCConnection extends EventEmitter<IPCConnectionEvents> {
  private buffer = "";
  private _appId: string | null = null;
  private _token: string | null = null;
  private _manifest: PackageManifest | null = null;
  private _ready = false;
  private _closed = false;
  private handlers: Map<string, IPCMethodHandler>;

  constructor(
    private socket: net.Socket,
    handlers: Map<string, IPCMethodHandler>,
  ) {
    super();
    this.handlers = handlers;

    socket.on("data", this.handleData.bind(this));
    socket.on("close", () => {
      this._closed = true;
      this.emit("close");
    });
    socket.on("error", (err) => this.emit("error", err));
  }

  get appId(): string | null {
    return this._appId;
  }

  get token(): string | null {
    return this._token;
  }

  get manifest(): PackageManifest | null {
    return this._manifest;
  }

  get ready(): boolean {
    return this._ready;
  }

  get closed(): boolean {
    return this._closed;
  }

  /**
   * Send a message to the connected client
   */
  send(message: IPCMessage): void {
    if (!this.socket.destroyed && !this._closed) {
      this.socket.write(JSON.stringify(message) + "\n");
    }
  }

  /**
   * Send an event to the connected client
   */
  sendEvent(event: string, payload: unknown): void {
    this.send({
      id: crypto.randomUUID(),
      type: "event",
      timestamp: Date.now(),
      event,
      payload,
    } as IPCEvent);
  }

  /**
   * Close the connection
   */
  close(): void {
    if (!this._closed) {
      this._closed = true;
      this.socket.destroy();
    }
  }

  /**
   * Mark the connection as ready (called after app.ready)
   */
  markReady(): void {
    this._ready = true;
    this.emit("ready");
  }

  /**
   * Set registration info (called after app.register)
   */
  setRegistration(appId: string, token: string, manifest: PackageManifest): void {
    this._appId = appId;
    this._token = token;
    this._manifest = manifest;
    this.emit("registered", appId);
  }

  private handleData(data: Buffer): void {
    this.buffer += data.toString("utf8");

    let idx: number;
    while ((idx = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);

      if (!line) {
        continue;
      }

      try {
        const message = JSON.parse(line) as IPCMessage;
        this.emit("message", message);
        void this.handleMessage(message);
      } catch {
        // Ignore parse errors - malformed messages are dropped
      }
    }
  }

  private async handleMessage(message: IPCMessage): Promise<void> {
    if (message.type !== "request") {
      return;
    }

    const request = message;
    const handler = this.handlers.get(request.method);

    if (!handler) {
      this.sendError(request.id, "METHOD_NOT_FOUND", `Unknown method: ${request.method}`);
      return;
    }

    try {
      const result = await handler(this._appId, request.params, this);
      this.sendSuccess(request.id, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.sendError(request.id, "INTERNAL_ERROR", message);
    }
  }

  private sendSuccess(requestId: string, result: unknown): void {
    this.send({
      id: crypto.randomUUID(),
      type: "response",
      timestamp: Date.now(),
      requestId,
      success: true,
      result,
    } as IPCResponse);
  }

  private sendError(requestId: string, code: IPCErrorCode, message: string): void {
    this.send({
      id: crypto.randomUUID(),
      type: "response",
      timestamp: Date.now(),
      requestId,
      success: false,
      error: { code, message },
    } as IPCResponse);
  }
}
