/**
 * iMessage Channel App
 *
 * Process-isolated iMessage client using the OpenClawOS SDK.
 * Uses macOS AppleScript to interact with the Messages app.
 */

import { ChannelApp, type SendMessageParams, type MessageReceivedEvent } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import type { IMessageAppConfig, IMessageMessageMeta } from "./config.js";

import manifest from "../openclawos.manifest.json" with { type: "json" };

export class IMessageApp extends ChannelApp {
  protected readonly channelId = "imessage";

  readonly manifest = manifest as unknown as PackageManifest;

  private config: IMessageAppConfig = {};

  protected async setupChannel(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("channels.imessage");
    this.config = (kernelConfig || {}) as IMessageAppConfig;

    // Verify we're on macOS
    if (process.platform !== "darwin") {
      throw new Error("iMessage app only works on macOS");
    }

    this.log.info("iMessage channel initialized (macOS AppleScript mode)");
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    const handle = params.metadata?.handle as string;
    if (!handle) {
      this.log.warn("Cannot send message: no handle in metadata");
      return;
    }

    try {
      // Use AppleScript to send message via Messages app
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execFileAsync = promisify(execFile);

      const script = `
        tell application "Messages"
          set targetService to 1st account whose service type = iMessage
          set targetBuddy to participant "${handle}" of targetService
          send "${params.content.replace(/"/g, '\\"')}" to targetBuddy
        end tell
      `;

      await execFileAsync("osascript", ["-e", script]);
      this.log.debug(`Sent message to ${handle}`);
    } catch (error) {
      this.log.error("Failed to send iMessage:", error);
    }
  }

  protected async teardown(): Promise<void> {
    this.log.info("iMessage channel shut down");
  }

  protected buildSessionKey(from: string): string {
    // Build session key for iMessage
    // Format: imessage:direct:{handle}
    return `imessage:direct:${from}`;
  }

  protected getChannelMeta() {
    return {
      name: "iMessage",
      icon: "apple",
      supportsThreads: false,
      supportsReactions: true,
      supportsMedia: true,
    };
  }

  /**
   * Handle inbound events from the kernel.
   * Note: iMessage receives messages through polling or external notification,
   * so this method handles messages forwarded by the kernel.
   */
  protected async handleInbound(event: MessageReceivedEvent): Promise<void> {
    this.log.debug("Received inbound event from kernel:", event);

    // Extract metadata
    const meta = event.metadata as IMessageMessageMeta | undefined;
    if (!meta?.handle) {
      this.log.warn("Received message without handle metadata");
      return;
    }

    // Dispatch to kernel for processing
    await this.dispatchInbound(meta.handle, event.content, meta);
  }
}
