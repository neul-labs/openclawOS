/**
 * Telegram App Configuration Types
 */

export interface TelegramAppConfig {
  /** Telegram bot token from @BotFather */
  botToken?: string;

  /** Optional webhook URL for push mode (uses polling if not set) */
  webhookUrl?: string;

  /** Webhook secret for validation */
  webhookSecret?: string;

  /** DM policy */
  dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";

  /** Group policy */
  groupPolicy?: "open" | "allowlist" | "disabled";

  /** Allowed sender IDs */
  allowFrom?: Array<string | number>;
}

export interface MessageMeta {
  chatId: string;
  chatType: "private" | "group" | "supergroup" | "channel";
  messageId: number;
  threadId?: number;
  replyToMessageId?: number;
}

export interface OutboundMessageParams {
  chatId: string;
  content: string;
  threadId?: number;
  replyToMessageId?: number;
  parseMode?: "HTML" | "MarkdownV2";
}
