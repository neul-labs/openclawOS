/**
 * App Store Package Types
 *
 * Types for package management, installation, and App Store display.
 */

// =============================================================================
// Package Type
// =============================================================================

/**
 * Package type classification.
 */
export type PackageType = "app" | "skill" | "agent" | "extension";

// =============================================================================
// Package Manifest
// =============================================================================

/**
 * Package manifest for OpenClawOS packages.
 */
export interface PackageManifest {
  /** Package ID (e.g., "@openclawos/telegram") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Package version */
  version: string;
  /** Package description */
  description?: string;
  /** Package type */
  type: PackageType;
  /** Entry point (relative path to main file) */
  main?: string;
  /** Author name */
  author?: string;
  /** License identifier */
  license?: string;
  /** Repository URL */
  repository?: string;
  /** Icon emoji or URL */
  icon?: string;
  /** Categorization tags */
  tags?: string[];
  /** Protocol compatibility */
  protocol?: {
    version: string;
    minKernelVersion?: string;
  };
  /** Package capabilities */
  capabilities?: Record<string, unknown>;
  /** Configuration schema (JSON Schema) */
  configSchema?: unknown;
  /** Configuration UI hints */
  configUiHints?: Record<string, unknown>;
  /** Package dependencies */
  dependencies?: {
    apps?: string[];
    skills?: string[];
    agents?: string[];
  };
}

// =============================================================================
// Package Info (for display in App Store)
// =============================================================================

/**
 * Extended package information for App Store display.
 * Combines manifest data with installation state and runtime info.
 */
export interface PackageInfo {
  /** Package ID (e.g., "@openclawos/telegram") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Package description */
  description?: string;
  /** Package type */
  type: PackageType;
  /** Current version */
  version: string;
  /** Icon emoji or URL */
  icon?: string;
  /** Author name */
  author?: string;
  /** License identifier */
  license?: string;
  /** Repository URL */
  repository?: string;
  /** Categorization tags */
  tags?: string[];

  // === Installation State ===

  /** Whether the package is installed */
  installed: boolean;
  /** Whether this is a built-in package */
  builtin: boolean;
  /** Whether the package is enabled */
  enabled?: boolean;
  /** Installed version (if different from latest) */
  installedVersion?: string;
  /** Latest available version */
  latestVersion?: string;

  // === Runtime State (for apps) ===

  /** Runtime status (for apps) */
  status?: PackageStatus;
  /** Last error message */
  lastError?: string;

  // === Capabilities (for install modal) ===

  /** Package capabilities */
  capabilities?: Record<string, unknown>;
}

/**
 * Runtime status for app packages.
 */
export type PackageStatus =
  | "running"
  | "stopped"
  | "starting"
  | "stopping"
  | "error"
  | "not_applicable";

// =============================================================================
// Installed Package
// =============================================================================

/**
 * Full details of an installed package.
 */
export interface InstalledPackage {
  /** Full package manifest */
  manifest: PackageManifest;
  /** Installation directory */
  installDir: string;
  /** Installation timestamp */
  installedAt: number;
  /** Last update timestamp */
  updatedAt?: number;
  /** Whether the package is enabled */
  enabled: boolean;
  /** Current runtime status */
  status: PackageStatus;
  /** Current configuration */
  config: Record<string, unknown>;
}

// =============================================================================
// Package Filtering
// =============================================================================

/**
 * Filter options for package queries.
 */
export interface PackageFilter {
  /** Filter by package type */
  type?: PackageType;
  /** Filter by installation state */
  installed?: boolean;
  /** Filter by enabled state */
  enabled?: boolean;
  /** Filter by built-in status */
  builtin?: boolean;
  /** Search text (matches name, description, tags) */
  search?: string;
  /** Filter by tags (any match) */
  tags?: string[];
}

// =============================================================================
// Installation Results
// =============================================================================

/**
 * Result of a package installation.
 */
export interface InstallResult {
  /** Whether installation succeeded */
  ok: boolean;
  /** Installed package ID */
  packageId: string;
  /** Installed version */
  version: string;
  /** Installation directory */
  installDir?: string;
  /** Error message if failed */
  error?: string;
  /** Warning messages */
  warnings?: string[];
  /** Whether this was an upgrade */
  upgraded?: boolean;
  /** Previous version (if upgraded) */
  previousVersion?: string;
}

/**
 * Options for package uninstallation.
 */
export interface UninstallOptions {
  /** Also remove package data/config */
  purgeData?: boolean;
  /** Force removal even if package is in use */
  force?: boolean;
}

/**
 * Result of a package uninstallation.
 */
export interface UninstallResult {
  /** Whether uninstallation succeeded */
  ok: boolean;
  /** Package ID that was removed */
  packageId: string;
  /** Error message if failed */
  error?: string;
  /** Whether data was purged */
  dataPurged?: boolean;
}

// =============================================================================
// Package Configuration
// =============================================================================

/**
 * Options for package configuration update.
 */
export interface ConfigureOptions {
  /** Merge with existing config (default true) */
  merge?: boolean;
  /** Validate config against schema */
  validate?: boolean;
  /** Restart package after config change (for apps) */
  restart?: boolean;
}

/**
 * Result of a configuration update.
 */
export interface ConfigureResult {
  /** Whether configuration succeeded */
  ok: boolean;
  /** Package ID */
  packageId: string;
  /** Final configuration */
  config?: Record<string, unknown>;
  /** Error message if failed */
  error?: string;
  /** Validation errors */
  validationErrors?: Array<{ field: string; message: string }>;
  /** Whether package was restarted */
  restarted?: boolean;
}

// =============================================================================
// Package Source
// =============================================================================

/**
 * Source of a package for installation.
 */
export type PackageSource =
  | { type: "builtin"; path: string }
  | { type: "workspace"; path: string }
  | { type: "local"; path: string }
  | { type: "registry"; registry: string; packageId: string };

/**
 * Package category for App Store grouping.
 */
export type PackageCategory = "all" | "apps" | "skills" | "agents" | "extensions";

// =============================================================================
// Registry Types
// =============================================================================

/**
 * Supervisor interface for registry integration.
 * Used to get real app status and control app lifecycle.
 */
export interface RegistrySupervisor {
  /** Get app process info by ID */
  getStatus: (appId: string) => { status: string } | undefined;
  /** List all spawned apps */
  listApps: () => Array<{ appId: string; status: string }>;
  /** Spawn an app process */
  spawn: (manifest: unknown) => Promise<unknown>;
  /** Stop an app process */
  stop: (appId: string) => Promise<void>;
}

/**
 * Options for creating a package registry.
 */
export interface RegistryOptions {
  /** Directory containing built-in apps */
  appsDir: string;
  /** Data directory for installed packages */
  dataDir: string;
  /** Configuration directory */
  configDir: string;
  /** App supervisor for real status and lifecycle control */
  supervisor?: RegistrySupervisor;
}

/**
 * Package registry interface.
 */
export interface PackageRegistry {
  /** List available packages from all sources */
  listAvailable(filter?: PackageFilter): Promise<PackageInfo[]>;

  /** List installed packages */
  listInstalled(): Promise<InstalledPackage[]>;

  /** Get package info by ID */
  getPackage(packageId: string): Promise<PackageInfo | null>;

  /** Get installed package details */
  getInstalledPackage(packageId: string): Promise<InstalledPackage | null>;

  /** Get package manifest */
  getManifest(packageId: string): Promise<PackageManifest | null>;

  /** Install package */
  install(packageId: string, version?: string): Promise<InstallResult>;

  /** Uninstall package */
  uninstall(packageId: string, opts?: UninstallOptions): Promise<UninstallResult>;

  /** Enable/disable package */
  setEnabled(packageId: string, enabled: boolean): Promise<void>;

  /** Get package configuration */
  getConfig(packageId: string): Promise<Record<string, unknown>>;

  /** Set package configuration */
  setConfig(
    packageId: string,
    config: Record<string, unknown>,
    opts?: ConfigureOptions,
  ): Promise<ConfigureResult>;

  /** Get package runtime status (for apps) */
  getStatus(packageId: string): Promise<PackageStatus>;

  /** Start an app package */
  startPackage(packageId: string): Promise<void>;

  /** Stop an app package */
  stopPackage(packageId: string): Promise<void>;

  /** Restart an app package */
  restartPackage(packageId: string): Promise<void>;
}
