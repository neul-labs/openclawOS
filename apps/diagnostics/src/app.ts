/**
 * Diagnostics App
 *
 * Process-isolated OpenTelemetry diagnostics app using the OpenClawOS SDK.
 */

import { OpenClawApp } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import type { DiagnosticsAppConfig } from "./config.js";

// OpenTelemetry imports (placeholder for now)
// import { NodeSDK } from "@opentelemetry/sdk-node";
// import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
// import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
// import { Resource } from "@opentelemetry/resources";
// import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

import manifest from "../openclawos.manifest.json" with { type: "json" };

export class DiagnosticsApp extends OpenClawApp {
  readonly manifest = manifest as unknown as PackageManifest;

  private config: DiagnosticsAppConfig = {};
  // private otelSdk: NodeSDK | null = null;

  protected async setup(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("diagnostics");
    this.config = (kernelConfig || {}) as DiagnosticsAppConfig;

    // Check if diagnostics are enabled
    if (!this.config.enabled) {
      this.log.info("Diagnostics disabled, running in passive mode");
      return;
    }

    // Validate required config
    if (!this.config.otlpEndpoint) {
      throw new Error("OTLP endpoint is required (diagnostics.otlpEndpoint)");
    }

    const serviceName = this.config.serviceName || "openclawos";

    this.log.info(`Initializing OpenTelemetry export to ${this.config.otlpEndpoint}`);
    this.log.info(`Service name: ${serviceName}`);

    // TODO: Initialize OpenTelemetry SDK
    // this.otelSdk = new NodeSDK({
    //   resource: new Resource({
    //     [ATTR_SERVICE_NAME]: serviceName,
    //   }),
    //   traceExporter: new OTLPTraceExporter({
    //     url: `${this.config.otlpEndpoint}/v1/traces`,
    //   }),
    //   metricReader: new PeriodicExportingMetricReader({
    //     exporter: new OTLPMetricExporter({
    //       url: `${this.config.otlpEndpoint}/v1/metrics`,
    //     }),
    //   }),
    // });
    // await this.otelSdk.start();

    // Subscribe to hooks
    await this.onHook("agent_end", this.handleAgentEnd.bind(this));
    await this.onHook("llm_input", this.handleLlmInput.bind(this));
    await this.onHook("llm_output", this.handleLlmOutput.bind(this));

    this.log.info("Diagnostics app initialized");
  }

  private async handleAgentEnd(data: unknown): Promise<void> {
    this.log.debug("agent_end hook:", data);
    // TODO: Export trace/metrics for agent completion
  }

  private async handleLlmInput(data: unknown): Promise<void> {
    this.log.debug("llm_input hook:", data);
    // TODO: Export trace/metrics for LLM input
  }

  private async handleLlmOutput(data: unknown): Promise<void> {
    this.log.debug("llm_output hook:", data);
    // TODO: Export trace/metrics for LLM output
  }

  protected async teardown(): Promise<void> {
    this.log.info("Shutting down diagnostics app");

    // TODO: Shutdown OpenTelemetry SDK
    // if (this.otelSdk) {
    //   await this.otelSdk.shutdown();
    //   this.otelSdk = null;
    // }

    this.log.info("Diagnostics app stopped");
  }
}
