/**
 * Discord App Configuration Types
 */

export interface DiscordAppConfig {
  /** Discord bot token */
  token?: string;

  /** Discord application ID */
  applicationId?: string;

  /** DM policy */
  dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";

  /** Group policy */
  groupPolicy?: "open" | "allowlist" | "disabled";

  /** Allowed sender IDs */
  allowFrom?: Array<string | number>;

  /** HTTP(S) proxy URL for gateway WebSocket */
  proxy?: string;
}

export interface MessageMeta {
  /** Channel ID */
  channelId: string;

  /** Guild ID (if in a guild) */
  guildId?: string;

  /** User ID of sender */
  userId: string;

  /** Message ID */
  messageId: string;

  /** Chat type */
  chatType: "direct" | "group" | "guild";

  /** If replying to a message, its ID */
  referencedMessageId?: string;
}

export interface OutboundMessageParams {
  channelId: string;
  content: string;
  replyToMessageId?: string;
}
