/**
 * Mattermost Channel App
 *
 * Process-isolated Mattermost client using the OpenClawOS SDK.
 */

import { ChannelApp, type SendMessageParams, type MessageReceivedEvent } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import type { MattermostAppConfig, MattermostMessageMeta } from "./config.js";

import manifest from "../openclawos.manifest.json" with { type: "json" };

export class MattermostApp extends ChannelApp {
  protected readonly channelId = "mattermost";

  readonly manifest = manifest as unknown as PackageManifest;

  private config: MattermostAppConfig = {};
  private abortController: AbortController | null = null;

  protected async setupChannel(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("channels.mattermost");
    this.config = (kernelConfig || {}) as MattermostAppConfig;

    // Validate required configuration
    const serverUrl = this.config.serverUrl;
    if (!serverUrl) {
      throw new Error("Mattermost server URL is required (channels.mattermost.serverUrl)");
    }

    // Resolve authentication from config or environment
    const botToken = this.config.botToken || process.env.MATTERMOST_BOT_TOKEN;
    const personalAccessToken =
      this.config.personalAccessToken || process.env.MATTERMOST_PERSONAL_ACCESS_TOKEN;
    const password = this.config.password || process.env.MATTERMOST_PASSWORD;

    if (!botToken && !personalAccessToken && (!this.config.username || !password)) {
      throw new Error(
        "Mattermost authentication required: provide botToken, personalAccessToken, or username+password"
      );
    }

    this.abortController = new AbortController();

    this.log.info(`Connecting to Mattermost server: ${serverUrl}`);

    // TODO: Implement actual Mattermost client connection
    // This is a placeholder implementation
    this.log.info("Mattermost client connected (placeholder)");
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    const channelId = params.metadata?.channelId as string;
    if (!channelId) {
      this.log.warn("Cannot send message: no channelId in metadata");
      return;
    }

    try {
      // TODO: Implement actual Mattermost API call to send message
      this.log.debug(`Sending message to channel ${channelId}: ${params.content}`);
    } catch (error) {
      this.log.error("Failed to send Mattermost message:", error);
    }
  }

  protected async teardown(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    // TODO: Cleanup Mattermost client connection
    this.log.info("Mattermost client disconnected");
  }

  protected buildSessionKey(from: string): string {
    // Build partial session key for Mattermost
    // Format: mattermost:direct:{userId}
    return `mattermost:direct:${from}`;
  }

  protected getChannelMeta() {
    return {
      name: "Mattermost",
      icon: "message-square",
      supportsThreads: true,
      supportsReactions: true,
      supportsMedia: true,
    };
  }

  /**
   * Handle inbound events from the kernel.
   * Note: Mattermost receives messages via WebSocket or polling,
   * so this method handles incoming messages from the platform.
   */
  protected async handleInbound(_event: MessageReceivedEvent): Promise<void> {
    this.log.debug("Received inbound event from kernel:", _event);
    // TODO: Implement handling of inbound events if needed
  }
}
