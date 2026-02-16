/**
 * OpenClawOS IPC Server Integration
 *
 * Integrates the kernel IPC server and app supervisor with the gateway.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { SubsystemLogger } from "../logging/subsystem.js";

// Types mirroring kernel exports (since kernel is optional/dynamic)
interface IPCServerLike {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

interface AppRegistryLike {
  on: (event: string, handler: (data: unknown) => void) => void;
}

interface CapabilityTrackerLike {
  on: (event: string, handler: (data: unknown) => void) => void;
}

interface AppSupervisorLike {
  spawn: (manifest: unknown) => Promise<unknown>;
  stopAll: () => Promise<void>;
  markReady: (appId: string) => void;
}

// Types for gateway integration
export interface IPCIntegrationDeps {
  /** Logger instance */
  log: SubsystemLogger;
  /** State directory path (e.g., ~/.openclaw) */
  stateDir: string;
  /** Workspace directory for apps */
  workspaceDir: string;
  /** Get config value at path */
  getConfig: (path?: string) => unknown;
  /** Queue an agent invocation */
  queueAgent?: (params: {
    sessionKey: string;
    text: string;
    metadata?: Record<string, unknown>;
  }) => Promise<{ runId: string; queued: boolean }>;
}

export interface IPCIntegrationHandle {
  /** IPC server instance */
  ipcServer: IPCServerLike;
  /** App registry instance */
  appRegistry: AppRegistryLike;
  /** Capability tracker instance */
  capabilities: CapabilityTrackerLike;
  /** App supervisor instance */
  supervisor: AppSupervisorLike;
  /** Stop all IPC components */
  stop: () => Promise<void>;
}

/**
 * Initialize the OpenClawOS IPC server and app supervisor.
 * This is a no-op if the kernel package is not available.
 */
export async function initIPCIntegration(
  deps: IPCIntegrationDeps,
): Promise<IPCIntegrationHandle | null> {
  const { log, stateDir, workspaceDir, getConfig, queueAgent } = deps;

  // Try to import kernel components
  let kernel: {
    IPCServer: new (opts: { socketPath: string }) => IPCServerLike;
    AppRegistry: new () => AppRegistryLike;
    CapabilityTracker: new () => CapabilityTrackerLike;
    AppSupervisor: new (opts: {
      appsDir: string;
      socketPath: string;
      onAppStart?: (appId: string) => void;
      onAppStop?: (appId: string, code: number | null) => void;
      onAppError?: (appId: string, error: Error) => void;
    }) => AppSupervisorLike;
    registerCoreHandlers: (
      server: IPCServerLike,
      deps: {
        registry: AppRegistryLike;
        capabilities: CapabilityTrackerLike;
        getConfig: (path?: string) => unknown;
        queueAgent: (params: {
          sessionKey: string;
          text: string;
          metadata?: Record<string, unknown>;
        }) => Promise<{ runId: string; queued: boolean }>;
      },
    ) => void;
  };

  try {
    // @ts-expect-error - Dynamic import of optional workspace package
    kernel = await import("@openclawos/kernel");
  } catch (err) {
    log.debug(`OpenClawOS kernel not available, IPC integration disabled: ${String(err)}`);
    return null;
  }

  const { IPCServer, AppRegistry, CapabilityTracker, AppSupervisor, registerCoreHandlers } = kernel;

  // Create socket path
  const runDir = path.join(stateDir, "run");
  await fs.mkdir(runDir, { recursive: true });
  const socketPath = path.join(runDir, "kernel.sock");

  // Create instances
  const ipcServer = new IPCServer({ socketPath });
  const appRegistry = new AppRegistry();
  const capabilities = new CapabilityTracker();

  // Register core handlers
  registerCoreHandlers(ipcServer, {
    registry: appRegistry,
    capabilities,
    getConfig: (configPath?: string) => {
      if (!configPath) {
        return getConfig();
      }
      // Resolve nested path
      const value = getConfig(configPath);
      return value;
    },
    queueAgent: queueAgent
      ? async (params: { sessionKey: string; text: string; metadata?: Record<string, unknown> }) =>
          queueAgent(params)
      : async () => ({ runId: crypto.randomUUID(), queued: false }),
  });

  // Start server
  await ipcServer.start();
  log.info(`IPC server listening on ${socketPath}`);

  // Create supervisor
  const appsDir = path.join(workspaceDir, "apps");
  const supervisor = new AppSupervisor({
    appsDir,
    socketPath,
    onAppStart: (appId: string) => log.info(`App started: ${appId}`),
    onAppStop: (appId: string, code: number | null) =>
      log.info(`App stopped: ${appId} (code: ${code})`),
    onAppError: (appId: string, error: Error) => log.error(`App error (${appId}): ${error}`),
  });

  // Event handlers for app registration
  appRegistry.on("registered", (appId: unknown) => {
    log.info(`App registered: ${appId}`);
  });

  appRegistry.on("ready", (appId: unknown) => {
    log.info(`App ready: ${appId}`);
    supervisor.markReady(appId as string);
  });

  capabilities.on("registered", (cap: unknown) => {
    const c = cap as { type: string; appId: string };
    log.debug(`Capability registered: ${c.type} by ${c.appId}`);
  });

  return {
    ipcServer,
    appRegistry,
    capabilities,
    supervisor,
    stop: async () => {
      log.info("Stopping IPC integration...");
      await supervisor.stopAll();
      await ipcServer.stop();
      log.info("IPC integration stopped");
    },
  };
}

/**
 * Load and spawn apps based on configuration.
 */
export async function spawnConfiguredApps(
  handle: IPCIntegrationHandle,
  config: { apps?: Record<string, { enabled?: boolean }> },
  workspaceDir: string,
  log: SubsystemLogger,
): Promise<void> {
  const { supervisor } = handle;
  const apps = config.apps || {};

  for (const [appName, appConfig] of Object.entries(apps)) {
    if (appConfig.enabled === false) {
      continue;
    }

    // Resolve app directory - try different naming conventions
    const possibleDirs = [
      path.join(workspaceDir, "apps", appName),
      path.join(workspaceDir, "apps", `openclawos-${appName}`),
      path.join(workspaceDir, "apps", appName.replace("@openclawos/", "")),
    ];

    let appDir: string | null = null;
    let manifestPath: string | null = null;

    for (const dir of possibleDirs) {
      const mPath = path.join(dir, "openclawos.manifest.json");
      try {
        await fs.access(mPath);
        appDir = dir;
        manifestPath = mPath;
        break;
      } catch {
        // Try next
      }
    }

    if (!appDir || !manifestPath) {
      log.debug(`App not found: ${appName}`);
      continue;
    }

    try {
      const manifestContent = await fs.readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(manifestContent) as unknown;

      log.info(`Spawning app: ${(manifest as { id: string }).id}`);
      await supervisor.spawn(manifest);
    } catch (err) {
      log.warn(`Failed to spawn app ${appName}: ${err}`);
    }
  }
}
