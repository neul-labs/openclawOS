/**
 * Telegram Channel App
 *
 * Process-isolated Telegram bot using the OpenClawOS SDK.
 */

import { ChannelApp, type SendMessageParams, type MessageReceivedEvent } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import { Bot } from "grammy";
import { run, type RunnerHandle } from "@grammyjs/runner";
import type { TelegramAppConfig, MessageMeta } from "./config.js";

// Load manifest from JSON file
import manifest from "../openclawos.manifest.json" with { type: "json" };

export class TelegramApp extends ChannelApp {
  protected readonly channelId = "telegram";

  readonly manifest = manifest as unknown as PackageManifest;

  private bot: Bot | null = null;
  private runner: RunnerHandle | null = null;
  private config: TelegramAppConfig = {};

  protected async setupChannel(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("channels.telegram");
    this.config = (kernelConfig || {}) as TelegramAppConfig;

    // Resolve bot token
    const token = this.config.botToken || process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error("TELEGRAM_BOT_TOKEN is required");
    }

    // Create bot instance
    this.bot = new Bot(token);

    // Set up message handlers
    this.setupMessageHandlers();

    // Start the bot
    if (this.config.webhookUrl) {
      await this.startWebhook();
    } else {
      await this.startPolling();
    }

    this.log.info("Telegram bot started");
  }

  private setupMessageHandlers(): void {
    if (!this.bot) {return;}

    // Handle text messages
    this.bot.on("message:text", async (ctx) => {
      const meta: MessageMeta = {
        chatId: String(ctx.chat.id),
        chatType: ctx.chat.type,
        messageId: ctx.message.message_id,
        threadId: ctx.message.message_thread_id,
        replyToMessageId: ctx.message.reply_to_message?.message_id,
      };

      // Build session key and dispatch to kernel
      await this.dispatchInbound(
        String(ctx.from.id),
        ctx.message.text,
        {
          ...meta,
          fromUsername: ctx.from.username,
          fromFirstName: ctx.from.first_name,
        },
      );
    });

    // Handle photos
    this.bot.on("message:photo", async (ctx) => {
      const meta: MessageMeta = {
        chatId: String(ctx.chat.id),
        chatType: ctx.chat.type,
        messageId: ctx.message.message_id,
      };

      const caption = ctx.message.caption || "[Photo]";
      await this.dispatchInbound(String(ctx.from.id), caption, {
        ...meta,
        hasPhoto: true,
        photoFileId: ctx.message.photo[ctx.message.photo.length - 1]?.file_id,
      });
    });

    // Handle documents
    this.bot.on("message:document", async (ctx) => {
      const meta: MessageMeta = {
        chatId: String(ctx.chat.id),
        chatType: ctx.chat.type,
        messageId: ctx.message.message_id,
      };

      const caption = ctx.message.caption || `[Document: ${ctx.message.document.file_name}]`;
      await this.dispatchInbound(String(ctx.from.id), caption, {
        ...meta,
        hasDocument: true,
        documentFileId: ctx.message.document.file_id,
        documentFileName: ctx.message.document.file_name,
      });
    });

    // Handle callback queries (button clicks)
    this.bot.on("callback_query:data", async (ctx) => {
      const data = ctx.callbackQuery.data;

      await this.dispatchInbound(
        String(ctx.from.id),
        data,
        {
          chatId: String(ctx.callbackQuery.message?.chat.id),
          chatType: ctx.callbackQuery.message?.chat.type || "private",
          isCallback: true,
          callbackQueryId: ctx.callbackQuery.id,
        },
      );

      // Acknowledge the callback
      await ctx.answerCallbackQuery();
    });
  }

  private async startPolling(): Promise<void> {
    if (!this.bot) {return;}

    this.runner = run(this.bot, {
      runner: {
        fetch: {
          allowed_updates: ["message", "callback_query", "my_chat_member"],
        },
      },
    });

    this.log.info("Telegram polling started");
  }

  private async startWebhook(): Promise<void> {
    // Webhook mode would require HTTP route registration
    // For now, fall back to polling
    this.log.warn("Webhook mode not yet implemented, using polling");
    await this.startPolling();
  }

  protected async sendMessage(params: SendMessageParams): Promise<void> {
    if (!this.bot) {
      this.log.warn("Cannot send message: bot not initialized");
      return;
    }

    const chatId = params.metadata?.chatId as string;
    if (!chatId) {
      this.log.warn("Cannot send message: no chatId in metadata");
      return;
    }

    try {
      await this.bot.api.sendMessage(chatId, params.content, {
        message_thread_id: params.metadata?.threadId as number | undefined,
        reply_to_message_id: params.metadata?.replyToMessageId as number | undefined,
        parse_mode: "HTML",
      });
    } catch (error) {
      this.log.error("Failed to send Telegram message:", error);

      // Retry without parse_mode if HTML parsing failed
      if (error instanceof Error && error.message.includes("parse")) {
        try {
          await this.bot.api.sendMessage(chatId, params.content, {
            message_thread_id: params.metadata?.threadId as number | undefined,
            reply_to_message_id: params.metadata?.replyToMessageId as number | undefined,
          });
        } catch (retryError) {
          this.log.error("Retry also failed:", retryError);
        }
      }
    }
  }

  protected async teardown(): Promise<void> {
    if (this.runner) {
      await this.runner.stop();
      this.runner = null;
    }
    this.bot = null;
    this.log.info("Telegram bot stopped");
  }

  protected buildSessionKey(from: string): string {
    // Build partial session key - kernel will resolve agentId via routing
    // Format matches existing: telegram:{peerKind}:{peerId}
    return `telegram:direct:${from}`;
  }

  protected getChannelMeta() {
    return {
      name: "Telegram",
      icon: "telegram",
      supportsThreads: true,
      supportsReactions: true,
      supportsMedia: true,
    };
  }

  /**
   * Handle inbound events from the kernel.
   * Note: Telegram receives messages directly from its API via grammY,
   * so this method is not used for normal message handling.
   */
  protected async handleInbound(_event: MessageReceivedEvent): Promise<void> {
    // Telegram messages come from grammY handlers, not from kernel push
    // This method would be used if the kernel needed to push data to the channel
    this.log.debug("Received inbound event from kernel:", _event);
  }
}
