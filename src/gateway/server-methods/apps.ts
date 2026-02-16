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

  /**
   * Get UI manifest for all enabled packages.
   */
  "apps.getUiManifest": async ({ respond }) => {
    try {
      const registry = getRegistry();
      const packages = await registry.listAvailable({ enabled: true });

      const tabs: Array<{
        packageId: string;
        id: string;
        title: string;
        icon?: string;
        render: { type: string; src?: string; tag?: string; view?: string };
        position?: string;
        badge?: { method: string; interval?: number };
      }> = [];

      const components: Array<{
        packageId: string;
        tag: string;
        module: string;
        scope: string;
      }> = [];

      const settings: Array<{
        packageId: string;
        id: string;
        title: string;
        render: { type: string; src?: string; tag?: string };
      }> = [];

      for (const pkg of packages) {
        const caps = pkg.capabilities;
        const ui = caps?.ui as
          | {
              tabs?: Array<{
                id: string;
                title: string;
                icon?: string;
                render: { type: string; src?: string; tag?: string; view?: string };
                position?: string;
                badge?: { method: string; interval?: number };
              }>;
              components?: Array<{
                tag: string;
                module: string;
                scope: string;
              }>;
              settings?: Array<{
                id: string;
                title: string;
                render: { type: string; src?: string; tag?: string };
              }>;
            }
          | undefined;

        if (ui?.tabs) {
          for (const tab of ui.tabs) {
            tabs.push({
              packageId: pkg.id,
              id: tab.id,
              title: tab.title,
              icon: tab.icon,
              render: tab.render,
              position: tab.position,
              badge: tab.badge,
            });
          }
        }

        if (ui?.components) {
          for (const component of ui.components) {
            components.push({
              packageId: pkg.id,
              tag: component.tag,
              module: component.module,
              scope: component.scope,
            });
          }
        }

        if (ui?.settings) {
          for (const setting of ui.settings) {
            settings.push({
              packageId: pkg.id,
              id: setting.id,
              title: setting.title,
              render: setting.render,
            });
          }
        }
      }

      respond(true, { tabs, components, settings });
    } catch (error) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Failed to get UI manifest: ${String(error)}`),
      );
    }
  },

  /**
   * Start a package (app).
   */
  "apps.start": async ({ params, respond }) => {
    const p = params as { packageId?: string };
    if (!p.packageId?.trim()) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "packageId is required"));
      return;
    }

    try {
      const registry = getRegistry();
      await registry.startPackage(p.packageId);
      respond(true, { ok: true });
    } catch (error) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Failed to start package: ${String(error)}`),
      );
    }
  },

  /**
   * Stop a package (app).
   */
  "apps.stop": async ({ params, respond }) => {
    const p = params as { packageId?: string };
    if (!p.packageId?.trim()) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "packageId is required"));
      return;
    }

    try {
      const registry = getRegistry();
      await registry.stopPackage(p.packageId);
      respond(true, { ok: true });
    } catch (error) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Failed to stop package: ${String(error)}`),
      );
    }
  },

  /**
   * Restart a package (app).
   */
  "apps.restart": async ({ params, respond }) => {
    const p = params as { packageId?: string };
    if (!p.packageId?.trim()) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "packageId is required"));
      return;
    }

    try {
      const registry = getRegistry();
      await registry.restartPackage(p.packageId);
      respond(true, { ok: true });
    } catch (error) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Failed to restart package: ${String(error)}`),
      );
    }
  },
};
