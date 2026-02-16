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
 * Start a package (app).
 */
export async function startPackage(state: AppStoreState, packageId: string): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }

  state.appstoreBusyKey = packageId;
  state.appstoreError = null;

  try {
    const res = await state.client.request<{ ok: boolean; error?: string }>("apps.start", {
      packageId,
    });

    if (res?.ok) {
      setMessage(state, packageId, { kind: "success", message: "Started" });
      await loadPackages(state);
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
export async function stopPackage(state: AppStoreState, packageId: string): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }

  state.appstoreBusyKey = packageId;
  state.appstoreError = null;

  try {
    const res = await state.client.request<{ ok: boolean; error?: string }>("apps.stop", {
      packageId,
    });

    if (res?.ok) {
      setMessage(state, packageId, { kind: "success", message: "Stopped" });
      await loadPackages(state);
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
export async function restartPackage(state: AppStoreState, packageId: string): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }

  state.appstoreBusyKey = packageId;
  state.appstoreError = null;

  try {
    const res = await state.client.request<{ ok: boolean; error?: string }>("apps.restart", {
      packageId,
    });

    if (res?.ok) {
      setMessage(state, packageId, { kind: "success", message: "Restarted" });
      await loadPackages(state);
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
export async function confirmInstall(state: AppStoreState): Promise<void> {
  const pkg = state.appstoreInstallPending;
  if (!pkg) {
    return;
  }
  state.appstoreInstallPending = null;
  await installPackage(state, pkg.id);
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
