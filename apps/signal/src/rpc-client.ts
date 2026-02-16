/**
 * Signal JSON-RPC Client
 *
 * Handles communication with signal-cli daemon via JSON-RPC over HTTP.
 */

import { randomUUID } from "node:crypto";
import type { SignalRpcOptions, SignalRpcResponse } from "./config.js";

const DEFAULT_TIMEOUT_MS = 10_000;

function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error("Signal base URL is required");
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, "");
  }
  return `http://${trimmed}`.replace(/\/+$/, "");
}

/**
 * Make a JSON-RPC request to signal-cli daemon.
 */
export async function signalRpcRequest<T = unknown>(
  method: string,
  params: Record<string, unknown> | undefined,
  opts: SignalRpcOptions,
): Promise<T> {
  const baseUrl = normalizeBaseUrl(opts.baseUrl);
  const id = randomUUID();
  const body = JSON.stringify({
    jsonrpc: "2.0",
    method,
    params,
    id,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/api/v1/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });

    if (res.status === 201) {
      return undefined as T;
    }

    const text = await res.text();
    if (!text) {
      throw new Error(`Signal RPC empty response (status ${res.status})`);
    }

    const parsed = JSON.parse(text) as SignalRpcResponse<T>;
    if (parsed.error) {
      const code = parsed.error.code ?? "unknown";
      const msg = parsed.error.message ?? "Signal RPC error";
      throw new Error(`Signal RPC ${code}: ${msg}`);
    }

    return parsed.result as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if the signal-cli daemon is available.
 */
export async function signalCheck(
  baseUrl: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ ok: boolean; status?: number | null; error?: string | null }> {
  const normalized = normalizeBaseUrl(baseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${normalized}/api/v1/check`, {
      method: "GET",
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }

    return { ok: true, status: res.status, error: null };
  } catch (err) {
    return {
      ok: false,
      status: null,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Send a message via signal-cli.
 */
export async function sendMessage(params: {
  baseUrl: string;
  account?: string;
  recipient: string;
  message: string;
  groupId?: string;
}): Promise<void> {
  const { baseUrl, account, recipient, message, groupId } = params;

  const rpcParams: Record<string, unknown> = {
    message,
  };

  if (account) {
    rpcParams.account = account;
  }

  if (groupId) {
    rpcParams.groupId = groupId;
  } else {
    rpcParams.recipient = [recipient];
  }

  await signalRpcRequest("send", rpcParams, { baseUrl });
}

/**
 * Send a reaction via signal-cli.
 */
export async function sendReaction(params: {
  baseUrl: string;
  account?: string;
  recipient: string;
  emoji: string;
  targetAuthor: string;
  targetTimestamp: number;
  groupId?: string;
}): Promise<void> {
  const { baseUrl, account, recipient, emoji, targetAuthor, targetTimestamp, groupId } = params;

  const rpcParams: Record<string, unknown> = {
    emoji,
    targetAuthor,
    targetTimestamp,
  };

  if (account) {
    rpcParams.account = account;
  }

  if (groupId) {
    rpcParams.groupId = groupId;
  } else {
    rpcParams.recipient = [recipient];
  }

  await signalRpcRequest("sendReaction", rpcParams, { baseUrl });
}

/**
 * Mark a message as read via signal-cli.
 */
export async function markAsRead(params: {
  baseUrl: string;
  account?: string;
  sender: string;
  timestamp: number;
}): Promise<void> {
  const { baseUrl, account, sender, timestamp } = params;

  const rpcParams: Record<string, unknown> = {
    recipient: sender,
    targetTimestamp: [timestamp],
  };

  if (account) {
    rpcParams.account = account;
  }

  await signalRpcRequest("sendReceipt", { ...rpcParams, type: "read" }, { baseUrl });
}
