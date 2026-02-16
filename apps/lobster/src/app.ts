/**
 * Lobster App
 *
 * Process-isolated Lobster workflow tool integration using the OpenClawOS SDK.
 */

import { OpenClawApp } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import type { LobsterAppConfig } from "./config.js";

import manifest from "../openclawos.manifest.json" with { type: "json" };

export class LobsterApp extends OpenClawApp {
  readonly manifest = manifest as unknown as PackageManifest;

  private config: LobsterAppConfig = {};

  protected async setup(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("lobster");
    this.config = (kernelConfig || {}) as LobsterAppConfig;

    // Validate required configuration
    if (!this.config.apiKey) {
      throw new Error("Lobster API key is required (lobster.apiKey)");
    }

    const endpoint = this.config.endpoint || "https://api.lobster.dev";

    this.log.info(`Lobster app initialized with endpoint: ${endpoint}`);
  }

  protected async teardown(): Promise<void> {
    this.log.info("Lobster app shutdown");
  }
}
