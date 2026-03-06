/**
 * App Store Gateway Method Handlers
 *
 * Handlers for apps.* gateway methods that manage OpenClawOS packages.
 */

import type { ChannelId } from "../../channels/plugins/types.js";
import type { ChannelRuntimeSnapshot } from "../server-channels.js";
import type { GatewayRequestContext, GatewayRequestHandlers } from "./types.js";
import { getChannelPlugin } from "../../channels/plugins/index.js";
import { loadConfig, writeConfigFile, type OpenClawConfig } from "../../config/config.js";
import { resolveStateDir } from "../../config/paths.js";
import {
  createPackageRegistry,
  type PackageInfo,
  type PackageRegistry,
  type RegistrySupervisor,
} from "../../packages/index.js";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "../../routing/session-key.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateAppsLifecycleParams,
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

type RuntimeMode = "in-process" | "ipc";
type PackageStatus = "running" | "stopped" | "starting" | "stopping" | "error" | "not_applicable";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isRuntimeMode(value: unknown): value is RuntimeMode {
  return value === "in-process" || value === "ipc";
}

function normalizeRequestedAccountId(accountId?: string): string | undefined {
  const trimmed = accountId?.trim();
  return trimmed ? normalizeAccountId(trimmed) : undefined;
}

function resolveChannelIdFromPackageId(packageId: string): ChannelId | null {
  const suffix = packageId.includes("/") ? packageId.split("/").at(-1) : packageId;
  if (!suffix) {
    return null;
  }
  return getChannelPlugin(suffix as ChannelId)?.id ?? null;
}

function readRuntimeModeFromResolvedAccount(account: unknown): RuntimeMode | undefined {
  if (!isRecord(account)) {
    return undefined;
  }
  const directRuntime = account.runtime;
  if (isRuntimeMode(directRuntime)) {
    return directRuntime;
  }
  const nested = account.config;
  if (!isRecord(nested)) {
    return undefined;
  }
  const nestedRuntime = nested.runtime;
  return isRuntimeMode(nestedRuntime) ? nestedRuntime : undefined;
}

function resolveChannelRuntimeMode(
  cfg: OpenClawConfig,
  channelId: ChannelId,
  accountId?: string,
): RuntimeMode {
  const plugin = getChannelPlugin(channelId);
  if (!plugin) {
    return "in-process";
  }
  const targetAccountId =
    normalizeRequestedAccountId(accountId) ??
    plugin.config.defaultAccountId?.(cfg) ??
    DEFAULT_ACCOUNT_ID;
  const resolved = plugin.config.resolveAccount(cfg, targetAccountId);
  const accountRuntime = readRuntimeModeFromResolvedAccount(resolved);
  if (accountRuntime) {
    return accountRuntime;
  }
  const section = cfg.channels?.[channelId];
  if (!isRecord(section)) {
    return "in-process";
  }
  const sectionRuntime = section.runtime;
  const accounts = isRecord(section.accounts) ? section.accounts : undefined;
  if (accountId && accounts) {
    const account = accounts[targetAccountId];
    if (isRecord(account) && isRuntimeMode(account.runtime)) {
      return account.runtime;
    }
    const matched = Object.entries(accounts).find(
      ([key, value]) => normalizeAccountId(key) === targetAccountId && isRecord(value),
    );
    if (matched && isRuntimeMode((matched[1] as Record<string, unknown>).runtime)) {
      return (matched[1] as Record<string, unknown>).runtime as RuntimeMode;
    }
  }
  if (isRuntimeMode(sectionRuntime)) {
    return sectionRuntime;
  }
  if (!accounts) {
    return "in-process";
  }
  for (const account of Object.values(accounts)) {
    if (isRecord(account) && isRuntimeMode(account.runtime)) {
      return account.runtime;
    }
  }
  return "in-process";
}

function resolveChannelEnabled(
  cfg: OpenClawConfig,
  channelId: ChannelId,
  accountId?: string,
): boolean {
  const plugin = getChannelPlugin(channelId);
  if (!plugin) {
    return true;
  }
  const targetAccountId =
    normalizeRequestedAccountId(accountId) ??
    plugin.config.defaultAccountId?.(cfg) ??
    DEFAULT_ACCOUNT_ID;
  const resolved = plugin.config.resolveAccount(cfg, targetAccountId);
  if (plugin.config.isEnabled) {
    return plugin.config.isEnabled(resolved, cfg);
  }
  if (!isRecord(resolved)) {
    return true;
  }
  return resolved.enabled !== false;
}

function resolveAppEnabledOverride(cfg: OpenClawConfig, packageId: string): boolean | undefined {
  const apps = cfg.apps;
  if (!apps) {
    return undefined;
  }
  const exact = apps[packageId];
  if (exact && typeof exact.enabled === "boolean") {
    return exact.enabled;
  }
  const unscoped = packageId.includes("/") ? packageId.split("/").at(-1) : packageId;
  if (!unscoped) {
    return undefined;
  }
  const alias = apps[unscoped];
  return alias && typeof alias.enabled === "boolean" ? alias.enabled : undefined;
}

function setAppEnabledOverride(
  cfg: OpenClawConfig,
  packageId: string,
  enabled: boolean,
): OpenClawConfig {
  return {
    ...cfg,
    apps: {
      ...cfg.apps,
      [packageId]: { ...cfg.apps?.[packageId], enabled },
    },
  };
}

function resolveInProcessStatus(
  lastError: string | null | undefined,
  running: boolean,
): PackageStatus {
  if (running) {
    return "running";
  }
  if (!lastError || lastError === "disabled" || lastError === "not configured") {
    return "stopped";
  }
  return "error";
}

function adaptPackageForConfig(
  pkg: PackageInfo,
  cfg: OpenClawConfig,
  runtimeSnapshot: ChannelRuntimeSnapshot | null,
  accountId?: string,
): PackageInfo {
  const channelId = resolveChannelIdFromPackageId(pkg.id);
  if (!channelId) {
    const explicit = resolveAppEnabledOverride(cfg, pkg.id);
    return explicit === undefined ? pkg : { ...pkg, enabled: explicit };
  }
  const explicit = resolveAppEnabledOverride(cfg, pkg.id);
  const channelEnabled = resolveChannelEnabled(cfg, channelId, accountId);
  const enabled = explicit ?? channelEnabled;
  const runtimeMode = resolveChannelRuntimeMode(cfg, channelId, accountId);
  if (runtimeMode === "ipc") {
    return { ...pkg, enabled };
  }
  const runtime = resolveChannelRuntime(runtimeSnapshot, channelId, accountId);
  const running = runtime?.running === true;
  const lastError = runtime?.lastError ?? null;
  return {
    ...pkg,
    enabled,
    status: resolveInProcessStatus(lastError, running),
    lastError: lastError ?? undefined,
  };
}

function mergeChannelConfig(
  cfg: OpenClawConfig,
  channelId: ChannelId,
  nextConfig: Record<string, unknown>,
  merge: boolean,
  accountId?: string,
): OpenClawConfig {
  const baseChannels = (cfg.channels ?? {}) as Record<string, unknown>;
  const existingSection = baseChannels[channelId];
  const currentSection = isRecord(existingSection) ? existingSection : {};
  const account = accountId?.trim();
  if (!account) {
    const section = merge ? { ...currentSection, ...nextConfig } : { ...nextConfig };
    return {
      ...cfg,
      channels: {
        ...baseChannels,
        [channelId]: section,
      } as OpenClawConfig["channels"],
    };
  }

  const normalized = normalizeAccountId(account);
  const existingAccounts = isRecord(currentSection.accounts) ? currentSection.accounts : undefined;
  if (normalized === DEFAULT_ACCOUNT_ID && !existingAccounts) {
    const section = merge ? { ...currentSection, ...nextConfig } : { ...nextConfig };
    return {
      ...cfg,
      channels: {
        ...baseChannels,
        [channelId]: section,
      } as OpenClawConfig["channels"],
    };
  }

  const accounts = { ...existingAccounts };
  let currentAccount = accounts[normalized];
  if (!isRecord(currentAccount)) {
    const matched = Object.entries(accounts).find(
      ([key, value]) => normalizeAccountId(key) === normalized && isRecord(value),
    );
    currentAccount = matched ? matched[1] : undefined;
  }
  const nextAccount =
    merge && isRecord(currentAccount) ? { ...currentAccount, ...nextConfig } : { ...nextConfig };
  accounts[normalized] = nextAccount;
  const section = {
    ...currentSection,
    accounts,
  };
  return {
    ...cfg,
    channels: {
      ...baseChannels,
      [channelId]: section,
    } as OpenClawConfig["channels"],
  };
}

function resolveChannelConfig(
  cfg: OpenClawConfig,
  channelId: ChannelId,
  accountId?: string,
): Record<string, unknown> {
  const section = cfg.channels?.[channelId];
  if (!isRecord(section)) {
    return {};
  }
  const account = normalizeRequestedAccountId(accountId);
  if (!account) {
    return section;
  }
  const base = { ...section };
  delete base.accounts;
  const accounts = isRecord(section.accounts) ? section.accounts : null;
  if (!accounts) {
    return section;
  }
  let accountSection = accounts[account];
  if (!isRecord(accountSection)) {
    const matched = Object.entries(accounts).find(
      ([key, value]) => normalizeAccountId(key) === account && isRecord(value),
    );
    accountSection = matched ? matched[1] : undefined;
  }
  if (!isRecord(accountSection)) {
    return base;
  }
  return { ...base, ...accountSection };
}

function setChannelEnabled(
  cfg: OpenClawConfig,
  channelId: ChannelId,
  enabled: boolean,
  accountId?: string,
): OpenClawConfig {
  const targetAccountId = normalizeRequestedAccountId(accountId) ?? DEFAULT_ACCOUNT_ID;
  const plugin = getChannelPlugin(channelId);
  if (!plugin?.config.setAccountEnabled) {
    return mergeChannelConfig(cfg, channelId, { enabled }, true, targetAccountId);
  }
  return plugin.config.setAccountEnabled({
    cfg,
    accountId: targetAccountId,
    enabled,
  });
}

function resolveChannelRuntime(
  runtimeSnapshot: ChannelRuntimeSnapshot | null,
  channelId: ChannelId,
  accountId?: string,
) {
  if (!runtimeSnapshot) {
    return undefined;
  }
  const targetAccountId = normalizeRequestedAccountId(accountId);
  if (!targetAccountId) {
    return runtimeSnapshot.channels[channelId];
  }
  const accountRuntimes = runtimeSnapshot.channelAccounts[channelId];
  if (!accountRuntimes) {
    return runtimeSnapshot.channels[channelId];
  }
  const direct = accountRuntimes[targetAccountId];
  if (direct) {
    return direct;
  }
  const matched = Object.entries(accountRuntimes).find(
    ([key]) => normalizeAccountId(key) === targetAccountId,
  );
  return matched?.[1] ?? runtimeSnapshot.channels[channelId];
}

function readRestartCount(runtime: unknown): number | undefined {
  if (!isRecord(runtime)) {
    return undefined;
  }
  const value = runtime.restartCount;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.trunc(value);
}

async function runChannelLifecycle(params: {
  context: GatewayRequestContext;
  registry: PackageRegistry;
  packageId: string;
  channelId: ChannelId;
  cfg: OpenClawConfig;
  accountId?: string;
  action: "start" | "stop" | "restart";
}): Promise<void> {
  const targetAccountId = normalizeRequestedAccountId(params.accountId);
  const mode = resolveChannelRuntimeMode(params.cfg, params.channelId, targetAccountId);
  if (mode === "ipc") {
    if (params.action === "start") {
      await params.registry.startPackage(params.packageId);
      return;
    }
    if (params.action === "stop") {
      await params.registry.stopPackage(params.packageId);
      return;
    }
    await params.registry.restartPackage(params.packageId);
    return;
  }
  if (params.action === "start") {
    await params.context.startChannel(params.channelId, targetAccountId);
    return;
  }
  if (params.action === "stop") {
    await params.context.stopChannel(params.channelId, targetAccountId);
    return;
  }
  await params.context.stopChannel(params.channelId, targetAccountId);
  await params.context.startChannel(params.channelId, targetAccountId);
}

// =============================================================================
// Handler Implementations
// =============================================================================

export const appsHandlers: GatewayRequestHandlers = {
  /**
   * List all packages (installed + available).
   */
  "apps.list": async ({ params, respond, context }) => {
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
      accountId?: string;
      installed?: boolean;
      enabled?: boolean;
      builtin?: boolean;
      search?: string;
      tags?: string[];
    };

    try {
      const registry = getRegistry();
      const cfg = loadConfig();
      const runtimeSnapshot = context.getRuntimeSnapshot();
      const packages = await registry.listAvailable({
        type: p.type,
        installed: p.installed,
        enabled: undefined,
        builtin: p.builtin,
        search: p.search,
        tags: p.tags,
      });
      let adaptedPackages = packages.map((pkg) =>
        adaptPackageForConfig(pkg, cfg, runtimeSnapshot, p.accountId),
      );
      if (typeof p.enabled === "boolean") {
        adaptedPackages = adaptedPackages.filter((pkg) => (pkg.enabled ?? false) === p.enabled);
      }

      respond(true, {
        packages: adaptedPackages,
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
  "apps.info": async ({ params, respond, context }) => {
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

    const p = params as { packageId: string; accountId?: string };

    try {
      const registry = getRegistry();
      const cfg = loadConfig();
      const pkg = await registry.getPackage(p.packageId);
      const manifest = await registry.getManifest(p.packageId);
      const channelId = resolveChannelIdFromPackageId(p.packageId);
      const config = channelId
        ? resolveChannelConfig(cfg, channelId, p.accountId)
        : await registry.getConfig(p.packageId);
      const adaptedPkg = pkg
        ? adaptPackageForConfig(pkg, cfg, context.getRuntimeSnapshot(), p.accountId)
        : pkg;
      const channelPlugin = channelId ? getChannelPlugin(channelId) : null;

      respond(true, {
        package: adaptedPkg,
        configSchema: channelPlugin?.configSchema?.schema ?? manifest?.configSchema,
        configUiHints: channelPlugin?.configSchema?.uiHints ?? manifest?.configUiHints,
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
  "apps.install": async ({ params, respond, context }) => {
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

    const p = params as { packageId: string; accountId?: string; version?: string };

    try {
      const registry = getRegistry();
      const channelId = resolveChannelIdFromPackageId(p.packageId);
      if (!channelId) {
        const result = await registry.install(p.packageId, p.version);
        respond(true, result);
        return;
      }

      const pkg = await registry.getPackage(p.packageId);
      if (!pkg) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `unknown package: ${p.packageId}`),
        );
        return;
      }

      const cfg = loadConfig();
      let nextCfg = cfg;
      if (!normalizeRequestedAccountId(p.accountId)) {
        nextCfg = setAppEnabledOverride(nextCfg, p.packageId, true);
      }
      nextCfg = setChannelEnabled(nextCfg, channelId, true, p.accountId);
      await writeConfigFile(nextCfg);

      try {
        await runChannelLifecycle({
          context,
          registry,
          packageId: p.packageId,
          channelId,
          cfg: nextCfg,
          accountId: p.accountId,
          action: "start",
        });
      } catch (err) {
        context.logGateway.warn(
          `apps.install lifecycle failed for ${p.packageId} (${channelId}): ${String(err)}`,
        );
      }

      respond(true, {
        ok: true,
        packageId: p.packageId,
        version: pkg.version,
      });
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
  "apps.uninstall": async ({ params, respond, context }) => {
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

    const p = params as {
      packageId: string;
      accountId?: string;
      purgeData?: boolean;
      force?: boolean;
    };

    try {
      const registry = getRegistry();
      const channelId = resolveChannelIdFromPackageId(p.packageId);
      if (!channelId) {
        const result = await registry.uninstall(p.packageId, {
          purgeData: p.purgeData,
          force: p.force,
        });
        respond(true, result);
        return;
      }

      const pkg = await registry.getPackage(p.packageId);
      if (!pkg) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `unknown package: ${p.packageId}`),
        );
        return;
      }

      const cfg = loadConfig();
      let nextCfg = cfg;
      if (!normalizeRequestedAccountId(p.accountId)) {
        nextCfg = setAppEnabledOverride(nextCfg, p.packageId, false);
      }
      nextCfg = setChannelEnabled(nextCfg, channelId, false, p.accountId);
      await writeConfigFile(nextCfg);

      try {
        await runChannelLifecycle({
          context,
          registry,
          packageId: p.packageId,
          channelId,
          cfg: nextCfg,
          accountId: p.accountId,
          action: "stop",
        });
      } catch (err) {
        context.logGateway.warn(
          `apps.uninstall lifecycle failed for ${p.packageId} (${channelId}): ${String(err)}`,
        );
      }

      respond(true, {
        ok: true,
        packageId: p.packageId,
        dataPurged: false,
      });
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
  "apps.configure": async ({ params, respond, context }) => {
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
      accountId?: string;
      config: Record<string, unknown>;
      merge?: boolean;
      validate?: boolean;
      restart?: boolean;
    };

    try {
      const registry = getRegistry();
      const channelId = resolveChannelIdFromPackageId(p.packageId);
      if (!channelId) {
        const result = await registry.setConfig(p.packageId, p.config, {
          merge: p.merge,
          validate: p.validate,
          restart: p.restart,
        });
        respond(true, result);
        return;
      }

      const cfg = loadConfig();
      const nextCfg = mergeChannelConfig(cfg, channelId, p.config, p.merge !== false, p.accountId);
      await writeConfigFile(nextCfg);

      let restarted = false;
      if (p.restart) {
        try {
          await runChannelLifecycle({
            context,
            registry,
            packageId: p.packageId,
            channelId,
            cfg: nextCfg,
            accountId: p.accountId,
            action: "restart",
          });
          restarted = true;
        } catch (err) {
          context.logGateway.warn(
            `apps.configure restart failed for ${p.packageId} (${channelId}): ${String(err)}`,
          );
        }
      }

      respond(true, {
        ok: true,
        packageId: p.packageId,
        config: resolveChannelConfig(nextCfg, channelId, p.accountId),
        restarted,
      });
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

    const p = params as { packageId: string; accountId?: string };

    try {
      const registry = getRegistry();
      const channelId = resolveChannelIdFromPackageId(p.packageId);
      const config = channelId
        ? resolveChannelConfig(loadConfig(), channelId, p.accountId)
        : await registry.getConfig(p.packageId);

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
  "apps.setEnabled": async ({ params, respond, context }) => {
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

    const p = params as { packageId: string; accountId?: string; enabled: boolean };

    try {
      const registry = getRegistry();
      const channelId = resolveChannelIdFromPackageId(p.packageId);
      if (!channelId) {
        await registry.setEnabled(p.packageId, p.enabled);
        respond(true, { ok: true });
        return;
      }

      const cfg = loadConfig();
      let nextCfg = cfg;
      if (!normalizeRequestedAccountId(p.accountId)) {
        nextCfg = setAppEnabledOverride(nextCfg, p.packageId, p.enabled);
      }
      nextCfg = setChannelEnabled(nextCfg, channelId, p.enabled, p.accountId);
      await writeConfigFile(nextCfg);

      try {
        await runChannelLifecycle({
          context,
          registry,
          packageId: p.packageId,
          channelId,
          cfg: nextCfg,
          accountId: p.accountId,
          action: p.enabled ? "start" : "stop",
        });
      } catch (err) {
        context.logGateway.warn(
          `apps.setEnabled lifecycle failed for ${p.packageId} (${channelId}): ${String(err)}`,
        );
      }

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
  "apps.status": async ({ params, respond, context }) => {
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

    const p = params as { packageId: string; accountId?: string };

    try {
      const registry = getRegistry();
      const cfg = loadConfig();
      const channelId = resolveChannelIdFromPackageId(p.packageId);
      const pkg = await registry.getPackage(p.packageId);
      if (!pkg) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `unknown package: ${p.packageId}`),
        );
        return;
      }
      const adapted = adaptPackageForConfig(pkg, cfg, context.getRuntimeSnapshot(), p.accountId);
      const explicitEnabled = resolveAppEnabledOverride(cfg, p.packageId);
      const enabled = channelId
        ? (explicitEnabled ?? resolveChannelEnabled(cfg, channelId, p.accountId))
        : (adapted.enabled ?? false);
      const mode = channelId ? resolveChannelRuntimeMode(cfg, channelId, p.accountId) : "ipc";
      const runtime = channelId
        ? resolveChannelRuntime(context.getRuntimeSnapshot(), channelId, p.accountId)
        : undefined;
      const status =
        channelId && mode === "in-process"
          ? resolveInProcessStatus(runtime?.lastError, runtime?.running === true)
          : await registry.getStatus(p.packageId);

      respond(true, {
        packageId: p.packageId,
        status,
        enabled,
        lastError: channelId ? (runtime?.lastError ?? undefined) : adapted.lastError,
        startedAt: runtime?.lastStartAt,
        restartCount: readRestartCount(runtime),
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
      const cfg = loadConfig();
      const packages = (await registry.listAvailable())
        .map((pkg) => adaptPackageForConfig(pkg, cfg, null))
        .filter((pkg) => pkg.enabled !== false);

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
  "apps.start": async ({ params, respond, context }) => {
    if (!validateAppsLifecycleParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid apps.start params: ${formatValidationErrors(validateAppsLifecycleParams.errors)}`,
        ),
      );
      return;
    }
    const p = params as { packageId: string; accountId?: string };

    try {
      const registry = getRegistry();
      const channelId = resolveChannelIdFromPackageId(p.packageId);
      if (!channelId) {
        await registry.startPackage(p.packageId);
        respond(true, { ok: true });
        return;
      }
      await runChannelLifecycle({
        context,
        registry,
        packageId: p.packageId,
        channelId,
        cfg: loadConfig(),
        accountId: p.accountId,
        action: "start",
      });
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
  "apps.stop": async ({ params, respond, context }) => {
    if (!validateAppsLifecycleParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid apps.stop params: ${formatValidationErrors(validateAppsLifecycleParams.errors)}`,
        ),
      );
      return;
    }
    const p = params as { packageId: string; accountId?: string };

    try {
      const registry = getRegistry();
      const channelId = resolveChannelIdFromPackageId(p.packageId);
      if (!channelId) {
        await registry.stopPackage(p.packageId);
        respond(true, { ok: true });
        return;
      }
      await runChannelLifecycle({
        context,
        registry,
        packageId: p.packageId,
        channelId,
        cfg: loadConfig(),
        accountId: p.accountId,
        action: "stop",
      });
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
  "apps.restart": async ({ params, respond, context }) => {
    if (!validateAppsLifecycleParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid apps.restart params: ${formatValidationErrors(validateAppsLifecycleParams.errors)}`,
        ),
      );
      return;
    }
    const p = params as { packageId: string; accountId?: string };

    try {
      const registry = getRegistry();
      const channelId = resolveChannelIdFromPackageId(p.packageId);
      if (!channelId) {
        await registry.restartPackage(p.packageId);
        respond(true, { ok: true });
        return;
      }
      await runChannelLifecycle({
        context,
        registry,
        packageId: p.packageId,
        channelId,
        cfg: loadConfig(),
        accountId: p.accountId,
        action: "restart",
      });
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
