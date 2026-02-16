/**
 * @openclawos/sdk
 *
 * OpenClawOS SDK for building apps, skills, agents, and extensions.
 */

// Re-export protocol types
export * from "@openclawos/protocol";

// Client
export { KernelClient, KernelError, createKernelClient } from "./client.js";
export type { KernelClientOptions, KernelClientEvents } from "./client.js";

// App
export { OpenClawApp, ChannelApp } from "./app.js";
export type {
  AppLogger,
  ChannelConfig,
  ChannelMeta,
  ToolDefinition,
  GatewayMethodHandler,
  HttpRouteHandler,
  HookHandler,
  MessageReceivedEvent,
  MessageSendingEvent,
  SendMessageParams,
} from "./app.js";

// Skill
export { OpenClawSkill, toolSuccess, toolError, validateToolParams } from "./skill.js";
export type {
  SkillContext,
  SkillTool,
  ToolParameters,
  ToolParameterProperty,
  ToolExecutor,
  ToolContext,
  ToolResult,
  SkillLogger,
} from "./skill.js";

// Agent
export { AgentTemplateBuilder, defineAgent, loadPromptFile } from "./agent.js";
export type { AgentTemplate, AgentConfig, AgentConfigValidation } from "./agent.js";

// Extension
export { ExtensionBuilder, defineExtension } from "./extension.js";
export type {
  KernelExtension,
  ExtensionContext,
  KernelServices,
  ConfigChange,
  DiagnosticEvent,
  GatewayMethodDefinition,
  GatewayMethodContext,
  ProviderDefinition,
  ModelDefinition,
  ProviderAuthMethod,
  ProviderAuthContext,
  ProviderAuthResult,
  ExtensionHookDefinition,
  ExtensionHookHandler,
  ExtensionHookContext,
  ExtensionLogger,
} from "./extension.js";
