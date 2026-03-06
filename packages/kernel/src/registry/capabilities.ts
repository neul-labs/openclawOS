/**
 * Capability Tracker
 *
 * Tracks registered capabilities and hook subscriptions for apps.
 */

import { EventEmitter } from "node:events";

export type CapabilityType =
  | "channel"
  | "tool"
  | "hook"
  | "gateway_method"
  | "http_route"
  | "provider";

export interface RegisteredCapability {
  id: string;
  appId: string;
  type: CapabilityType;
  config: unknown;
  registeredAt: number;
}

export interface CapabilityTrackerEvents {
  registered: [capability: RegisteredCapability];
  unregistered: [capabilityId: string, appId: string];
  hookSubscribed: [appId: string, event: string];
  hookUnsubscribed: [appId: string, event: string];
}

export class CapabilityTracker extends EventEmitter<CapabilityTrackerEvents> {
  /** All registered capabilities by ID */
  private capabilities = new Map<string, RegisteredCapability>();

  /** Capabilities grouped by app ID */
  private capabilitiesByApp = new Map<string, Set<string>>();

  /** Capabilities grouped by type */
  private capabilitiesByType = new Map<CapabilityType, Set<string>>();

  /** Hook subscriptions: event -> set of app IDs */
  private hookSubscriptions = new Map<string, Set<string>>();

  /** Channels: channel ID -> capability ID */
  private channelMap = new Map<string, string>();

  /** Tools: tool ID -> capability ID */
  private toolMap = new Map<string, string>();

  /** Gateway methods: method name -> capability ID */
  private gatewayMethodMap = new Map<string, string>();

  private getChannelId(config: Record<string, unknown>): string | undefined {
    const channelId = config.channelId ?? config.id;
    return typeof channelId === "string" && channelId.trim() ? channelId : undefined;
  }

  private getToolId(config: Record<string, unknown>): string | undefined {
    const toolId = config.toolId ?? config.name;
    return typeof toolId === "string" && toolId.trim() ? toolId : undefined;
  }

  private getGatewayMethodName(config: Record<string, unknown>): string | undefined {
    const methodName = config.methodName ?? config.method;
    return typeof methodName === "string" && methodName.trim() ? methodName : undefined;
  }

  /**
   * Check if registering a capability would conflict with an existing one.
   * Returns null if no conflict, or an error message if there's a conflict.
   */
  checkConflict(type: CapabilityType, config: unknown): string | null {
    const cfg = config as Record<string, unknown>;

    switch (type) {
      case "channel": {
        const channelId = this.getChannelId(cfg);
        if (channelId && this.channelMap.has(channelId)) {
          const existingCapId = this.channelMap.get(channelId)!;
          const existingCap = this.capabilities.get(existingCapId);
          return `Channel "${channelId}" is already registered by app "${existingCap?.appId}"`;
        }
        break;
      }
      case "tool": {
        const toolId = this.getToolId(cfg);
        if (toolId && this.toolMap.has(toolId)) {
          const existingCapId = this.toolMap.get(toolId)!;
          const existingCap = this.capabilities.get(existingCapId);
          return `Tool "${toolId}" is already registered by app "${existingCap?.appId}"`;
        }
        break;
      }
      case "gateway_method": {
        const methodName = this.getGatewayMethodName(cfg);
        if (methodName && this.gatewayMethodMap.has(methodName)) {
          const existingCapId = this.gatewayMethodMap.get(methodName)!;
          const existingCap = this.capabilities.get(existingCapId);
          return `Gateway method "${methodName}" is already registered by app "${existingCap?.appId}"`;
        }
        break;
      }
    }

    return null;
  }

  /**
   * Register a capability
   */
  register(appId: string, type: CapabilityType, config: unknown): string {
    const id = crypto.randomUUID();

    const capability: RegisteredCapability = {
      id,
      appId,
      type,
      config,
      registeredAt: Date.now(),
    };

    this.capabilities.set(id, capability);

    // Add to app's capabilities
    if (!this.capabilitiesByApp.has(appId)) {
      this.capabilitiesByApp.set(appId, new Set());
    }
    this.capabilitiesByApp.get(appId)!.add(id);

    // Add to type index
    if (!this.capabilitiesByType.has(type)) {
      this.capabilitiesByType.set(type, new Set());
    }
    this.capabilitiesByType.get(type)!.add(id);

    // Add to specific maps
    this.addToSpecificMaps(capability);

    this.emit("registered", capability);

    return id;
  }

  /**
   * Unregister a capability
   */
  unregister(appId: string, capabilityId: string): boolean {
    const capability = this.capabilities.get(capabilityId);
    if (!capability || capability.appId !== appId) {
      return false;
    }

    this.capabilities.delete(capabilityId);

    // Remove from app's capabilities
    this.capabilitiesByApp.get(appId)?.delete(capabilityId);

    // Remove from type index
    this.capabilitiesByType.get(capability.type)?.delete(capabilityId);

    // Remove from specific maps
    this.removeFromSpecificMaps(capability);

    this.emit("unregistered", capabilityId, appId);

    return true;
  }

  /**
   * Unregister all capabilities for an app
   */
  unregisterAll(appId: string): void {
    const capabilityIds = this.capabilitiesByApp.get(appId);
    if (!capabilityIds) {
      return;
    }

    for (const capabilityId of capabilityIds) {
      this.unregister(appId, capabilityId);
    }

    // Clear hook subscriptions for this app
    for (const [event, subscribers] of this.hookSubscriptions) {
      if (subscribers.delete(appId)) {
        this.emit("hookUnsubscribed", appId, event);
      }
    }
  }

  /**
   * Get capability by ID
   */
  get(capabilityId: string): RegisteredCapability | undefined {
    return this.capabilities.get(capabilityId);
  }

  /**
   * Get all capabilities for an app
   */
  getByApp(appId: string): RegisteredCapability[] {
    const ids = this.capabilitiesByApp.get(appId);
    if (!ids) {
      return [];
    }

    return Array.from(ids)
      .map((id) => this.capabilities.get(id))
      .filter((c): c is RegisteredCapability => c !== undefined);
  }

  /**
   * Get all capabilities of a type
   */
  getByType(type: CapabilityType): RegisteredCapability[] {
    const ids = this.capabilitiesByType.get(type);
    if (!ids) {
      return [];
    }

    return Array.from(ids)
      .map((id) => this.capabilities.get(id))
      .filter((c): c is RegisteredCapability => c !== undefined);
  }

  /**
   * Get app ID that provides a channel
   */
  getChannelProvider(channelId: string): string | undefined {
    const capId = this.channelMap.get(channelId);
    if (!capId) {
      return undefined;
    }
    return this.capabilities.get(capId)?.appId;
  }

  /**
   * Get app ID that provides a tool
   */
  getToolProvider(toolId: string): string | undefined {
    const capId = this.toolMap.get(toolId);
    if (!capId) {
      return undefined;
    }
    return this.capabilities.get(capId)?.appId;
  }

  /**
   * Get app ID that provides a gateway method
   */
  getGatewayMethodProvider(methodName: string): string | undefined {
    const capId = this.gatewayMethodMap.get(methodName);
    if (!capId) {
      return undefined;
    }
    return this.capabilities.get(capId)?.appId;
  }

  /**
   * Subscribe to a hook event
   */
  subscribeHook(appId: string, event: string): void {
    if (!this.hookSubscriptions.has(event)) {
      this.hookSubscriptions.set(event, new Set());
    }
    this.hookSubscriptions.get(event)!.add(appId);
    this.emit("hookSubscribed", appId, event);
  }

  /**
   * Unsubscribe from a hook event
   */
  unsubscribeHook(appId: string, event: string): void {
    this.hookSubscriptions.get(event)?.delete(appId);
    this.emit("hookUnsubscribed", appId, event);
  }

  /**
   * Get all apps subscribed to a hook event
   */
  getHookSubscribers(event: string): string[] {
    return Array.from(this.hookSubscriptions.get(event) || []);
  }

  /**
   * Check if app is subscribed to a hook
   */
  isSubscribedToHook(appId: string, event: string): boolean {
    return this.hookSubscriptions.get(event)?.has(appId) ?? false;
  }

  /**
   * Get all hook events an app is subscribed to
   */
  getAppHookSubscriptions(appId: string): string[] {
    const events: string[] = [];
    for (const [event, subscribers] of this.hookSubscriptions) {
      if (subscribers.has(appId)) {
        events.push(event);
      }
    }
    return events;
  }

  /**
   * List all registered channels
   */
  listChannels(): string[] {
    return Array.from(this.channelMap.keys());
  }

  /**
   * List all registered tools
   */
  listTools(): string[] {
    return Array.from(this.toolMap.keys());
  }

  /**
   * List all registered gateway methods
   */
  listGatewayMethods(): string[] {
    return Array.from(this.gatewayMethodMap.keys());
  }

  private addToSpecificMaps(capability: RegisteredCapability): void {
    const config = capability.config as Record<string, unknown>;

    switch (capability.type) {
      case "channel": {
        const channelId = this.getChannelId(config);
        if (channelId) {
          this.channelMap.set(channelId, capability.id);
        }
        break;
      }
      case "tool": {
        const toolId = this.getToolId(config);
        if (toolId) {
          this.toolMap.set(toolId, capability.id);
        }
        break;
      }
      case "gateway_method": {
        const methodName = this.getGatewayMethodName(config);
        if (methodName) {
          this.gatewayMethodMap.set(methodName, capability.id);
        }
        break;
      }
    }
  }

  private removeFromSpecificMaps(capability: RegisteredCapability): void {
    const config = capability.config as Record<string, unknown>;

    switch (capability.type) {
      case "channel": {
        const channelId = this.getChannelId(config);
        if (channelId) {
          this.channelMap.delete(channelId);
        }
        break;
      }
      case "tool": {
        const toolId = this.getToolId(config);
        if (toolId) {
          this.toolMap.delete(toolId);
        }
        break;
      }
      case "gateway_method": {
        const methodName = this.getGatewayMethodName(config);
        if (methodName) {
          this.gatewayMethodMap.delete(methodName);
        }
        break;
      }
    }
  }
}
