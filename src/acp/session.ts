import { randomUUID } from "node:crypto";
import type { AcpSession } from "./types.js";

// Default eviction settings for CLI deployment
const DEFAULT_MAX_SESSIONS = 10;
const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // 60 seconds

export type AcpSessionStoreOptions = {
  maxSessions?: number;
  sessionTtlMs?: number;
};

export type AcpSessionStore = {
  createSession: (params: { sessionKey: string; cwd: string; sessionId?: string }) => AcpSession;
  getSession: (sessionId: string) => AcpSession | undefined;
  getSessionByRunId: (runId: string) => AcpSession | undefined;
  setActiveRun: (sessionId: string, runId: string, abortController: AbortController) => void;
  clearActiveRun: (sessionId: string) => void;
  cancelActiveRun: (sessionId: string) => boolean;
  clearAllSessionsForTest: () => void;
  getSessionCount: () => number;
  stopCleanup: () => void;
};

export function createInMemorySessionStore(options: AcpSessionStoreOptions = {}): AcpSessionStore {
  const maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS;
  const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;

  const sessions = new Map<string, AcpSession>();
  const runIdToSessionId = new Map<string, string>();

  // Evict oldest inactive session (LRU by lastAccessedAt)
  const evictOldestInactiveSession = (): boolean => {
    let oldestSession: AcpSession | null = null;
    let oldestTime = Infinity;

    for (const session of sessions.values()) {
      // Skip sessions with active runs
      if (session.activeRunId !== null) {
        continue;
      }
      if (session.lastAccessedAt < oldestTime) {
        oldestTime = session.lastAccessedAt;
        oldestSession = session;
      }
    }

    if (oldestSession) {
      sessions.delete(oldestSession.sessionId);
      return true;
    }
    return false;
  };

  // Evict sessions that exceed TTL
  const evictExpiredSessions = (): number => {
    const now = Date.now();
    const cutoff = now - sessionTtlMs;
    let evictedCount = 0;

    for (const session of sessions.values()) {
      // Skip sessions with active runs
      if (session.activeRunId !== null) {
        continue;
      }
      if (session.lastAccessedAt < cutoff) {
        if (session.activeRunId) {
          runIdToSessionId.delete(session.activeRunId);
        }
        sessions.delete(session.sessionId);
        evictedCount++;
      }
    }

    return evictedCount;
  };

  // Periodic cleanup timer
  const cleanupTimer = setInterval(() => {
    evictExpiredSessions();
  }, CLEANUP_INTERVAL_MS);

  // Don't block process exit
  cleanupTimer.unref();

  const createSession: AcpSessionStore["createSession"] = (params) => {
    // Evict if at capacity before creating new session
    while (sessions.size >= maxSessions) {
      if (!evictOldestInactiveSession()) {
        // All sessions have active runs, can't evict
        break;
      }
    }

    const sessionId = params.sessionId ?? randomUUID();
    const now = Date.now();
    const session: AcpSession = {
      sessionId,
      sessionKey: params.sessionKey,
      cwd: params.cwd,
      createdAt: now,
      lastAccessedAt: now,
      abortController: null,
      activeRunId: null,
    };
    sessions.set(sessionId, session);
    return session;
  };

  const getSession: AcpSessionStore["getSession"] = (sessionId) => {
    const session = sessions.get(sessionId);
    if (session) {
      // Update last accessed time on read
      session.lastAccessedAt = Date.now();
    }
    return session;
  };

  const getSessionByRunId: AcpSessionStore["getSessionByRunId"] = (runId) => {
    const sessionId = runIdToSessionId.get(runId);
    return sessionId ? sessions.get(sessionId) : undefined;
  };

  const setActiveRun: AcpSessionStore["setActiveRun"] = (sessionId, runId, abortController) => {
    const session = sessions.get(sessionId);
    if (!session) {
      return;
    }
    session.activeRunId = runId;
    session.abortController = abortController;
    runIdToSessionId.set(runId, sessionId);
  };

  const clearActiveRun: AcpSessionStore["clearActiveRun"] = (sessionId) => {
    const session = sessions.get(sessionId);
    if (!session) {
      return;
    }
    if (session.activeRunId) {
      runIdToSessionId.delete(session.activeRunId);
    }
    session.activeRunId = null;
    session.abortController = null;
  };

  const cancelActiveRun: AcpSessionStore["cancelActiveRun"] = (sessionId) => {
    const session = sessions.get(sessionId);
    if (!session?.abortController) {
      return false;
    }
    session.abortController.abort();
    if (session.activeRunId) {
      runIdToSessionId.delete(session.activeRunId);
    }
    session.abortController = null;
    session.activeRunId = null;
    return true;
  };

  const clearAllSessionsForTest: AcpSessionStore["clearAllSessionsForTest"] = () => {
    for (const session of sessions.values()) {
      session.abortController?.abort();
    }
    sessions.clear();
    runIdToSessionId.clear();
  };

  const getSessionCount: AcpSessionStore["getSessionCount"] = () => sessions.size;

  const stopCleanup: AcpSessionStore["stopCleanup"] = () => {
    clearInterval(cleanupTimer);
  };

  return {
    createSession,
    getSession,
    getSessionByRunId,
    setActiveRun,
    clearActiveRun,
    cancelActiveRun,
    clearAllSessionsForTest,
    getSessionCount,
    stopCleanup,
  };
}

export const defaultAcpSessionStore = createInMemorySessionStore();
