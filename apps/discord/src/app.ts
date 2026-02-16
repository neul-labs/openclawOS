/**
 * Discord Channel App
 *
 * Process-isolated Discord bot using the OpenClawOS SDK.
 * Uses @buape/carbon for Discord gateway and API interaction.
 */

import { ChannelApp, type SendMessageParams, type MessageReceivedEvent } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import { Client, MessageCreateListener } from "@buape/carbon";
import { GatewayPlugin, GatewayIntents } from "@buape/carbon/gateway";
import type { DiscordAppConfig, MessageMeta } from "./config.js";

// Load manifest from JSON file
import manifest from "../openclawos.manifest.json" with { type: "json" };

// Type for the message event data from MessageCreateListener
type DiscordMessageEvent = Parameters<MessageCreateListener["handle"]>[0];

// Custom message listener class
class AppMessageListener extends MessageCreateListener {
  constructor(private handler: (message: DiscordMessageEvent, client: Client) => Promise<void>) {
    super();
  }

  async handle(message: DiscordMessageEvent, client: Client) {
    await this.handler(message, client);
  }
}

export class DiscordApp extends ChannelApp {
  protected readonly channelId = "discord";

  readonly manifest = manifest as unknown as PackageManifest;

  private config: DiscordAppConfig = {};
  private client: Client | null = null;
  private gateway: GatewayPlugin | null = null;
  private botUserId = "";

  protected async setupChannel(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("channels.discord");
    this.config = (kernelConfig || {}) as DiscordAppConfig;

    // Resolve token
    const token = this.config.token || process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      throw new Error("DISCORD_BOT_TOKEN is required");
    }

    // Fetch application ID
    const applicationId = this.config.applicationId || (await this.fetchApplicationId(token));
    if (!applicationId) {
      throw new Error("Could not resolve Discord application ID");
    }

    // Create gateway plugin with intents
    const intents =
      GatewayIntents.Guilds |
      GatewayIntents.GuildMessages |
      GatewayIntents.MessageContent |
      GatewayIntents.DirectMessages |
      GatewayIntents.GuildMessageReactions |
      GatewayIntents.DirectMessageReactions;

    this.gateway = new GatewayPlugin({
      reconnect: { maxAttempts: 50 },
      intents,
      autoInteractions: true,
    });

    // Create client
    this.client = new Client(
      {
        baseUrl: "http://localhost",
        deploySecret: "a",
        clientId: applicationId,
        publicKey: "a",
        token,
        autoDeploy: false,
      },
      {
        commands: [],
        listeners: [new AppMessageListener(this.handleMessage.bind(this))],
        components: [],
      },
      [this.gateway],
    );

    // Get bot user ID
    try {
      const botUser = await this.client.fetchUser("@me");
      this.botUserId = botUser?.id || "";
      this.log.info(`Authenticated as bot user ${this.botUserId}`);
    } catch (error) {
      this.log.warn("Failed to fetch bot identity:", error);
    }

    this.log.info("Discord gateway connected");
  }

  private async fetchApplicationId(token: string): Promise<string | null> {
    try {
      const res = await fetch("https://discord.com/api/v10/applications/@me", {
        headers: { Authorization: `Bot ${token}` },
      });
      if (!res.ok) {
        return null;
      }
      const data = (await res.json()) as { id?: string };
      return data.id || null;
    } catch {
      return null;
    }
  }

  private async handleMessage(data: DiscordMessageEvent, _client: Client): Promise<void> {
    // Ignore bot messages
    if (data.author?.bot) {
      return;
    }

    const content = data.message?.content;
    const userId = data.author?.id;
    const channelId = data.channel_id;

    if (!content || !userId || !channelId) {
      return;
    }

    // Determine chat type
    let chatType: "direct" | "group" | "guild" = "guild";
    if (!data.guild_id) {
      chatType = "direct";
    }

    const meta: MessageMeta = {
      channelId,
      guildId: data.guild_id,
      userId,
      messageId: data.message?.id || "",
      chatType,
      referencedMessageId: data.rawMessage?.referenced_message?.id,
    };

    // Build session key
    const sessionKey = chatType === "direct"
      ? `discord:direct:${channelId}:${userId}`
      : `discord:guild:${data.guild_id}:${channelId}`;

    await this.dispatchInbound(sessionKey, content, meta as unknown as Record<string, unknown>);
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    const metadata = params.metadata || {};
    const channelId = (metadata.channelId || params.target) as string;

    if (!channelId) {
      this.log.warn("Cannot send message: no channelId specified");
      return;
    }

    try {
      // Use REST API to send message
      const token = this.config.token || process.env.DISCORD_BOT_TOKEN;
      const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: params.content,
          message_reference: metadata.replyToMessageId
            ? { message_id: metadata.replyToMessageId }
            : undefined,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Discord API error: ${res.status} ${text}`);
      }

      this.log.debug(`Sent message to ${channelId}`);
    } catch (error) {
      this.log.error("Failed to send Discord message:", error);
    }
  }

  protected async teardown(): Promise<void> {
    if (this.gateway) {
      this.gateway.disconnect();
      this.gateway = null;
    }
    this.client = null;
    this.log.info("Discord channel stopped");
  }

  protected buildSessionKey(from: string): string {
    // Build partial session key - kernel will resolve agentId via routing
    return `discord:${from}`;
  }

  protected getChannelMeta() {
    return {
      name: "Discord",
      icon: "discord",
      supportsThreads: true,
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
