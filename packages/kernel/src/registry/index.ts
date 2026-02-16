/**
 * Registry Module
 *
 * App registration and capability tracking.
 */

export {
  AppRegistry,
  type RegisteredApp,
  type AppState,
  type AppRegistryEvents,
} from "./registry.js";

export {
  CapabilityTracker,
  type CapabilityType,
  type RegisteredCapability,
  type CapabilityTrackerEvents,
} from "./capabilities.js";
