/**
 * Signal SSE Client
 *
 * Handles Server-Sent Events from signal-cli daemon with auto-reconnect.
 */

import type { SignalSseEvent } from "./config.js";

interface BackoffPolicy {
  initialMs: number;
  maxMs: number;
  factor: number;
  jitter: number;
}

const DEFAULT_RECONNECT_POLICY: BackoffPolicy = {
  initialMs: 1_000,
  maxMs: 10_000,
  factor: 2,
  jitter: 0.2,
};

function computeBackoff(policy: BackoffPolicy, attempt: number): number {
  const base = policy.initialMs * Math.pow(policy.factor, attempt - 1);
  const capped = Math.min(base, policy.maxMs);
  const jitter = capped * policy.jitter * (Math.random() * 2 - 1);
  return Math.round(capped + jitter);
}

function sleepWithAbort(ms: number, abortSignal?: AbortSignal): Promise<void> {
  return new Promise((resolve, _reject) => {
    if (abortSignal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    abortSignal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

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
 * Stream events from signal-cli SSE endpoint.
 */
export async function streamSignalEvents(params: {
  baseUrl: string;
  account?: string;
  abortSignal?: AbortSignal;
  onEvent: (event: SignalSseEvent) => void;
}): Promise<void> {
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  const url = new URL(`${baseUrl}/api/v1/events`);
  if (params.account) {
    url.searchParams.set("account", params.account);
  }

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "text/event-stream" },
    signal: params.abortSignal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`Signal SSE failed (${res.status} ${res.statusText || "error"})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent: SignalSseEvent = {};

  const flushEvent = () => {
    if (!currentEvent.data && !currentEvent.event && !currentEvent.id) {
      return;
    }
    params.onEvent({
      event: currentEvent.event,
      data: currentEvent.data,
      id: currentEvent.id,
    });
    currentEvent = {};
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    let lineEnd = buffer.indexOf("\n");
    while (lineEnd !== -1) {
      let line = buffer.slice(0, lineEnd);
      buffer = buffer.slice(lineEnd + 1);
      if (line.endsWith("\r")) {
        line = line.slice(0, -1);
      }

      if (line === "") {
        flushEvent();
        lineEnd = buffer.indexOf("\n");
        continue;
      }
      if (line.startsWith(":")) {
        lineEnd = buffer.indexOf("\n");
        continue;
      }
      const [rawField, ...rest] = line.split(":");
      const field = rawField.trim();
      const rawValue = rest.join(":");
      const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;
      if (field === "event") {
        currentEvent.event = value;
      } else if (field === "data") {
        currentEvent.data = currentEvent.data ? `${currentEvent.data}\n${value}` : value;
      } else if (field === "id") {
        currentEvent.id = value;
      }
      lineEnd = buffer.indexOf("\n");
    }
  }

  flushEvent();
}

interface SseLoopParams {
  baseUrl: string;
  account?: string;
  abortSignal?: AbortSignal;
  onEvent: (event: SignalSseEvent) => void;
  onError?: (error: Error) => void;
  onReconnect?: (attempt: number, delayMs: number) => void;
  policy?: Partial<BackoffPolicy>;
}

/**
 * Run SSE event loop with auto-reconnect.
 */
export async function runSignalSseLoop(params: SseLoopParams): Promise<void> {
  const reconnectPolicy = {
    ...DEFAULT_RECONNECT_POLICY,
    ...params.policy,
  };
  let reconnectAttempts = 0;

  while (!params.abortSignal?.aborted) {
    try {
      await streamSignalEvents({
        baseUrl: params.baseUrl,
        account: params.account,
        abortSignal: params.abortSignal,
        onEvent: (event) => {
          // Reset reconnect counter on successful event
          reconnectAttempts = 0;
          params.onEvent(event);
        },
      });

      if (params.abortSignal?.aborted) {
        return;
      }

      reconnectAttempts += 1;
      const delayMs = computeBackoff(reconnectPolicy, reconnectAttempts);
      params.onReconnect?.(reconnectAttempts, delayMs);
      await sleepWithAbort(delayMs, params.abortSignal);
    } catch (err) {
      if (params.abortSignal?.aborted) {
        return;
      }

      params.onError?.(err instanceof Error ? err : new Error(String(err)));
      reconnectAttempts += 1;
      const delayMs = computeBackoff(reconnectPolicy, reconnectAttempts);
      params.onReconnect?.(reconnectAttempts, delayMs);

      try {
        await sleepWithAbort(delayMs, params.abortSignal);
      } catch {
        if (params.abortSignal?.aborted) {
          return;
        }
        throw err;
      }
    }
  }
}
