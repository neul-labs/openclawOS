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
};

export type PackageCategory = "all" | "apps" | "skills" | "agents" | "extensions";

export type AppStoreMessage = {
  kind: "success" | "error";
  message: string;
};

export type AppStoreMessageMap = Record<string, AppStoreMessage>;

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

// =============================================================================
// Actions
// =============================================================================

/**
 * Load packages from the gateway.
 */
export async function loadPackages(
  state: AppStoreState,
  options?: { clearMessages?: boolean },
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
    const res = await state.client.request<{ packages: PackageInfo[] }>("apps.list", {});
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
export async function installPackage(state: AppStoreState, packageId: string): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }

  state.appstoreBusyKey = packageId;
  state.appstoreError = null;

  try {
    const res = await state.client.request<{ ok: boolean; error?: string }>("apps.install", {
      packageId,
    });

    if (res?.ok) {
      setMessage(state, packageId, { kind: "success", message: "Installed" });
      await loadPackages(state);
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
    });

    if (res?.ok) {
      setMessage(state, packageId, { kind: "success", message: "Uninstalled" });
      await loadPackages(state);
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
    });

    if (res?.ok) {
      setMessage(state, packageId, {
        kind: "success",
        message: enabled ? "Enabled" : "Disabled",
      });
      await loadPackages(state);
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
    });

    if (res?.ok) {
      setMessage(state, packageId, { kind: "success", message: "Configuration saved" });
      await loadPackages(state);
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
 * Clear a message for a package.
 */
export function clearMessage(state: AppStoreState, packageId: string): void {
  setMessage(state, packageId, undefined);
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
