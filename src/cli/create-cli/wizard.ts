import { intro, isCancel, outro, select, text } from "@clack/prompts";
import path from "node:path";
import {
  stylePromptHint,
  stylePromptMessage,
  stylePromptTitle,
} from "../../terminal/prompt-style.js";
import { theme } from "../../terminal/theme.js";
import { type AppType, getAppTypeDescription, getAppTypeLabel, scaffoldApp } from "./scaffold.js";

export interface WizardOptions {
  type?: AppType;
  name?: string;
  org?: string;
  description?: string;
  directory?: string;
  yes?: boolean;
}

export interface WizardResult {
  type: AppType;
  name: string;
  org: string;
  description: string;
  outputDir: string;
  files: string[];
}

const selectStyled = <T>(params: Parameters<typeof select<T>>[0]) =>
  select({
    ...params,
    message: stylePromptMessage(params.message),
    options: params.options.map((opt) =>
      opt.hint === undefined ? opt : { ...opt, hint: stylePromptHint(opt.hint) },
    ),
  });

const textStyled = (params: Parameters<typeof text>[0]) =>
  text({
    ...params,
    message: stylePromptMessage(params.message),
  });

function resolveOrg(): string {
  // Try to get from git config or use default
  // For simplicity, we'll use a default
  return "myorg";
}

function validatePackageName(value: string): string | undefined {
  if (!value || value.trim().length === 0) {
    return "Package name is required";
  }
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value)) {
    return "Package name must be lowercase, start with a letter/number, and only contain letters, numbers, and hyphens";
  }
  return undefined;
}

function validateOrg(value: string): string | undefined {
  if (!value || value.trim().length === 0) {
    return "Organization is required";
  }
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value)) {
    return "Organization must be lowercase, start with a letter/number, and only contain letters, numbers, and hyphens";
  }
  return undefined;
}

export async function runWizard(options: WizardOptions = {}): Promise<WizardResult | null> {
  intro(stylePromptTitle("Create OpenClawOS Package") ?? "Create OpenClawOS Package");

  // Step 1: Select app type
  let type = options.type;
  if (!type) {
    const typeResult = await selectStyled({
      message: "What type of package do you want to create?",
      options: [
        {
          value: "channel" as const,
          label: getAppTypeLabel("channel"),
          hint: getAppTypeDescription("channel"),
        },
        {
          value: "plugin" as const,
          label: getAppTypeLabel("plugin"),
          hint: getAppTypeDescription("plugin"),
        },
        {
          value: "skill" as const,
          label: getAppTypeLabel("skill"),
          hint: getAppTypeDescription("skill"),
        },
        {
          value: "agent" as const,
          label: getAppTypeLabel("agent"),
          hint: getAppTypeDescription("agent"),
        },
      ],
    });

    if (isCancel(typeResult)) {
      outro(theme.muted("Cancelled."));
      return null;
    }
    type = typeResult;
  }

  // Step 2: Package name
  let name = options.name;
  if (!name) {
    const nameResult = await textStyled({
      message: "Package name:",
      placeholder: "my-package",
      validate: validatePackageName,
    });

    if (isCancel(nameResult)) {
      outro(theme.muted("Cancelled."));
      return null;
    }
    name = nameResult;
  }

  // Step 3: Organization
  let org = options.org;
  if (!org) {
    const defaultOrg = resolveOrg();
    const orgResult = await textStyled({
      message: "Organization (scope):",
      placeholder: defaultOrg,
      initialValue: defaultOrg,
      validate: validateOrg,
    });

    if (isCancel(orgResult)) {
      outro(theme.muted("Cancelled."));
      return null;
    }
    org = orgResult;
  }

  // Step 4: Description
  let description = options.description;
  if (!description && !options.yes) {
    const descResult = await textStyled({
      message: "Description (optional):",
      placeholder: `${getAppTypeLabel(type)} for OpenClawOS`,
    });

    if (isCancel(descResult)) {
      outro(theme.muted("Cancelled."));
      return null;
    }
    description = descResult || undefined;
  }

  // Step 5: Output directory
  let outputDir = options.directory;
  if (!outputDir) {
    outputDir = path.resolve(process.cwd(), name);
  } else {
    outputDir = path.resolve(process.cwd(), outputDir);
  }

  // Run scaffold
  const { files } = await scaffoldApp({
    type,
    name,
    org,
    description,
    outputDir,
  });

  const result: WizardResult = {
    type,
    name,
    org,
    description: description || `${getAppTypeLabel(type)} for OpenClawOS`,
    outputDir,
    files,
  };

  // Success message
  outro(
    `${theme.success("Created")} ${theme.command(`@${org}/${name}`)} at ${theme.muted(outputDir)}`,
  );

  return result;
}

export function printNextSteps(result: WizardResult): void {
  const relativePath = path.relative(process.cwd(), result.outputDir);
  const cdPath = relativePath || ".";

  console.log("");
  console.log(theme.heading("Next steps:"));
  console.log("");
  console.log(`  ${theme.muted("1.")} cd ${cdPath}`);

  if (result.type !== "agent") {
    console.log(`  ${theme.muted("2.")} npm install`);
    console.log(`  ${theme.muted("3.")} npm run build`);
    if (result.type === "channel" || result.type === "plugin") {
      console.log(`  ${theme.muted("4.")} openclaw plugins install --link .`);
    }
  } else {
    console.log(`  ${theme.muted("2.")} openclaw packages install .`);
  }
  console.log("");
}
