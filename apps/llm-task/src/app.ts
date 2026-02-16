/**
 * LLM Task App
 *
 * Process-isolated LLM task execution using the OpenClawOS SDK.
 */

import { OpenClawApp } from "@openclawos/sdk/app";
import type { PackageManifest } from "@openclawos/protocol";
import type { LlmTaskAppConfig, Task, TaskStatus } from "./config.js";

import manifest from "../openclawos.manifest.json" with { type: "json" };

export class LlmTaskApp extends OpenClawApp {
  readonly manifest = manifest as unknown as PackageManifest;

  private config: LlmTaskAppConfig = {};
  private tasks = new Map<string, Task>();
  private runningCount = 0;
  private taskIdCounter = 0;

  protected async setup(): Promise<void> {
    // Get config from kernel
    const kernelConfig = await this.kernel.getConfig("llm-task");
    this.config = (kernelConfig || {}) as LlmTaskAppConfig;

    this.log.info(
      `LLM Task App configured with maxConcurrent=${this.config.maxConcurrent ?? 5}, timeout=${this.config.timeout ?? 300000}ms`,
    );

    // Register tool capabilities
    await this.registerTool({
      name: "execute_task",
      description: "Execute an LLM task asynchronously",
      parameters: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "Description of the task to execute",
          },
          prompt: {
            type: "string",
            description: "The prompt or instructions for the LLM",
          },
          context: {
            type: "object",
            description: "Additional context or parameters for the task",
          },
        },
        required: ["description", "prompt"],
      },
      handler: this.handleExecuteTask.bind(this),
    });

    await this.registerTool({
      name: "list_tasks",
      description: "List all tasks and their current status",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["pending", "running", "completed", "failed", "cancelled"],
            description: "Filter tasks by status",
          },
        },
      },
      handler: this.handleListTasks.bind(this),
    });

    await this.registerTool({
      name: "cancel_task",
      description: "Cancel a running or pending task",
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description: "ID of the task to cancel",
          },
        },
        required: ["taskId"],
      },
      handler: this.handleCancelTask.bind(this),
    });

    this.log.info("LLM Task tools registered");
  }

  private async handleExecuteTask(params: unknown): Promise<unknown> {
    const { description, prompt, context } = params as {
      description: string;
      prompt: string;
      context?: Record<string, unknown>;
    };

    const taskId = `task-${++this.taskIdCounter}`;
    const task: Task = {
      id: taskId,
      description,
      status: "pending",
      createdAt: Date.now(),
    };

    this.tasks.set(taskId, task);
    this.log.info(`Created task ${taskId}: ${description}`);

    // Start task execution asynchronously
    this.executeTask(taskId, prompt, context).catch((error) => {
      this.log.error(`Task ${taskId} failed:`, error);
    });

    return {
      taskId,
      status: "pending",
      message: "Task created and queued for execution",
    };
  }

  private async handleListTasks(params: unknown): Promise<unknown> {
    const { status } = (params || {}) as { status?: TaskStatus };

    const tasks = Array.from(this.tasks.values());
    const filteredTasks = status ? tasks.filter((t) => t.status === status) : tasks;

    return {
      tasks: filteredTasks.map((t) => ({
        id: t.id,
        description: t.description,
        status: t.status,
        createdAt: t.createdAt,
        startedAt: t.startedAt,
        completedAt: t.completedAt,
        error: t.error,
      })),
      total: filteredTasks.length,
    };
  }

  private async handleCancelTask(params: unknown): Promise<unknown> {
    const { taskId } = params as { taskId: string };

    const task = this.tasks.get(taskId);
    if (!task) {
      return {
        success: false,
        error: `Task ${taskId} not found`,
      };
    }

    if (task.status === "completed" || task.status === "failed") {
      return {
        success: false,
        error: `Task ${taskId} is already ${task.status}`,
      };
    }

    task.status = "cancelled";
    task.completedAt = Date.now();

    if (task.status === "running") {
      this.runningCount--;
    }

    this.log.info(`Cancelled task ${taskId}`);

    return {
      success: true,
      taskId,
      message: "Task cancelled successfully",
    };
  }

  private async executeTask(
    taskId: string,
    prompt: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return;
    }

    // Wait for available slot
    const maxConcurrent = this.config.maxConcurrent ?? 5;
    while (this.runningCount >= maxConcurrent) {
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check if task was cancelled while waiting
      if (task.status === "cancelled") {
        return;
      }
    }

    // Start execution
    task.status = "running";
    task.startedAt = Date.now();
    this.runningCount++;

    this.log.info(`Starting task ${taskId}`);

    try {
      const timeout = this.config.timeout ?? 300000;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Task timeout")), timeout),
      );

      // Simulate task execution (in a real implementation, this would call an LLM)
      const executionPromise = this.simulateTaskExecution(prompt, context);

      const result = await Promise.race([executionPromise, timeoutPromise]);

      if (task.status === "cancelled") {
        return;
      }

      task.status = "completed";
      task.completedAt = Date.now();
      task.result = result;

      this.log.info(`Task ${taskId} completed successfully`);
    } catch (error) {
      if (task.status === "cancelled") {
        return;
      }

      task.status = "failed";
      task.completedAt = Date.now();
      task.error = error instanceof Error ? error.message : String(error);

      this.log.error(`Task ${taskId} failed:`, error);
    } finally {
      this.runningCount--;
    }
  }

  private async simulateTaskExecution(
    prompt: string,
    context?: Record<string, unknown>,
  ): Promise<unknown> {
    // This is a placeholder for actual LLM execution
    // In a real implementation, this would:
    // 1. Call an LLM API (OpenAI, Anthropic, etc.)
    // 2. Process the prompt with the given context
    // 3. Return the LLM's response

    // Simulate some processing time
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

    return {
      prompt,
      context,
      response: "Task completed (simulated)",
      timestamp: Date.now(),
    };
  }

  protected async teardown(): Promise<void> {
    // Cancel all running tasks
    for (const task of this.tasks.values()) {
      if (task.status === "running" || task.status === "pending") {
        task.status = "cancelled";
        task.completedAt = Date.now();
      }
    }

    this.log.info("LLM Task App shutdown complete");
  }
}
