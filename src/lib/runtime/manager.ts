import { EventEmitter } from "node:events";
import { Runtime } from "./runtime.js";
import type { DroidEvent } from "../droid/types.js";
import type { RuntimeConfig, RuntimeStatus, RuntimeResult } from "./types.js";

function generateId(): string {
  return "rt-" + Math.random().toString(36).slice(2, 10);
}

export interface RuntimeManagerEvents {
  complete: [id: string, result: RuntimeResult];
  error: [id: string, error: Error];
  event: [id: string, event: DroidEvent];
}

export class RuntimeManager extends EventEmitter {
  private runtimes = new Map<string, Runtime>();
  private cwd: string;

  constructor(cwd: string) {
    super();
    this.cwd = cwd;
  }

  getRuntime(id: string): Runtime | undefined {
    return this.runtimes.get(id);
  }

  async spawn(config: RuntimeConfig, task: string): Promise<string> {
    const id = generateId();
    const runtime = new Runtime(id, config, task, this.cwd);

    this.runtimes.set(id, runtime);

    // Run initial task in background, emitting events
    this.runAndEmit(runtime);

    return id;
  }

  async *send(id: string, message: string): AsyncGenerator<DroidEvent, RuntimeResult | undefined, unknown> {
    const runtime = this.runtimes.get(id);
    if (!runtime) {
      throw new Error(`Runtime ${id} not found`);
    }

    if (!runtime.isActive()) {
      throw new Error(`Runtime ${id} is not active (status: ${runtime.status.status})`);
    }

    for await (const event of runtime.send(message)) {
      yield event;
    }

    return runtime.lastResult;
  }

  private async runAndEmit(runtime: Runtime): Promise<void> {
    try {
      for await (const event of runtime.run()) {
        this.emit("event", runtime.id, event);
      }

      const result = runtime.lastResult;
      if (result) {
        this.emit("complete", runtime.id, result);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit("error", runtime.id, error);
    }
  }

  list(): RuntimeStatus[] {
    const statuses: RuntimeStatus[] = [];

    for (const runtime of this.runtimes.values()) {
      statuses.push(runtime.status);
    }

    return statuses.sort(
      (a, b) => b.startedAt.getTime() - a.startedAt.getTime()
    );
  }

  get(id: string): RuntimeStatus | undefined {
    return this.runtimes.get(id)?.status;
  }

  getResult(id: string): RuntimeResult | undefined {
    return this.runtimes.get(id)?.lastResult;
  }

  getHistory(id: string): RuntimeResult[] {
    return this.runtimes.get(id)?.history || [];
  }

  isActive(id: string): boolean {
    const runtime = this.runtimes.get(id);
    return runtime?.isActive() ?? false;
  }

  isReady(id: string): boolean {
    const runtime = this.runtimes.get(id);
    return runtime?.isReady() ?? false;
  }

  async close(id: string): Promise<boolean> {
    const runtime = this.runtimes.get(id);
    if (!runtime) return false;

    if (runtime.isActive()) {
      await runtime.close();
      return true;
    }

    return false;
  }

  async cancel(id: string): Promise<boolean> {
    const runtime = this.runtimes.get(id);
    if (!runtime) return false;

    if (runtime.status.status === "running") {
      await runtime.cancel();
      return true;
    }

    return false;
  }

  prune(keep: number = 10): void {
    const inactive = this.list().filter(
      (s) => s.status !== "running" && s.status !== "idle"
    );

    if (inactive.length > keep) {
      const toRemove = inactive.slice(keep);
      for (const status of toRemove) {
        this.runtimes.delete(status.id);
      }
    }
  }
}
