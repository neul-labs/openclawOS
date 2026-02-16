/**
 * Zalo OA Channel App
 *
 * Process-isolated Zalo Official Account client using the OpenClawOS SDK.
 */

import { ChannelApp, type SendMessageParams, type MessageReceivedEvent } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import type { ZaloAppConfig, ZaloMessageMeta } from "./config.js";

import manifest from "../openclawos.manifest.json" with { type: "json" };

export class ZaloApp extends ChannelApp {
  protected readonly channelId = "zalo";

  readonly manifest = manifest as unknown as PackageManifest;

  private config: ZaloAppConfig = {};

  protected async setupChannel(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("channels.zalo");
    this.config = (kernelConfig || {}) as ZaloAppConfig;

    // Validate required config
    const appId = this.config.appId;
    const secretKey = this.config.secretKey;

    if (!appId) {
      throw new Error("Zalo App ID is required (channels.zalo.appId)");
    }
    if (!secretKey) {
      throw new Error("Zalo Secret Key is required (channels.zalo.secretKey)");
    }

    // Resolve tokens from env if not in config
    const accessToken = this.config.accessToken || process.env.ZALO_ACCESS_TOKEN;
    const refreshToken = this.config.refreshToken || process.env.ZALO_REFRESH_TOKEN;

    this.log.info(`Setting up Zalo OA channel with App ID: ${appId}`);

    // TODO: Initialize Zalo OA client
    // - Set up webhook listener for incoming messages
    // - Configure API client with access token
    // - Handle token refresh logic if needed

    this.log.info("Zalo OA channel setup complete");
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    const userId = params.metadata?.userId as string;
    if (!userId) {
      this.log.warn("Cannot send message: no userId in metadata");
      return;
    }

    try {
      // TODO: Implement Zalo OA message sending API call
      // Use Zalo's send message API endpoint with accessToken
      this.log.info(`Sending message to user ${userId}: ${params.content}`);
    } catch (error) {
      this.log.error("Failed to send Zalo message:", error);
    }
  }

  protected async teardown(): Promise<void> {
    // TODO: Clean up Zalo OA client resources
    this.log.info("Zalo OA client disconnected");
  }

  protected buildSessionKey(from: string): string {
    // Build partial session key for Zalo
    // Format: zalo:direct:{userId}
    return `zalo:direct:${from}`;
  }

  protected getChannelMeta() {
    return {
      name: "Zalo OA",
      icon: "message-circle",
      supportsThreads: false,
      supportsReactions: true,
      supportsMedia: true,
    };
  }

  /**
   * Handle inbound events from the kernel.
   * Note: Zalo receives messages via webhook callbacks,
   * so this method is not used for normal message handling.
   */
  protected async handleInbound(_event: MessageReceivedEvent): Promise<void> {
    this.log.debug("Received inbound event from kernel:", _event);
  }
}
