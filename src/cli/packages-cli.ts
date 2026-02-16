/**
 * Packages CLI
 *
 * CLI commands for managing OpenClawOS packages (apps, skills, agents, extensions).
 */

import type { Command } from "commander";
import { resolveStateDir } from "../config/paths.js";
import { createPackageRegistry, type PackageInfo, type PackageType } from "../packages/index.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";

// =============================================================================
// Formatting Helpers
// =============================================================================

const CATEGORY_EMOJI: Record<string, string> = {
  app: "[App]",
  skill: "[Skill]",
  agent: "[Agent]",
  extension: "[Ext]",
};

const STATUS_INDICATOR: Record<string, string> = {
  running: theme.success("running"),
  stopped: theme.muted("stopped"),
  starting: theme.warn("starting"),
  error: theme.error("error"),
  not_applicable: theme.muted("-"),
};

function formatPackageRow(pkg: PackageInfo, verbose: boolean): string {
  const typeLabel = CATEGORY_EMOJI[pkg.type] || `[${pkg.type}]`;
  const status = pkg.installed ? (pkg.enabled ? theme.success("ON") : theme.muted("OFF")) : "";
  const version = theme.muted(`v${pkg.version}`);

  if (verbose) {
    const desc = pkg.description ? theme.muted(` - ${pkg.description.slice(0, 50)}`) : "";
    return `  ${typeLabel.padEnd(8)} ${pkg.name.padEnd(20)} ${version.padEnd(12)} ${status.padEnd(10)}${desc}`;
  }

  return `  ${typeLabel.padEnd(8)} ${pkg.name.padEnd(20)} ${version.padEnd(12)} ${status}`;
}

function formatPackageList(
  packages: PackageInfo[],
  opts: { verbose?: boolean; json?: boolean },
): string {
  if (opts.json) {
    return JSON.stringify(packages, null, 2);
  }

  if (packages.length === 0) {
    return theme.muted("No packages found.");
  }

  const lines: string[] = [];

  // Group by type
  const grouped = {
    app: packages.filter((p) => p.type === "app"),
    skill: packages.filter((p) => p.type === "skill"),
    agent: packages.filter((p) => p.type === "agent"),
    extension: packages.filter((p) => p.type === "extension"),
  };

  for (const [type, pkgs] of Object.entries(grouped)) {
    if (pkgs.length > 0) {
      lines.push("");
      lines.push(
        theme.heading(`${type.charAt(0).toUpperCase() + type.slice(1)}s (${pkgs.length})`),
      );
      for (const pkg of pkgs) {
        lines.push(formatPackageRow(pkg, opts.verbose ?? false));
      }
    }
  }

  return lines.join("\n");
}

function formatPackageInfo(
  pkg: PackageInfo | null,
  config: Record<string, unknown>,
  opts: { json?: boolean },
): string {
  if (!pkg) {
    return theme.error("Package not found.");
  }

  if (opts.json) {
    return JSON.stringify({ package: pkg, config }, null, 2);
  }

  const lines: string[] = [];

  lines.push(theme.heading(pkg.name));
  lines.push("");
  lines.push(`  ${theme.muted("ID:")}          ${pkg.id}`);
  lines.push(`  ${theme.muted("Type:")}        ${pkg.type}`);
  lines.push(`  ${theme.muted("Version:")}     ${pkg.version}`);
  lines.push(`  ${theme.muted("Installed:")}   ${pkg.installed ? theme.success("Yes") : "No"}`);
  lines.push(
    `  ${theme.muted("Enabled:")}     ${pkg.enabled ? theme.success("Yes") : theme.muted("No")}`,
  );

  if (pkg.author) {
    lines.push(`  ${theme.muted("Author:")}      ${pkg.author}`);
  }
  if (pkg.license) {
    lines.push(`  ${theme.muted("License:")}     ${pkg.license}`);
  }
  if (pkg.description) {
    lines.push("");
    lines.push(`  ${pkg.description}`);
  }
  if (pkg.tags?.length) {
    lines.push("");
    lines.push(`  ${theme.muted("Tags:")} ${pkg.tags.join(", ")}`);
  }

  if (Object.keys(config).length > 0) {
    lines.push("");
    lines.push(theme.heading("Configuration"));
    for (const [key, value] of Object.entries(config)) {
      const displayValue =
        typeof value === "string" && key.toLowerCase().includes("token")
          ? "***"
          : JSON.stringify(value);
      lines.push(`  ${theme.muted(key + ":")} ${displayValue}`);
    }
  }

  return lines.join("\n");
}

// =============================================================================
// CLI Registration
// =============================================================================

/**
 * Register the packages CLI commands.
 */
export function registerPackagesCli(program: Command) {
  const stateDir = resolveStateDir();
  const registry = createPackageRegistry({
    appsDir: "apps",
    dataDir: `${stateDir}/packages`,
    configDir: stateDir,
  });

  const packages = program
    .command("packages")
    .alias("pkg")
    .description("Manage OpenClawOS packages (apps, skills, agents, extensions)")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/packages", "docs.openclaw.ai/cli/packages")}\n`,
    );

  // === List ===
  packages
    .command("list")
    .description("List all available packages")
    .option("-t, --type <type>", "Filter by type: app, skill, agent, extension")
    .option("--installed", "Show only installed packages")
    .option("--enabled", "Show only enabled packages")
    .option("-v, --verbose", "Show more details including descriptions")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const packages = await registry.listAvailable({
          type: opts.type as PackageType | undefined,
          installed: opts.installed,
          enabled: opts.enabled,
        });
        defaultRuntime.log(formatPackageList(packages, opts));
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  // === Info ===
  packages
    .command("info <packageId>")
    .description("Show detailed information about a package")
    .option("--json", "Output as JSON")
    .action(async (packageId, opts) => {
      try {
        const pkg = await registry.getPackage(packageId);
        const config = await registry.getConfig(packageId);
        defaultRuntime.log(formatPackageInfo(pkg, config, opts));
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  // === Install ===
  packages
    .command("install <packageId>")
    .description("Install a package (or enable if built-in)")
    .option("-v, --version <version>", "Specific version to install")
    .action(async (packageId, opts) => {
      try {
        defaultRuntime.log(theme.muted(`Installing ${packageId}...`));
        const result = await registry.install(packageId, opts.version);
        if (result.ok) {
          defaultRuntime.log(theme.success(`Installed ${result.packageId} v${result.version}`));
        } else {
          defaultRuntime.error(`Failed to install: ${result.error}`);
          defaultRuntime.exit(1);
        }
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  // === Uninstall ===
  packages
    .command("uninstall <packageId>")
    .description("Uninstall a package (or disable if built-in)")
    .option("--purge", "Also remove package data and config")
    .action(async (packageId, opts) => {
      try {
        defaultRuntime.log(theme.muted(`Uninstalling ${packageId}...`));
        const result = await registry.uninstall(packageId, { purgeData: opts.purge });
        if (result.ok) {
          defaultRuntime.log(theme.success(`Uninstalled ${result.packageId}`));
        } else {
          defaultRuntime.error(`Failed to uninstall: ${result.error}`);
          defaultRuntime.exit(1);
        }
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  // === Enable ===
  packages
    .command("enable <packageId>")
    .description("Enable a package")
    .action(async (packageId) => {
      try {
        await registry.setEnabled(packageId, true);
        defaultRuntime.log(theme.success(`Enabled ${packageId}`));
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  // === Disable ===
  packages
    .command("disable <packageId>")
    .description("Disable a package")
    .action(async (packageId) => {
      try {
        await registry.setEnabled(packageId, false);
        defaultRuntime.log(theme.success(`Disabled ${packageId}`));
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  // === Configure ===
  packages
    .command("configure <packageId>")
    .description("Configure a package")
    .option("--set <key=value...>", "Set configuration values")
    .option("--json <json>", "Set configuration from JSON string")
    .action(async (packageId, opts) => {
      try {
        let config: Record<string, unknown> = {};

        if (opts.json) {
          config = JSON.parse(opts.json);
        } else if (opts.set?.length) {
          for (const item of opts.set) {
            const [key, ...valueParts] = item.split("=");
            const value = valueParts.join("=");
            // Try to parse as JSON, fall back to string
            try {
              config[key] = JSON.parse(value);
            } catch {
              config[key] = value;
            }
          }
        } else {
          // Show current config
          const currentConfig = await registry.getConfig(packageId);
          defaultRuntime.log(JSON.stringify(currentConfig, null, 2));
          return;
        }

        const result = await registry.setConfig(packageId, config);
        if (result.ok) {
          defaultRuntime.log(theme.success(`Configuration updated for ${packageId}`));
        } else {
          defaultRuntime.error(`Failed to configure: ${result.error}`);
          defaultRuntime.exit(1);
        }
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  // === Status ===
  packages
    .command("status <packageId>")
    .description("Get package runtime status")
    .option("--json", "Output as JSON")
    .action(async (packageId, opts) => {
      try {
        const status = await registry.getStatus(packageId);
        const pkg = await registry.getPackage(packageId);

        if (opts.json) {
          defaultRuntime.log(JSON.stringify({ packageId, status, enabled: pkg?.enabled }, null, 2));
        } else {
          const statusDisplay = STATUS_INDICATOR[status] || status;
          const enabledDisplay = pkg?.enabled ? theme.success("enabled") : theme.muted("disabled");
          defaultRuntime.log(`${packageId}: ${statusDisplay} (${enabledDisplay})`);
        }
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  // Default action (no subcommand) - show list
  packages.action(async () => {
    try {
      const packages = await registry.listAvailable();
      defaultRuntime.log(formatPackageList(packages, {}));
    } catch (err) {
      defaultRuntime.error(String(err));
      defaultRuntime.exit(1);
    }
  });
}
