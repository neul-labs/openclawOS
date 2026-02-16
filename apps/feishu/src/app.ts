/**
 * Feishu Channel App
 *
 * Process-isolated Feishu (Lark) client using the OpenClawOS SDK.
 */

import { ChannelApp, type SendMessageParams, type MessageReceivedEvent } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import type { FeishuAppConfig, FeishuMessageMeta } from "./config.js";

import manifest from "../openclawos.manifest.json" with { type: "json" };

export class FeishuApp extends ChannelApp {
  protected readonly channelId = "feishu";

  readonly manifest = manifest as unknown as PackageManifest;

  private config: FeishuAppConfig | null = null;

  protected async setupChannel(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("channels.feishu");
    this.config = kernelConfig as FeishuAppConfig;

    if (!this.config?.appId) {
      throw new Error("Feishu App ID is required (channels.feishu.appId)");
    }
    if (!this.config?.appSecret) {
      throw new Error("Feishu App Secret is required (channels.feishu.appSecret)");
    }

    this.log.info(`Initializing Feishu app with App ID: ${this.config.appId}`);

    // TODO: Initialize Feishu client and event listeners
    // This would typically involve:
    // 1. Setting up webhook endpoint for receiving messages
    // 2. Authenticating with Feishu API
    // 3. Registering event handlers for incoming messages

    this.log.info("Feishu channel setup complete");
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    if (!this.config) {
      this.log.warn("Cannot send message: Feishu client not configured");
      return;
    }

    const meta = params.metadata as FeishuMessageMeta | undefined;
    const openId = meta?.openId;

    if (!openId) {
      this.log.warn("Cannot send message: no openId in metadata");
      return;
    }

    try {
      // TODO: Implement actual Feishu message sending
      // This would use the Feishu API to send messages
      this.log.info(`Sending message to Feishu user ${openId}: ${params.content}`);
    } catch (error) {
      this.log.error("Failed to send Feishu message:", error);
    }
  }

  protected async teardown(): Promise<void> {
    this.config = null;
    this.log.info("Feishu client disconnected");
  }

  protected buildSessionKey(from: string): string {
    // Build session key for Feishu
    // Format: feishu:direct:{openId}
    return `feishu:direct:${from}`;
  }

  protected getChannelMeta() {
    return {
      name: "Feishu",
      icon: "message-square",
      supportsThreads: true,
      supportsReactions: true,
      supportsMedia: true,
    };
  }

  /**
   * Handle inbound events from the kernel.
   * This is called when messages are routed back to this channel.
   */
  protected async handleInbound(event: MessageReceivedEvent): Promise<void> {
    this.log.debug("Received inbound event from kernel:", event);
    // Additional handling if needed
  }
}
