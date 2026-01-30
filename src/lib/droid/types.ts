export interface DroidSessionOptions {
  model?: string;
  reasoningEffort?: "off" | "low" | "medium" | "high";
  autonomyLevel?: "low" | "medium" | "high";
  cwd?: string;
  enabledTools?: string[];
  disabledTools?: string[];
  systemPrompt?: string;
}

export interface SendOptions {
  model?: string;
  reasoningEffort?: "off" | "low" | "medium" | "high";
  // Spec mode - plan before executing
  useSpec?: boolean;
  specModel?: string;
  specReasoningEffort?: "off" | "low" | "medium" | "high";
  // Custom droid to invoke
  droid?: string;
  // Tool controls
  enabledTools?: string[];
  disabledTools?: string[];
}

export type DroidEventType =
  | "system"
  | "message"
  | "tool_call"
  | "tool_result"
  | "completion";

export interface SystemEvent {
  type: "system";
  subtype: "init";
  cwd: string;
  session_id: string;
  tools: string[];
  model: string;
  timestamp?: number;
}

export interface MessageEvent {
  type: "message";
  role: "user" | "assistant";
  id: string;
  text: string;
  timestamp: number;
  session_id: string;
}

export interface ToolCallEvent {
  type: "tool_call";
  id: string;
  messageId: string;
  toolId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  timestamp: number;
  session_id: string;
}

export interface ToolResultEvent {
  type: "tool_result";
  id: string;
  messageId: string;
  toolId: string;
  isError: boolean;
  value: string;
  timestamp: number;
  session_id: string;
}

export interface CompletionEvent {
  type: "completion";
  finalText: string;
  numTurns: number;
  durationMs: number;
  session_id: string;
  timestamp: number;
}

export type DroidEvent =
  | SystemEvent
  | MessageEvent
  | ToolCallEvent
  | ToolResultEvent
  | CompletionEvent;

export interface DroidResult {
  success: boolean;
  text: string;
  sessionId: string;
  numTurns: number;
  durationMs: number;
}
