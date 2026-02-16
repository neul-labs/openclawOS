/**
 * Google Chat Channel App
 *
 * Process-isolated Google Chat client using the OpenClawOS SDK.
 */

import { ChannelApp, type SendMessageParams, type MessageReceivedEvent } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import type { GoogleChatAppConfig, GoogleChatMessageMeta } from "./config.js";

import manifest from "../openclawos.manifest.json" with { type: "json" };

export class GoogleChatApp extends ChannelApp {
  protected readonly channelId = "googlechat";

  readonly manifest = manifest as unknown as PackageManifest;

  private config: GoogleChatAppConfig = {};

  protected async setupChannel(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("channels.googlechat");
    this.config = (kernelConfig || {}) as GoogleChatAppConfig;

    // Validate required configuration
    const serviceAccountKey = this.config.serviceAccountKey || process.env.GOOGLE_CHAT_SERVICE_ACCOUNT_KEY;
    const projectId = this.config.projectId;

    if (!serviceAccountKey) {
      throw new Error("Google Chat service account key is required (channels.googlechat.serviceAccountKey)");
    }
    if (!projectId) {
      throw new Error("Google Chat project ID is required (channels.googlechat.projectId)");
    }

    this.log.info(`Initializing Google Chat for project: ${projectId}`);

    // TODO: Initialize Google Chat API client
    // TODO: Set up webhook listener or polling mechanism
    // TODO: Authenticate with service account

    this.log.info("Google Chat client initialized");
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    const meta = params.metadata as GoogleChatMessageMeta | undefined;
    const spaceId = meta?.spaceId;

    if (!spaceId) {
      this.log.warn("Cannot send message: no spaceId in metadata");
      return;
    }

    try {
      // TODO: Send message via Google Chat API
      this.log.info(`Sending message to space ${spaceId}: ${params.content}`);
    } catch (error) {
      this.log.error("Failed to send Google Chat message:", error);
    }
  }

  protected async teardown(): Promise<void> {
    // TODO: Clean up Google Chat client resources
    this.log.info("Google Chat client disconnected");
  }

  protected buildSessionKey(from: string): string {
    // Build partial session key for Google Chat
    // Format: googlechat:direct:{spaceId}
    return `googlechat:direct:${from}`;
  }

  protected getChannelMeta() {
    return {
      name: "Google Chat",
      icon: "message-circle",
      supportsThreads: true,
      supportsReactions: true,
      supportsMedia: true,
    };
  }

  /**
   * Handle inbound events from the kernel.
   * Note: Google Chat receives messages via webhooks or polling,
   * so this method is not used for normal message handling.
   */
  protected async handleInbound(_event: MessageReceivedEvent): Promise<void> {
    this.log.debug("Received inbound event from kernel:", _event);
  }
}
