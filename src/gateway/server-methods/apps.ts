/**
 * App Store Gateway Method Handlers
 *
 * Handlers for apps.* gateway methods that manage OpenClawOS packages.
 */

import type { GatewayRequestHandlers } from "./types.js";
import { resolveStateDir } from "../../config/paths.js";
import {
  createPackageRegistry,
  type PackageRegistry,
  type RegistrySupervisor,
} from "../../packages/index.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateAppsListParams,
  validateAppsInfoParams,
  validateAppsInstallParams,
  validateAppsUninstallParams,
  validateAppsConfigureParams,
  validateAppsGetConfigParams,
  validateAppsSetEnabledParams,
  validateAppsStatusParams,
} from "../protocol/index.js";

// =============================================================================
// Registry Singleton
// =============================================================================

let registryInstance: PackageRegistry | null = null;
let supervisorInstance: RegistrySupervisor | null = null;

/**
 * Set the supervisor for the package registry.
 * This should be called after IPC integration is initialized.
 */
export function setAppsSupervisor(supervisor: RegistrySupervisor): void {
  supervisorInstance = supervisor;
  // Reset registry so it will be recreated with supervisor
  registryInstance = null;
}

function getRegistry(): PackageRegistry {
  if (!registryInstance) {
    const stateDir = resolveStateDir();
    registryInstance = createPackageRegistry({
      appsDir: "apps", // Relative to workspace root
      dataDir: `${stateDir}/packages`,
      configDir: stateDir,
      supervisor: supervisorInstance ?? undefined,
    });
  }
  return registryInstance;
}

// =============================================================================
// Category Helpers
// =============================================================================

function getCategories(): string[] {
  return ["all", "apps", "skills", "agents", "extensions"];
}

// =============================================================================
// Handler Implementations
// =============================================================================

export const appsHandlers: GatewayRequestHandlers = {
  /**
   * List all packages (installed + available).
   */
  "apps.list": async ({ params, respond }) => {
    if (!validateAppsListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid apps.list params: ${formatValidationErrors(validateAppsListParams.errors)}`,
        ),
      );
      return;
    }

    const p = params as {
      type?: "app" | "skill" | "agent" | "extension";
      installed?: boolean;
      enabled?: boolean;
      builtin?: boolean;
      search?: string;
      tags?: string[];
    };

    try {
      const registry = getRegistry();
      const packages = await registry.listAvailable({
        type: p.type,
        installed: p.installed,
        enabled: p.enabled,
        builtin: p.builtin,
        search: p.search,
        tags: p.tags,
      });

      respond(true, {
        packages,
        categories: getCategories(),
      });
    } catch (error) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Failed to list packages: ${String(error)}`),
      );
    }
  },

  /**
   * Get detailed info about a package.
   */
  "apps.info": async ({ params, respond }) => {
    if (!validateAppsInfoParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid apps.info params: ${formatValidationErrors(validateAppsInfoParams.errors)}`,
        ),
      );
      return;
    }

    const p = params as { packageId: string };

    try {
      const registry = getRegistry();
      const pkg = await registry.getPackage(p.packageId);
      const manifest = await registry.getManifest(p.packageId);
      const config = await registry.getConfig(p.packageId);

      respond(true, {
        package: pkg,
        configSchema: manifest?.configSchema,
        configUiHints: manifest?.configUiHints,
        config,
      });
    } catch (error) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Failed to get package info: ${String(error)}`),
      );
    }
  },

  /**
   * Install a package.
   */
  "apps.install": async ({ params, respond }) => {
    if (!validateAppsInstallParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid apps.install params: ${formatValidationErrors(validateAppsInstallParams.errors)}`,
        ),
      );
      return;
    }

    const p = params as { packageId: string; version?: string };

    try {
      const registry = getRegistry();
      const result = await registry.install(p.packageId, p.version);

      respond(true, result);
    } catch (error) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Failed to install package: ${String(error)}`),
      );
    }
  },

  /**
   * Uninstall a package.
   */
  "apps.uninstall": async ({ params, respond }) => {
    if (!validateAppsUninstallParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid apps.uninstall params: ${formatValidationErrors(validateAppsUninstallParams.errors)}`,
        ),
      );
      return;
    }

    const p = params as { packageId: string; purgeData?: boolean; force?: boolean };

    try {
      const registry = getRegistry();
      const result = await registry.uninstall(p.packageId, {
        purgeData: p.purgeData,
        force: p.force,
      });

      respond(true, result);
    } catch (error) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Failed to uninstall package: ${String(error)}`),
      );
    }
  },

  /**
   * Configure a package.
   */
  "apps.configure": async ({ params, respond }) => {
    if (!validateAppsConfigureParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid apps.configure params: ${formatValidationErrors(validateAppsConfigureParams.errors)}`,
        ),
      );
      return;
    }

    const p = params as {
      packageId: string;
      config: Record<string, unknown>;
      merge?: boolean;
      validate?: boolean;
      restart?: boolean;
    };

    try {
      const registry = getRegistry();
      const result = await registry.setConfig(p.packageId, p.config, {
        merge: p.merge,
        validate: p.validate,
        restart: p.restart,
      });

      respond(true, result);
    } catch (error) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Failed to configure package: ${String(error)}`),
      );
    }
  },

  /**
   * Get package configuration.
   */
  "apps.getConfig": async ({ params, respond }) => {
    if (!validateAppsGetConfigParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid apps.getConfig params: ${formatValidationErrors(validateAppsGetConfigParams.errors)}`,
        ),
      );
      return;
    }

    const p = params as { packageId: string };

    try {
      const registry = getRegistry();
      const config = await registry.getConfig(p.packageId);

      respond(true, { config });
    } catch (error) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Failed to get package config: ${String(error)}`),
      );
    }
  },

  /**
   * Enable or disable a package.
   */
  "apps.setEnabled": async ({ params, respond }) => {
    if (!validateAppsSetEnabledParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid apps.setEnabled params: ${formatValidationErrors(validateAppsSetEnabledParams.errors)}`,
        ),
      );
      return;
    }

    const p = params as { packageId: string; enabled: boolean };

    try {
      const registry = getRegistry();
      await registry.setEnabled(p.packageId, p.enabled);

      respond(true, { ok: true });
    } catch (error) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Failed to set package enabled: ${String(error)}`),
      );
    }
  },

  /**
   * Get package runtime status.
   */
  "apps.status": async ({ params, respond }) => {
    if (!validateAppsStatusParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid apps.status params: ${formatValidationErrors(validateAppsStatusParams.errors)}`,
        ),
      );
      return;
    }

    const p = params as { packageId: string };

    try {
      const registry = getRegistry();
      const status = await registry.getStatus(p.packageId);
      const pkg = await registry.getPackage(p.packageId);

      respond(true, {
        packageId: p.packageId,
        status,
        enabled: pkg?.enabled ?? false,
        lastError: pkg?.lastError,
      });
    } catch (error) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Failed to get package status: ${String(error)}`),
      );
    }
  },
};
