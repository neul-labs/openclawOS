/**
 * Signal Channel App
 *
 * Process-isolated Signal messenger integration using the OpenClawOS SDK.
 * Connects to signal-cli daemon via JSON-RPC and SSE.
 */

import { ChannelApp, type SendMessageParams, type MessageReceivedEvent } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import type { SignalAppConfig, SignalSseEvent, MessageMeta } from "./config.js";
import { signalCheck, sendMessage } from "./rpc-client.js";
import { runSignalSseLoop } from "./sse-client.js";

// Load manifest from JSON file
import manifest from "../openclawos.manifest.json" with { type: "json" };

interface SignalEnvelope {
  source?: string;
  sourceUuid?: string;
  timestamp?: number;
  dataMessage?: {
    message?: string;
    timestamp?: number;
    groupInfo?: {
      groupId?: string;
      groupName?: string;
    };
  };
  syncMessage?: {
    sentMessage?: {
      destination?: string;
      message?: string;
      timestamp?: number;
      groupInfo?: {
        groupId?: string;
        groupName?: string;
      };
    };
  };
}

export class SignalApp extends ChannelApp {
  protected readonly channelId = "signal";

  readonly manifest = manifest as unknown as PackageManifest;

  private config: SignalAppConfig = {};
  private baseUrl = "";
  private account?: string;
  private abortController: AbortController | null = null;

  protected async setupChannel(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("channels.signal");
    this.config = (kernelConfig || {}) as SignalAppConfig;

    // Resolve base URL
    this.baseUrl = this.resolveBaseUrl();
    this.account = this.config.account;

    // Check daemon availability
    const check = await signalCheck(this.baseUrl);
    if (!check.ok) {
      throw new Error(`Signal daemon not available: ${check.error}`);
    }

    this.log.info(`Connected to signal-cli daemon at ${this.baseUrl}`);

    // Start SSE event loop
    this.abortController = new AbortController();
    this.startEventLoop();

    this.log.info("Signal channel started");
  }

  private resolveBaseUrl(): string {
    // Check explicit URL first
    if (this.config.httpUrl) {
      return this.config.httpUrl;
    }

    // Build from host/port
    const host = this.config.httpHost || "127.0.0.1";
    const port = this.config.httpPort || 8080;
    return `http://${host}:${port}`;
  }

  private startEventLoop(): void {
    // Run in background without blocking
    runSignalSseLoop({
      baseUrl: this.baseUrl,
      account: this.account,
      abortSignal: this.abortController?.signal,
      onEvent: (event) => {
        void this.handleSseEvent(event).catch((err) => {
          this.log.error("Error handling SSE event:", err);
        });
      },
      onError: (err) => {
        this.log.error("SSE connection error:", err.message);
      },
      onReconnect: (attempt, delayMs) => {
        this.log.warn(`SSE reconnecting (attempt ${attempt}) in ${delayMs / 1000}s...`);
      },
    }).catch((err) => {
      if (!this.abortController?.signal.aborted) {
        this.log.error("SSE loop failed:", err);
      }
    });
  }

  private async handleSseEvent(event: SignalSseEvent): Promise<void> {
    if (event.event !== "message" || !event.data) {
      return;
    }

    let envelope: SignalEnvelope;
    try {
      envelope = JSON.parse(event.data) as SignalEnvelope;
    } catch {
      this.log.warn("Failed to parse SSE event data");
      return;
    }

    // Handle direct data message
    if (envelope.dataMessage?.message) {
      const sender = envelope.source || envelope.sourceUuid || "unknown";
      const meta: MessageMeta = {
        sender,
        timestamp: envelope.timestamp,
        isGroup: !!envelope.dataMessage.groupInfo,
        groupId: envelope.dataMessage.groupInfo?.groupId,
        groupName: envelope.dataMessage.groupInfo?.groupName,
      };

      await this.dispatchInbound(sender, envelope.dataMessage.message, meta as unknown as Record<string, unknown>);
    }

    // Handle sync message (messages sent from linked devices)
    if (envelope.syncMessage?.sentMessage?.message) {
      const sent = envelope.syncMessage.sentMessage;
      // For sync messages, the destination is the conversation partner
      const target = sent.destination || "unknown";
      this.log.debug(`Sync message to ${target}: ${sent.message?.slice(0, 50)}...`);
    }
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    const metadata = params.metadata || {};
    const recipient = (metadata.recipient || metadata.sender || params.target) as string;
    const groupId = metadata.groupId as string | undefined;

    if (!recipient && !groupId) {
      this.log.warn("Cannot send message: no recipient or groupId");
      return;
    }

    try {
      await sendMessage({
        baseUrl: this.baseUrl,
        account: this.account,
        recipient,
        message: params.content,
        groupId,
      });

      this.log.debug(`Sent message to ${groupId || recipient}`);
    } catch (error) {
      this.log.error("Failed to send Signal message:", error);
    }
  }

  protected async teardown(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.log.info("Signal channel stopped");
  }

  protected buildSessionKey(from: string): string {
    // Build partial session key - kernel will resolve agentId via routing
    // Format matches existing: signal:{peerKind}:{peerId}
    return `signal:direct:${from}`;
  }

  protected getChannelMeta() {
    return {
      name: "Signal",
      icon: "signal",
      supportsThreads: false,
      supportsReactions: true,
      supportsMedia: true,
    };
  }

  /**
   * Handle inbound events from the kernel.
   * Note: Signal receives messages via SSE from the daemon,
   * so this method is not used for normal message handling.
   */
  protected async handleInbound(_event: MessageReceivedEvent): Promise<void> {
    // Signal messages come from SSE handlers, not from kernel push
    this.log.debug("Received inbound event from kernel:", _event);
  }
}
