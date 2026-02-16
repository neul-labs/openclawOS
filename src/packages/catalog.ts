/**
 * Built-in Package Catalog
 *
 * Defines metadata for all built-in packages that appear in the App Store.
 * These packages are bundled with OpenClawOS and always available.
 */

import type { PackageInfo } from "./types.js";

// =============================================================================
// Built-in Apps (Process-Isolated Channels)
// =============================================================================

export const BUILTIN_APPS: PackageInfo[] = [
  {
    id: "@openclawos/telegram",
    name: "Telegram",
    description: "Telegram bot integration via grammY. Supports polling and webhook modes.",
    type: "app",
    version: "0.1.0",
    icon: "telegram",
    author: "OpenClawOS",
    license: "MIT",
    tags: ["channel", "messaging", "telegram", "chat"],
    installed: true,
    builtin: true,
    enabled: true,
    status: "not_applicable",
  },
  {
    id: "@openclawos/discord",
    name: "Discord",
    description: "Discord bot integration via Carbon SDK. Supports slash commands and threads.",
    type: "app",
    version: "0.1.0",
    icon: "discord",
    author: "OpenClawOS",
    license: "MIT",
    tags: ["channel", "messaging", "discord", "chat", "gaming"],
    installed: true,
    builtin: true,
    enabled: true,
    status: "not_applicable",
  },
  {
    id: "@openclawos/slack",
    name: "Slack",
    description: "Slack workspace integration via Bolt SDK. Socket and HTTP modes supported.",
    type: "app",
    version: "0.1.0",
    icon: "slack",
    author: "OpenClawOS",
    license: "MIT",
    tags: ["channel", "messaging", "slack", "workspace", "enterprise"],
    installed: true,
    builtin: true,
    enabled: true,
    status: "not_applicable",
  },
  {
    id: "@openclawos/whatsapp",
    name: "WhatsApp",
    description: "WhatsApp integration via Baileys (unofficial API). Requires QR code login.",
    type: "app",
    version: "0.1.0",
    icon: "whatsapp",
    author: "OpenClawOS",
    license: "MIT",
    tags: ["channel", "messaging", "whatsapp", "chat", "mobile"],
    installed: true,
    builtin: true,
    enabled: true,
    status: "not_applicable",
  },
  {
    id: "@openclawos/signal",
    name: "Signal",
    description: "Signal messenger integration via signal-cli daemon. Privacy-focused messaging.",
    type: "app",
    version: "0.1.0",
    icon: "signal",
    author: "OpenClawOS",
    license: "MIT",
    tags: ["channel", "messaging", "signal", "chat", "privacy", "encrypted"],
    installed: true,
    builtin: true,
    enabled: true,
    status: "not_applicable",
  },
];

// =============================================================================
// Built-in Skills (In-Process Agent Tools)
// =============================================================================

export const BUILTIN_SKILLS: PackageInfo[] = [
  {
    id: "@openclawos/coding-agent",
    name: "Coding Agent",
    description:
      "Core coding tools: file editing, bash commands, glob search, grep, and web browsing.",
    type: "skill",
    version: "1.0.0",
    icon: "code",
    author: "OpenClawOS",
    license: "MIT",
    tags: ["coding", "development", "files", "bash", "search"],
    installed: true,
    builtin: true,
    enabled: true,
    status: "not_applicable",
  },
  {
    id: "@openclawos/canvas",
    name: "Canvas",
    description: "Visual canvas for diagrams, flowcharts, and collaborative whiteboarding.",
    type: "skill",
    version: "1.0.0",
    icon: "canvas",
    author: "OpenClawOS",
    license: "MIT",
    tags: ["visual", "diagrams", "drawing", "whiteboard"],
    installed: true,
    builtin: true,
    enabled: false,
    status: "not_applicable",
  },
  {
    id: "@openclawos/memory",
    name: "Memory",
    description: "Persistent memory storage for agent context across sessions.",
    type: "skill",
    version: "1.0.0",
    icon: "memory",
    author: "OpenClawOS",
    license: "MIT",
    tags: ["memory", "context", "persistence", "storage"],
    installed: true,
    builtin: true,
    enabled: false,
    status: "not_applicable",
  },
  {
    id: "@openclawos/web-browse",
    name: "Web Browse",
    description: "Web browsing capabilities for research and information retrieval.",
    type: "skill",
    version: "1.0.0",
    icon: "globe",
    author: "OpenClawOS",
    license: "MIT",
    tags: ["web", "browse", "research", "internet"],
    installed: true,
    builtin: true,
    enabled: true,
    status: "not_applicable",
  },
  {
    id: "@openclawos/mcp",
    name: "MCP Servers",
    description: "Model Context Protocol server integration for extended capabilities.",
    type: "skill",
    version: "1.0.0",
    icon: "server",
    author: "OpenClawOS",
    license: "MIT",
    tags: ["mcp", "servers", "integration", "protocol"],
    installed: true,
    builtin: true,
    enabled: true,
    status: "not_applicable",
  },
];

// =============================================================================
// Built-in Agent Templates
// =============================================================================

export const BUILTIN_AGENTS: PackageInfo[] = [
  {
    id: "@openclawos/agent-coder",
    name: "Software Engineer",
    description:
      "Optimized for software development tasks. Includes coding-agent skill with sandboxed execution.",
    type: "agent",
    version: "1.0.0",
    icon: "coder",
    author: "OpenClawOS",
    license: "MIT",
    tags: ["coding", "development", "engineer", "programming"],
    installed: false,
    builtin: true,
    enabled: false,
    status: "not_applicable",
  },
  {
    id: "@openclawos/agent-writer",
    name: "Content Writer",
    description: "Focused on content creation, editing, and writing assistance.",
    type: "agent",
    version: "1.0.0",
    icon: "writer",
    author: "OpenClawOS",
    license: "MIT",
    tags: ["writing", "content", "editing", "creative"],
    installed: false,
    builtin: true,
    enabled: false,
    status: "not_applicable",
  },
  {
    id: "@openclawos/agent-assistant",
    name: "General Assistant",
    description: "General-purpose assistant for everyday tasks and queries.",
    type: "agent",
    version: "1.0.0",
    icon: "assistant",
    author: "OpenClawOS",
    license: "MIT",
    tags: ["assistant", "general", "helper", "productivity"],
    installed: false,
    builtin: true,
    enabled: false,
    status: "not_applicable",
  },
];

// =============================================================================
// Built-in Extensions (Future)
// =============================================================================

export const BUILTIN_EXTENSIONS: PackageInfo[] = [
  // Extensions will be added as kernel capabilities are modularized
];

// =============================================================================
// Combined Catalog
// =============================================================================

/**
 * All built-in packages available in OpenClawOS.
 */
export const BUILTIN_PACKAGES: PackageInfo[] = [
  ...BUILTIN_APPS,
  ...BUILTIN_SKILLS,
  ...BUILTIN_AGENTS,
  ...BUILTIN_EXTENSIONS,
];

/**
 * Get all built-in packages of a specific type.
 */
export function getBuiltinPackagesByType(type: PackageInfo["type"]): PackageInfo[] {
  return BUILTIN_PACKAGES.filter((pkg) => pkg.type === type);
}

/**
 * Get a built-in package by ID.
 */
export function getBuiltinPackage(packageId: string): PackageInfo | undefined {
  return BUILTIN_PACKAGES.find((pkg) => pkg.id === packageId);
}

/**
 * Check if a package ID is a built-in package.
 */
export function isBuiltinPackage(packageId: string): boolean {
  return BUILTIN_PACKAGES.some((pkg) => pkg.id === packageId);
}
