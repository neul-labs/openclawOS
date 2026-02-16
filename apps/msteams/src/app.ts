/**
 * Microsoft Teams Channel App
 *
 * Process-isolated Microsoft Teams client using the OpenClawOS SDK.
 */

import { ChannelApp, type SendMessageParams, type MessageReceivedEvent } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import type { MSTeamsAppConfig } from "./config.js";

import manifest from "../openclawos.manifest.json" with { type: "json" };

export class MSTeamsApp extends ChannelApp {
  protected readonly channelId = "msteams";

  readonly manifest = manifest as unknown as PackageManifest;

  private config: MSTeamsAppConfig = {};

  protected async setupChannel(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("channels.msteams");
    this.config = (kernelConfig || {}) as MSTeamsAppConfig;

    // Validate required configuration
    const appId = this.config.appId;
    const appPassword = this.config.appPassword || process.env.MSTEAMS_APP_PASSWORD;

    if (!appId) {
      throw new Error("Microsoft Teams App ID is required (channels.msteams.appId)");
    }
    if (!appPassword) {
      throw new Error("Microsoft Teams App Password is required (channels.msteams.appPassword)");
    }

    this.log.info(`Initializing Microsoft Teams bot with App ID: ${appId}`);

    // TODO: Initialize Bot Framework adapter and middleware
    // TODO: Set up message handlers
    // TODO: Start HTTP server for Bot Framework webhook

    this.log.info("Microsoft Teams bot initialized (placeholder)");
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    const conversationId = params.metadata?.conversationId as string;
    if (!conversationId) {
      this.log.warn("Cannot send message: no conversationId in metadata");
      return;
    }

    try {
      // TODO: Send message via Bot Framework adapter
      this.log.info(`Sending message to conversation ${conversationId}: ${params.content}`);
    } catch (error) {
      this.log.error("Failed to send Microsoft Teams message:", error);
    }
  }

  protected async teardown(): Promise<void> {
    // TODO: Cleanup Bot Framework resources
    // TODO: Stop HTTP server
    this.log.info("Microsoft Teams bot disconnected");
  }

  protected buildSessionKey(from: string): string {
    // Build partial session key for Microsoft Teams
    // Format: msteams:direct:{conversationId}
    return `msteams:direct:${from}`;
  }

  protected getChannelMeta() {
    return {
      name: "Microsoft Teams",
      icon: "users",
      supportsThreads: true,
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
