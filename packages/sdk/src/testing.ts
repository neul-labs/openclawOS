/**
 * OpenClawOS Testing Utilities
 *
 * Helpers for testing apps, skills, agents, and extensions.
 */

import type { PackageManifest, IPCRequest, IPCResponse, IPCEvent } from "@openclawos/protocol";
import type { AgentTemplate, AgentConfig } from "./agent.js";
import type { KernelClient } from "./client.js";
import type { ExtensionContext, KernelServices } from "./extension.js";
import type { SkillContext, SkillTool, ToolContext, ToolResult } from "./skill.js";

// =============================================================================
// Mock Kernel Client
// =============================================================================

/**
 * Mock kernel client for testing apps.
 *
 * @example
 * ```typescript
 * const mockKernel = new MockKernelClient();
 * mockKernel.onMethod("config.get", () => ({ value: { foo: "bar" } }));
 *
 * const app = new MyApp({ client: mockKernel });
 * await app.start();
 *
 * expect(mockKernel.getRegisteredCapabilities()).toContain("my-channel");
 * ```
 */
export class MockKernelClient {
  private connected = false;
  private registered = false;
  private appId = "test-app";
  private methodHandlers = new Map<string, (params: unknown) => unknown>();
  private eventHandlers = new Map<string, Array<(payload: unknown) => void>>();
  private registeredCapabilities: string[] = [];
  private subscribedHooks: string[] = [];
  private sentMessages: Array<{ method: string; params: unknown }> = [];

  // ===========================================================================
  // Setup Methods
  // ===========================================================================

  /** Register a handler for a method call */
  onMethod(method: string, handler: (params: unknown) => unknown): void {
    this.methodHandlers.set(method, handler);
  }

  /** Emit a mock event */
  emitEvent(event: string, payload: unknown): void {
    const handlers = this.eventHandlers.get(event) || [];
    for (const handler of handlers) {
      handler(payload);
    }
  }

  // ===========================================================================
  // Client Interface (for injection)
  // ===========================================================================

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  isRegistered(): boolean {
    return this.registered;
  }

  async register(
    manifest: PackageManifest,
  ): Promise<{ appId: string; token: string; protocolVersion: string }> {
    this.registered = true;
    return { appId: this.appId, token: "test-token", protocolVersion: "1.0" };
  }

  async ready(): Promise<void> {}

  async heartbeat(): Promise<void> {}

  async shutdown(): Promise<void> {
    this.connected = false;
  }

  async registerCapability(
    type: string,
    config: unknown,
  ): Promise<{ capabilityId: string; granted: boolean }> {
    const capabilityId = `${type}:${JSON.stringify(config)}`;
    this.registeredCapabilities.push(capabilityId);
    return { capabilityId, granted: true };
  }

  async unregisterCapability(capabilityId: string): Promise<void> {
    this.registeredCapabilities = this.registeredCapabilities.filter((c) => c !== capabilityId);
  }

  async subscribeHooks(events: string[]): Promise<{ subscribed: string[]; denied: string[] }> {
    this.subscribedHooks.push(...events);
    return { subscribed: events, denied: [] };
  }

  async unsubscribeHooks(events: string[]): Promise<void> {
    this.subscribedHooks = this.subscribedHooks.filter((e) => !events.includes(e));
  }

  async sendHookResult(eventId: string, result: unknown): Promise<void> {}

  async getConfig(path?: string): Promise<unknown> {
    return this.call("config.get", { path });
  }

  async getSession(key: string): Promise<unknown> {
    return this.call("session.get", { key });
  }

  async listSessions(): Promise<unknown[]> {
    const result = await this.call("session.list", {});
    return (result as { sessions: unknown[] }).sessions;
  }

  async dispatchMessage(
    sessionKey: string,
    content: string,
    metadata?: unknown,
  ): Promise<{ dispatchId: string; queued: boolean }> {
    return this.call("message.dispatch", { sessionKey, content, metadata }) as Promise<{
      dispatchId: string;
      queued: boolean;
    }>;
  }

  async queueAgent(
    sessionKey: string,
    text: string,
    metadata?: unknown,
  ): Promise<{ runId: string; queued: boolean }> {
    return this.call("agent.queue", { sessionKey, text, metadata }) as Promise<{
      runId: string;
      queued: boolean;
    }>;
  }

  async call(method: string, params: unknown): Promise<unknown> {
    this.sentMessages.push({ method, params });

    const handler = this.methodHandlers.get(method);
    if (handler) {
      return handler(params);
    }

    // Default responses
    switch (method) {
      case "config.get":
        return { value: {} };
      case "session.get":
        return { session: null };
      case "session.list":
        return { sessions: [], total: 0 };
      case "message.dispatch":
        return { dispatchId: "test-dispatch", queued: true };
      case "agent.queue":
        return { runId: "test-run", queued: true };
      default:
        return {};
    }
  }

  on(event: string, handler: (payload: unknown) => void): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  onEvent(handler: (event: IPCEvent) => void): void {
    this.on("event", (payload) => handler(payload as IPCEvent));
  }

  onHook(hookName: string, handler: (payload: unknown, context: unknown) => void): void {
    this.on(`hook:${hookName}`, (event) => {
      const e = event as { data: unknown; context: unknown };
      handler(e.data, e.context);
    });
  }

  // ===========================================================================
  // Test Assertions
  // ===========================================================================

  /** Get all registered capabilities */
  getRegisteredCapabilities(): string[] {
    return [...this.registeredCapabilities];
  }

  /** Get all subscribed hooks */
  getSubscribedHooks(): string[] {
    return [...this.subscribedHooks];
  }

  /** Get all sent messages */
  getSentMessages(): Array<{ method: string; params: unknown }> {
    return [...this.sentMessages];
  }

  /** Clear all state */
  reset(): void {
    this.connected = false;
    this.registered = false;
    this.registeredCapabilities = [];
    this.subscribedHooks = [];
    this.sentMessages = [];
    this.methodHandlers.clear();
    this.eventHandlers.clear();
  }
}

// =============================================================================
// Skill Testing
// =============================================================================

/** Create a mock skill context */
export function createMockSkillContext(overrides?: Partial<SkillContext>): SkillContext {
  return {
    dataDir: "/tmp/test-skill-data",
    workspaceDir: "/tmp/test-workspace",
    agentId: "test-agent",
    sessionKey: "test-session",
    config: {},
    logger: createMockLogger(),
    ...overrides,
  };
}

/** Create a mock tool context */
export function createMockToolContext(overrides?: Partial<ToolContext>): ToolContext {
  return {
    agentId: "test-agent",
    sessionKey: "test-session",
    workspaceDir: "/tmp/test-workspace",
    sandboxed: false,
    ...overrides,
  };
}

/** Test a skill tool */
export async function testTool(
  tool: SkillTool,
  params: Record<string, unknown>,
  context?: Partial<ToolContext>,
): Promise<ToolResult> {
  const ctx = createMockToolContext(context);
  return await tool.execute(params, ctx);
}

// =============================================================================
// Agent Template Testing
// =============================================================================

/** Test an agent template */
export async function testAgentTemplate(template: AgentTemplate): Promise<{
  systemPrompt: string;
  config: Partial<AgentConfig>;
  valid: boolean;
  errors: string[];
}> {
  const systemPrompt = await template.getSystemPrompt();
  const config = template.getDefaultConfig();
  const errors: string[] = [];

  // Basic validation
  if (!template.manifest.id) {
    errors.push("Missing manifest.id");
  }
  if (!template.manifest.name) {
    errors.push("Missing manifest.name");
  }
  if (!template.manifest.version) {
    errors.push("Missing manifest.version");
  }
  if (template.manifest.type !== "agent") {
    errors.push("manifest.type must be 'agent'");
  }
  if (!systemPrompt) {
    errors.push("System prompt is empty");
  }

  return {
    systemPrompt,
    config,
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// Extension Testing
// =============================================================================

/** Create a mock extension context */
export function createMockExtensionContext(
  overrides?: Partial<ExtensionContext>,
): ExtensionContext {
  return {
    dataDir: "/tmp/test-extension-data",
    config: {},
    logger: createMockLogger(),
    kernel: createMockKernelServices(),
    ...overrides,
  };
}

/** Create mock kernel services */
export function createMockKernelServices(): KernelServices {
  return {
    getConfig: () => ({}),
    watchConfig: () => () => {},
    getSession: async () => null,
    listSessions: async () => [],
    emitDiagnostic: () => {},
  };
}

// =============================================================================
// Mock Logger
// =============================================================================

export interface MockLogger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  messages: Array<{ level: string; args: unknown[] }>;
}

/** Create a mock logger that captures messages */
export function createMockLogger(): MockLogger {
  const messages: Array<{ level: string; args: unknown[] }> = [];

  return {
    debug: (...args: unknown[]) => messages.push({ level: "debug", args }),
    info: (...args: unknown[]) => messages.push({ level: "info", args }),
    warn: (...args: unknown[]) => messages.push({ level: "warn", args }),
    error: (...args: unknown[]) => messages.push({ level: "error", args }),
    messages,
  };
}

// =============================================================================
// Test Helpers
// =============================================================================

/** Wait for a condition to be true */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 50,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`Condition not met within ${timeout}ms`);
}

/** Create a deferred promise */
export function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
