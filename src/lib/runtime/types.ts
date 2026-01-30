export interface RuntimeConfig {
  name: string;
  model: string;
  reasoning?: "off" | "low" | "medium" | "high";
  autonomy?: "low" | "medium" | "high";
  systemPrompt?: string;
}

export interface RuntimeStatus {
  id: string;
  name: string;
  model: string;
  task: string;
  status: "running" | "idle" | "closed" | "failed" | "cancelled";
  startedAt: Date;
  completedAt?: Date;
}

export interface RuntimeResult {
  id: string;
  success: boolean;
  summary: string;
  fullOutput: string;
  durationMs: number;
}
