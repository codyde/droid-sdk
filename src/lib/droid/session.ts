import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { JsonLineParser } from "./parser.js";
import type { DroidEvent, DroidSessionOptions, DroidResult, SendOptions } from "./types.js";

function findDroidPath(): string {
  // Check common installation locations
  const candidates = [
    join(homedir(), ".local", "bin", "droid"),
    join(homedir(), ".factory", "bin", "droid"),
    "/usr/local/bin/droid",
    "/opt/homebrew/bin/droid",
    "droid", // Fall back to PATH lookup
  ];

  for (const candidate of candidates) {
    if (candidate === "droid" || existsSync(candidate)) {
      return candidate;
    }
  }

  return "droid"; // Let it fail with a clear error if not found
}

export class DroidSession extends EventEmitter {
  private parser = new JsonLineParser();
  private sessionId: string | null = null;
  private startTime: number | null = null;
  private options: DroidSessionOptions;
  private droidPath: string;

  constructor(options: DroidSessionOptions = {}) {
    super();
    this.options = options;
    this.droidPath = findDroidPath();
    this.startTime = Date.now();
  }

  private buildArgs(prompt: string, overrides?: SendOptions): string[] {
    const args = ["exec", "--output-format", "stream-json"];

    // Custom droid (must come before other flags)
    if (overrides?.droid) {
      args.push("--droid", overrides.droid);
    }

    if (this.options.autonomyLevel) {
      args.push("--auto", this.options.autonomyLevel);
    } else {
      args.push("--auto", "high");
    }

    // Model: override > fallback
    const model = overrides?.model || this.options.model;
    if (model) {
      args.push("-m", model);
    }

    // Reasoning: override > fallback
    const reasoning = overrides?.reasoningEffort || this.options.reasoningEffort;
    if (reasoning) {
      args.push("-r", reasoning);
    }

    // Spec mode
    if (overrides?.useSpec) {
      args.push("--use-spec");
      if (overrides.specModel) {
        args.push("--spec-model", overrides.specModel);
      }
      if (overrides.specReasoningEffort) {
        args.push("--spec-reasoning-effort", overrides.specReasoningEffort);
      }
    }

    // Tool controls: override > session defaults
    const enabledTools = overrides?.enabledTools || this.options.enabledTools;
    if (enabledTools?.length) {
      args.push("--enabled-tools", enabledTools.join(","));
    }

    const disabledTools = overrides?.disabledTools || this.options.disabledTools;
    if (disabledTools?.length) {
      args.push("--disabled-tools", disabledTools.join(","));
    }

    // Use session-id for multi-turn conversation
    if (this.sessionId) {
      args.push("-s", this.sessionId);
    }

    // Prepend system prompt to the first message only (when no session exists yet)
    let finalPrompt = prompt;
    if (this.options.systemPrompt && !this.sessionId) {
      finalPrompt = `${this.options.systemPrompt}\n\n---\n\nTask: ${prompt}`;
    }

    args.push(finalPrompt);

    return args;
  }

  async *send(
    prompt: string,
    options?: SendOptions
  ): AsyncGenerator<DroidEvent, DroidResult, unknown> {
    const args = this.buildArgs(prompt, options);
    const cwd = this.options.cwd || process.cwd();
    const effectiveModel = options?.model || this.options.model || "default";
    const effectiveReasoning = options?.reasoningEffort || this.options.reasoningEffort || "default";
    const extras: string[] = [];
    if (options?.useSpec) extras.push("spec");
    if (options?.droid) extras.push(`droid=${options.droid}`);
    const extraInfo = extras.length ? ` [${extras.join(", ")}]` : "";
    console.log(`[DroidSession] Running (model=${effectiveModel}, reasoning=${effectiveReasoning})${extraInfo}:`, this.droidPath, args.slice(0, 5).join(" "), "...");

    const child = spawn(this.droidPath, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.parser.reset();

    let finalResult: DroidResult | null = null;
    let resolveNext: ((event: DroidEvent) => void) | null = null;
    const eventQueue: DroidEvent[] = [];

    const pushEvent = (event: DroidEvent) => {
      if (resolveNext) {
        resolveNext(event);
        resolveNext = null;
      } else {
        eventQueue.push(event);
      }
    };

    child.stdout?.on("data", (data: Buffer) => {
      const events = this.parser.parse(data.toString());
      for (const event of events) {
        // Capture session ID from init event
        if (event.type === "system" && event.subtype === "init") {
          this.sessionId = event.session_id;
        }
        this.emit("event", event);
        pushEvent(event);
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      console.error("[DroidSession] stderr:", data.toString());
    });

    const processEnded = new Promise<void>((resolve, reject) => {
      child.on("close", (code) => {
        // Flush any remaining data
        const remaining = this.parser.flush();
        for (const event of remaining) {
          pushEvent(event);
        }
        this.emit("close", code);
        resolve();
      });

      child.on("error", (err) => {
        console.error("[DroidSession] Process error:", err);
        this.emit("error", err);
        reject(err);
      });
    });

    const nextEvent = (): Promise<DroidEvent> => {
      if (eventQueue.length > 0) {
        return Promise.resolve(eventQueue.shift()!);
      }
      return new Promise((resolve) => {
        resolveNext = resolve;
      });
    };

    // Yield events until completion
    while (true) {
      const event = await Promise.race([
        nextEvent(),
        processEnded.then(() => null),
      ]);

      if (!event) {
        // Process ended without completion event
        if (!finalResult) {
          throw new Error("Process ended without completion");
        }
        break;
      }

      yield event;

      if (event.type === "completion") {
        finalResult = {
          success: true,
          text: event.finalText,
          sessionId: event.session_id,
          numTurns: event.numTurns,
          durationMs: event.durationMs,
        };
        break;
      }
    }

    return finalResult!;
  }

  async close(): Promise<void> {
    this.sessionId = null;
    this.startTime = null;
    this.parser.reset();
  }

  isAlive(): boolean {
    return this.sessionId !== null;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getUptime(): number {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime;
  }

  getModel(): string {
    return this.options.model || "default";
  }

  getCwd(): string {
    return this.options.cwd || process.cwd();
  }

  updateOptions(options: Partial<DroidSessionOptions>): void {
    this.options = { ...this.options, ...options };
  }
}
