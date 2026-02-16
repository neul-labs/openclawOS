/**
 * Process Supervisor
 *
 * Manages app process lifecycle: spawning, monitoring, restarting, and graceful shutdown.
 */

import type { PackageManifest } from "@openclawos/protocol";
import { fork, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import path from "node:path";

export interface SupervisorOptions {
  /** Directory containing app packages */
  appsDir: string;
  /** Kernel socket path to pass to apps via env */
  socketPath: string;
  /** Default restart policy */
  defaultRestartPolicy?: RestartPolicy;
  /** Default max restarts before giving up */
  defaultMaxRestarts?: number;
  /** Default delay between restarts in ms */
  defaultRestartDelay?: number;
}

export type RestartPolicy = "always" | "on-failure" | "never";

export interface AppProcessConfig {
  /** When to restart the app */
  restartPolicy: RestartPolicy;
  /** Maximum number of restarts before giving up */
  maxRestarts: number;
  /** Delay between restarts in ms */
  restartDelay: number;
  /** Additional environment variables */
  env?: Record<string, string>;
}

export type AppStatus = "starting" | "running" | "stopping" | "stopped" | "crashed" | "restarting";

export interface AppProcess {
  appId: string;
  manifest: PackageManifest;
  process: ChildProcess | null;
  status: AppStatus;
  restartCount: number;
  startedAt: number;
  stoppedAt?: number;
  lastError?: string;
  config: AppProcessConfig;
  pid?: number;
}

export interface SupervisorEvents {
  spawn: [appId: string, pid: number];
  ready: [appId: string];
  stop: [appId: string, code: number | null, signal: string | null];
  crash: [appId: string, error: string];
  restart: [appId: string, attempt: number];
  error: [appId: string, error: Error];
}

export class AppSupervisor extends EventEmitter<SupervisorEvents> {
  private apps = new Map<string, AppProcess>();
  private stopping = false;

  constructor(private options: SupervisorOptions) {
    super();
  }

  /**
   * Spawn an app process
   */
  async spawn(manifest: PackageManifest, config?: Partial<AppProcessConfig>): Promise<AppProcess> {
    const appId = manifest.id;

    // Check if already running
    const existing = this.apps.get(appId);
    if (existing && existing.status !== "stopped" && existing.status !== "crashed") {
      throw new Error(`App ${appId} is already running`);
    }

    // Resolve app directory and entry point
    const appDirName = appId.replace(/^@/, "").replace("/", "-");
    const appDir = path.join(this.options.appsDir, appDirName);
    const entryPoint = path.join(appDir, manifest.main || "dist/index.js");

    // Build process config
    const processConfig: AppProcessConfig = {
      restartPolicy: config?.restartPolicy || this.options.defaultRestartPolicy || "on-failure",
      maxRestarts: config?.maxRestarts ?? this.options.defaultMaxRestarts ?? 5,
      restartDelay: config?.restartDelay ?? this.options.defaultRestartDelay ?? 1000,
      env: config?.env,
    };

    // Fork the process
    const child = fork(entryPoint, [], {
      cwd: appDir,
      env: {
        ...process.env,
        ...processConfig.env,
        OPENCLAWOS_KERNEL_SOCKET: this.options.socketPath,
        OPENCLAWOS_APP_ID: appId,
      },
      stdio: ["pipe", "pipe", "pipe", "ipc"],
      detached: false,
    });

    // Create app process record
    const app: AppProcess = {
      appId,
      manifest,
      process: child,
      status: "starting",
      restartCount: existing?.restartCount ?? 0,
      startedAt: Date.now(),
      config: processConfig,
      pid: child.pid,
    };

    this.apps.set(appId, app);

    // Handle process events
    this.setupProcessHandlers(app, child);

    if (child.pid) {
      this.emit("spawn", appId, child.pid);
    }

    return app;
  }

  /**
   * Stop an app process gracefully
   */
  async stop(appId: string, timeout = 5000): Promise<void> {
    const app = this.apps.get(appId);
    if (!app || !app.process) {
      return;
    }

    if (app.status === "stopped" || app.status === "stopping") {
      return;
    }

    app.status = "stopping";

    // Send SIGTERM for graceful shutdown
    app.process.kill("SIGTERM");

    // Wait for exit or force kill after timeout
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (app.process && !app.process.killed) {
          app.process.kill("SIGKILL");
        }
        resolve();
      }, timeout);

      const onExit = () => {
        clearTimeout(timer);
        resolve();
      };

      if (app.process) {
        app.process.once("exit", onExit);
      } else {
        resolve();
      }
    });

    app.status = "stopped";
    app.stoppedAt = Date.now();
    app.process = null;
  }

  /**
   * Restart an app
   */
  async restart(appId: string): Promise<AppProcess> {
    const app = this.apps.get(appId);
    if (!app) {
      throw new Error(`App ${appId} not found`);
    }

    await this.stop(appId);

    // Reset restart count on manual restart
    app.restartCount = 0;

    return this.spawn(app.manifest, app.config);
  }

  /**
   * Stop all apps
   */
  async stopAll(timeout = 5000): Promise<void> {
    this.stopping = true;

    const stopPromises = Array.from(this.apps.keys()).map((appId) => this.stop(appId, timeout));

    await Promise.all(stopPromises);
    this.stopping = false;
  }

  /**
   * Get app status
   */
  getStatus(appId: string): AppProcess | undefined {
    return this.apps.get(appId);
  }

  /**
   * List all apps
   */
  listApps(): AppProcess[] {
    return Array.from(this.apps.values());
  }

  /**
   * Get running apps
   */
  getRunningApps(): AppProcess[] {
    return Array.from(this.apps.values()).filter(
      (app) => app.status === "running" || app.status === "starting",
    );
  }

  /**
   * Check if app is running
   */
  isRunning(appId: string): boolean {
    const app = this.apps.get(appId);
    return app?.status === "running" || app?.status === "starting";
  }

  /**
   * Mark app as ready (called when app.ready IPC is received)
   */
  markReady(appId: string): void {
    const app = this.apps.get(appId);
    if (app && app.status === "starting") {
      app.status = "running";
      this.emit("ready", appId);
    }
  }

  private setupProcessHandlers(app: AppProcess, child: ChildProcess): void {
    // Capture stdout/stderr
    child.stdout?.on("data", (data: Buffer) => {
      // Could be forwarded to a logging system
      process.stdout.write(`[${app.appId}] ${data.toString()}`);
    });

    child.stderr?.on("data", (data: Buffer) => {
      process.stderr.write(`[${app.appId}] ${data.toString()}`);
    });

    child.on("error", (err) => {
      app.lastError = err.message;
      this.emit("error", app.appId, err);
    });

    child.on("exit", (code, signal) => {
      void this.handleExit(app, code, signal);
    });
  }

  private async handleExit(
    app: AppProcess,
    code: number | null,
    signal: string | null,
  ): Promise<void> {
    const wasRunning = app.status === "running" || app.status === "starting";

    // Don't restart if we're stopping or the app was manually stopped
    if (this.stopping || app.status === "stopping") {
      app.status = "stopped";
      app.stoppedAt = Date.now();
      app.process = null;
      this.emit("stop", app.appId, code, signal);
      return;
    }

    // Determine if we should restart
    const shouldRestart =
      wasRunning &&
      (app.config.restartPolicy === "always" ||
        (app.config.restartPolicy === "on-failure" && code !== 0));

    if (shouldRestart && app.restartCount < app.config.maxRestarts) {
      app.status = "restarting";
      app.restartCount++;
      this.emit("restart", app.appId, app.restartCount);

      // Delay before restart
      await new Promise((r) => setTimeout(r, app.config.restartDelay));

      // Re-fetch app state (might have been modified during delay by stop())
      const currentApp = this.apps.get(app.appId);
      if (
        !currentApp ||
        this.stopping ||
        currentApp.status === "stopping" ||
        currentApp.status === "stopped"
      ) {
        return;
      }

      try {
        await this.spawn(app.manifest, app.config);
      } catch (err) {
        app.status = "crashed";
        app.lastError = err instanceof Error ? err.message : String(err);
        this.emit("crash", app.appId, app.lastError);
      }
    } else {
      // Don't restart - mark as crashed or stopped
      app.status = code === 0 ? "stopped" : "crashed";
      app.stoppedAt = Date.now();
      app.process = null;

      if (code !== 0) {
        app.lastError = `Exit code ${code}${signal ? `, signal ${signal}` : ""}`;
        this.emit("crash", app.appId, app.lastError);
      } else {
        this.emit("stop", app.appId, code, signal);
      }
    }
  }
}
