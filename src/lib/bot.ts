import type { BotAdapter, IncomingMessage } from "./adapters/types.js";
import { DroidSession, type DroidEvent, type DroidSessionOptions } from "./droid/index.js";
import { SkillsManager } from "./skills/index.js";

export interface DroidBotConfig {
  model?: string;
  cwd?: string;
  reasoning?: "off" | "low" | "medium" | "high";
  autonomy?: "low" | "medium" | "high";
}

export class DroidBot {
  protected adapter: BotAdapter;
  protected session: DroidSession;
  protected skills: SkillsManager;
  protected processingChats = new Set<string>();
  protected config: DroidBotConfig;

  constructor(adapter: BotAdapter, config: DroidBotConfig = {}) {
    this.adapter = adapter;
    this.config = {
      model: config.model || "claude-sonnet-4-5-20250929",
      cwd: config.cwd || process.cwd(),
      reasoning: config.reasoning || "low",
      autonomy: config.autonomy || "high",
    };
    this.session = new DroidSession({
      model: this.config.model,
      cwd: this.config.cwd,
      reasoningEffort: this.config.reasoning,
      autonomyLevel: this.config.autonomy,
    });
    this.skills = new SkillsManager();

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Commands
    this.adapter.onCommand("start", this.handleStart.bind(this));
    this.adapter.onCommand("reset", this.handleReset.bind(this));
    this.adapter.onCommand("status", this.handleStatus.bind(this));
    this.adapter.onCommand("skill", this.handleSkill.bind(this));
    this.adapter.onCommand("model", this.handleModel.bind(this));
    this.adapter.onCommand("cwd", this.handleCwd.bind(this));
    this.adapter.onCommand("help", this.handleHelp.bind(this));

    // Messages
    this.adapter.onMessage(this.handleMessage.bind(this));
  }

  async start(): Promise<void> {
    await this.adapter.start();
    console.log(`[DroidBot] Started on ${this.adapter.platform}`);
  }

  async stop(): Promise<void> {
    await this.session.close();
    await this.adapter.stop();
  }

  private async handleStart(msg: IncomingMessage): Promise<void> {
    await this.adapter.sendMessage({
      chatId: msg.chatId,
      text: `*Droid Bot Ready*\n\nI'm your personal AI assistant powered by Factory Droid.\n\nModel: \`${this.config.model}\`\nWorking directory: \`${this.config.cwd}\`\n\nJust send me a message to get started, or use /help for commands.`,
    });
  }

  private async handleReset(msg: IncomingMessage): Promise<void> {
    await this.session.close();
    this.session = new DroidSession({
      model: this.config.model,
      cwd: this.config.cwd,
      reasoningEffort: this.config.reasoning,
      autonomyLevel: this.config.autonomy,
    });

    await this.adapter.sendMessage({
      chatId: msg.chatId,
      text: "Session reset. Starting fresh conversation.",
    });
  }

  private async handleStatus(msg: IncomingMessage): Promise<void> {
    const alive = this.session.isAlive();
    const uptime = Math.round(this.session.getUptime() / 1000);
    const sessionId = this.session.getSessionId();

    await this.adapter.sendMessage({
      chatId: msg.chatId,
      text: `*Session Status*\n\nActive: ${alive ? "Yes" : "No"}\nSession ID: \`${sessionId || "none"}\`\nUptime: ${uptime}s\nModel: \`${this.session.getModel()}\`\nCWD: \`${this.session.getCwd()}\``,
    });
  }

  private async handleSkill(msg: IncomingMessage, args: string): Promise<void> {
    const parts = args.split(" ");
    const action = parts[0]?.toLowerCase();

    if (action === "add" && parts.length >= 3) {
      const name = parts[1];
      const prompt = parts.slice(2).join(" ");
      this.skills.add({ name, prompt });
      await this.adapter.sendMessage({
        chatId: msg.chatId,
        text: `Skill "${name}" added.`,
      });
    } else if (action === "remove" && parts[1]) {
      const removed = this.skills.remove(parts[1]);
      await this.adapter.sendMessage({
        chatId: msg.chatId,
        text: removed ? `Skill "${parts[1]}" removed.` : `Skill "${parts[1]}" not found.`,
      });
    } else if (action === "list" || !action) {
      const skills = this.skills.list();
      if (skills.length === 0) {
        await this.adapter.sendMessage({
          chatId: msg.chatId,
          text: "No skills configured. Use `/skill add <name> <prompt>` to add one.",
        });
      } else {
        const list = skills.map((s) => `• *${s.name}*: ${s.prompt.slice(0, 50)}...`).join("\n");
        await this.adapter.sendMessage({
          chatId: msg.chatId,
          text: `*Skills*\n\n${list}`,
        });
      }
    } else {
      await this.adapter.sendMessage({
        chatId: msg.chatId,
        text: "Usage:\n`/skill add <name> <prompt>`\n`/skill remove <name>`\n`/skill list`",
      });
    }
  }

  private async handleModel(msg: IncomingMessage, args: string): Promise<void> {
    if (!args.trim()) {
      await this.adapter.sendMessage({
        chatId: msg.chatId,
        text: `Current model: \`${this.session.getModel()}\`\n\nUsage: \`/model <model-id>\``,
      });
      return;
    }

    this.session.updateOptions({ model: args.trim() });
    await this.adapter.sendMessage({
      chatId: msg.chatId,
      text: `Model updated to \`${args.trim()}\`. Will apply on next session restart or /reset.`,
    });
  }

  private async handleCwd(msg: IncomingMessage, args: string): Promise<void> {
    if (!args.trim()) {
      await this.adapter.sendMessage({
        chatId: msg.chatId,
        text: `Current directory: \`${this.session.getCwd()}\`\n\nUsage: \`/cwd <path>\``,
      });
      return;
    }

    this.session.updateOptions({ cwd: args.trim() });
    await this.adapter.sendMessage({
      chatId: msg.chatId,
      text: `Working directory updated to \`${args.trim()}\`. Will apply on next session restart or /reset.`,
    });
  }

  private async handleHelp(msg: IncomingMessage): Promise<void> {
    await this.adapter.sendMessage({
      chatId: msg.chatId,
      text: `*Droid Bot Commands*

/start - Initialize bot
/reset - Reset session (fresh conversation)
/status - Show session info
/model <id> - Change AI model
/cwd <path> - Change working directory
/skill add <name> <prompt> - Add skill
/skill remove <name> - Remove skill
/skill list - List skills
/help - Show this message

Just send any message to chat with Droid!`,
    });
  }

  protected async handleMessage(msg: IncomingMessage): Promise<void> {
    // Prevent concurrent processing for same chat
    if (this.processingChats.has(msg.chatId)) {
      await this.adapter.sendMessage({
        chatId: msg.chatId,
        text: "Still processing previous request...",
      });
      return;
    }

    this.processingChats.add(msg.chatId);

    try {
      // Check for skill trigger
      let prompt = msg.text;
      const matchedSkill = this.skills.findByTrigger(msg.text);
      if (matchedSkill) {
        prompt = this.skills.applySkill(matchedSkill, msg.text);
      }

      // Send initial status
      const statusMsgId = await this.adapter.sendMessage({
        chatId: msg.chatId,
        text: "Thinking...",
      });

      let lastToolCall = "";
      let finalText = "";

      // Stream events from droid
      for await (const event of this.session.send(prompt)) {
        await this.handleDroidEvent(event, msg.chatId, statusMsgId, lastToolCall);

        if (event.type === "tool_call") {
          lastToolCall = this.formatToolCall(event);
        }

        if (event.type === "completion") {
          finalText = event.finalText;
        }
      }

      // Send final response
      if (finalText) {
        await this.adapter.editMessage({
          chatId: msg.chatId,
          messageId: statusMsgId,
          text: finalText,
        });
      }
    } catch (err) {
      console.error("[DroidBot] Error:", err);
      await this.adapter.sendMessage({
        chatId: msg.chatId,
        text: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    } finally {
      this.processingChats.delete(msg.chatId);
    }
  }

  private async handleDroidEvent(
    event: DroidEvent,
    chatId: string,
    statusMsgId: string,
    lastToolCall: string
  ): Promise<void> {
    if (event.type === "tool_call") {
      const status = this.formatToolCall(event);
      await this.adapter.editMessage({
        chatId,
        messageId: statusMsgId,
        text: status,
      });
      await this.adapter.sendTypingIndicator(chatId);
    }
  }

  private formatToolCall(event: DroidEvent & { type: "tool_call" }): string {
    const tool = event.toolName;
    const params = event.parameters;

    switch (tool) {
      case "Execute":
        return `Running: \`${params.command}\``;
      case "Read":
        return `Reading: \`${params.file_path}\``;
      case "Grep":
        return `Searching: \`${params.pattern}\``;
      case "Glob":
        return `Finding files...`;
      case "Create":
        return `Creating: \`${params.file_path}\``;
      case "Edit":
        return `Editing: \`${params.file_path}\``;
      case "LS":
        return `Listing: \`${params.directory_path || "."}\``;
      default:
        return `Using ${tool}...`;
    }
  }
}
