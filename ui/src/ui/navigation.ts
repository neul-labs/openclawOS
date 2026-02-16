import type { AppTab } from "./controllers/ui-manifest.ts";
import type { IconName } from "./icons.js";

export const TAB_GROUPS = [
  { label: "Chat", tabs: ["chat"] },
  {
    label: "Control",
    tabs: ["overview", "channels", "instances", "sessions", "usage", "cron"],
  },
  { label: "Agent", tabs: ["agents", "skills", "appstore", "nodes"] },
  { label: "Settings", tabs: ["config", "debug", "logs"] },
] as const;

// Static tabs are the built-in tabs
export type StaticTab =
  | "agents"
  | "overview"
  | "channels"
  | "instances"
  | "sessions"
  | "usage"
  | "cron"
  | "skills"
  | "appstore"
  | "nodes"
  | "chat"
  | "config"
  | "debug"
  | "logs";

// Tab type includes both static and dynamic (app-contributed) tabs
export type Tab = StaticTab | `app:${string}`;

const TAB_PATHS: Record<StaticTab, string> = {
  agents: "/agents",
  overview: "/overview",
  channels: "/channels",
  instances: "/instances",
  sessions: "/sessions",
  usage: "/usage",
  cron: "/cron",
  skills: "/skills",
  appstore: "/appstore",
  nodes: "/nodes",
  chat: "/chat",
  config: "/config",
  debug: "/debug",
  logs: "/logs",
};

const PATH_TO_TAB = new Map(
  Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab as StaticTab]),
);

// =============================================================================
// Dynamic Tab Helpers
// =============================================================================

/** Check if a tab is a dynamic (app-contributed) tab */
export function isDynamicTab(tab: Tab): tab is `app:${string}` {
  return tab.startsWith("app:");
}

/** Check if a tab is a static (built-in) tab */
export function isStaticTab(tab: Tab): tab is StaticTab {
  return !isDynamicTab(tab);
}

/** Get the dynamic tab ID without the "app:" prefix */
export function getDynamicTabId(tab: Tab): string {
  return tab.replace(/^app:/, "");
}

/** Create a tab ID from a dynamic tab ID */
export function makeDynamicTab(id: string): `app:${string}` {
  return `app:${id}`;
}

// =============================================================================
// Effective Tab Groups (with dynamic tabs merged in)
// =============================================================================

export type EffectiveTabGroup = {
  label: string;
  tabs: Tab[];
};

/**
 * Merge static tab groups with dynamic app-contributed tabs.
 * Dynamic tabs are positioned based on their position property:
 * - "top": First tab in first group
 * - "after:chat": After the chat tab
 * - "after:channels": After the channels tab
 * - "bottom" (default): In a new "Apps" group at the end
 */
export function getEffectiveTabGroups(
  staticGroups: typeof TAB_GROUPS,
  dynamicTabs: AppTab[],
): EffectiveTabGroup[] {
  // Clone static groups
  const groups: EffectiveTabGroup[] = staticGroups.map((g) => ({
    label: g.label,
    tabs: [...g.tabs] as Tab[],
  }));

  // Track bottom-positioned tabs for "Apps" group
  const appsTabs: Tab[] = [];

  for (const tab of dynamicTabs) {
    const tabId = makeDynamicTab(tab.id);

    switch (tab.position) {
      case "top":
        // Add to beginning of first group
        if (groups.length > 0) {
          groups[0].tabs.unshift(tabId);
        }
        break;

      case "after:chat": {
        // Find chat tab and insert after it
        const chatGroup = groups.find((g) => g.tabs.includes("chat"));
        if (chatGroup) {
          const chatIdx = chatGroup.tabs.indexOf("chat");
          chatGroup.tabs.splice(chatIdx + 1, 0, tabId);
        } else {
          appsTabs.push(tabId);
        }
        break;
      }

      case "after:channels": {
        // Find channels tab and insert after it
        const channelsGroup = groups.find((g) => g.tabs.includes("channels" as Tab));
        if (channelsGroup) {
          const chanIdx = channelsGroup.tabs.indexOf("channels" as Tab);
          channelsGroup.tabs.splice(chanIdx + 1, 0, tabId);
        } else {
          appsTabs.push(tabId);
        }
        break;
      }

      case "bottom":
      default:
        appsTabs.push(tabId);
        break;
    }
  }

  // Add "Apps" group if there are bottom-positioned tabs
  if (appsTabs.length > 0) {
    groups.push({ label: "Apps", tabs: appsTabs });
  }

  return groups;
}

export function normalizeBasePath(basePath: string): string {
  if (!basePath) {
    return "";
  }
  let base = basePath.trim();
  if (!base.startsWith("/")) {
    base = `/${base}`;
  }
  if (base === "/") {
    return "";
  }
  if (base.endsWith("/")) {
    base = base.slice(0, -1);
  }
  return base;
}

export function normalizePath(path: string): string {
  if (!path) {
    return "/";
  }
  let normalized = path.trim();
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function pathForTab(tab: Tab, basePath = ""): string {
  const base = normalizeBasePath(basePath);
  let path: string;
  if (isDynamicTab(tab)) {
    // Dynamic tabs use /app/{id} path
    path = `/app/${getDynamicTabId(tab)}`;
  } else {
    path = TAB_PATHS[tab];
  }
  return base ? `${base}${path}` : path;
}

export function tabFromPath(pathname: string, basePath = ""): Tab | null {
  const base = normalizeBasePath(basePath);
  let path = pathname || "/";
  if (base) {
    if (path === base) {
      path = "/";
    } else if (path.startsWith(`${base}/`)) {
      path = path.slice(base.length);
    }
  }
  let normalized = normalizePath(path).toLowerCase();
  if (normalized.endsWith("/index.html")) {
    normalized = "/";
  }
  if (normalized === "/") {
    return "chat";
  }
  // Check for dynamic app tab: /app/{id}
  const appMatch = normalized.match(/^\/app\/(.+)$/);
  if (appMatch) {
    return makeDynamicTab(appMatch[1]);
  }
  return PATH_TO_TAB.get(normalized) ?? null;
}

export function inferBasePathFromPathname(pathname: string): string {
  let normalized = normalizePath(pathname);
  if (normalized.endsWith("/index.html")) {
    normalized = normalizePath(normalized.slice(0, -"/index.html".length));
  }
  if (normalized === "/") {
    return "";
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) {
    return "";
  }
  for (let i = 0; i < segments.length; i++) {
    const candidate = `/${segments.slice(i).join("/")}`.toLowerCase();
    if (PATH_TO_TAB.has(candidate)) {
      const prefix = segments.slice(0, i);
      return prefix.length ? `/${prefix.join("/")}` : "";
    }
  }
  return `/${segments.join("/")}`;
}

export function iconForTab(tab: Tab, dynamicTabConfig?: AppTab): IconName {
  if (isDynamicTab(tab) && dynamicTabConfig?.icon) {
    // Validate that the icon is a known icon name
    return (dynamicTabConfig.icon as IconName) || "puzzle";
  }
  if (isDynamicTab(tab)) {
    return "puzzle";
  }
  switch (tab) {
    case "agents":
      return "folder";
    case "chat":
      return "messageSquare";
    case "overview":
      return "barChart";
    case "channels":
      return "link";
    case "instances":
      return "radio";
    case "sessions":
      return "fileText";
    case "usage":
      return "barChart";
    case "cron":
      return "loader";
    case "skills":
      return "zap";
    case "appstore":
      return "package";
    case "nodes":
      return "monitor";
    case "config":
      return "settings";
    case "debug":
      return "bug";
    case "logs":
      return "scrollText";
    default:
      return "folder";
  }
}

export function titleForTab(tab: Tab, dynamicTabConfig?: AppTab): string {
  if (isDynamicTab(tab) && dynamicTabConfig?.title) {
    return dynamicTabConfig.title;
  }
  if (isDynamicTab(tab)) {
    return getDynamicTabId(tab);
  }
  switch (tab) {
    case "agents":
      return "Agents";
    case "overview":
      return "Overview";
    case "channels":
      return "Channels";
    case "instances":
      return "Instances";
    case "sessions":
      return "Sessions";
    case "usage":
      return "Usage";
    case "cron":
      return "Cron Jobs";
    case "skills":
      return "Skills";
    case "appstore":
      return "App Store";
    case "nodes":
      return "Nodes";
    case "chat":
      return "Chat";
    case "config":
      return "Config";
    case "debug":
      return "Debug";
    case "logs":
      return "Logs";
    default:
      return "Control";
  }
}

export function subtitleForTab(tab: Tab, dynamicTabConfig?: AppTab): string {
  if (isDynamicTab(tab)) {
    // Dynamic tabs don't have subtitles defined in AppTab
    return "";
  }
  switch (tab) {
    case "agents":
      return "Manage agent workspaces, tools, and identities.";
    case "overview":
      return "Gateway status, entry points, and a fast health read.";
    case "channels":
      return "Manage channels and settings.";
    case "instances":
      return "Presence beacons from connected clients and nodes.";
    case "sessions":
      return "Inspect active sessions and adjust per-session defaults.";
    case "usage":
      return "";
    case "cron":
      return "Schedule wakeups and recurring agent runs.";
    case "skills":
      return "Manage skill availability and API key injection.";
    case "appstore":
      return "Browse, install, and configure apps, skills, and agents.";
    case "nodes":
      return "Paired devices, capabilities, and command exposure.";
    case "chat":
      return "Direct gateway chat session for quick interventions.";
    case "config":
      return "Edit ~/.openclaw/openclaw.json safely.";
    case "debug":
      return "Gateway snapshots, events, and manual RPC calls.";
    case "logs":
      return "Live tail of the gateway file logs.";
    default:
      return "";
  }
}
