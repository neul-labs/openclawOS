/**
 * OpenClawOS Package Manifest
 *
 * Unified manifest format for all installable packages:
 * - Apps (process-isolated channels/plugins)
 * - Skills (in-process agent tools)
 * - Agents (agent templates/personas)
 * - Extensions (kernel enhancements)
 */

import { z } from "zod";
import type { PackageCapabilities } from "./capabilities.js";

// =============================================================================
// Package Types
// =============================================================================

export type PackageType = "app" | "skill" | "agent" | "extension";

// =============================================================================
// Package Manifest
// =============================================================================

export interface PackageManifest {
  // === Identity ===
  /** Package ID, e.g., "@openclawos/telegram" or "@community/agent-coder" */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semantic version */
  version: string;
  /** Short description */
  description?: string;
  /** Author name or organization */
  author?: string;
  /** License identifier (SPDX) */
  license?: string;
  /** Repository URL */
  repository?: string;
  /** Icon URL for App Store */
  icon?: string;
  /** Tags for categorization */
  tags?: string[];

  // === Package Type ===
  /** Type of package */
  type: PackageType;

  // === Entry Point ===
  /** Entry point file (for apps/skills/extensions) */
  main?: string;

  // === Protocol Compatibility ===
  /** Protocol version requirements */
  protocol: ProtocolConfig;

  // === Capabilities ===
  /** What this package provides/requires */
  capabilities: PackageCapabilities;

  // === Configuration ===
  /** JSON Schema for package config */
  configSchema?: JSONSchemaObject;
  /** UI hints for config fields */
  configUiHints?: Record<string, ConfigUiHint>;

  // === Dependencies ===
  /** Dependencies on other packages */
  dependencies?: PackageDependencies;
}

// =============================================================================
// Protocol Configuration
// =============================================================================

export interface ProtocolConfig {
  /** Protocol version this package uses */
  version: string;
  /** Minimum kernel version required */
  minKernelVersion?: string;
}

// =============================================================================
// Dependencies
// =============================================================================

export interface PackageDependencies {
  /** Required apps */
  apps?: string[];
  /** Required skills */
  skills?: string[];
  /** Required agents */
  agents?: string[];
}

// =============================================================================
// Configuration UI
// =============================================================================

export interface ConfigUiHint {
  /** Field label */
  label?: string;
  /** Help text / description */
  description?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether to mask input (for secrets) */
  sensitive?: boolean;
  /** Whether to hide in basic view */
  advanced?: boolean;
  /** Field type */
  type?: ConfigFieldType;
  /** Options for select/multiselect */
  options?: Array<{ label: string; value: string }>;
  /** Validation rules */
  validation?: ConfigValidation;
}

export type ConfigFieldType =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "multiselect"
  | "code"
  | "textarea";

export interface ConfigValidation {
  /** Regex pattern */
  pattern?: string;
  /** Minimum value (for numbers) */
  min?: number;
  /** Maximum value (for numbers) */
  max?: number;
  /** Minimum length (for strings) */
  minLength?: number;
  /** Maximum length (for strings) */
  maxLength?: number;
}

// =============================================================================
// JSON Schema Types (simplified)
// =============================================================================

export interface JSONSchemaObject {
  type: "object";
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export type JSONSchemaProperty =
  | { type: "string"; default?: string; enum?: string[] }
  | { type: "number"; default?: number; minimum?: number; maximum?: number }
  | { type: "integer"; default?: number; minimum?: number; maximum?: number }
  | { type: "boolean"; default?: boolean }
  | { type: "array"; items: JSONSchemaProperty; default?: unknown[] }
  | JSONSchemaObject;

// =============================================================================
// Zod Schemas for Validation
// =============================================================================

export const PackageTypeSchema = z.enum(["app", "skill", "agent", "extension"]);

export const ProtocolConfigSchema = z.object({
  version: z.string(),
  minKernelVersion: z.string().optional(),
});

export const PackageDependenciesSchema = z.object({
  apps: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  agents: z.array(z.string()).optional(),
});

export const ConfigUiHintSchema = z.object({
  label: z.string().optional(),
  description: z.string().optional(),
  placeholder: z.string().optional(),
  sensitive: z.boolean().optional(),
  advanced: z.boolean().optional(),
  type: z
    .enum(["text", "number", "boolean", "select", "multiselect", "code", "textarea"])
    .optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  validation: z
    .object({
      pattern: z.string().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
    })
    .optional(),
});

export const PackageManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+/),
  description: z.string().optional(),
  author: z.string().optional(),
  license: z.string().optional(),
  repository: z.string().url().optional(),
  icon: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  type: PackageTypeSchema,
  main: z.string().optional(),
  protocol: ProtocolConfigSchema,
  capabilities: z.record(z.string(), z.unknown()), // Validated separately
  configSchema: z.record(z.string(), z.unknown()).optional(),
  configUiHints: z.record(z.string(), ConfigUiHintSchema).optional(),
  dependencies: PackageDependenciesSchema.optional(),
});

// =============================================================================
// Validation Helpers
// =============================================================================

export interface ManifestValidationResult {
  valid: boolean;
  errors: ManifestValidationError[];
  warnings: string[];
}

export interface ManifestValidationError {
  path: string;
  message: string;
}

/** Validate a package manifest */
export function validateManifest(manifest: unknown): ManifestValidationResult {
  const result: ManifestValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  const parsed = PackageManifestSchema.safeParse(manifest);

  if (!parsed.success) {
    result.valid = false;
    for (const issue of parsed.error.issues) {
      result.errors.push({
        path: issue.path.join("."),
        message: issue.message,
      });
    }
    return result;
  }

  const m = parsed.data as PackageManifest;

  // Type-specific validation
  if (m.type === "app" || m.type === "skill" || m.type === "extension") {
    if (!m.main) {
      result.errors.push({
        path: "main",
        message: `Package type "${m.type}" requires a "main" entry point`,
      });
      result.valid = false;
    }
  }

  if (m.type === "agent") {
    if (!m.capabilities.agent) {
      result.errors.push({
        path: "capabilities.agent",
        message: 'Agent packages require "capabilities.agent" configuration',
      });
      result.valid = false;
    }
  }

  // Warnings
  if (!m.description) {
    result.warnings.push("Package has no description");
  }

  if (!m.license) {
    result.warnings.push("Package has no license specified");
  }

  return result;
}

/** Parse and validate a manifest from JSON */
export function parseManifest(json: string): PackageManifest {
  const data = JSON.parse(json);
  const result = validateManifest(data);

  if (!result.valid) {
    const messages = result.errors.map((e) => `${e.path}: ${e.message}`);
    throw new Error(`Invalid manifest:\n${messages.join("\n")}`);
  }

  return data as PackageManifest;
}

// =============================================================================
// Manifest File Names
// =============================================================================

/** Standard manifest file name */
export const MANIFEST_FILE = "openclawos.manifest.json";

/** Alternative manifest file names (for compatibility) */
export const MANIFEST_FILE_ALTERNATIVES = [
  "openclawos.json",
  "openclaw.plugin.json", // Legacy
];
