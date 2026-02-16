/**
 * WhatsApp App Configuration Types
 */

export interface WhatsAppAppConfig {
  /** Directory for WhatsApp authentication state */
  authDir?: string;

  /** Same-phone setup (bot uses your personal number) */
  selfChatMode?: boolean;

  /** DM policy */
  dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";

  /** Group policy */
  groupPolicy?: "open" | "allowlist" | "disabled";

  /** Allowed sender IDs (E.164 phone numbers) */
  allowFrom?: string[];

  /** Group allowed sender IDs */
  groupAllowFrom?: string[];

  /** Send read receipts */
  sendReadReceipts?: boolean;
}

export interface MessageMeta {
  /** Remote JID (sender/group) */
  remoteJid: string;

  /** Participant JID (for groups) */
  participant?: string;

  /** Message ID */
  messageId: string;

  /** Whether this is a group message */
  isGroup: boolean;

  /** Message timestamp */
  timestamp?: number;

  /** Quoted message ID (if replying) */
  quotedMessageId?: string;
}

export interface OutboundMessageParams {
  jid: string;
  content: string;
  quotedMessageId?: string;
}
