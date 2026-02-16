/**
 * App Registry
 *
 * Tracks registered apps, their manifests, and state.
 */

import type { PackageManifest } from "@openclawos/protocol";
import { EventEmitter } from "node:events";

export type AppState = "registered" | "ready" | "shutting_down" | "unregistered";

export interface RegisteredApp {
  appId: string;
  manifest: PackageManifest;
  token: string;
  state: AppState;
  registeredAt: number;
  readyAt?: number;
  metadata?: Record<string, unknown>;
  shutdownReason?: string;
}

export interface AppRegistryEvents {
  registered: [appId: string, manifest: PackageManifest];
  ready: [appId: string];
  shuttingDown: [appId: string, reason?: string];
  unregistered: [appId: string];
}

export class AppRegistry extends EventEmitter<AppRegistryEvents> {
  private apps = new Map<string, RegisteredApp>();
  private tokenToApp = new Map<string, string>();

  /**
   * Register a new app
   */
  register(appId: string, manifest: PackageManifest, token: string): RegisteredApp {
    // Unregister existing app with same ID
    const existing = this.apps.get(appId);
    if (existing) {
      this.unregister(appId);
    }

    const app: RegisteredApp = {
      appId,
      manifest,
      token,
      state: "registered",
      registeredAt: Date.now(),
    };

    this.apps.set(appId, app);
    this.tokenToApp.set(token, appId);

    this.emit("registered", appId, manifest);

    return app;
  }

  /**
   * Unregister an app
   */
  unregister(appId: string): boolean {
    const app = this.apps.get(appId);
    if (!app) {
      return false;
    }

    this.tokenToApp.delete(app.token);
    this.apps.delete(appId);

    this.emit("unregistered", appId);

    return true;
  }

  /**
   * Get registered app by ID
   */
  get(appId: string): RegisteredApp | undefined {
    return this.apps.get(appId);
  }

  /**
   * Get app ID by token
   */
  getByToken(token: string): RegisteredApp | undefined {
    const appId = this.tokenToApp.get(token);
    if (!appId) {
      return undefined;
    }
    return this.apps.get(appId);
  }

  /**
   * Get manifest for an app
   */
  getManifest(appId: string): PackageManifest | undefined {
    return this.apps.get(appId)?.manifest;
  }

  /**
   * Check if app is registered
   */
  isRegistered(appId: string): boolean {
    return this.apps.has(appId);
  }

  /**
   * Check if app is ready
   */
  isReady(appId: string): boolean {
    return this.apps.get(appId)?.state === "ready";
  }

  /**
   * Mark app as ready
   */
  setReady(appId: string, metadata?: Record<string, unknown>): void {
    const app = this.apps.get(appId);
    if (!app) {
      return;
    }

    app.state = "ready";
    app.readyAt = Date.now();
    if (metadata) {
      app.metadata = metadata;
    }

    this.emit("ready", appId);
  }

  /**
   * Mark app as shutting down
   */
  setShuttingDown(appId: string, reason?: string): void {
    const app = this.apps.get(appId);
    if (!app) {
      return;
    }

    app.state = "shutting_down";
    app.shutdownReason = reason;

    this.emit("shuttingDown", appId, reason);
  }

  /**
   * List all registered apps
   */
  list(): RegisteredApp[] {
    return Array.from(this.apps.values());
  }

  /**
   * List ready apps
   */
  listReady(): RegisteredApp[] {
    return Array.from(this.apps.values()).filter((app) => app.state === "ready");
  }

  /**
   * Get apps by type
   */
  getByType(type: PackageManifest["type"]): RegisteredApp[] {
    return Array.from(this.apps.values()).filter((app) => app.manifest.type === type);
  }

  /**
   * Get apps that provide a specific channel
   */
  getChannelProviders(channelId: string): RegisteredApp[] {
    return Array.from(this.apps.values()).filter((app) =>
      app.manifest.capabilities?.channels?.provides?.includes(channelId),
    );
  }

  /**
   * Get apps that provide a specific tool
   */
  getToolProviders(toolId: string): RegisteredApp[] {
    return Array.from(this.apps.values()).filter((app) =>
      app.manifest.capabilities?.tools?.provides?.includes(toolId),
    );
  }

  /**
   * Get count of registered apps
   */
  get count(): number {
    return this.apps.size;
  }

  /**
   * Clear all registered apps
   */
  clear(): void {
    const appIds = Array.from(this.apps.keys());
    for (const appId of appIds) {
      this.unregister(appId);
    }
  }
}
