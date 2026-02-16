/**
 * Slack Channel App
 *
 * Process-isolated Slack integration using the OpenClawOS SDK.
 * Uses @slack/bolt for both Socket Mode and HTTP webhook handling.
 */

import { ChannelApp, type SendMessageParams, type MessageReceivedEvent } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import SlackBolt from "@slack/bolt";
import type { SlackAppConfig, MessageMeta } from "./config.js";

// Load manifest from JSON file
import manifest from "../openclawos.manifest.json" with { type: "json" };

// Handle CJS/ESM compatibility
const slackBoltModule = SlackBolt as typeof import("@slack/bolt") & {
  default?: typeof import("@slack/bolt");
};
const slackBolt =
  (slackBoltModule.App ? slackBoltModule : slackBoltModule.default) ?? slackBoltModule;
const { App, HTTPReceiver } = slackBolt;

export class SlackApp extends ChannelApp {
  protected readonly channelId = "slack";

  readonly manifest = manifest as unknown as PackageManifest;

  private config: SlackAppConfig = {};
  private boltApp: InstanceType<typeof App> | null = null;
  private botUserId = "";
  private teamId = "";

  protected async setupChannel(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("channels.slack");
    this.config = (kernelConfig || {}) as SlackAppConfig;

    // Resolve tokens
    const botToken = this.config.botToken || process.env.SLACK_BOT_TOKEN;
    const appToken = this.config.appToken || process.env.SLACK_APP_TOKEN;
    const mode = this.config.mode || "socket";

    if (!botToken) {
      throw new Error("SLACK_BOT_TOKEN is required");
    }

    if (mode === "socket" && !appToken) {
      throw new Error("SLACK_APP_TOKEN is required for socket mode");
    }

    // Create Bolt app
    if (mode === "socket") {
      this.boltApp = new App({
        token: botToken,
        appToken,
        socketMode: true,
      });
    } else {
      const signingSecret = this.config.signingSecret;
      if (!signingSecret) {
        throw new Error("Slack signing secret is required for HTTP mode");
      }
      const receiver = new HTTPReceiver({
        signingSecret,
        endpoints: this.config.webhookPath || "/slack/events",
      });
      this.boltApp = new App({
        token: botToken,
        receiver,
      });
    }

    // Get bot info
    try {
      const auth = await this.boltApp.client.auth.test({ token: botToken });
      this.botUserId = auth.user_id ?? "";
      this.teamId = auth.team_id ?? "";
      this.log.info(`Authenticated as bot user ${this.botUserId} in team ${this.teamId}`);
    } catch (error) {
      this.log.warn("Auth test failed, continuing without bot user ID:", error);
    }

    // Set up message handlers
    this.setupMessageHandlers();

    // Start the app
    await this.boltApp.start();

    this.log.info(`Slack ${mode} mode started`);
  }

  private setupMessageHandlers(): void {
    if (!this.boltApp) {return;}

    // Handle all messages
    this.boltApp.message(async ({ message }) => {
      // Type guard - ensure message has required properties
      const msg = message as {
        bot_id?: string;
        subtype?: string;
        user?: string;
        text?: string;
        channel?: string;
        ts?: string;
        thread_ts?: string;
        channel_type?: string;
      };

      // Filter out bot messages
      if (msg.bot_id || msg.subtype) {
        return;
      }

      // Ensure it's a standard message with required fields
      if (!msg.user || !msg.text || !msg.channel) {
        return;
      }

      const user = msg.user;
      const text = msg.text;
      const channel = msg.channel;
      const ts = msg.ts || "";
      const threadTs = msg.thread_ts;

      // Determine chat type
      let chatType: "direct" | "group" | "channel" = "channel";
      if (msg.channel_type === "im") {
        chatType = "direct";
      } else if (msg.channel_type === "mpim") {
        chatType = "group";
      }

      // Check mention requirement for channels
      if (chatType === "channel" && this.config.requireMention !== false) {
        const botMention = `<@${this.botUserId}>`;
        if (!text.includes(botMention)) {
          return;
        }
      }

      const meta: MessageMeta = {
        channel,
        user,
        ts,
        threadTs,
        chatType,
        team: this.teamId,
      };

      // Build session key using thread context for threading support
      const sessionKey = threadTs
        ? `slack:thread:${channel}:${threadTs}`
        : `slack:${chatType}:${channel}:${user}`;

      await this.dispatchInbound(sessionKey, text, meta as unknown as Record<string, unknown>);
    });

    // Handle app mentions
    this.boltApp.event("app_mention", async ({ event }) => {
      const user = event.user;
      const text = event.text;
      const channel = event.channel;
      const ts = event.ts;
      const threadTs = event.thread_ts;

      const meta: MessageMeta = {
        channel,
        user: user || "",
        ts,
        threadTs,
        chatType: "channel",
        team: this.teamId,
      };

      const sessionKey = threadTs
        ? `slack:thread:${channel}:${threadTs}`
        : `slack:channel:${channel}:${user || "unknown"}`;

      await this.dispatchInbound(sessionKey, text, meta as unknown as Record<string, unknown>);
    });
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    if (!this.boltApp) {
      this.log.warn("Cannot send message: Bolt app not initialized");
      return;
    }

    const metadata = params.metadata || {};
    const channel = (metadata.channel || params.target) as string;
    const threadTs = metadata.threadTs as string | undefined;

    if (!channel) {
      this.log.warn("Cannot send message: no channel specified");
      return;
    }

    try {
      await this.boltApp.client.chat.postMessage({
        channel,
        text: params.content,
        thread_ts: threadTs,
        mrkdwn: true,
      });

      this.log.debug(`Sent message to ${channel}`);
    } catch (error) {
      this.log.error("Failed to send Slack message:", error);
    }
  }

  protected async teardown(): Promise<void> {
    if (this.boltApp) {
      await this.boltApp.stop();
      this.boltApp = null;
    }
    this.log.info("Slack channel stopped");
  }

  protected buildSessionKey(from: string): string {
    // Build partial session key - kernel will resolve agentId via routing
    return `slack:${from}`;
  }

  protected getChannelMeta() {
    return {
      name: "Slack",
      icon: "slack",
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
