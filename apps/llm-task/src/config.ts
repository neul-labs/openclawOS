export type LlmTaskAppConfig = {
  maxConcurrent?: number;
  timeout?: number;
};

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export type Task = {
  id: string;
  description: string;
  status: TaskStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: unknown;
  error?: string;
};
