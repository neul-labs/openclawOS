/**
 * Twitch Channel App
 *
 * Process-isolated Twitch client using the OpenClawOS SDK.
 */

import { ChannelApp, type SendMessageParams, type MessageReceivedEvent } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import type { TwitchAppConfig, TwitchMessageMeta } from "./config.js";

import manifest from "../openclawos.manifest.json" with { type: "json" };

export class TwitchApp extends ChannelApp {
  protected readonly channelId = "twitch";

  readonly manifest = manifest as unknown as PackageManifest;

  private config: TwitchAppConfig = {};
  private connected = false;

  protected async setupChannel(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("channels.twitch");
    this.config = (kernelConfig || {}) as TwitchAppConfig;

    // Validate required config
    const clientId = this.config.clientId;
    if (!clientId) {
      throw new Error("Twitch clientId is required (channels.twitch.clientId)");
    }

    // Resolve tokens from env if not in config
    const clientSecret = this.config.clientSecret || process.env.TWITCH_CLIENT_SECRET;
    const accessToken = this.config.accessToken || process.env.TWITCH_ACCESS_TOKEN;
    const refreshToken = this.config.refreshToken || process.env.TWITCH_REFRESH_TOKEN;

    this.log.info("Connecting to Twitch chat...");

    // TODO: Implement Twitch chat client connection
    // This is a placeholder implementation
    this.connected = true;

    this.log.info("Connected to Twitch chat");
  }

  private async handleTwitchMessage(
    channel: string,
    userId: string,
    userName: string,
    userDisplayName: string,
    text: string,
    messageId: string
  ): Promise<void> {
    const meta: TwitchMessageMeta = {
      channel,
      userId,
      userName,
      userDisplayName,
      messageId,
      isGroup: true,
    };

    // Dispatch to kernel
    await this.dispatchInbound(userId, text, meta);
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    if (!this.connected) {
      this.log.warn("Cannot send message: client not connected");
      return;
    }

    const channel = params.metadata?.channel as string;
    if (!channel) {
      this.log.warn("Cannot send message: no channel in metadata");
      return;
    }

    try {
      // TODO: Implement Twitch message sending
      this.log.debug(`Sending message to ${channel}: ${params.content}`);
    } catch (error) {
      this.log.error("Failed to send Twitch message:", error);
    }
  }

  protected async teardown(): Promise<void> {
    if (this.connected) {
      // TODO: Implement Twitch client disconnect
      this.connected = false;
    }
    this.log.info("Twitch client disconnected");
  }

  protected buildSessionKey(from: string): string {
    // Build partial session key for Twitch
    // Format: twitch:direct:{userId}
    return `twitch:direct:${from}`;
  }

  protected getChannelMeta() {
    return {
      name: "Twitch",
      icon: "tv",
      supportsThreads: false,
      supportsReactions: false,
    };
  }

  /**
   * Handle inbound events from the kernel.
   * Note: Twitch receives messages directly via the Twitch chat protocol,
   * so this method is not used for normal message handling.
   */
  protected async handleInbound(_event: MessageReceivedEvent): Promise<void> {
    this.log.debug("Received inbound event from kernel:", _event);
  }
}
