/**
 * IRC Channel App
 *
 * Process-isolated IRC client using the OpenClawOS SDK.
 */

import { ChannelApp, type SendMessageParams, type MessageReceivedEvent } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import { connectIrcClient, type IrcClient, type IrcPrivmsgEvent } from "./client.js";
import { makeIrcMessageId } from "./protocol.js";
import type { IrcAppConfig, IrcMessageMeta } from "./config.js";
import { isChannelTarget } from "./config.js";

import manifest from "../openclawos.manifest.json" with { type: "json" };

export class IrcApp extends ChannelApp {
  protected readonly channelId = "irc";

  readonly manifest = manifest as unknown as PackageManifest;

  private client: IrcClient | null = null;
  private config: IrcAppConfig = {};
  private abortController: AbortController | null = null;

  protected async setupChannel(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("channels.irc");
    this.config = (kernelConfig || {}) as IrcAppConfig;

    // Resolve connection parameters
    const host = this.config.host;
    const nick = this.config.nick;

    if (!host) {
      throw new Error("IRC host is required (channels.irc.host)");
    }
    if (!nick) {
      throw new Error("IRC nick is required (channels.irc.nick)");
    }

    const port = this.config.port ?? (this.config.tls !== false ? 6697 : 6667);
    const useTls = this.config.tls !== false;
    const username = this.config.username || nick;
    const realname = this.config.realname || "OpenClawOS Bot";

    // Resolve password from env if not in config
    const password = this.config.password || process.env.IRC_PASSWORD;
    const nickservPassword =
      this.config.nickserv?.password || process.env.IRC_NICKSERV_PASSWORD;

    this.abortController = new AbortController();

    this.log.info(`Connecting to ${host}:${port}${useTls ? " (TLS)" : ""} as ${nick}`);

    // Connect to IRC
    this.client = await connectIrcClient({
      host,
      port,
      tls: useTls,
      nick,
      username,
      realname,
      password,
      nickserv: this.config.nickserv
        ? {
            ...this.config.nickserv,
            password: nickservPassword,
          }
        : undefined,
      channels: this.config.channels,
      abortSignal: this.abortController.signal,
      onPrivmsg: (event) => this.handlePrivmsg(event),
      onNotice: (text, target) => {
        this.log.debug(`NOTICE ${target ?? ""}: ${text}`);
      },
      onError: (error) => {
        this.log.error(`IRC error: ${error.message}`);
      },
      onLine: (line) => {
        this.log.debug(`<< ${line}`);
      },
    });

    this.log.info(`Connected as ${this.client.nick}`);
  }

  private async handlePrivmsg(event: IrcPrivmsgEvent): Promise<void> {
    if (!this.client) {
      return;
    }

    // Ignore messages from self
    if (event.senderNick.toLowerCase() === this.client.nick.toLowerCase()) {
      return;
    }

    // Determine if this is a group message or DM
    const isGroup = isChannelTarget(event.target);
    // For group messages, target is the channel; for DMs, target is the sender's nick
    const conversationTarget = isGroup ? event.target : event.senderNick;

    const meta: IrcMessageMeta = {
      target: conversationTarget,
      senderNick: event.senderNick,
      senderUser: event.senderUser,
      senderHost: event.senderHost,
      isGroup,
      messageId: makeIrcMessageId(),
    };

    // Dispatch to kernel
    await this.dispatchInbound(event.senderNick, event.text, meta);
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    if (!this.client) {
      this.log.warn("Cannot send message: client not connected");
      return;
    }

    const target = params.metadata?.target as string;
    if (!target) {
      this.log.warn("Cannot send message: no target in metadata");
      return;
    }

    try {
      this.client.sendPrivmsg(target, params.content);
    } catch (error) {
      this.log.error("Failed to send IRC message:", error);
    }
  }

  protected async teardown(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.client) {
      this.client.quit("shutdown");
      this.client = null;
    }
    this.log.info("IRC client disconnected");
  }

  protected buildSessionKey(from: string): string {
    // Build partial session key for IRC
    // Format: irc:direct:{nick} or irc:group:{channel}
    return `irc:direct:${from}`;
  }

  protected getChannelMeta() {
    return {
      name: "IRC",
      icon: "hash",
      supportsThreads: false,
      supportsReactions: false,
      supportsMedia: false,
    };
  }

  /**
   * Handle inbound events from the kernel.
   * Note: IRC receives messages directly via the IRC protocol,
   * so this method is not used for normal message handling.
   */
  protected async handleInbound(_event: MessageReceivedEvent): Promise<void> {
    this.log.debug("Received inbound event from kernel:", _event);
  }
}
