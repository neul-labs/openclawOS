/**
 * LINE Channel App
 *
 * Process-isolated LINE Messaging API client using the OpenClawOS SDK.
 */

import { ChannelApp, type SendMessageParams, type MessageReceivedEvent } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import type { LineAppConfig, LineMessageMeta } from "./config.js";

import manifest from "../openclawos.manifest.json" with { type: "json" };

export class LineApp extends ChannelApp {
  protected readonly channelId = "line";

  readonly manifest = manifest as unknown as PackageManifest;

  private config: LineAppConfig = {};

  protected async setupChannel(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("channels.line");
    this.config = (kernelConfig || {}) as LineAppConfig;

    // Validate required configuration
    const channelAccessToken = this.config.channelAccessToken || process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const channelSecret = this.config.channelSecret || process.env.LINE_CHANNEL_SECRET;

    if (!channelAccessToken) {
      throw new Error("LINE channel access token is required (channels.line.channelAccessToken)");
    }
    if (!channelSecret) {
      throw new Error("LINE channel secret is required (channels.line.channelSecret)");
    }

    this.log.info("LINE channel app initialized");
    this.log.info(`Webhook URL: ${this.config.webhookUrl || "Not configured"}`);

    // TODO: Initialize LINE webhook server
    // TODO: Set up webhook handler to receive LINE events
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    const meta = params.metadata as LineMessageMeta | undefined;
    const userId = meta?.userId;

    if (!userId) {
      this.log.warn("Cannot send message: no userId in metadata");
      return;
    }

    try {
      // TODO: Implement LINE API message sending
      // Use LINE Messaging API to send messages to userId
      this.log.debug(`Sending message to LINE user ${userId}: ${params.content}`);

      // Placeholder implementation
      this.log.warn("LINE message sending not yet implemented");
    } catch (error) {
      this.log.error("Failed to send LINE message:", error);
    }
  }

  protected async teardown(): Promise<void> {
    // TODO: Close webhook server if running
    this.log.info("LINE channel app shut down");
  }

  protected buildSessionKey(from: string): string {
    // Build session key for LINE
    // Format: line:direct:{userId}
    return `line:direct:${from}`;
  }

  protected getChannelMeta() {
    return {
      name: "LINE",
      icon: "message-circle",
      supportsThreads: false,
      supportsReactions: true,
      supportsMedia: true,
    };
  }

  /**
   * Handle inbound events from the kernel.
   * LINE receives messages via webhook, so this method handles
   * any kernel-initiated events if needed.
   */
  protected async handleInbound(_event: MessageReceivedEvent): Promise<void> {
    this.log.debug("Received inbound event from kernel:", _event);
  }
}
