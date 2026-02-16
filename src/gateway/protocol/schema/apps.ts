/**
 * App Store Gateway Protocol Schemas
 *
 * TypeBox schemas for apps.* gateway methods.
 */

import { Type, type Static } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";

// =============================================================================
// Package Type
// =============================================================================

export const PackageTypeSchema = Type.Union([
  Type.Literal("app"),
  Type.Literal("skill"),
  Type.Literal("agent"),
  Type.Literal("extension"),
]);

export const PackageStatusSchema = Type.Union([
  Type.Literal("running"),
  Type.Literal("stopped"),
  Type.Literal("starting"),
  Type.Literal("stopping"),
  Type.Literal("error"),
  Type.Literal("not_applicable"),
]);

// =============================================================================
// Package Info
// =============================================================================

export const PackageInfoSchema = Type.Object(
  {
    id: NonEmptyString,
    name: NonEmptyString,
    description: Type.Optional(Type.String()),
    type: PackageTypeSchema,
    version: NonEmptyString,
    icon: Type.Optional(Type.String()),
    author: Type.Optional(Type.String()),
    license: Type.Optional(Type.String()),
    repository: Type.Optional(Type.String()),
    tags: Type.Optional(Type.Array(Type.String())),
    installed: Type.Boolean(),
    builtin: Type.Boolean(),
    enabled: Type.Optional(Type.Boolean()),
    installedVersion: Type.Optional(Type.String()),
    latestVersion: Type.Optional(Type.String()),
    status: Type.Optional(PackageStatusSchema),
    lastError: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

// =============================================================================
// apps.list
// =============================================================================

export const AppsListParamsSchema = Type.Object(
  {
    type: Type.Optional(PackageTypeSchema),
    installed: Type.Optional(Type.Boolean()),
    enabled: Type.Optional(Type.Boolean()),
    builtin: Type.Optional(Type.Boolean()),
    search: Type.Optional(Type.String()),
    tags: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

export const AppsListResultSchema = Type.Object(
  {
    packages: Type.Array(PackageInfoSchema),
    categories: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);

// =============================================================================
// apps.info
// =============================================================================

export const AppsInfoParamsSchema = Type.Object(
  {
    packageId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const AppsInfoResultSchema = Type.Object(
  {
    package: Type.Union([PackageInfoSchema, Type.Null()]),
    configSchema: Type.Optional(Type.Unknown()),
    configUiHints: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    config: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  },
  { additionalProperties: false },
);

// =============================================================================
// apps.install
// =============================================================================

export const AppsInstallParamsSchema = Type.Object(
  {
    packageId: NonEmptyString,
    version: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const AppsInstallResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    packageId: NonEmptyString,
    version: Type.String(),
    error: Type.Optional(Type.String()),
    warnings: Type.Optional(Type.Array(Type.String())),
    upgraded: Type.Optional(Type.Boolean()),
    previousVersion: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

// =============================================================================
// apps.uninstall
// =============================================================================

export const AppsUninstallParamsSchema = Type.Object(
  {
    packageId: NonEmptyString,
    purgeData: Type.Optional(Type.Boolean()),
    force: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const AppsUninstallResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    packageId: NonEmptyString,
    error: Type.Optional(Type.String()),
    dataPurged: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

// =============================================================================
// apps.configure
// =============================================================================

export const AppsConfigureParamsSchema = Type.Object(
  {
    packageId: NonEmptyString,
    config: Type.Record(Type.String(), Type.Unknown()),
    merge: Type.Optional(Type.Boolean()),
    validate: Type.Optional(Type.Boolean()),
    restart: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const AppsConfigureResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    packageId: NonEmptyString,
    config: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    error: Type.Optional(Type.String()),
    validationErrors: Type.Optional(
      Type.Array(
        Type.Object({
          field: Type.String(),
          message: Type.String(),
        }),
      ),
    ),
    restarted: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

// =============================================================================
// apps.getConfig
// =============================================================================

export const AppsGetConfigParamsSchema = Type.Object(
  {
    packageId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const AppsGetConfigResultSchema = Type.Object(
  {
    config: Type.Record(Type.String(), Type.Unknown()),
  },
  { additionalProperties: false },
);

// =============================================================================
// apps.setEnabled
// =============================================================================

export const AppsSetEnabledParamsSchema = Type.Object(
  {
    packageId: NonEmptyString,
    enabled: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const AppsSetEnabledResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    error: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

// =============================================================================
// apps.status
// =============================================================================

export const AppsStatusParamsSchema = Type.Object(
  {
    packageId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const AppsStatusResultSchema = Type.Object(
  {
    packageId: NonEmptyString,
    status: PackageStatusSchema,
    enabled: Type.Boolean(),
    lastError: Type.Optional(Type.String()),
    startedAt: Type.Optional(Type.Integer({ minimum: 0 })),
    restartCount: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);

// =============================================================================
// Type Exports
// =============================================================================

export type PackageInfo = Static<typeof PackageInfoSchema>;
export type AppsListParams = Static<typeof AppsListParamsSchema>;
export type AppsListResult = Static<typeof AppsListResultSchema>;
export type AppsInfoParams = Static<typeof AppsInfoParamsSchema>;
export type AppsInfoResult = Static<typeof AppsInfoResultSchema>;
export type AppsInstallParams = Static<typeof AppsInstallParamsSchema>;
export type AppsInstallResult = Static<typeof AppsInstallResultSchema>;
export type AppsUninstallParams = Static<typeof AppsUninstallParamsSchema>;
export type AppsUninstallResult = Static<typeof AppsUninstallResultSchema>;
export type AppsConfigureParams = Static<typeof AppsConfigureParamsSchema>;
export type AppsConfigureResult = Static<typeof AppsConfigureResultSchema>;
export type AppsGetConfigParams = Static<typeof AppsGetConfigParamsSchema>;
export type AppsGetConfigResult = Static<typeof AppsGetConfigResultSchema>;
export type AppsSetEnabledParams = Static<typeof AppsSetEnabledParamsSchema>;
export type AppsSetEnabledResult = Static<typeof AppsSetEnabledResultSchema>;
export type AppsStatusParams = Static<typeof AppsStatusParamsSchema>;
export type AppsStatusResult = Static<typeof AppsStatusResultSchema>;
