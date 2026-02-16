/**
 * Matrix Channel App
 *
 * Process-isolated Matrix client using the OpenClawOS SDK.
 */

import { ChannelApp, type SendMessageParams, type MessageReceivedEvent } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import type { MatrixAppConfig, MatrixMessageMeta } from "./config.js";

import manifest from "../openclawos.manifest.json" with { type: "json" };

export class MatrixApp extends ChannelApp {
  protected readonly channelId = "matrix";

  readonly manifest = manifest as unknown as PackageManifest;

  private config: MatrixAppConfig = {};
  private connected: boolean = false;

  protected async setupChannel(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("channels.matrix");
    this.config = (kernelConfig || {}) as MatrixAppConfig;

    // Validate required configuration
    const homeserver = this.config.homeserver;
    if (!homeserver) {
      throw new Error("Matrix homeserver is required (channels.matrix.homeserver)");
    }

    // Resolve authentication from config or env
    const accessToken = this.config.accessToken || process.env.MATRIX_ACCESS_TOKEN;
    const password = this.config.password || process.env.MATRIX_PASSWORD;

    if (!accessToken && !password) {
      throw new Error("Matrix authentication required: provide accessToken or password");
    }

    this.log.info(`Connecting to Matrix homeserver: ${homeserver}`);

    // TODO: Initialize Matrix client
    // This is a placeholder implementation that should be replaced with actual Matrix SDK integration
    // Example: Initialize matrix-sdk-js client, authenticate, start sync

    this.connected = true;
    this.log.info("Matrix client connected (placeholder implementation)");
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    if (!this.connected) {
      this.log.warn("Cannot send message: client not connected");
      return;
    }

    const roomId = params.metadata?.roomId as string;
    if (!roomId) {
      this.log.warn("Cannot send message: no roomId in metadata");
      return;
    }

    try {
      // TODO: Implement actual Matrix message sending
      // Example: await matrixClient.sendMessage(roomId, { msgtype: "m.text", body: params.content })
      this.log.debug(`Sending message to room ${roomId}: ${params.content}`);
    } catch (error) {
      this.log.error("Failed to send Matrix message:", error);
    }
  }

  protected async teardown(): Promise<void> {
    if (this.connected) {
      // TODO: Implement proper Matrix client shutdown
      // Example: await matrixClient.stopClient()
      this.connected = false;
    }
    this.log.info("Matrix client disconnected");
  }

  protected buildSessionKey(from: string): string {
    // Build partial session key for Matrix
    // Format: matrix:direct:{userId}
    return `matrix:direct:${from}`;
  }

  protected getChannelMeta() {
    return {
      name: "Matrix",
      icon: "grid",
      supportsThreads: true,
      supportsReactions: true,
      supportsMedia: true,
    };
  }

  /**
   * Handle inbound events from the kernel.
   * Note: Matrix receives messages directly via the Matrix protocol,
   * so this method is not used for normal message handling.
   */
  protected async handleInbound(_event: MessageReceivedEvent): Promise<void> {
    this.log.debug("Received inbound event from kernel:", _event);
  }

  /**
   * Handle incoming Matrix messages (to be called by Matrix client event handlers)
   */
  private async handleMatrixMessage(
    roomId: string,
    eventId: string,
    senderId: string,
    content: string,
    isGroup: boolean,
    threadId?: string
  ): Promise<void> {
    // TODO: This should be called by Matrix SDK event handlers
    const meta: MatrixMessageMeta = {
      roomId,
      eventId,
      senderId,
      isGroup,
      threadId,
    };

    // Dispatch to kernel
    await this.dispatchInbound(senderId, content, meta);
  }
}
