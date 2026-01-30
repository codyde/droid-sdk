import type { DroidEvent } from "./types.js";

export class JsonLineParser {
  private buffer = "";

  parse(chunk: string): DroidEvent[] {
    this.buffer += chunk;
    const events: DroidEvent[] = [];
    const lines = this.buffer.split("\n");

    // Keep the last incomplete line in buffer
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const event = JSON.parse(trimmed) as DroidEvent;
        events.push(event);
      } catch {
        // Skip malformed lines
        console.error("[Parser] Failed to parse line:", trimmed.slice(0, 100));
      }
    }

    return events;
  }

  flush(): DroidEvent[] {
    if (!this.buffer.trim()) return [];

    try {
      const event = JSON.parse(this.buffer) as DroidEvent;
      this.buffer = "";
      return [event];
    } catch {
      this.buffer = "";
      return [];
    }
  }

  reset(): void {
    this.buffer = "";
  }
}
