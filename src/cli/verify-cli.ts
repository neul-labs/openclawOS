import type { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";

export interface VerifyOptions {
  fix?: boolean;
  json?: boolean;
}

interface VerifyIssue {
  level: "error" | "warning";
  message: string;
  field?: string;
}

interface VerifyResult {
  valid: boolean;
  packageId: string | null;
  packageType: string | null;
  issues: VerifyIssue[];
}

const REQUIRED_MANIFEST_FIELDS = ["id", "name", "version", "type", "protocol"];
const VALID_TYPES = ["app", "skill", "agent", "extension"];

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadManifest(dir: string): Promise<{ manifest: unknown; error?: string }> {
  const manifestPath = path.join(dir, "openclawos.manifest.json");
  try {
    const content = await fs.readFile(manifestPath, "utf-8");
    return { manifest: JSON.parse(content) };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { manifest: null, error: "openclawos.manifest.json not found" };
    }
    return {
      manifest: null,
      error: `Failed to parse manifest: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function verifyPackage(dir: string): Promise<VerifyResult> {
  const issues: VerifyIssue[] = [];
  let packageId: string | null = null;
  let packageType: string | null = null;

  // Check manifest exists and is valid JSON
  const { manifest, error } = await loadManifest(dir);
  if (error) {
    issues.push({ level: "error", message: error });
    return { valid: false, packageId, packageType, issues };
  }

  if (!manifest || typeof manifest !== "object") {
    issues.push({ level: "error", message: "Invalid manifest structure" });
    return { valid: false, packageId, packageType, issues };
  }

  const m = manifest as Record<string, unknown>;

  // Check required fields
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!(field in m)) {
      issues.push({ level: "error", message: `Missing required field: ${field}`, field });
    }
  }

  // Validate id format
  if (typeof m.id === "string") {
    packageId = m.id;
    if (!m.id.match(/^@[a-z0-9-]+\/[a-z0-9-]+$/)) {
      issues.push({
        level: "error",
        message: `Invalid package id format. Expected @scope/name, got: ${m.id}`,
        field: "id",
      });
    }
  }

  // Validate type
  if (typeof m.type === "string") {
    packageType = m.type;
    if (!VALID_TYPES.includes(m.type)) {
      issues.push({
        level: "error",
        message: `Invalid type. Expected one of: ${VALID_TYPES.join(", ")}`,
        field: "type",
      });
    }
  }

  // Validate protocol
  if (m.protocol && typeof m.protocol === "object") {
    const protocol = m.protocol as Record<string, unknown>;
    if (!protocol.version) {
      issues.push({
        level: "error",
        message: "Missing protocol.version",
        field: "protocol.version",
      });
    }
  }

  // Check main file exists for apps/skills/extensions
  if (["app", "skill", "extension"].includes(packageType || "")) {
    if (!m.main) {
      issues.push({
        level: "error",
        message: "Missing 'main' field for app/skill/extension",
        field: "main",
      });
    } else if (typeof m.main === "string") {
      const mainPath = path.join(dir, m.main);
      const mainExists = await fileExists(mainPath);
      if (!mainExists) {
        // Check if source exists (pre-build)
        const srcMain = m.main.replace(/^dist\//, "src/").replace(/\.js$/, ".ts");
        const srcPath = path.join(dir, srcMain);
        const srcExists = await fileExists(srcPath);

        if (!srcExists) {
          issues.push({
            level: "warning",
            message: `Entry point not found: ${m.main} (run npm run build?)`,
            field: "main",
          });
        }
      }
    }
  }

  // Check package.json exists
  const pkgJsonPath = path.join(dir, "package.json");
  const pkgJsonExists = await fileExists(pkgJsonPath);
  if (!pkgJsonExists && packageType !== "agent") {
    issues.push({
      level: "warning",
      message: "package.json not found",
    });
  }

  // Check recommended fields
  if (!m.description) {
    issues.push({
      level: "warning",
      message: "Missing recommended field: description",
      field: "description",
    });
  }

  // Check capabilities
  if (!m.capabilities || typeof m.capabilities !== "object") {
    issues.push({
      level: "warning",
      message: "No capabilities defined",
      field: "capabilities",
    });
  }

  // Type-specific checks
  if (packageType === "agent") {
    const caps = m.capabilities as Record<string, unknown> | undefined;
    if (!caps?.agent) {
      issues.push({
        level: "error",
        message: "Agent packages must define capabilities.agent",
        field: "capabilities.agent",
      });
    } else {
      const agent = caps.agent as Record<string, unknown>;
      if (!agent.systemPrompt && !agent.systemPromptFile) {
        issues.push({
          level: "warning",
          message: "Agent should define systemPrompt or systemPromptFile",
          field: "capabilities.agent",
        });
      }

      // Check systemPromptFile exists
      if (typeof agent.systemPromptFile === "string") {
        const promptPath = path.join(dir, agent.systemPromptFile);
        const promptExists = await fileExists(promptPath);
        if (!promptExists) {
          issues.push({
            level: "error",
            message: `System prompt file not found: ${agent.systemPromptFile}`,
            field: "capabilities.agent.systemPromptFile",
          });
        }
      }
    }
  }

  if (packageType === "app") {
    const caps = m.capabilities as Record<string, unknown> | undefined;
    const hasChannel = caps?.channels && typeof caps.channels === "object";
    const hasTools = caps?.tools && typeof caps.tools === "object";
    const hasHooks = caps?.hooks && typeof caps.hooks === "object";

    if (!hasChannel && !hasTools && !hasHooks) {
      issues.push({
        level: "warning",
        message: "App should provide channels, tools, or hooks",
        field: "capabilities",
      });
    }
  }

  const errorCount = issues.filter((i) => i.level === "error").length;
  return {
    valid: errorCount === 0,
    packageId,
    packageType,
    issues,
  };
}

function printVerifyResult(result: VerifyResult): void {
  if (result.packageId) {
    defaultRuntime.log(`Verifying ${theme.command(result.packageId)}...`);
    defaultRuntime.log("");
  }

  for (const issue of result.issues) {
    const icon = issue.level === "error" ? theme.error("✗") : theme.warn("⚠");
    const msg = issue.level === "error" ? theme.error(issue.message) : theme.warn(issue.message);
    defaultRuntime.log(`${icon} ${msg}`);
  }

  if (result.issues.length === 0) {
    defaultRuntime.log(theme.success("✓ Package is valid"));
  } else {
    defaultRuntime.log("");
    const errors = result.issues.filter((i) => i.level === "error").length;
    const warnings = result.issues.filter((i) => i.level === "warning").length;
    const parts: string[] = [];
    if (errors > 0) {
      parts.push(`${errors} error${errors > 1 ? "s" : ""}`);
    }
    if (warnings > 0) {
      parts.push(`${warnings} warning${warnings > 1 ? "s" : ""}`);
    }
    defaultRuntime.log(`${parts.join(", ")} found`);
  }
}

export function registerVerifyCli(program: Command): void {
  program
    .command("verify")
    .description("Verify an OpenClawOS package")
    .argument("[path]", "Path to package directory", ".")
    .option("--json", "Output JSON format")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Examples:")}\n` +
        `  openclaw verify              # Verify current directory\n` +
        `  openclaw verify ./my-app     # Verify specific directory\n` +
        `  openclaw verify --json       # Output as JSON\n` +
        `\n${theme.muted("Docs:")} ${formatDocsLink("/developing-apps/app-structure", "docs.openclaw.ai/developing-apps/app-structure")}\n`,
    )
    .action(async (targetPath: string, opts: VerifyOptions) => {
      const dir = path.resolve(process.cwd(), targetPath);

      // Check directory exists
      try {
        const stat = await fs.stat(dir);
        if (!stat.isDirectory()) {
          defaultRuntime.error(`Not a directory: ${dir}`);
          process.exit(1);
        }
      } catch {
        defaultRuntime.error(`Directory not found: ${dir}`);
        process.exit(1);
      }

      const result = await verifyPackage(dir);

      if (opts.json) {
        defaultRuntime.log(JSON.stringify(result, null, 2));
      } else {
        printVerifyResult(result);
      }

      if (!result.valid) {
        process.exit(1);
      }
    });
}
