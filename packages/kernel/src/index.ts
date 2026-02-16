/**
 * OpenClawOS Kernel
 *
 * Core runtime components for the OpenClawOS operating system:
 * - IPC server for app communication
 * - Process supervisor for app lifecycle management
 * - App registry and capability tracking
 */

// IPC Server
export { IPCServer, type IPCServerOptions, type IPCServerEvents } from "./ipc/server.js";

export {
  IPCConnection,
  type IPCMethodHandler,
  type IPCConnectionEvents,
} from "./ipc/connection.js";

export { registerCoreHandlers, type HandlerDependencies } from "./ipc/handlers.js";

// Process Supervisor
export {
  AppSupervisor,
  type SupervisorOptions,
  type AppProcessConfig,
  type AppProcess,
  type AppStatus,
  type RestartPolicy,
  type SupervisorEvents,
} from "./supervisor/supervisor.js";

// App Registry
export {
  AppRegistry,
  type RegisteredApp,
  type AppState,
  type AppRegistryEvents,
} from "./registry/registry.js";

export {
  CapabilityTracker,
  type CapabilityType,
  type RegisteredCapability,
  type CapabilityTrackerEvents,
} from "./registry/capabilities.js";
