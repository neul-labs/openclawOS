import type { Command } from "commander";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { type AppType, getAppTypeLabel, scaffoldApp } from "./scaffold.js";
import { printNextSteps, runWizard } from "./wizard.js";

export interface CreateOptions {
  org?: string;
  directory?: string;
  description?: string;
  yes?: boolean;
}

function isValidType(value: string): value is AppType {
  return ["channel", "plugin", "skill", "agent"].includes(value);
}

export function registerCreateCli(program: Command): void {
  const create = program
    .command("create")
    .description("Create a new OpenClawOS package")
    .argument("[type]", "Package type: channel, plugin, skill, or agent")
    .argument("[name]", "Package name")
    .option("-o, --org <org>", "Organization/scope for the package")
    .option("-d, --directory <dir>", "Output directory")
    .option("--description <desc>", "Package description")
    .option("-y, --yes", "Skip confirmation prompts")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Examples:")}\n` +
        `  openclaw create                     # Interactive wizard\n` +
        `  openclaw create channel telegram    # Create channel app\n` +
        `  openclaw create plugin my-tools     # Create plugin app\n` +
        `  openclaw create skill calculator    # Create skill\n` +
        `  openclaw create agent assistant     # Create agent\n` +
        `\n${theme.muted("Docs:")} ${formatDocsLink("/developing-apps", "docs.openclaw.ai/developing-apps")}\n`,
    )
    .action(async (type: string | undefined, name: string | undefined, opts: CreateOptions) => {
      // Validate type if provided
      if (type && !isValidType(type)) {
        defaultRuntime.error(
          `Invalid type "${type}". Must be one of: channel, plugin, skill, agent`,
        );
        process.exit(1);
      }

      // If both type and name provided, run non-interactive
      if (type && name && isValidType(type)) {
        const org = opts.org || "myorg";
        const outputDir = opts.directory || name;

        try {
          const { files } = await scaffoldApp({
            type,
            name,
            org,
            description: opts.description,
            outputDir,
          });

          defaultRuntime.log(
            `${theme.success("Created")} ${theme.command(`@${org}/${name}`)} (${getAppTypeLabel(type)})`,
          );
          defaultRuntime.log(theme.muted(`  ${files.length} files in ${outputDir}/`));

          printNextSteps({
            type,
            name,
            org,
            description: opts.description || "",
            outputDir,
            files,
          });
        } catch (err) {
          defaultRuntime.error(`Failed to create package: ${err}`);
          process.exit(1);
        }
        return;
      }

      // Interactive mode
      if (!process.stdin.isTTY && !type) {
        defaultRuntime.error(
          "Interactive mode requires a TTY. Use `openclaw create <type> <name>` instead.",
        );
        process.exit(1);
      }

      const result = await runWizard({
        type: type as AppType | undefined,
        name,
        org: opts.org,
        description: opts.description,
        directory: opts.directory,
        yes: opts.yes,
      });

      if (result) {
        printNextSteps(result);
      }
    });

  // Add subcommands for each type
  for (const appType of ["channel", "plugin", "skill", "agent"] as const) {
    create
      .command(appType)
      .description(`Create a new ${getAppTypeLabel(appType)}`)
      .argument("<name>", "Package name")
      .option("-o, --org <org>", "Organization/scope for the package")
      .option("-d, --directory <dir>", "Output directory")
      .option("--description <desc>", "Package description")
      .action(async (name: string, opts: CreateOptions) => {
        const org = opts.org || "myorg";
        const outputDir = opts.directory || name;

        try {
          const { files } = await scaffoldApp({
            type: appType,
            name,
            org,
            description: opts.description,
            outputDir,
          });

          defaultRuntime.log(
            `${theme.success("Created")} ${theme.command(`@${org}/${name}`)} (${getAppTypeLabel(appType)})`,
          );
          defaultRuntime.log(theme.muted(`  ${files.length} files in ${outputDir}/`));

          printNextSteps({
            type: appType,
            name,
            org,
            description: opts.description || "",
            outputDir,
            files,
          });
        } catch (err) {
          defaultRuntime.error(`Failed to create package: ${err}`);
          process.exit(1);
        }
      });
  }
}
