/**
 * GitHub Copilot Proxy App
 *
 * Process-isolated proxy server using the OpenClawOS SDK.
 */

import { OpenClawApp } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import type { CopilotProxyAppConfig } from "./config.js";

import manifest from "../openclawos.manifest.json" with { type: "json" };

export class CopilotProxyApp extends OpenClawApp {
  readonly manifest = manifest as unknown as PackageManifest;

  private config: CopilotProxyAppConfig | null = null;
  private server: any | null = null;

  protected async setup(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("copilot-proxy");
    this.config = kernelConfig as CopilotProxyAppConfig;

    if (!this.config) {
      throw new Error("Copilot Proxy configuration is required");
    }

    const { port, upstreamUrl } = this.config;

    this.log.info(`Starting Copilot Proxy on port ${port}, upstream: ${upstreamUrl}`);

    // Register gateway method for proxy requests
    this.registerGatewayMethod("proxy_request", async (params: any) => {
      return this.handleProxyRequest(params);
    });

    this.log.info(`Copilot Proxy initialized on port ${port}`);
  }

  private async handleProxyRequest(params: any): Promise<any> {
    if (!this.config) {
      throw new Error("Proxy not configured");
    }

    const { method, path, headers, body } = params;
    const url = `${this.config.upstreamUrl}${path}`;

    this.log.debug(`Proxying ${method} ${path} to ${url}`);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const responseBody = await response.text();
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
      };
    } catch (error) {
      this.log.error("Proxy request failed:", error);
      throw error;
    }
  }

  protected async teardown(): Promise<void> {
    if (this.server) {
      this.log.info("Stopping Copilot Proxy server");
      this.server = null;
    }
    this.log.info("Copilot Proxy stopped");
  }
}
