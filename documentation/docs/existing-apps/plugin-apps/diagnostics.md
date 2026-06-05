# Diagnostics Plugin

OpenTelemetry integration for metrics, traces, and observability.

## Overview

| Property | Value                          |
| -------- | ------------------------------ |
| Package  | `@openclawos/diagnostics`      |
| Protocol | OTLP (OpenTelemetry)           |
| Features | Metrics, traces, health checks |
| Status   | Production Ready               |

## Quick Start

### 1. Install

```bash
openclaw apps install @openclawos/diagnostics
```

### 2. Configure

```json
{
  "apps": {
    "@openclawos/diagnostics": {
      "enabled": true,
      "otlpEndpoint": "http://localhost:4318"
    }
  }
}
```

### 3. Start

```bash
openclaw gateway
```

## Configuration

### Basic

```json
{
  "apps": {
    "@openclawos/diagnostics": {
      "enabled": true,
      "otlpEndpoint": "http://localhost:4318"
    }
  }
}
```

### Full Options

```json
{
  "apps": {
    "@openclawos/diagnostics": {
      "enabled": true,
      "otlpEndpoint": "http://localhost:4318",
      "serviceName": "openclawos",
      "metrics": {
        "enabled": true,
        "interval": 60000
      },
      "traces": {
        "enabled": true,
        "sampleRate": 0.1
      },
      "headers": {
        "Authorization": "Bearer xxx"
      }
    }
  }
}
```

| Option              | Type    | Description                |
| ------------------- | ------- | -------------------------- |
| `otlpEndpoint`      | string  | OTLP endpoint URL          |
| `serviceName`       | string  | Service name for telemetry |
| `metrics.enabled`   | boolean | Enable metrics export      |
| `metrics.interval`  | number  | Export interval (ms)       |
| `traces.enabled`    | boolean | Enable trace export        |
| `traces.sampleRate` | number  | Trace sampling rate (0-1)  |
| `headers`           | object  | Custom headers for OTLP    |

## Metrics

### Agent Metrics

| Metric                       | Type      | Description      |
| ---------------------------- | --------- | ---------------- |
| `agent_runs_total`           | Counter   | Total agent runs |
| `agent_run_duration_seconds` | Histogram | Run duration     |
| `agent_tokens_used`          | Counter   | Tokens consumed  |
| `agent_errors_total`         | Counter   | Error count      |

### Message Metrics

| Metric                    | Type      | Description       |
| ------------------------- | --------- | ----------------- |
| `messages_received_total` | Counter   | Inbound messages  |
| `messages_sent_total`     | Counter   | Outbound messages |
| `message_latency_seconds` | Histogram | Message latency   |

### System Metrics

| Metric               | Type  | Description     |
| -------------------- | ----- | --------------- |
| `sessions_active`    | Gauge | Active sessions |
| `apps_running`       | Gauge | Running apps    |
| `memory_usage_bytes` | Gauge | Memory usage    |

## Traces

Traces are created for:

- Agent runs (full conversation flow)
- Tool executions
- IPC calls
- External API calls

### Trace Attributes

| Attribute     | Description                |
| ------------- | -------------------------- |
| `session.key` | Session identifier         |
| `agent.id`    | Agent ID                   |
| `channel.id`  | Channel ID                 |
| `tool.name`   | Tool name (for tool spans) |

## Integration Examples

### Prometheus + Grafana

```yaml
# docker-compose.yml
services:
  otel-collector:
    image: otel/opentelemetry-collector
    ports:
      - "4318:4318"
    volumes:
      - ./otel-config.yaml:/etc/otel/config.yaml

  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
```

### Jaeger

```yaml
# docker-compose.yml
services:
  jaeger:
    image: jaegertracing/all-in-one
    ports:
      - "16686:16686" # UI
      - "4318:4318" # OTLP
```

### Datadog

```json
{
  "apps": {
    "@openclawos/diagnostics": {
      "enabled": true,
      "endpoint": "https://http-intake.logs.datadoghq.com",
      "headers": {
        "DD-API-KEY": "your-api-key"
      }
    }
  }
}
```

## Gateway Methods

### diagnostics.health

Get system health:

```typescript
const health = await gateway.call("diagnostics.health");
// { status: "ok", uptime: 3600, ... }
```

### diagnostics.metrics

Get current metrics:

```typescript
const metrics = await gateway.call("diagnostics.metrics");
// { agentRuns: 100, errors: 2, ... }
```

## Agent Tool

The plugin registers a `diagnostics_health` tool:

```
Agent: Let me check the system health.
[Calling diagnostics_health]
The system is running well with 99.9% uptime.
```

## Dashboard

A Grafana dashboard is available at:
`apps/diagnostics/grafana/dashboard.json`

## Next Steps

- [Voice Call Plugin](voice-call.md)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
