/**
 * UI Manifest Controller
 *
 * Manages app-contributed UI elements: tabs, components, and settings panels.
 */

import type { GatewayBrowserClient } from "../gateway.ts";

// =============================================================================
// Types
// =============================================================================

export type AppTab = {
  packageId: string;
  id: string;
  title: string;
  icon?: string;
  render:
    | { type: "iframe"; src: string }
    | { type: "component"; tag: string }
    | { type: "builtin"; view: string };
  position?: "top" | "bottom" | "after:chat" | "after:channels";
  badge?: { method: string; interval?: number };
};

export type AppComponent = {
  packageId: string;
  tag: string;
  module: string;
  scope: "tab" | "widget" | "settings" | "global";
};

export type AppSetting = {
  packageId: string;
  id: string;
  title: string;
  render: { type: "iframe"; src: string } | { type: "component"; tag: string };
};

export type UiManifestResult = {
  tabs: AppTab[];
  components: AppComponent[];
  settings: AppSetting[];
};

export type UiManifestState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  uiManifestLoading: boolean;
  uiManifestError: string | null;
  uiManifest: UiManifestResult | null;
  tabBadges: Map<string, number>;
};

// =============================================================================
// Badge Polling
// =============================================================================

const badgePollers = new Map<string, ReturnType<typeof setInterval>>();

export function startBadgePolling(state: UiManifestState): void {
  stopBadgePolling();

  if (!state.uiManifest?.tabs) {
    return;
  }

  for (const tab of state.uiManifest.tabs) {
    if (!tab.badge) {
      continue;
    }

    const interval = tab.badge.interval ?? 30;

    // Initial fetch
    void fetchBadgeCount(state, tab);

    // Set up polling
    const id = setInterval(() => {
      void fetchBadgeCount(state, tab);
    }, interval * 1000);

    badgePollers.set(tab.id, id);
  }
}

export function stopBadgePolling(): void {
  for (const [, intervalId] of badgePollers) {
    clearInterval(intervalId);
  }
  badgePollers.clear();
}

async function fetchBadgeCount(state: UiManifestState, tab: AppTab): Promise<void> {
  if (!state.client || !state.connected || !tab.badge) {
    return;
  }

  try {
    const res = await state.client.request<{ count?: number }>(tab.badge.method, {});
    const count = res?.count ?? 0;
    state.tabBadges = new Map(state.tabBadges).set(tab.id, count);
  } catch {
    // Silently ignore badge fetch errors
  }
}

// =============================================================================
// Load UI Manifest
// =============================================================================

export async function loadUiManifest(state: UiManifestState): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.uiManifestLoading) {
    return;
  }

  state.uiManifestLoading = true;
  state.uiManifestError = null;

  try {
    const res = await state.client.request<UiManifestResult>("apps.getUiManifest", {});
    if (res) {
      state.uiManifest = {
        tabs: Array.isArray(res.tabs) ? res.tabs : [],
        components: Array.isArray(res.components) ? res.components : [],
        settings: Array.isArray(res.settings) ? res.settings : [],
      };

      // Start badge polling for tabs that have badge config
      startBadgePolling(state);
    }
  } catch (err) {
    state.uiManifestError = String(err);
  } finally {
    state.uiManifestLoading = false;
  }
}
