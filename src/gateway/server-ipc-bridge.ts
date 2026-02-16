/**
 * IPC Hook Bridge
 *
 * Bridges the in-process hook system with IPC apps that have subscribed to hooks.
 * This allows process-isolated apps to receive hook events from the kernel.
 */

import type { SubsystemLogger } from "../logging/subsystem.js";
import type { IPCIntegrationHandle } from "./server-ipc.js";

export interface IPCHookBridgeOptions {
  ipcHandle: IPCIntegrationHandle;
  log: SubsystemLogger;
}

export interface IPCHookBridge {
  /** Forward a hook event to subscribed IPC apps */
  forwardHook: (hookName: string, payload: unknown) => void;
  /** Check if any IPC apps are subscribed to a hook */
  hasSubscribers: (hookName: string) => boolean;
}

/**
 * Create an IPC hook bridge for forwarding hook events to IPC apps.
 * Returns null if IPC integration is not available.
 */
export function createIPCHookBridge(opts: IPCHookBridgeOptions | null): IPCHookBridge | null {
  if (!opts) {
    return null;
  }

  const { ipcHandle, log } = opts;
  const { capabilities } = ipcHandle;

  // Type-safe access to capability tracker methods
  const getHookSubscribers = (hookName: string): string[] => {
    // The capability tracker's getCapabilities method returns all registered capabilities
    // We need to filter for hook subscriptions that match the given hook name
    const tracker = capabilities as {
      getCapabilities?: (type: string) => Array<{ appId: string; data: unknown }>;
    };
    if (!tracker.getCapabilities) {
      return [];
    }
    try {
      const hookCaps = tracker.getCapabilities("hook.subscribe");
      return hookCaps
        .filter((cap) => {
          const data = cap.data as { hookName?: string } | undefined;
          return data?.hookName === hookName;
        })
        .map((cap) => cap.appId);
    } catch {
      return [];
    }
  };

  // Type-safe access to IPC server's sendTo method
  const sendToApp = (appId: string, event: string, payload: unknown): boolean => {
    const server = ipcHandle.ipcServer as {
      sendTo?: (appId: string, event: string, payload: unknown) => boolean;
      getConnection?: (appId: string) => { send: (msg: unknown) => void } | undefined;
    };

    // Try sendTo first
    if (server.sendTo) {
      try {
        return server.sendTo(appId, event, payload);
      } catch {
        return false;
      }
    }

    // Fall back to getConnection + send
    if (server.getConnection) {
      try {
        const conn = server.getConnection(appId);
        if (conn) {
          conn.send({
            id: crypto.randomUUID(),
            type: "event",
            timestamp: Date.now(),
            event,
            payload,
          });
          return true;
        }
      } catch {
        return false;
      }
    }

    return false;
  };

  return {
    forwardHook: (hookName: string, payload: unknown) => {
      const subscribers = getHookSubscribers(hookName);
      if (subscribers.length === 0) {
        return;
      }

      log.debug(`Forwarding hook ${hookName} to ${subscribers.length} IPC apps`);

      for (const appId of subscribers) {
        const sent = sendToApp(appId, `hook:${hookName}`, payload);
        if (!sent) {
          log.warn(`Failed to forward hook ${hookName} to app ${appId}`);
        }
      }
    },

    hasSubscribers: (hookName: string) => {
      return getHookSubscribers(hookName).length > 0;
    },
  };
}

// Global IPC hook bridge instance
let globalIPCHookBridge: IPCHookBridge | null = null;

/**
 * Initialize the global IPC hook bridge.
 * Called during gateway startup after IPC integration is initialized.
 */
export function initializeIPCHookBridge(
  ipcHandle: IPCIntegrationHandle | null,
  log: SubsystemLogger,
): void {
  if (!ipcHandle) {
    globalIPCHookBridge = null;
    return;
  }
  globalIPCHookBridge = createIPCHookBridge({ ipcHandle, log });
}

/**
 * Get the global IPC hook bridge.
 * Returns null if IPC integration is not available.
 */
export function getIPCHookBridge(): IPCHookBridge | null {
  return globalIPCHookBridge;
}

/**
 * Forward a hook event to IPC apps if the bridge is available.
 * This is a convenience function for integrating with the existing hook system.
 */
export function forwardHookToIPC(hookName: string, payload: unknown): void {
  globalIPCHookBridge?.forwardHook(hookName, payload);
}

/**
 * Reset the global IPC hook bridge (for testing).
 */
export function resetIPCHookBridge(): void {
  globalIPCHookBridge = null;
}
