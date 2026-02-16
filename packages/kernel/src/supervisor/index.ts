/**
 * Supervisor Module
 *
 * Process supervision for OpenClawOS applications.
 */

export {
  AppSupervisor,
  type SupervisorOptions,
  type AppProcessConfig,
  type AppProcess,
  type AppStatus,
  type RestartPolicy,
  type SupervisorEvents,
} from "./supervisor.js";
