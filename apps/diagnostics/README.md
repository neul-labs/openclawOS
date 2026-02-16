# OpenClawOS Diagnostics App

OpenTelemetry-based diagnostics plugin app for OpenClawOS.

## Overview

This is a **plugin app** (not a channel app) that provides OpenTelemetry metrics and traces export for monitoring and observability. It subscribes to agent lifecycle hooks to capture telemetry data.

## Features

- Subscribes to `agent_end`, `llm_input`, and `llm_output` hooks
- Exports traces and metrics to an OTLP-compatible endpoint (e.g., Jaeger, Tempo, Honeycomb)
- Configurable service name and endpoint
- Can be enabled/disabled via configuration

## Configuration

The app is configured via the `diagnostics` key in your OpenClawOS configuration:

```json
{
  "diagnostics": {
    "enabled": true,
    "otlpEndpoint": "http://localhost:4318",
    "serviceName": "openclawos"
  }
}
```

### Configuration Options

- `enabled` (boolean, default: `false`): Enable/disable OpenTelemetry export
- `otlpEndpoint` (string, required): OTLP endpoint URL (e.g., `http://localhost:4318`)
- `serviceName` (string, default: `"openclawos"`): Service name for traces and metrics

## Development

### Build

```bash
npm run build
```

### Type Check

```bash
npm run typecheck
```

### Run

```bash
npm start
```

## Architecture

This app extends `OpenClawApp` (not `ChannelApp`) from `@openclawos/sdk/app`, making it a pure plugin app without channel capabilities.

### Hook Subscriptions

- **agent_end**: Captures agent completion events
- **llm_input**: Captures LLM request events
- **llm_output**: Captures LLM response events

## Migration from Old Extension

This app replaces the deprecated `@openclaw/diagnostics-otel` extension. The new app:

1. Runs as a process-isolated app instead of an in-process extension
2. Uses the OpenClawOS SDK and manifest system
3. Provides better isolation and configurability
4. Uses the same OpenTelemetry dependencies

## TODO

The OpenTelemetry SDK initialization is currently commented out with placeholder code. To complete the implementation:

1. Uncomment the OpenTelemetry imports in `src/app.ts`
2. Uncomment the SDK initialization code
3. Implement actual trace/metric export in the hook handlers
4. Test with a local OTLP collector (e.g., Jaeger or OTEL Collector)

## License

MIT
