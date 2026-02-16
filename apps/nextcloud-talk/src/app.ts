/**
 * Nextcloud Talk Channel App
 *
 * Process-isolated Nextcloud Talk client using the OpenClawOS SDK.
 */

import { ChannelApp, type SendMessageParams, type MessageReceivedEvent } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import type { NextcloudTalkAppConfig, NextcloudTalkMessageMeta } from "./config.js";

import manifest from "../openclawos.manifest.json" with { type: "json" };

export class NextcloudTalkApp extends ChannelApp {
  protected readonly channelId = "nextcloud-talk";

  readonly manifest = manifest as unknown as PackageManifest;

  private config: NextcloudTalkAppConfig = {};
  private abortController: AbortController | null = null;

  protected async setupChannel(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("channels.nextcloud-talk");
    this.config = (kernelConfig || {}) as NextcloudTalkAppConfig;

    // Validate required configuration
    const serverUrl = this.config.serverUrl;
    const username = this.config.username;
    const appPassword = this.config.appPassword || process.env.NEXTCLOUD_APP_PASSWORD;

    if (!serverUrl) {
      throw new Error("Nextcloud server URL is required (channels.nextcloud-talk.serverUrl)");
    }
    if (!username) {
      throw new Error("Nextcloud username is required (channels.nextcloud-talk.username)");
    }
    if (!appPassword) {
      throw new Error("Nextcloud app password is required (channels.nextcloud-talk.appPassword or NEXTCLOUD_APP_PASSWORD env var)");
    }

    this.abortController = new AbortController();

    this.log.info(`Connecting to Nextcloud Talk at ${serverUrl} as ${username}`);

    // TODO: Implement Nextcloud Talk client connection
    // This would involve:
    // 1. Authenticating with the Nextcloud server
    // 2. Setting up webhook/polling for incoming messages
    // 3. Fetching conversation list
    // 4. Setting up message handlers

    this.log.info(`Connected to Nextcloud Talk as ${username}`);
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    const conversationId = params.metadata?.conversationId as string;
    if (!conversationId) {
      this.log.warn("Cannot send message: no conversationId in metadata");
      return;
    }

    try {
      // TODO: Implement sending message to Nextcloud Talk
      // This would involve making an API call to:
      // POST /ocs/v2.php/apps/spreed/api/v1/chat/{conversationId}
      // with the message content

      this.log.debug(`Sending message to conversation ${conversationId}: ${params.content}`);
    } catch (error) {
      this.log.error("Failed to send Nextcloud Talk message:", error);
    }
  }

  protected async teardown(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.log.info("Nextcloud Talk client disconnected");
  }

  protected buildSessionKey(from: string, metadata?: Record<string, unknown>): string {
    // Build session key for Nextcloud Talk
    // Format: nextcloud-talk:direct:{conversationId}
    const conversationId = (metadata?.conversationId as string) || from;
    return `nextcloud-talk:direct:${conversationId}`;
  }

  protected getChannelMeta() {
    return {
      name: "Nextcloud Talk",
      icon: "message-circle",
      supportsThreads: true,
      supportsReactions: true,
      supportsMedia: true,
    };
  }

  /**
   * Handle inbound events from the kernel.
   * Note: Nextcloud Talk receives messages via webhooks/polling,
   * so this method is not used for normal message handling.
   */
  protected async handleInbound(_event: MessageReceivedEvent): Promise<void> {
    this.log.debug("Received inbound event from kernel:", _event);
  }

  /**
   * Handle incoming message from Nextcloud Talk
   * This would be called by the webhook/polling handler
   */
  private async handleIncomingMessage(
    conversationId: string,
    senderDisplayName: string,
    senderId: string,
    messageText: string,
    messageId: string,
    isGroup: boolean,
    conversationName?: string,
    timestamp?: number
  ): Promise<void> {
    const meta: NextcloudTalkMessageMeta = {
      conversationId,
      conversationName,
      senderDisplayName,
      senderId,
      isGroup,
      messageId,
      timestamp,
    };

    // Dispatch to kernel
    await this.dispatchInbound(senderDisplayName, messageText, meta);
  }
}
