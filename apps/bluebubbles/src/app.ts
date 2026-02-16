/**
 * BlueBubbles Channel App
 *
 * Process-isolated BlueBubbles client using the OpenClawOS SDK.
 */

import { ChannelApp, type SendMessageParams, type MessageReceivedEvent } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import type { BlueBubblesAppConfig, BlueBubblesMessageMeta } from "./config.js";

import manifest from "../openclawos.manifest.json" with { type: "json" };

export class BlueBubblesApp extends ChannelApp {
  protected readonly channelId = "bluebubbles";

  readonly manifest = manifest as unknown as PackageManifest;

  private config: BlueBubblesAppConfig | null = null;
  private abortController: AbortController | null = null;

  protected async setupChannel(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("channels.bluebubbles");
    this.config = kernelConfig as BlueBubblesAppConfig;

    if (!this.config?.serverUrl) {
      throw new Error("BlueBubbles server URL is required (channels.bluebubbles.serverUrl)");
    }
    if (!this.config?.password) {
      throw new Error("BlueBubbles password is required (channels.bluebubbles.password)");
    }

    this.abortController = new AbortController();

    this.log.info(`Connecting to BlueBubbles server at ${this.config.serverUrl}`);

    // TODO: Implement BlueBubbles client connection
    // This would involve:
    // 1. Connecting to the BlueBubbles REST API
    // 2. Setting up websocket for real-time message updates
    // 3. Handling incoming messages and dispatching them

    this.log.info("BlueBubbles client connected");
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    if (!this.config) {
      this.log.warn("Cannot send message: client not connected");
      return;
    }

    const chatId = params.metadata?.chatId as string;
    if (!chatId) {
      this.log.warn("Cannot send message: no chatId in metadata");
      return;
    }

    try {
      // TODO: Implement sending message via BlueBubbles API
      // This would involve making a POST request to /api/v1/message/text
      this.log.info(`Sending message to chat ${chatId}: ${params.content}`);
    } catch (error) {
      this.log.error("Failed to send BlueBubbles message:", error);
    }
  }

  protected async teardown(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.config = null;
    this.log.info("BlueBubbles client disconnected");
  }

  protected buildSessionKey(from: string): string {
    // Build partial session key for BlueBubbles
    // Format: bluebubbles:direct:{chatId}
    return `bluebubbles:direct:${from}`;
  }

  protected getChannelMeta() {
    return {
      name: "BlueBubbles",
      icon: "apple",
      supportsThreads: false,
      supportsReactions: true,
      supportsMedia: true,
    };
  }

  /**
   * Handle inbound events from the kernel.
   * Note: BlueBubbles receives messages directly via the BlueBubbles protocol,
   * so this method is not used for normal message handling.
   */
  protected async handleInbound(_event: MessageReceivedEvent): Promise<void> {
    this.log.debug("Received inbound event from kernel:", _event);
  }
}
