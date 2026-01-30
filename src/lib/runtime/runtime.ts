import { DroidSession } from "../droid/index.js";
import type { DroidEvent } from "../droid/types.js";
import type { RuntimeConfig, RuntimeStatus, RuntimeResult } from "./types.js";

export class Runtime {
  readonly id: string;
  readonly config: RuntimeConfig;
  readonly task: string;

  private session: DroidSession;
  private _status: RuntimeStatus;
  private _history: RuntimeResult[] = [];
  private abortController = new AbortController();
  private _processing = false;

  constructor(id: string, config: RuntimeConfig, task: string, cwd: string) {
    this.id = id;
    this.config = config;
    this.task = task;

    this._status = {
      id,
      name: config.name,
      model: config.model,
      task: task.slice(0, 100),
      status: "running",
      startedAt: new Date(),
    };

    this.session = new DroidSession({
      model: config.model,
      cwd,
      reasoningEffort: config.reasoning,
      autonomyLevel: config.autonomy || "high",
      systemPrompt: config.systemPrompt,
    });
  }

  get status(): RuntimeStatus {
    return { ...this._status };
  }

  get history(): RuntimeResult[] {
    return [...this._history];
  }

  get lastResult(): RuntimeResult | undefined {
    return this._history.length > 0 ? { ...this._history[this._history.length - 1] } : undefined;
  }

  isActive(): boolean {
    return this._status.status === "running" || this._status.status === "idle";
  }

  isProcessing(): boolean {
    return this._processing;
  }

  isReady(): boolean {
    return this.isActive() && !this._processing;
  }

  async *run(): AsyncGenerator<DroidEvent, RuntimeResult, unknown> {
    yield* this.sendMessage(this.task);
    return this.lastResult!;
  }

  async *send(message: string): AsyncGenerator<DroidEvent, RuntimeResult, unknown> {
    if (!this.isActive()) {
      throw new Error(`Runtime ${this.id} is not active (status: ${this._status.status})`);
    }
    if (this._processing) {
      throw new Error(`Runtime ${this.id} is busy processing`);
    }
    yield* this.sendMessage(message);
    return this.lastResult!;
  }

  private async *sendMessage(message: string): AsyncGenerator<DroidEvent, void, unknown> {
    const startTime = Date.now();
    let fullOutput = "";

    this._processing = true;
    this._status.status = "running";

    try {
      for await (const event of this.session.send(message)) {
        if (this.abortController.signal.aborted) {
          throw new Error("Runtime cancelled");
        }

        yield event;

        if (event.type === "completion") {
          fullOutput = event.finalText;
        }
      }

      const result: RuntimeResult = {
        id: this.id,
        success: true,
        summary: this.generateSummary(fullOutput),
        fullOutput,
        durationMs: Date.now() - startTime,
      };

      this._history.push(result);
      this._status.status = "idle";

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      
      const result: RuntimeResult = {
        id: this.id,
        success: false,
        summary: `Runtime failed: ${errorMessage}`,
        fullOutput: errorMessage,
        durationMs: Date.now() - startTime,
      };

      this._history.push(result);
      this._status.status = this.abortController.signal.aborted ? "cancelled" : "failed";
    } finally {
      this._processing = false;
    }
  }

  async close(): Promise<void> {
    this.abortController.abort();
    await this.session.close();
    this._status.status = "closed";
    this._status.completedAt = new Date();
  }

  async cancel(): Promise<void> {
    await this.close();
    this._status.status = "cancelled";
  }

  private generateSummary(text: string): string {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    const summary = sentences.slice(0, 3).join(" ").trim();
    
    if (summary.length > 300) {
      return summary.slice(0, 297) + "...";
    }
    
    return summary || text.slice(0, 200) + "...";
  }
}
