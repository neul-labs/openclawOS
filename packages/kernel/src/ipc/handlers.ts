/**
 * Core IPC Method Handlers
 *
 * Implements the kernel-side handlers for all IPC methods.
 */

import type {
  AppRegisterParams,
  AppRegisterResult,
  AppHeartbeatParams,
  AppHeartbeatResult,
  AppReadyParams,
  AppReadyResult,
  AppShutdownParams,
  AppShutdownResult,
  CapabilityRegisterParams,
  CapabilityRegisterResult,
  CapabilityUnregisterParams,
  CapabilityUnregisterResult,
  HookSubscribeParams,
  HookSubscribeResult,
  HookUnsubscribeParams,
  HookUnsubscribeResult,
  HookResultParams,
  HookResultResult,
  ConfigGetParams,
  ConfigGetResult,
  SessionGetParams,
  SessionGetResult,
  SessionListParams,
  SessionListResult,
  MessageDispatchParams,
  MessageDispatchResult,
  AgentQueueParams,
  AgentQueueResult,
} from "@openclawos/protocol";
import type { CapabilityTracker } from "../registry/capabilities.js";
import type { AppRegistry } from "../registry/registry.js";
import type { IPCMethodHandler } from "./connection.js";
import type { IPCServer } from "./server.js";

export interface HandlerDependencies {
  registry: AppRegistry;
  capabilities: CapabilityTracker;
  // These will be injected from the gateway when integrated
  getConfig?: (path?: string) => unknown;
  getSession?: (key: string) => unknown;
  listSessions?: (filter?: unknown) => { sessions: unknown[]; total: number };
  dispatchMessage?: (
    params: MessageDispatchParams,
  ) => Promise<{ dispatchId: string; queued: boolean }>;
  queueAgent?: (params: AgentQueueParams) => Promise<{ runId: string; queued: boolean }>;
}

/**
 * Register all core IPC method handlers on the server
 */
export function registerCoreHandlers(server: IPCServer, deps: HandlerDependencies): void {
  // App lifecycle
  server.registerMethod("app.register", handleAppRegister(deps));
  server.registerMethod("app.heartbeat", handleAppHeartbeat(deps));
  server.registerMethod("app.ready", handleAppReady(deps));
  server.registerMethod("app.shutdown", handleAppShutdown(deps));

  // Capabilities
  server.registerMethod("capability.register", handleCapabilityRegister(deps));
  server.registerMethod("capability.unregister", handleCapabilityUnregister(deps));

  // Hooks
  server.registerMethod("hook.subscribe", handleHookSubscribe(deps));
  server.registerMethod("hook.unsubscribe", handleHookUnsubscribe(deps));
  server.registerMethod("hook.result", handleHookResult(deps));

  // Config
  server.registerMethod("config.get", handleConfigGet(deps));

  // Sessions
  server.registerMethod("session.get", handleSessionGet(deps));
  server.registerMethod("session.list", handleSessionList(deps));

  // Messages
  server.registerMethod("message.dispatch", handleMessageDispatch(deps));
  server.registerMethod("agent.queue", handleAgentQueue(deps));
}

// =============================================================================
// App Lifecycle Handlers
// =============================================================================

function handleAppRegister(deps: HandlerDependencies): IPCMethodHandler {
  return async (_appId, params, conn): Promise<AppRegisterResult> => {
    const { manifest } = params as AppRegisterParams;

    // Validate manifest
    if (!manifest || typeof manifest !== "object") {
      throw new Error("Invalid manifest");
    }

    const pkg = manifest;
    if (!pkg.id || !pkg.type || !pkg.protocol?.version) {
      throw new Error("Missing required manifest fields: id, type, protocol.version");
    }

    // Generate token for authentication
    const token = crypto.randomUUID();

    // Register with registry
    deps.registry.register(pkg.id, pkg, token);

    // Update connection state
    conn.setRegistration(pkg.id, token, pkg);

    return {
      appId: pkg.id,
      token,
      protocolVersion: "1.0",
    };
  };
}

function handleAppHeartbeat(_deps: HandlerDependencies): IPCMethodHandler {
  return async (_appId, params): Promise<AppHeartbeatResult> => {
    const { status } = (params || {}) as AppHeartbeatParams;

    // Could store health status in registry here
    if (_appId && status) {
      // deps.registry.updateHealth(_appId, status);
    }

    return {
      ok: true,
      serverTime: Date.now(),
    };
  };
}

function handleAppReady(deps: HandlerDependencies): IPCMethodHandler {
  return async (appId, params, conn): Promise<AppReadyResult> => {
    if (!appId) {
      throw new Error("App must be registered before calling ready");
    }

    const { metadata } = (params || {}) as AppReadyParams;

    // Update registry state
    deps.registry.setReady(appId, metadata);

    // Update connection state
    conn.markReady();

    return { ok: true };
  };
}

function handleAppShutdown(deps: HandlerDependencies): IPCMethodHandler {
  return async (appId, params): Promise<AppShutdownResult> => {
    if (!appId) {
      throw new Error("App must be registered before calling shutdown");
    }

    const { reason } = (params || {}) as AppShutdownParams;

    // Mark as shutting down in registry
    deps.registry.setShuttingDown(appId, reason);

    return { ok: true };
  };
}

// =============================================================================
// Capability Handlers
// =============================================================================

/**
 * Validate that a capability registration matches the manifest declaration.
 * Returns null if valid, or an error message if invalid.
 */
function validateCapabilityAgainstManifest(
  type: string,
  config: unknown,
  manifest: { capabilities?: unknown },
): string | null {
  const caps = (manifest.capabilities as Record<string, unknown> | undefined) || {};
  const cfg = config as Record<string, unknown>;

  switch (type) {
    case "channel": {
      const channelId = cfg?.channelId ?? cfg?.id;
      const provides = (caps.channels as Record<string, unknown>)?.provides;
      if (!Array.isArray(provides) || !provides.includes(channelId)) {
        return `Channel "${channelId}" not declared in manifest capabilities.channels.provides`;
      }
      break;
    }
    case "tool": {
      const toolId = cfg?.toolId ?? cfg?.name;
      const provides = (caps.tools as Record<string, unknown>)?.provides;
      if (!Array.isArray(provides) || !provides.includes(toolId)) {
        return `Tool "${toolId}" not declared in manifest capabilities.tools.provides`;
      }
      break;
    }
    case "hook": {
      const event = cfg?.event;
      const subscribes = (caps.hooks as Record<string, unknown>)?.subscribes || [];
      const intercepts = (caps.hooks as Record<string, unknown>)?.intercepts || [];
      const allowed = [
        ...(Array.isArray(subscribes) ? subscribes : []),
        ...(Array.isArray(intercepts) ? intercepts : []),
      ];
      if (!allowed.includes(event)) {
        return `Hook "${event}" not declared in manifest capabilities.hooks`;
      }
      break;
    }
    case "gateway_method": {
      const methodName = cfg?.methodName ?? cfg?.method;
      const methods = (caps.gateway as Record<string, unknown>)?.methods;
      if (!Array.isArray(methods) || !methods.includes(methodName)) {
        return `Gateway method "${methodName}" not declared in manifest capabilities.gateway.methods`;
      }
      break;
    }
    case "http_route": {
      const route = cfg?.route ?? cfg?.path;
      const routes = (caps.gateway as Record<string, unknown>)?.httpRoutes;
      if (!Array.isArray(routes) || !routes.includes(route)) {
        return `HTTP route "${route}" not declared in manifest capabilities.gateway.httpRoutes`;
      }
      break;
    }
    case "provider": {
      const providerId = cfg?.providerId;
      const provides = (caps.providers as Record<string, unknown>)?.provides;
      if (!Array.isArray(provides) || !provides.includes(providerId)) {
        return `Provider "${providerId}" not declared in manifest capabilities.providers.provides`;
      }
      break;
    }
  }

  return null;
}

function handleCapabilityRegister(deps: HandlerDependencies): IPCMethodHandler {
  return async (appId, params): Promise<CapabilityRegisterResult> => {
    if (!appId) {
      throw new Error("App must be registered before registering capabilities");
    }

    const { type, config } = params as CapabilityRegisterParams;

    // Validate capability type
    const validTypes = ["channel", "tool", "hook", "gateway_method", "http_route", "provider"];
    if (!validTypes.includes(type)) {
      return {
        capabilityId: "",
        granted: false,
        reason: `Invalid capability type: ${type}`,
      };
    }

    // Check if app manifest allows this capability
    const manifest = deps.registry.getManifest(appId);
    if (!manifest) {
      return {
        capabilityId: "",
        granted: false,
        reason: "App not registered",
      };
    }

    // Validate capability against manifest declaration
    const validationError = validateCapabilityAgainstManifest(type, config, manifest);
    if (validationError) {
      return {
        capabilityId: "",
        granted: false,
        reason: validationError,
      };
    }

    // Check for conflicts before registering
    const conflictError = deps.capabilities.checkConflict(type, config);
    if (conflictError) {
      return {
        capabilityId: "",
        granted: false,
        reason: conflictError,
      };
    }

    // Register capability
    const capabilityId = deps.capabilities.register(appId, type, config);

    return {
      capabilityId,
      granted: true,
    };
  };
}

function handleCapabilityUnregister(deps: HandlerDependencies): IPCMethodHandler {
  return async (appId, params): Promise<CapabilityUnregisterResult> => {
    if (!appId) {
      throw new Error("App must be registered");
    }

    const { capabilityId } = params as CapabilityUnregisterParams;

    const removed = deps.capabilities.unregister(appId, capabilityId);

    return { ok: removed };
  };
}

// =============================================================================
// Hook Handlers
// =============================================================================

function handleHookSubscribe(deps: HandlerDependencies): IPCMethodHandler {
  return async (appId, params): Promise<HookSubscribeResult> => {
    if (!appId) {
      throw new Error("App must be registered");
    }

    const { events } = params as HookSubscribeParams;

    const subscribed: string[] = [];
    const denied: string[] = [];

    for (const event of events) {
      // Check if manifest allows this hook subscription
      const manifest = deps.registry.getManifest(appId);
      const allowedHooks = (manifest?.capabilities?.hooks?.subscribes || []) as string[];
      const allowedIntercepts = (manifest?.capabilities?.hooks?.intercepts || []) as string[];

      if (allowedHooks.includes(event) || allowedIntercepts.includes(event)) {
        deps.capabilities.subscribeHook(appId, event);
        subscribed.push(event);
      } else {
        denied.push(event);
      }
    }

    return { subscribed, denied };
  };
}

function handleHookUnsubscribe(deps: HandlerDependencies): IPCMethodHandler {
  return async (appId, params): Promise<HookUnsubscribeResult> => {
    if (!appId) {
      throw new Error("App must be registered");
    }

    const { events } = params as HookUnsubscribeParams;

    for (const event of events) {
      deps.capabilities.unsubscribeHook(appId, event);
    }

    return { unsubscribed: events };
  };
}

function handleHookResult(_deps: HandlerDependencies): IPCMethodHandler {
  return async (appId, params): Promise<HookResultResult> => {
    if (!appId) {
      throw new Error("App must be registered");
    }

    const { eventId: _eventId, result: _result } = params as HookResultParams;

    // Hook result handling is currently a no-op.
    // When IPC-based hook interception is needed, this will integrate with
    // the gateway's hook runner to resolve pending intercept promises.
    // See: src/gateway/server-ipc-bridge.ts for hook forwarding to IPC apps.

    return { ok: true };
  };
}

// =============================================================================
// Config Handlers
// =============================================================================

function handleConfigGet(deps: HandlerDependencies): IPCMethodHandler {
  return async (appId, params): Promise<ConfigGetResult> => {
    if (!appId) {
      throw new Error("App must be registered");
    }

    const { path } = (params || {}) as ConfigGetParams;

    if (deps.getConfig) {
      const value = deps.getConfig(path);
      return { value };
    }

    return { value: null };
  };
}

// =============================================================================
// Session Handlers
// =============================================================================

function handleSessionGet(deps: HandlerDependencies): IPCMethodHandler {
  return async (appId, params): Promise<SessionGetResult> => {
    if (!appId) {
      throw new Error("App must be registered");
    }

    const { key } = params as SessionGetParams;

    if (deps.getSession) {
      const session = deps.getSession(key);
      return { session: session as SessionGetResult["session"] };
    }

    return { session: null };
  };
}

function handleSessionList(deps: HandlerDependencies): IPCMethodHandler {
  return async (appId, params): Promise<SessionListResult> => {
    if (!appId) {
      throw new Error("App must be registered");
    }

    const { filter, limit, offset } = (params || {}) as SessionListParams;

    if (deps.listSessions) {
      const result = deps.listSessions(filter);
      let sessions = result.sessions as SessionListResult["sessions"];

      // Apply pagination
      if (offset) {
        sessions = sessions.slice(offset);
      }
      if (limit) {
        sessions = sessions.slice(0, limit);
      }

      return { sessions, total: result.total };
    }

    return { sessions: [], total: 0 };
  };
}

// =============================================================================
// Message Handlers
// =============================================================================

function handleMessageDispatch(deps: HandlerDependencies): IPCMethodHandler {
  return async (appId, params): Promise<MessageDispatchResult> => {
    if (!appId) {
      throw new Error("App must be registered");
    }

    const dispatchParams = params as MessageDispatchParams;

    if (deps.dispatchMessage) {
      return deps.dispatchMessage(dispatchParams);
    }

    // Default: return a queued response (actual dispatch handled by gateway)
    return {
      dispatchId: crypto.randomUUID(),
      queued: true,
    };
  };
}

function handleAgentQueue(deps: HandlerDependencies): IPCMethodHandler {
  return async (appId, params): Promise<AgentQueueResult> => {
    if (!appId) {
      throw new Error("App must be registered");
    }

    const queueParams = params as AgentQueueParams;

    if (deps.queueAgent) {
      return deps.queueAgent(queueParams);
    }

    // Default: return a queued response (actual agent invocation handled by gateway)
    return {
      runId: crypto.randomUUID(),
      queued: true,
    };
  };
}
