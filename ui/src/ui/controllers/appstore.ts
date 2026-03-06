/**
 * App Store Controller
 *
 * Manages state and actions for the App Store UI.
 */

import type { GatewayBrowserClient } from "../gateway.js";

// =============================================================================
// Types
// =============================================================================

export type PackageType = "app" | "skill" | "agent" | "extension";

export type PackageStatus =
  | "running"
  | "stopped"
  | "starting"
  | "stopping"
  | "error"
  | "not_applicable";

export type PackageCapabilities = {
  channels?: {
    provides?: string[];
    requires?: string[];
  };
  tools?: {
    provides?: string[];
    requires?: string[];
  };
  hooks?: {
    subscribes?: string[];
    intercepts?: string[];
  };
  gateway?: {
    methods?: string[];
    httpRoutes?: string[];
  };
  providers?: {
    provides?: string[];
    models?: string[];
  };
  resources?: {
    env?: string[];
    fs?: {
      read?: string[];
      write?: string[];
    };
    network?: {
      hosts?: string[];
    };
  };
  security?: {
    sandboxed?: boolean;
    trustLevel?: string;
  };
};

export type PackageInfo = {
  id: string;
  name: string;
  description?: string;
  type: PackageType;
  version: string;
  icon?: string;
  author?: string;
  license?: string;
  repository?: string;
  tags?: string[];
  installed: boolean;
  builtin: boolean;
  enabled?: boolean;
  installedVersion?: string;
  latestVersion?: string;
  status?: PackageStatus;
  lastError?: string;
  capabilities?: PackageCapabilities;
};

export type PackageCategory = "all" | "apps" | "skills" | "agents" | "extensions";

export type AppStoreMessage = {
  kind: "success" | "error";
  message: string;
};

export type AppStoreMessageMap = Record<string, AppStoreMessage>;

export type AppStoreAccountScope = {
  accountId?: string;
};

export type PackageDetails = {
  package: PackageInfo;
  configSchema?: unknown;
  configUiHints?: Record<string, unknown>;
  config: Record<string, unknown>;
};

export type AppStoreState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  appstoreLoading: boolean;
  appstorePackages: PackageInfo[] | null;
  appstoreError: string | null;
  appstoreFilter: string;
  appstoreCategory: PackageCategory;
  appstoreSelectedId: string | null;
  appstoreBusyKey: string | null;
  appstoreMessages: AppStoreMessageMap;
  /** Package pending install confirmation (for modal) */
  appstoreInstallPending: PackageInfo | null;
  appstoreDetailsLoading: boolean;
  appstoreDetailsError: string | null;
  appstoreDetails: PackageDetails | null;
  appstoreConfigDraft: string;
  appstoreConfigDirty: boolean;
  appstoreSelectedScopeAccountId: string | null;
};

// =============================================================================
// Initial State
// =============================================================================

export function createAppStoreInitialState(): Partial<AppStoreState> {
  return {
    appstoreLoading: false,
    appstorePackages: null,
    appstoreError: null,
    appstoreFilter: "",
    appstoreCategory: "all",
    appstoreSelectedId: null,
    appstoreBusyKey: null,
    appstoreMessages: {},
    appstoreInstallPending: null,
    appstoreDetailsLoading: false,
    appstoreDetailsError: null,
    appstoreDetails: null,
    appstoreConfigDraft: "{}",
    appstoreConfigDirty: false,
    appstoreSelectedScopeAccountId: null,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function setMessage(state: AppStoreState, key: string, message?: AppStoreMessage) {
  if (!key.trim()) {
    return;
  }
  const next = { ...state.appstoreMessages };
  if (message) {
    next[key] = message;
  } else {
    delete next[key];
  }
  state.appstoreMessages = next;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

function resolveScopeParams(scope?: AppStoreAccountScope): Record<string, unknown> {
  const accountId = scope?.accountId?.trim();
  return accountId ? { accountId } : {};
}

function resolveScopeAccountId(scope?: AppStoreAccountScope): string | null {
  const accountId = scope?.accountId?.trim();
  return accountId || null;
}

function toConfigRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function clearPackageDetails(state: AppStoreState): void {
  state.appstoreDetailsLoading = false;
  state.appstoreDetailsError = null;
  state.appstoreDetails = null;
  state.appstoreConfigDraft = "{}";
  state.appstoreConfigDirty = false;
  state.appstoreSelectedScopeAccountId = null;
}

// =============================================================================
// Actions
// =============================================================================

/**
 * Load packages from the gateway.
 */
export async function loadPackages(
  state: AppStoreState,
  options?: { clearMessages?: boolean; scope?: AppStoreAccountScope },
): Promise<void> {
  if (options?.clearMessages && Object.keys(state.appstoreMessages).length > 0) {
    state.appstoreMessages = {};
  }
  if (!state.client || !state.connected) {
    return;
  }
  if (state.appstoreLoading) {
    return;
  }

  state.appstoreLoading = true;
  state.appstoreError = null;

  try {
    const res = await state.client.request<{ packages: PackageInfo[] }>("apps.list", {
      ...resolveScopeParams(options?.scope),
    });
    if (res?.packages) {
      state.appstorePackages = res.packages;
    }
  } catch (err) {
    state.appstoreError = getErrorMessage(err);
  } finally {
    state.appstoreLoading = false;
  }
}

/**
 * Install a package.
 */
export async function installPackage(
  state: AppStoreState,
  packageId: string,
  scope?: AppStoreAccountScope,
): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }

  state.appstoreBusyKey = packageId;
  state.appstoreError = null;

  try {
    const res = await state.client.request<{ ok: boolean; error?: string }>("apps.install", {
      packageId,
      ...resolveScopeParams(scope),
    });

    if (res?.ok) {
      setMessage(state, packageId, { kind: "success", message: "Installed" });
      await loadPackages(state, { scope });
      if (state.appstoreSelectedId === packageId) {
        await loadPackageDetails(state, packageId, scope);
      }
    } else {
      setMessage(state, packageId, { kind: "error", message: res?.error || "Install failed" });
    }
  } catch (err) {
    const message = getErrorMessage(err);
    state.appstoreError = message;
    setMessage(state, packageId, { kind: "error", message });
  } finally {
    state.appstoreBusyKey = null;
  }
}

/**
 * Uninstall a package.
 */
export async function uninstallPackage(
  state: AppStoreState,
  packageId: string,
  purgeData = false,
  scope?: AppStoreAccountScope,
): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }

  state.appstoreBusyKey = packageId;
  state.appstoreError = null;

  try {
    const res = await state.client.request<{ ok: boolean; error?: string }>("apps.uninstall", {
      packageId,
      purgeData,
      ...resolveScopeParams(scope),
    });

    if (res?.ok) {
      setMessage(state, packageId, { kind: "success", message: "Uninstalled" });
      await loadPackages(state, { scope });
      if (state.appstoreSelectedId === packageId) {
        await loadPackageDetails(state, packageId, scope);
      }
    } else {
      setMessage(state, packageId, { kind: "error", message: res?.error || "Uninstall failed" });
    }
  } catch (err) {
    const message = getErrorMessage(err);
    state.appstoreError = message;
    setMessage(state, packageId, { kind: "error", message });
  } finally {
    state.appstoreBusyKey = null;
  }
}

/**
 * Enable or disable a package.
 */
export async function setPackageEnabled(
  state: AppStoreState,
  packageId: string,
  enabled: boolean,
  scope?: AppStoreAccountScope,
): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }

  state.appstoreBusyKey = packageId;
  state.appstoreError = null;

  try {
    const res = await state.client.request<{ ok: boolean; error?: string }>("apps.setEnabled", {
      packageId,
      enabled,
      ...resolveScopeParams(scope),
    });

    if (res?.ok) {
      setMessage(state, packageId, {
        kind: "success",
        message: enabled ? "Enabled" : "Disabled",
      });
      await loadPackages(state, { scope });
      if (state.appstoreSelectedId === packageId) {
        await loadPackageDetails(state, packageId, scope);
      }
    } else {
      setMessage(state, packageId, { kind: "error", message: res?.error || "Operation failed" });
    }
  } catch (err) {
    const message = getErrorMessage(err);
    state.appstoreError = message;
    setMessage(state, packageId, { kind: "error", message });
  } finally {
    state.appstoreBusyKey = null;
  }
}

/**
 * Update package configuration.
 */
export async function configurePackage(
  state: AppStoreState,
  packageId: string,
  config: Record<string, unknown>,
  scope?: AppStoreAccountScope,
): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }

  state.appstoreBusyKey = packageId;
  state.appstoreError = null;

  try {
    const res = await state.client.request<{ ok: boolean; error?: string }>("apps.configure", {
      packageId,
      config,
      ...resolveScopeParams(scope),
    });

    if (res?.ok) {
      setMessage(state, packageId, { kind: "success", message: "Configuration saved" });
      await loadPackages(state, { scope });
      if (state.appstoreSelectedId === packageId) {
        await loadPackageDetails(state, packageId, scope);
      }
    } else {
      setMessage(state, packageId, { kind: "error", message: res?.error || "Configure failed" });
    }
  } catch (err) {
    const message = getErrorMessage(err);
    state.appstoreError = message;
    setMessage(state, packageId, { kind: "error", message });
  } finally {
    state.appstoreBusyKey = null;
  }
}

/**
 * Start a package (app).
 */
export async function startPackage(
  state: AppStoreState,
  packageId: string,
  scope?: AppStoreAccountScope,
): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }

  state.appstoreBusyKey = packageId;
  state.appstoreError = null;

  try {
    const res = await state.client.request<{ ok: boolean; error?: string }>("apps.start", {
      packageId,
      ...resolveScopeParams(scope),
    });

    if (res?.ok) {
      setMessage(state, packageId, { kind: "success", message: "Started" });
      await loadPackages(state, { scope });
      if (state.appstoreSelectedId === packageId) {
        await loadPackageDetails(state, packageId, scope);
      }
    } else {
      setMessage(state, packageId, { kind: "error", message: res?.error || "Start failed" });
    }
  } catch (err) {
    const message = getErrorMessage(err);
    state.appstoreError = message;
    setMessage(state, packageId, { kind: "error", message });
  } finally {
    state.appstoreBusyKey = null;
  }
}

/**
 * Stop a package (app).
 */
export async function stopPackage(
  state: AppStoreState,
  packageId: string,
  scope?: AppStoreAccountScope,
): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }

  state.appstoreBusyKey = packageId;
  state.appstoreError = null;

  try {
    const res = await state.client.request<{ ok: boolean; error?: string }>("apps.stop", {
      packageId,
      ...resolveScopeParams(scope),
    });

    if (res?.ok) {
      setMessage(state, packageId, { kind: "success", message: "Stopped" });
      await loadPackages(state, { scope });
      if (state.appstoreSelectedId === packageId) {
        await loadPackageDetails(state, packageId, scope);
      }
    } else {
      setMessage(state, packageId, { kind: "error", message: res?.error || "Stop failed" });
    }
  } catch (err) {
    const message = getErrorMessage(err);
    state.appstoreError = message;
    setMessage(state, packageId, { kind: "error", message });
  } finally {
    state.appstoreBusyKey = null;
  }
}

/**
 * Restart a package (app).
 */
export async function restartPackage(
  state: AppStoreState,
  packageId: string,
  scope?: AppStoreAccountScope,
): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }

  state.appstoreBusyKey = packageId;
  state.appstoreError = null;

  try {
    const res = await state.client.request<{ ok: boolean; error?: string }>("apps.restart", {
      packageId,
      ...resolveScopeParams(scope),
    });

    if (res?.ok) {
      setMessage(state, packageId, { kind: "success", message: "Restarted" });
      await loadPackages(state, { scope });
      if (state.appstoreSelectedId === packageId) {
        await loadPackageDetails(state, packageId, scope);
      }
    } else {
      setMessage(state, packageId, { kind: "error", message: res?.error || "Restart failed" });
    }
  } catch (err) {
    const message = getErrorMessage(err);
    state.appstoreError = message;
    setMessage(state, packageId, { kind: "error", message });
  } finally {
    state.appstoreBusyKey = null;
  }
}

/**
 * Clear a message for a package.
 */
export function clearMessage(state: AppStoreState, packageId: string): void {
  setMessage(state, packageId, undefined);
}

/**
 * Show install confirmation modal for a package.
 */
export function showInstallModal(state: AppStoreState, packageId: string): void {
  const pkg = state.appstorePackages?.find((p) => p.id === packageId);
  if (pkg) {
    state.appstoreInstallPending = pkg;
  }
}

/**
 * Cancel install modal.
 */
export function cancelInstallModal(state: AppStoreState): void {
  state.appstoreInstallPending = null;
}

/**
 * Confirm install from modal.
 */
export async function confirmInstall(
  state: AppStoreState,
  scope?: AppStoreAccountScope,
): Promise<void> {
  const pkg = state.appstoreInstallPending;
  if (!pkg) {
    return;
  }
  state.appstoreInstallPending = null;
  await installPackage(state, pkg.id, scope);
}

/**
 * Set the filter string.
 */
export function setFilter(state: AppStoreState, filter: string): void {
  state.appstoreFilter = filter;
}

/**
 * Set the category filter.
 */
export function setCategory(state: AppStoreState, category: PackageCategory): void {
  state.appstoreCategory = category;
}

/**
 * Select a package for details view.
 */
export function selectPackage(state: AppStoreState, packageId: string | null): void {
  state.appstoreSelectedId = packageId;
  if (!packageId) {
    clearPackageDetails(state);
  }
}

export async function loadPackageDetails(
  state: AppStoreState,
  packageId: string,
  scope?: AppStoreAccountScope,
): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }
  state.appstoreSelectedId = packageId;
  state.appstoreDetailsLoading = true;
  state.appstoreDetailsError = null;
  state.appstoreSelectedScopeAccountId = resolveScopeAccountId(scope);

  try {
    const res = await state.client.request<{
      package: PackageInfo | null;
      configSchema?: unknown;
      configUiHints?: Record<string, unknown>;
      config?: Record<string, unknown>;
    }>("apps.info", {
      packageId,
      ...resolveScopeParams(scope),
    });

    if (!res?.package) {
      state.appstoreDetails = null;
      state.appstoreDetailsError = `Package not found: ${packageId}`;
      state.appstoreConfigDraft = "{}";
      state.appstoreConfigDirty = false;
      return;
    }

    const config = toConfigRecord(res.config);
    state.appstoreDetails = {
      package: res.package,
      configSchema: res.configSchema,
      configUiHints: res.configUiHints,
      config,
    };
    state.appstoreConfigDraft = formatJson(config);
    state.appstoreConfigDirty = false;
  } catch (err) {
    state.appstoreDetails = null;
    state.appstoreDetailsError = getErrorMessage(err);
  } finally {
    state.appstoreDetailsLoading = false;
  }
}

export function updateConfigDraft(state: AppStoreState, draft: string): void {
  state.appstoreConfigDraft = draft;
  state.appstoreConfigDirty = true;
}

export function resetConfigDraft(state: AppStoreState): void {
  const config = state.appstoreDetails?.config ?? {};
  state.appstoreConfigDraft = formatJson(config);
  state.appstoreConfigDirty = false;
}

export async function saveSelectedPackageConfig(
  state: AppStoreState,
  scope?: AppStoreAccountScope,
): Promise<void> {
  const packageId = state.appstoreSelectedId;
  if (!packageId || !state.client || !state.connected) {
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(state.appstoreConfigDraft);
  } catch {
    state.appstoreDetailsError = "Configuration must be valid JSON.";
    return;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    state.appstoreDetailsError = "Configuration must be a JSON object.";
    return;
  }
  state.appstoreDetailsError = null;
  await configurePackage(state, packageId, parsed as Record<string, unknown>, scope);
}

/**
 * Get filtered packages based on current state.
 */
export function getFilteredPackages(state: AppStoreState): PackageInfo[] {
  const packages = state.appstorePackages ?? [];
  const filter = state.appstoreFilter.trim().toLowerCase();
  const category = state.appstoreCategory;

  return packages.filter((pkg) => {
    // Category filter
    if (category !== "all") {
      const typeMap: Record<PackageCategory, PackageType | null> = {
        all: null,
        apps: "app",
        skills: "skill",
        agents: "agent",
        extensions: "extension",
      };
      const targetType = typeMap[category];
      if (targetType && pkg.type !== targetType) {
        return false;
      }
    }

    // Text filter
    if (filter) {
      const searchText = [pkg.name, pkg.description, pkg.id, ...(pkg.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!searchText.includes(filter)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Group packages by type.
 */
export function groupPackagesByType(packages: PackageInfo[]): Map<PackageType, PackageInfo[]> {
  const groups = new Map<PackageType, PackageInfo[]>();

  for (const pkg of packages) {
    const existing = groups.get(pkg.type) ?? [];
    existing.push(pkg);
    groups.set(pkg.type, existing);
  }

  return groups;
}
