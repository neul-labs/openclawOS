/**
 * Nostr Channel App
 *
 * Process-isolated Nostr client using the OpenClawOS SDK.
 */

import { ChannelApp, type SendMessageParams, type MessageReceivedEvent } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import type { NostrAppConfig, NostrMessageMeta } from "./config.js";

import manifest from "../openclawos.manifest.json" with { type: "json" };

export class NostrApp extends ChannelApp {
  protected readonly channelId = "nostr";

  readonly manifest = manifest as unknown as PackageManifest;

  private config: NostrAppConfig | null = null;
  private publicKey: string | null = null;

  protected async setupChannel(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("channels.nostr");
    this.config = kernelConfig as NostrAppConfig;

    if (!this.config) {
      throw new Error("Nostr configuration is required");
    }

    // Validate required fields
    if (!this.config.privateKey) {
      throw new Error("Nostr private key is required (channels.nostr.privateKey)");
    }
    if (!this.config.relays || this.config.relays.length === 0) {
      throw new Error("At least one Nostr relay is required (channels.nostr.relays)");
    }

    // Resolve private key from env if not in config
    const privateKey = this.config.privateKey || process.env.NOSTR_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("Nostr private key not found in config or environment");
    }

    this.log.info(`Connecting to Nostr relays: ${this.config.relays.join(", ")}`);

    // TODO: Initialize Nostr client with nostr-tools
    // - Derive public key from private key
    // - Connect to relays
    // - Subscribe to DMs for this pubkey
    // - Handle incoming encrypted DMs (NIP-04)

    this.publicKey = "TODO_DERIVE_FROM_PRIVATE_KEY";
    this.log.info(`Nostr client initialized with pubkey: ${this.publicKey}`);
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    if (!this.config || !this.publicKey) {
      this.log.warn("Cannot send message: client not initialized");
      return;
    }

    const targetPubkey = params.metadata?.pubkey as string;
    if (!targetPubkey) {
      this.log.warn("Cannot send message: no pubkey in metadata");
      return;
    }

    try {
      // TODO: Implement Nostr message sending
      // - Encrypt message content using NIP-04
      // - Create kind 4 (encrypted DM) event
      // - Sign event with private key
      // - Publish to all connected relays
      this.log.info(`Sending message to ${targetPubkey}: ${params.content}`);
    } catch (error) {
      this.log.error("Failed to send Nostr message:", error);
    }
  }

  protected async teardown(): Promise<void> {
    // TODO: Close relay connections
    this.log.info("Nostr client disconnected");
  }

  protected buildSessionKey(from: string): string {
    // Build partial session key for Nostr
    // Format: nostr:direct:{pubkey}
    return `nostr:direct:${from}`;
  }

  protected getChannelMeta() {
    return {
      name: "Nostr",
      icon: "zap",
      supportsThreads: true,
      supportsReactions: true,
      supportsMedia: false,
    };
  }

  /**
   * Handle inbound events from the kernel.
   * Note: Nostr receives messages directly via the Nostr protocol,
   * so this method is not used for normal message handling.
   */
  protected async handleInbound(_event: MessageReceivedEvent): Promise<void> {
    this.log.debug("Received inbound event from kernel:", _event);
  }
}
