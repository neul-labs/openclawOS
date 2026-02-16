/**
 * Zalo User Channel App
 *
 * Process-isolated Zalo User client using the OpenClawOS SDK.
 */

import { ChannelApp, type SendMessageParams, type MessageReceivedEvent } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import type { ZalouserAppConfig, ZalouserMessageMeta } from "./config.js";

import manifest from "../openclawos.manifest.json" with { type: "json" };

export class ZalouserApp extends ChannelApp {
  protected readonly channelId = "zalouser";

  readonly manifest = manifest as unknown as PackageManifest;

  private config: ZalouserAppConfig = {};
  private abortController: AbortController | null = null;

  protected async setupChannel(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("channels.zalouser");
    this.config = (kernelConfig || {}) as ZalouserAppConfig;

    // Validate required config
    if (!this.config.imei) {
      throw new Error("Zalo User IMEI is required (channels.zalouser.imei)");
    }

    this.abortController = new AbortController();

    this.log.info(`Setting up Zalo User channel with IMEI: ${this.config.imei.substring(0, 4)}...`);

    // TODO: Initialize Zalo User client
    // This is a placeholder implementation
    // In a real implementation, you would:
    // 1. Initialize the Zalo User client with IMEI and cookies
    // 2. Set up message listeners
    // 3. Handle authentication

    this.log.info("Zalo User channel setup complete");
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    const recipientId = params.metadata?.recipientId as string;
    if (!recipientId) {
      this.log.warn("Cannot send message: no recipientId in metadata");
      return;
    }

    try {
      // TODO: Implement actual Zalo User message sending
      this.log.info(`Sending message to ${recipientId}: ${params.content}`);
    } catch (error) {
      this.log.error("Failed to send Zalo User message:", error);
    }
  }

  protected async teardown(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.log.info("Zalo User client disconnected");
  }

  protected buildSessionKey(from: string): string {
    // Build session key for Zalo User
    // Format: zalouser:direct:{recipientId}
    return `zalouser:direct:${from}`;
  }

  protected getChannelMeta() {
    return {
      name: "Zalo User",
      icon: "user",
      supportsThreads: false,
      supportsReactions: true,
      supportsMedia: true,
    };
  }

  /**
   * Handle inbound events from the kernel.
   */
  protected async handleInbound(_event: MessageReceivedEvent): Promise<void> {
    this.log.debug("Received inbound event from kernel:", _event);
  }
}
