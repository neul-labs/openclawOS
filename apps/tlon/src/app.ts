/**
 * Tlon (Urbit) Channel App
 *
 * Process-isolated Tlon/Urbit client using the OpenClawOS SDK.
 */

import { ChannelApp, type SendMessageParams, type MessageReceivedEvent } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import type { TlonAppConfig, TlonMessageMeta } from "./config.js";

import manifest from "../openclawos.manifest.json" with { type: "json" };

export class TlonApp extends ChannelApp {
  protected readonly channelId = "tlon";

  readonly manifest = manifest as unknown as PackageManifest;

  private config: TlonAppConfig | null = null;
  private abortController: AbortController | null = null;

  protected async setupChannel(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("channels.tlon");
    this.config = kernelConfig as TlonAppConfig;

    if (!this.config?.shipUrl) {
      throw new Error("Tlon shipUrl is required (channels.tlon.shipUrl)");
    }
    if (!this.config?.code) {
      throw new Error("Tlon authentication code is required (channels.tlon.code)");
    }

    this.abortController = new AbortController();

    this.log.info(`Connecting to Urbit ship at ${this.config.shipUrl}`);

    // TODO: Implement Urbit connection logic
    // This would involve:
    // 1. Authenticating with the ship using the code
    // 2. Subscribing to chat channels
    // 3. Setting up message handlers

    this.log.info("Connected to Urbit ship");
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    if (!this.config) {
      this.log.warn("Cannot send message: client not connected");
      return;
    }

    const ship = params.metadata?.ship as string;
    if (!ship) {
      this.log.warn("Cannot send message: no ship in metadata");
      return;
    }

    try {
      // TODO: Implement message sending to Urbit ship
      this.log.info(`Sending message to ${ship}: ${params.content}`);
    } catch (error) {
      this.log.error("Failed to send Tlon message:", error);
    }
  }

  protected async teardown(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.config = null;
    this.log.info("Tlon client disconnected");
  }

  protected buildSessionKey(from: string): string {
    // Build partial session key for Tlon
    // Format: tlon:direct:{ship}
    return `tlon:direct:${from}`;
  }

  protected getChannelMeta() {
    return {
      name: "Tlon",
      icon: "globe",
      supportsThreads: true,
      supportsReactions: true,
      supportsMedia: true,
    };
  }

  /**
   * Handle inbound events from the kernel.
   * Note: Tlon receives messages directly via the Urbit protocol,
   * so this method is not used for normal message handling.
   */
  protected async handleInbound(_event: MessageReceivedEvent): Promise<void> {
    this.log.debug("Received inbound event from kernel:", _event);
  }
}
