/**
 * Signal App Configuration Types
 */

export interface SignalAppConfig {
  /** Full URL for signal-cli HTTP daemon (e.g., http://127.0.0.1:8080) */
  httpUrl?: string;

  /** HTTP host for signal-cli daemon (default: 127.0.0.1) */
  httpHost?: string;

  /** HTTP port for signal-cli daemon (default: 8080) */
  httpPort?: number;

  /** E.164 phone number for signal-cli account */
  account?: string;

  /** DM policy */
  dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";

  /** Group policy */
  groupPolicy?: "open" | "allowlist" | "disabled";

  /** Allowed sender IDs (E.164 phone numbers) */
  allowFrom?: Array<string | number>;

  /** Group allowed sender IDs */
  groupAllowFrom?: Array<string | number>;

  /** Send read receipts */
  sendReadReceipts?: boolean;
}

export interface SignalSseEvent {
  event?: string;
  data?: string;
  id?: string;
}

export interface SignalRpcOptions {
  baseUrl: string;
  timeoutMs?: number;
}

export interface SignalRpcError {
  code?: number;
  message?: string;
  data?: unknown;
}

export interface SignalRpcResponse<T> {
  jsonrpc?: string;
  result?: T;
  error?: SignalRpcError;
  id?: string | number | null;
}

export interface MessageMeta {
  /** Sender identifier (phone number or UUID) */
  sender: string;

  /** Group ID if message is from a group */
  groupId?: string;

  /** Group name */
  groupName?: string;

  /** Message timestamp */
  timestamp?: number;

  /** Whether this is a group message */
  isGroup?: boolean;
}

export interface OutboundMessageParams {
  recipient: string;
  content: string;
  groupId?: string;
}
