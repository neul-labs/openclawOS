/**
 * OpenClawOS Package Management
 *
 * Exports types, catalog, and registry for package management.
 */

// Types
export * from "./types.js";

// Catalog
export {
  BUILTIN_PACKAGES,
  BUILTIN_APPS,
  BUILTIN_SKILLS,
  BUILTIN_AGENTS,
  BUILTIN_EXTENSIONS,
  getBuiltinPackage,
  getBuiltinPackagesByType,
  isBuiltinPackage,
} from "./catalog.js";

// Registry
export {
  createPackageRegistry,
  getPackageRegistry,
  initializePackageRegistry,
} from "./registry.js";
