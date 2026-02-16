# Process Supervision

The kernel's supervisor manages the lifecycle of process-isolated apps.

## Overview

The supervisor is responsible for:

- **Spawning** app processes
- **Health monitoring** via heartbeats
- **Graceful shutdown** and restart
- **Resource management** and limits

## App Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                        App Lifecycle                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────┐      ┌──────────┐      ┌─────────┐      ┌──────────┐ │
│  │ Stopped │─────▶│ Starting │─────▶│  Ready  │─────▶│ Stopping │ │
│  └─────────┘      └──────────┘      └─────────┘      └──────────┘ │
│       ▲                │                 │                 │       │
│       │                │                 │                 │       │
│       │                ▼                 ▼                 ▼       │
│       │          [Connect IPC]    [Heartbeats]      [Cleanup]      │
│       │          [Register]       [Traffic]                        │
│       │                                                             │
│       └──────────────────── [Error/Crash] ──────────────────────────│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### States

| State      | Description                               |
| ---------- | ----------------------------------------- |
| `stopped`  | App is not running                        |
| `starting` | App process spawned, connecting to kernel |
| `ready`    | App registered and ready for traffic      |
| `stopping` | Graceful shutdown in progress             |
| `error`    | App crashed or failed health checks       |

## Spawning Apps

When an app is started:

1. **Load manifest**: Read `openclawos.manifest.json`
2. **Validate capabilities**: Check permissions
3. **Spawn process**: Execute entry point
4. **Wait for registration**: App calls `app.register`
5. **Wait for ready**: App calls `app.ready`

```typescript
// Supervisor spawns app
const child = spawn("node", ["dist/index.js"], {
  cwd: appPath,
  env: {
    ...process.env,
    OPENCLAWOS_SOCKET: socketPath,
    OPENCLAWOS_APP_ID: manifest.id,
  },
});
```

## Health Monitoring

Apps must send periodic heartbeats:

```typescript
// App sends heartbeat every 30 seconds
setInterval(async () => {
  await kernel.heartbeat({ status: "healthy" });
}, 30000);
```

### Heartbeat Protocol

1. App sends `app.heartbeat` request
2. Kernel responds with `{ ok: true, serverTime: ... }`
3. If no heartbeat in 90 seconds, app marked unhealthy
4. After 3 missed heartbeats, app is restarted

### Restart Policy

```typescript
interface RestartPolicy {
  /** Maximum restart attempts */
  maxRestarts: number; // Default: 5
  /** Time window for restart counting */
  restartWindow: number; // Default: 300000 (5 minutes)
  /** Delay before restart */
  restartDelay: number; // Default: 1000 (1 second)
  /** Backoff multiplier */
  backoffMultiplier: number; // Default: 2
}
```

Example restart sequence:

1. Crash at T+0 → Restart after 1s
2. Crash at T+5s → Restart after 2s
3. Crash at T+10s → Restart after 4s
4. Crash at T+15s → Restart after 8s
5. Crash at T+20s → App disabled, requires manual intervention

## Graceful Shutdown

When stopping an app:

1. **Send shutdown signal**: `app.shutdown` event
2. **Wait for cleanup**: App has `shutdownTimeout` to finish
3. **Force kill**: If timeout exceeded, SIGKILL

```typescript
// Kernel initiates shutdown
await sendToApp({ event: "shutdown", timeout: 5000 });

// Wait for app to cleanup
await waitForDisconnect(5000);

// Force kill if needed
if (app.isRunning) {
  app.process.kill("SIGKILL");
}
```

### App Shutdown Handler

```typescript
class MyApp extends OpenClawApp {
  protected async teardown(): Promise<void> {
    // Clean up resources
    await this.database.disconnect();
    await this.queue.flush();
    // App will exit after teardown completes
  }
}
```

## Resource Limits

Apps can have resource constraints:

```typescript
interface ResourceLimits {
  /** Maximum memory in bytes */
  maxMemory?: number;
  /** CPU shares (relative weight) */
  cpuShares?: number;
  /** Maximum file descriptors */
  maxFds?: number;
}
```

### Setting Limits

In manifest:

```json
{
  "capabilities": {
    "resources": {
      "limits": {
        "maxMemory": 536870912,
        "cpuShares": 50
      }
    }
  }
}
```

## Process Isolation

Each app runs in its own process:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Kernel Process                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Supervisor                            │   │
│  │                                                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │ App Process  │  │ App Process  │  │ App Process  │  │   │
│  │  │  (telegram)  │  │  (discord)   │  │   (slack)    │  │   │
│  │  │              │  │              │  │              │  │   │
│  │  │ PID: 12345   │  │ PID: 12346   │  │ PID: 12347   │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  │         │                 │                 │          │   │
│  │         └─────────────────┼─────────────────┘          │   │
│  │                           │                             │   │
│  │                    Unix Socket IPC                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Benefits

| Benefit                 | Description                                   |
| ----------------------- | --------------------------------------------- |
| **Fault Isolation**     | App crash doesn't affect kernel or other apps |
| **Memory Protection**   | Apps can't access each other's memory         |
| **Resource Accounting** | Per-app CPU/memory tracking                   |
| **Independent Updates** | Update one app without stopping others        |

## Monitoring

The supervisor provides monitoring data:

```typescript
interface AppStatus {
  packageId: string;
  state: AppState;
  pid?: number;
  startedAt?: number;
  restartCount: number;
  lastHeartbeat?: number;
  lastError?: string;
  resourceUsage?: {
    memoryRss: number;
    cpuPercent: number;
  };
}
```

### Gateway Methods

- `apps.list` - List all apps with status
- `apps.info` - Get detailed app info
- `apps.logs` - Get app stdout/stderr logs
- `apps.start` - Start a stopped app
- `apps.stop` - Stop a running app
- `apps.restart` - Restart an app

## Configuration

Supervisor configuration in `config.json`:

```json
{
  "apps": {
    "runtime": "ipc",
    "supervisor": {
      "heartbeatInterval": 30000,
      "heartbeatTimeout": 90000,
      "shutdownTimeout": 5000,
      "maxRestarts": 5,
      "restartWindow": 300000
    }
  }
}
```

## Next Steps

- [Capabilities](capabilities.md) - Permission system
- [IPC Protocol](ipc-protocol.md) - Communication details
- [Developing Apps](../developing-apps/index.md) - Build your own app
