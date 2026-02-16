/**
 * Slack App Configuration Types
 */

export interface SlackAppConfig {
  /** Slack bot OAuth token (xoxb-...) */
  botToken?: string;

  /** Slack app-level token for socket mode (xapp-...) */
  appToken?: string;

  /** Connection mode (socket or http) */
  mode?: "socket" | "http";

  /** Slack signing secret (required for HTTP mode) */
  signingSecret?: string;

  /** Webhook path for HTTP mode */
  webhookPath?: string;

  /** DM policy */
  dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";

  /** Group policy */
  groupPolicy?: "open" | "allowlist" | "disabled";

  /** Require @mention to trigger bot */
  requireMention?: boolean;

  /** Allowed sender IDs */
  allowFrom?: Array<string | number>;
}

export interface MessageMeta {
  /** Channel ID */
  channel: string;

  /** User ID of sender */
  user: string;

  /** Thread timestamp (for threaded messages) */
  threadTs?: string;

  /** Message timestamp */
  ts: string;

  /** Chat type */
  chatType: "direct" | "group" | "channel";

  /** Team ID */
  team?: string;
}

export interface OutboundMessageParams {
  channel: string;
  content: string;
  threadTs?: string;
}
