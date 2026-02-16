/**
 * Package Registry Service
 *
 * Manages package discovery, installation, and configuration.
 * Integrates built-in packages with user-installed packages.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type {
  ConfigureOptions,
  ConfigureResult,
  InstalledPackage,
  InstallResult,
  PackageFilter,
  PackageInfo,
  PackageManifest,
  PackageRegistry,
  PackageStatus,
  RegistryOptions,
  UninstallOptions,
  UninstallResult,
} from "./types.js";
import { BUILTIN_PACKAGES, getBuiltinPackage, isBuiltinPackage } from "./catalog.js";

// Package manifest file names to search for
const MANIFEST_FILE = "openclawos.manifest.json";
const MANIFEST_FILE_ALTERNATIVES = ["package.json"];

/**
 * Validate a package manifest.
 * Returns true if the manifest has required fields.
 */
const VALID_PACKAGE_TYPES = new Set(["app", "skill", "agent", "extension"]);

function validateManifest(manifest: unknown): manifest is PackageManifest {
  if (!manifest || typeof manifest !== "object") {
    return false;
  }
  const m = manifest as Record<string, unknown>;
  if (typeof m.id !== "string" || typeof m.name !== "string" || typeof m.version !== "string") {
    return false;
  }
  if (typeof m.type !== "string" || !VALID_PACKAGE_TYPES.has(m.type)) {
    return false;
  }
  return true;
}

// =============================================================================
// Package Registry Implementation
// =============================================================================

/**
 * Create a package registry instance.
 */
export function createPackageRegistry(options: RegistryOptions): PackageRegistry {
  const { appsDir, dataDir: _dataDir, configDir, supervisor } = options;

  // Cache for loaded manifests
  const manifestCache = new Map<string, PackageManifest>();

  /**
   * Get real app status from supervisor if available.
   */
  function getAppStatusFromSupervisor(packageId: string): string | null {
    if (!supervisor) {
      return null;
    }
    const appProcess = supervisor.getStatus(packageId);
    return appProcess?.status ?? null;
  }

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  /**
   * Load manifest from a directory.
   */
  async function loadManifestFromDir(dir: string): Promise<PackageManifest | null> {
    const candidates = [MANIFEST_FILE, ...MANIFEST_FILE_ALTERNATIVES];

    for (const filename of candidates) {
      const manifestPath = path.join(dir, filename);
      try {
        const content = await fs.readFile(manifestPath, "utf-8");
        const parsed = JSON.parse(content);
        if (validateManifest(parsed)) {
          return parsed;
        }
      } catch {
        // Try next candidate
      }
    }

    return null;
  }

  /**
   * Scan apps directory for available packages.
   */
  async function scanAppsDirectory(): Promise<Map<string, PackageManifest>> {
    const packages = new Map<string, PackageManifest>();

    try {
      const entries = await fs.readdir(appsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        // Skip special directories
        if (entry.name === "shared" || entry.name.startsWith(".")) {
          continue;
        }

        const appDir = path.join(appsDir, entry.name);
        const manifest = await loadManifestFromDir(appDir);

        if (manifest) {
          manifestCache.set(manifest.id, manifest);
          packages.set(manifest.id, manifest);
        }
      }
    } catch {
      // Apps directory may not exist
    }

    return packages;
  }

  /**
   * Get package configuration from config file.
   */
  async function getPackageConfig(packageId: string): Promise<Record<string, unknown>> {
    const configPath = path.join(configDir, "packages", `${packageId.replace(/\//g, "-")}.json`);

    try {
      const content = await fs.readFile(configPath, "utf-8");
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  /**
   * Save package configuration.
   */
  async function savePackageConfig(
    packageId: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    const packagesConfigDir = path.join(configDir, "packages");
    await fs.mkdir(packagesConfigDir, { recursive: true });

    const configPath = path.join(packagesConfigDir, `${packageId.replace(/\//g, "-")}.json`);
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Check if a package is enabled in config.
   */
  async function isPackageEnabled(packageId: string): Promise<boolean> {
    const config = await getPackageConfig(packageId);
    return config.enabled !== false;
  }

  /**
   * Build PackageInfo from manifest and state.
   */
  async function buildPackageInfo(
    manifest: PackageManifest,
    options: { installed: boolean; builtin: boolean },
  ): Promise<PackageInfo> {
    const config = await getPackageConfig(manifest.id);
    const enabled = config.enabled !== false;

    // Get real status from supervisor if available
    let status: PackageStatus = manifest.type === "app" ? "stopped" : "not_applicable";
    if (manifest.type === "app") {
      const supervisorStatus = getAppStatusFromSupervisor(manifest.id);
      if (supervisorStatus) {
        const statusMap: Record<string, PackageStatus> = {
          running: "running",
          starting: "starting",
          stopping: "stopping",
          stopped: "stopped",
          crashed: "error",
          restarting: "starting",
        };
        status = statusMap[supervisorStatus] ?? "stopped";
      } else if (enabled) {
        // Fallback: if enabled but no supervisor status, assume stopped
        status = "stopped";
      }
    }

    return {
      id: manifest.id,
      name: manifest.name,
      description: manifest.description,
      type: manifest.type,
      version: manifest.version,
      icon: manifest.icon,
      author: manifest.author,
      license: manifest.license,
      repository: manifest.repository,
      tags: manifest.tags,
      installed: options.installed,
      builtin: options.builtin,
      enabled,
      installedVersion: manifest.version,
      latestVersion: manifest.version, // Currently same as installed; remote registry not implemented
      status,
    };
  }

  // ==========================================================================
  // Registry Methods
  // ==========================================================================

  return {
    async listAvailable(filter?: PackageFilter): Promise<PackageInfo[]> {
      const result: PackageInfo[] = [];

      // Start with built-in packages
      for (const pkg of BUILTIN_PACKAGES) {
        result.push({ ...pkg });
      }

      // Scan for installed apps
      const installedApps = await scanAppsDirectory();
      for (const [packageId, manifest] of installedApps) {
        // Skip if already in built-in list (they're the same)
        if (isBuiltinPackage(packageId)) {
          continue;
        }

        const info = await buildPackageInfo(manifest, { installed: true, builtin: false });
        result.push(info);
      }

      // Apply filters
      let filtered = result;

      if (filter?.type) {
        filtered = filtered.filter((pkg) => pkg.type === filter.type);
      }

      if (filter?.installed !== undefined) {
        filtered = filtered.filter((pkg) => pkg.installed === filter.installed);
      }

      if (filter?.enabled !== undefined) {
        filtered = filtered.filter((pkg) => pkg.enabled === filter.enabled);
      }

      if (filter?.builtin !== undefined) {
        filtered = filtered.filter((pkg) => pkg.builtin === filter.builtin);
      }

      if (filter?.search) {
        const search = filter.search.toLowerCase();
        filtered = filtered.filter(
          (pkg) =>
            pkg.name.toLowerCase().includes(search) ||
            pkg.description?.toLowerCase().includes(search) ||
            pkg.id.toLowerCase().includes(search) ||
            pkg.tags?.some((tag) => tag.toLowerCase().includes(search)),
        );
      }

      if (filter?.tags?.length) {
        const filterTags = new Set(filter.tags.map((t) => t.toLowerCase()));
        filtered = filtered.filter((pkg) =>
          pkg.tags?.some((tag) => filterTags.has(tag.toLowerCase())),
        );
      }

      return filtered;
    },

    async listInstalled(): Promise<InstalledPackage[]> {
      const result: InstalledPackage[] = [];
      const installedApps = await scanAppsDirectory();

      for (const [packageId, manifest] of installedApps) {
        const installDir = path.join(appsDir, packageId.replace(/^@/, "").replace("/", "-"));
        const config = await getPackageConfig(packageId);
        const enabled = config.enabled !== false;

        // Get real status from supervisor if available
        let status: PackageStatus = manifest.type === "app" ? "stopped" : "not_applicable";
        if (manifest.type === "app") {
          const supervisorStatus = getAppStatusFromSupervisor(packageId);
          if (supervisorStatus) {
            const statusMap: Record<string, PackageStatus> = {
              running: "running",
              starting: "starting",
              stopping: "stopping",
              stopped: "stopped",
              crashed: "error",
              restarting: "starting",
            };
            status = statusMap[supervisorStatus] ?? "stopped";
          }
        }

        result.push({
          manifest,
          installDir,
          installedAt: Date.now(), // Uses current time; persistent install tracking not implemented
          enabled,
          status,
          config,
        });
      }

      return result;
    },

    async getPackage(packageId: string): Promise<PackageInfo | null> {
      // Check built-in first
      const builtin = getBuiltinPackage(packageId);
      if (builtin) {
        const config = await getPackageConfig(packageId);
        return {
          ...builtin,
          enabled: config.enabled !== false,
        };
      }

      // Check installed apps
      const manifest = await this.getManifest(packageId);
      if (manifest) {
        return buildPackageInfo(manifest, { installed: true, builtin: false });
      }

      return null;
    },

    async getInstalledPackage(packageId: string): Promise<InstalledPackage | null> {
      const manifest = await this.getManifest(packageId);
      if (!manifest) {
        return null;
      }

      const installDir = path.join(appsDir, packageId.replace(/^@/, "").replace("/", "-"));
      const config = await getPackageConfig(packageId);
      const enabled = config.enabled !== false;

      return {
        manifest,
        installDir,
        installedAt: Date.now(),
        enabled,
        status: manifest.type === "app" ? "stopped" : "not_applicable",
        config,
      };
    },

    async getManifest(packageId: string): Promise<PackageManifest | null> {
      // Check cache first
      if (manifestCache.has(packageId)) {
        return manifestCache.get(packageId)!;
      }

      // Try to load from apps directory
      const appDir = path.join(appsDir, packageId.replace(/^@/, "").replace("/", "-"));
      const manifest = await loadManifestFromDir(appDir);

      if (manifest) {
        manifestCache.set(packageId, manifest);
      }

      return manifest;
    },

    async install(packageId: string, _version?: string): Promise<InstallResult> {
      // For now, only built-in packages can be "installed" (enabled)
      if (isBuiltinPackage(packageId)) {
        await savePackageConfig(packageId, { enabled: true });
        const builtin = getBuiltinPackage(packageId);

        // Spawn app if supervisor is available and this is an app type
        if (supervisor && builtin?.type === "app") {
          const manifest = await this.getManifest(packageId);
          if (manifest) {
            try {
              await supervisor.spawn(manifest);
            } catch {
              // Might already be running
            }
          }
        }

        return {
          ok: true,
          packageId,
          version: builtin?.version || "1.0.0",
        };
      }

      // Check if it's a local app in the apps directory
      const manifest = await this.getManifest(packageId);
      if (manifest) {
        await savePackageConfig(packageId, { enabled: true });

        // Spawn if supervisor is available and this is an app
        if (supervisor && manifest.type === "app") {
          try {
            await supervisor.spawn(manifest);
          } catch {
            // Might already be running
          }
        }

        return {
          ok: true,
          packageId,
          version: manifest.version,
        };
      }

      return {
        ok: false,
        packageId,
        version: "",
        error: "Package not found. External package installation not yet implemented.",
      };
    },

    async uninstall(packageId: string, opts?: UninstallOptions): Promise<UninstallResult> {
      // Stop the app first if supervisor is available
      if (supervisor) {
        const currentStatus = getAppStatusFromSupervisor(packageId);
        if (currentStatus && currentStatus !== "stopped" && currentStatus !== "stopping") {
          try {
            await supervisor.stop(packageId);
          } catch {
            // Ignore errors stopping app
          }
        }
      }

      // Built-in packages can only be disabled, not uninstalled
      if (isBuiltinPackage(packageId)) {
        await savePackageConfig(packageId, { enabled: false });
        return {
          ok: true,
          packageId,
          dataPurged: false,
        };
      }

      // Disable the package
      await savePackageConfig(packageId, { enabled: false });

      const installDir = path.join(appsDir, packageId.replace(/^@/, "").replace("/", "-"));

      try {
        if (opts?.purgeData) {
          await fs.rm(installDir, { recursive: true, force: true });
          // Also remove config
          const configPath = path.join(
            configDir,
            "packages",
            `${packageId.replace(/\//g, "-")}.json`,
          );
          await fs.rm(configPath, { force: true });
        }

        return {
          ok: true,
          packageId,
          dataPurged: opts?.purgeData ?? false,
        };
      } catch (error) {
        return {
          ok: false,
          packageId,
          error: String(error),
        };
      }
    },

    async setEnabled(packageId: string, enabled: boolean): Promise<void> {
      const config = await getPackageConfig(packageId);
      await savePackageConfig(packageId, { ...config, enabled });

      // If supervisor is available, actually start/stop the app
      if (supervisor) {
        const pkg = await this.getPackage(packageId);
        if (pkg?.type === "app") {
          if (enabled) {
            // Spawn app if not already running
            const currentStatus = getAppStatusFromSupervisor(packageId);
            if (!currentStatus || currentStatus === "stopped" || currentStatus === "crashed") {
              const manifest = await this.getManifest(packageId);
              if (manifest) {
                try {
                  await supervisor.spawn(manifest);
                } catch {
                  // App might already be running, ignore
                }
              }
            }
          } else {
            // Stop app if running
            const currentStatus = getAppStatusFromSupervisor(packageId);
            if (currentStatus && currentStatus !== "stopped" && currentStatus !== "stopping") {
              try {
                await supervisor.stop(packageId);
              } catch {
                // App might already be stopped, ignore
              }
            }
          }
        }
      }
    },

    async getConfig(packageId: string): Promise<Record<string, unknown>> {
      return getPackageConfig(packageId);
    },

    async setConfig(
      packageId: string,
      config: Record<string, unknown>,
      opts?: ConfigureOptions,
    ): Promise<ConfigureResult> {
      try {
        const merge = opts?.merge !== false;
        const existing = merge ? await getPackageConfig(packageId) : {};
        const merged = { ...existing, ...config };

        // Config schema validation not yet implemented; requires manifest.configSchema
        // Would use TypeBox or Zod to validate merged config against schema

        await savePackageConfig(packageId, merged);

        // Restart app if requested and supervisor is available
        let restarted = false;
        if (opts?.restart && supervisor) {
          const manifest = await this.getManifest(packageId);
          if (manifest && manifest.type === "app") {
            try {
              await supervisor.stop(packageId);
              await supervisor.spawn(manifest);
              restarted = true;
            } catch {
              // Restart failed, but config was saved
            }
          }
        }

        return {
          ok: true,
          packageId,
          config: merged,
          restarted,
        };
      } catch (error) {
        return {
          ok: false,
          packageId,
          error: String(error),
        };
      }
    },

    async getStatus(packageId: string): Promise<PackageStatus> {
      const pkg = await this.getPackage(packageId);
      if (!pkg) {
        return "stopped";
      }
      if (pkg.type !== "app") {
        return "not_applicable";
      }

      // Check real status from supervisor if available
      const supervisorStatus = getAppStatusFromSupervisor(packageId);
      if (supervisorStatus) {
        // Map supervisor status to PackageStatus
        const statusMap: Record<string, PackageStatus> = {
          running: "running",
          starting: "starting",
          stopping: "stopping",
          stopped: "stopped",
          crashed: "error",
          restarting: "starting",
        };
        return statusMap[supervisorStatus] ?? "stopped";
      }

      // Fallback: check enabled config
      const enabled = await isPackageEnabled(packageId);
      return enabled ? "running" : "stopped";
    },
  };
}

// =============================================================================
// Registry Instance (Singleton)
// =============================================================================

let registryInstance: PackageRegistry | null = null;

/**
 * Get or create the singleton package registry.
 */
export function getPackageRegistry(options?: RegistryOptions): PackageRegistry {
  if (!registryInstance && options) {
    registryInstance = createPackageRegistry(options);
  }

  if (!registryInstance) {
    throw new Error("Package registry not initialized. Call with options first.");
  }

  return registryInstance;
}

/**
 * Initialize the package registry with options.
 */
export function initializePackageRegistry(options: RegistryOptions): PackageRegistry {
  registryInstance = createPackageRegistry(options);
  return registryInstance;
}
