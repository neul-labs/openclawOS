/**
 * Process Supervisor
 *
 * Manages app process lifecycle: spawning, monitoring, restarting, and graceful shutdown.
 */

import type { PackageManifest } from "@openclawos/protocol";
import { fork, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
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

    // Resolve app directory and entry point.
    const mainFile = manifest.main || "dist/index.js";
    const appDir = await this.resolveAppDir(appId, mainFile);
    const entryPoint = path.join(appDir, mainFile);

    // Build process config
    const processConfig: AppProcessConfig = {
      restartPolicy: config?.restartPolicy || this.options.defaultRestartPolicy || "on-failure",
      maxRestarts: config?.maxRestarts ?? this.options.defaultMaxRestarts ?? 5,
      restartDelay: config?.restartDelay ?? this.options.defaultRestartDelay ?? 1000,
      env: config?.env,
    };

    // Build filtered environment variables
    // Only pass env vars explicitly declared in manifest to prevent secret leakage
    const filteredEnv = this.buildFilteredEnv(manifest, processConfig.env);

    // Fork the process
    const child = fork(entryPoint, [], {
      cwd: appDir,
      env: filteredEnv,
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

  /**
   * Build filtered environment variables for an app process.
   * Only passes env vars declared in the manifest's capabilities.resources.env
   * plus required system vars to prevent secret leakage.
   */
  private buildFilteredEnv(
    manifest: PackageManifest,
    extraEnv?: Record<string, string>,
  ): Record<string, string> {
    const env: Record<string, string> = {};

    // Always include essential system vars for Node.js to function
    const systemVars = ["NODE_ENV", "PATH", "HOME", "LANG", "LC_ALL", "TZ"];
    for (const key of systemVars) {
      if (process.env[key]) {
        env[key] = process.env[key]!;
      }
    }

    // Include OpenClawOS system vars
    env.OPENCLAWOS_KERNEL_SOCKET = this.options.socketPath;
    // Backward compatibility for older SDK clients.
    env.OPENCLAW_KERNEL_SOCKET = this.options.socketPath;
    env.OPENCLAWOS_APP_ID = manifest.id;

    // Only include env vars explicitly declared in manifest
    const declaredEnvVars = (manifest.capabilities as Record<string, unknown> | undefined)
      ?.resources;
    const envAllowlist = (declaredEnvVars as Record<string, unknown> | undefined)?.env;

    if (Array.isArray(envAllowlist)) {
      for (const varName of envAllowlist) {
        if (typeof varName === "string" && process.env[varName]) {
          env[varName] = process.env[varName]!;
        }
      }
    }

    // Add extra env vars from config (these are trusted, set by admin)
    if (extraEnv) {
      Object.assign(env, extraEnv);
    }

    return env;
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

  private async resolveAppDir(appId: string, mainFile: string): Promise<string> {
    const unscopedName = appId.includes("/") ? appId.split("/").at(-1) || appId : appId;
    const candidates = Array.from(
      new Set([
        path.join(this.options.appsDir, appId),
        path.join(this.options.appsDir, appId.replace(/^@/, "").replace("/", "-")),
        path.join(this.options.appsDir, appId.replace(/^@openclawos\//, "")),
        path.join(this.options.appsDir, unscopedName),
      ]),
    );

    // Prefer exact manifest ID matches.
    for (const dir of candidates) {
      if (await this.hasMatchingManifest(dir, appId)) {
        return dir;
      }
    }

    // Fall back to directories that contain the configured entrypoint.
    for (const dir of candidates) {
      if (await this.pathExists(path.join(dir, mainFile))) {
        return dir;
      }
    }

    // Last resort: scan appsDir for a manifest with matching ID.
    try {
      const entries = await fs.readdir(this.options.appsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        const dir = path.join(this.options.appsDir, entry.name);
        if (await this.hasMatchingManifest(dir, appId)) {
          return dir;
        }
      }
    } catch {
      // Ignore directory read failures; we'll throw a clear error below.
    }

    throw new Error(`App directory not found for ${appId}`);
  }

  private async hasMatchingManifest(dir: string, appId: string): Promise<boolean> {
    try {
      const raw = await fs.readFile(path.join(dir, "openclawos.manifest.json"), "utf-8");
      const parsed = JSON.parse(raw) as { id?: unknown };
      return parsed.id === appId;
    } catch {
      return false;
    }
  }

  private async pathExists(target: string): Promise<boolean> {
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
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
