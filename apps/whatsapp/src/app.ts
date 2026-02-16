/**
 * WhatsApp Channel App
 *
 * Process-isolated WhatsApp integration using the OpenClawOS SDK.
 * Uses @whiskeysockets/baileys (unofficial WhatsApp Web API).
 */

import { ChannelApp, type SendMessageParams, type MessageReceivedEvent } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  type WASocket,
  type proto,
} from "@whiskeysockets/baileys";
import path from "node:path";
import fs from "node:fs/promises";
import type { WhatsAppAppConfig, MessageMeta } from "./config.js";

// Load manifest from JSON file
import manifest from "../openclawos.manifest.json" with { type: "json" };

export class WhatsAppApp extends ChannelApp {
  protected readonly channelId = "whatsapp";

  readonly manifest = manifest as unknown as PackageManifest;

  private config: WhatsAppAppConfig = {};
  private socket: WASocket | null = null;
  private authDir = "";
  private selfJid = "";

  protected async setupChannel(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("channels.whatsapp");
    this.config = (kernelConfig || {}) as WhatsAppAppConfig;

    // Resolve auth directory
    this.authDir = this.config.authDir || this.resolveDefaultAuthDir();
    await fs.mkdir(this.authDir, { recursive: true });

    // Check if we have existing auth
    const hasAuth = await this.hasAuthState();
    if (!hasAuth) {
      throw new Error(
        "WhatsApp requires QR login. Use gateway method whatsapp.requestQrLogin to initiate login.",
      );
    }

    // Connect to WhatsApp
    await this.connect();

    this.log.info("WhatsApp connected");
  }

  private resolveDefaultAuthDir(): string {
    const home = process.env.HOME || process.env.USERPROFILE || "/tmp";
    return path.join(home, ".openclaw", "whatsapp-auth");
  }

  private async hasAuthState(): Promise<boolean> {
    try {
      const credsPath = path.join(this.authDir, "creds.json");
      await fs.access(credsPath);
      return true;
    } catch {
      return false;
    }
  }

  private async connect(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    const { version } = await fetchLatestBaileysVersion();

    // Create a minimal logger
    const logger = {
      level: "silent",
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: (msg: unknown) => this.log.warn(String(msg)),
      error: (msg: unknown) => this.log.error(String(msg)),
      fatal: (msg: unknown) => this.log.error(String(msg)),
      child: () => logger,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pinoLogger = logger as any;

    this.socket = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pinoLogger),
      },
      version,
      logger: pinoLogger,
      printQRInTerminal: false,
      browser: ["OpenClawOS", "WhatsApp", "1.0.0"],
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });

    // Save credentials on update
    this.socket.ev.on("creds.update", saveCreds);

    // Handle connection updates
    this.socket.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output
          ?.statusCode;

        if (statusCode === DisconnectReason.loggedOut) {
          this.log.error("WhatsApp logged out");
        } else {
          this.log.warn(`WhatsApp connection closed: ${statusCode}`);
          // Attempt reconnect
          void this.reconnect();
        }
      }

      if (connection === "open") {
        this.selfJid = this.socket?.user?.id || "";
        this.log.info(`WhatsApp connected as ${this.selfJid}`);
      }
    });

    // Handle incoming messages
    this.socket.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") {
        return;
      }

      for (const msg of messages) {
        await this.handleIncomingMessage(msg);
      }
    });
  }

  private async reconnect(): Promise<void> {
    // Wait before reconnecting
    await new Promise((resolve) => setTimeout(resolve, 5000));

    if (this.socket) {
      try {
        await this.connect();
      } catch (error) {
        this.log.error("Reconnection failed:", error);
      }
    }
  }

  private async handleIncomingMessage(msg: proto.IWebMessageInfo): Promise<void> {
    // Skip status updates and own messages
    if (!msg.message || msg.key.fromMe) {
      return;
    }

    const remoteJid = msg.key.remoteJid;
    if (!remoteJid) {
      return;
    }

    // Extract message text
    const text = this.extractMessageText(msg);
    if (!text) {
      return;
    }

    const isGroup = remoteJid.endsWith("@g.us");
    const participant = msg.key.participant;

    // For self-chat mode, handle messages from self
    if (this.config.selfChatMode && remoteJid === this.selfJid) {
      return; // Skip self messages in normal flow
    }

    const meta: MessageMeta = {
      remoteJid,
      participant: participant || undefined,
      messageId: msg.key.id || "",
      isGroup,
      timestamp: msg.messageTimestamp
        ? typeof msg.messageTimestamp === "number"
          ? msg.messageTimestamp
          : msg.messageTimestamp.toNumber?.() || Number(msg.messageTimestamp)
        : undefined,
      quotedMessageId: msg.message?.extendedTextMessage?.contextInfo?.stanzaId ?? undefined,
    };

    // Build session key
    const senderId = isGroup ? participant || remoteJid : remoteJid;
    const sessionKey = isGroup
      ? `whatsapp:group:${remoteJid}`
      : `whatsapp:direct:${senderId.replace("@s.whatsapp.net", "")}`;

    await this.dispatchInbound(sessionKey, text, meta as unknown as Record<string, unknown>);
  }

  private extractMessageText(msg: proto.IWebMessageInfo): string | null {
    const message = msg.message;
    if (!message) {
      return null;
    }

    // Text message
    if (message.conversation) {
      return message.conversation;
    }

    // Extended text message (with mentions, links, etc.)
    if (message.extendedTextMessage?.text) {
      return message.extendedTextMessage.text;
    }

    // Image/video/document with caption
    if (message.imageMessage?.caption) {
      return `[Image] ${message.imageMessage.caption}`;
    }
    if (message.videoMessage?.caption) {
      return `[Video] ${message.videoMessage.caption}`;
    }
    if (message.documentMessage?.caption) {
      return `[Document: ${message.documentMessage.fileName}] ${message.documentMessage.caption}`;
    }

    // Just media without caption
    if (message.imageMessage) {
      return "[Image]";
    }
    if (message.videoMessage) {
      return "[Video]";
    }
    if (message.audioMessage) {
      return "[Audio]";
    }
    if (message.documentMessage) {
      return `[Document: ${message.documentMessage.fileName || "file"}]`;
    }
    if (message.stickerMessage) {
      return "[Sticker]";
    }

    return null;
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    if (!this.socket) {
      this.log.warn("Cannot send message: socket not connected");
      return;
    }

    const metadata = params.metadata || {};
    let jid = (metadata.remoteJid || metadata.jid || params.target) as string;

    // Ensure JID has proper suffix
    if (jid && !jid.includes("@")) {
      jid = `${jid}@s.whatsapp.net`;
    }

    if (!jid) {
      this.log.warn("Cannot send message: no JID specified");
      return;
    }

    try {
      await this.socket.sendMessage(jid, {
        text: params.content,
      });

      this.log.debug(`Sent message to ${jid}`);
    } catch (error) {
      this.log.error("Failed to send WhatsApp message:", error);
    }
  }

  protected async teardown(): Promise<void> {
    if (this.socket) {
      this.socket.end(undefined);
      this.socket = null;
    }
    this.log.info("WhatsApp channel stopped");
  }

  protected buildSessionKey(from: string): string {
    // Build partial session key - kernel will resolve agentId via routing
    return `whatsapp:${from}`;
  }

  protected getChannelMeta() {
    return {
      name: "WhatsApp",
      icon: "whatsapp",
      supportsThreads: false,
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
