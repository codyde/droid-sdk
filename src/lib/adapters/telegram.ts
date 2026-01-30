import type {
  BotAdapter,
  IncomingMessage,
  OutgoingMessage,
  StatusUpdate,
} from "./types.js";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number };
    from?: { id: number };
    text?: string;
    entities?: Array<{ type: string; offset: number; length: number }>;
  };
}

interface TelegramResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
}

export class TelegramAdapter implements BotAdapter {
  readonly platform = "telegram";
  private token: string;
  private baseUrl: string;
  private polling = false;
  private offset = 0;
  private messageHandler: ((message: IncomingMessage) => Promise<void>) | null = null;
  private commandHandlers = new Map<string, (message: IncomingMessage, args: string) => Promise<void>>();

  constructor(token: string) {
    this.token = token;
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async start(): Promise<void> {
    // Verify token
    const me = await this.apiCall<{ id: number; username: string }>("getMe");
    console.log(`[Telegram] Bot started: @${me.username}`);

    this.polling = true;
    this.poll();
  }

  async stop(): Promise<void> {
    this.polling = false;
  }

  private async poll(): Promise<void> {
    while (this.polling) {
      try {
        const updates = await this.apiCall<TelegramUpdate[]>("getUpdates", {
          offset: this.offset,
          timeout: 30,
        });

        for (const update of updates) {
          this.offset = update.update_id + 1;
          await this.handleUpdate(update);
        }
      } catch (err) {
        console.error("[Telegram] Polling error:", err);
        await this.sleep(5000);
      }
    }
  }

  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    const msg = update.message;
    if (!msg?.text) return;

    const incoming: IncomingMessage = {
      id: msg.message_id.toString(),
      chatId: msg.chat.id.toString(),
      userId: msg.from?.id.toString() || "unknown",
      text: msg.text,
      platform: "telegram",
    };

    // Check for commands
    const botCommand = msg.entities?.find((e) => e.type === "bot_command" && e.offset === 0);
    if (botCommand) {
      const commandText = msg.text.slice(0, botCommand.length).toLowerCase();
      const command = commandText.split("@")[0].slice(1); // Remove / and @botname
      const args = msg.text.slice(botCommand.length).trim();

      const handler = this.commandHandlers.get(command);
      if (handler) {
        await handler(incoming, args);
        return;
      }
    }

    // Regular message
    if (this.messageHandler) {
      await this.messageHandler(incoming);
    }
  }

  async sendMessage(message: OutgoingMessage): Promise<string> {
    const html = this.markdownToHtml(message.text);
    try {
      const result = await this.apiCall<{ message_id: number }>("sendMessage", {
        chat_id: message.chatId,
        text: this.truncate(html),
        reply_to_message_id: message.replyToMessageId,
        parse_mode: "HTML",
      });
      return result.message_id.toString();
    } catch (err) {
      if (err instanceof Error && err.message.includes("can't parse entities")) {
        // Retry without formatting
        const result = await this.apiCall<{ message_id: number }>("sendMessage", {
          chat_id: message.chatId,
          text: this.truncate(this.stripMarkdown(message.text)),
          reply_to_message_id: message.replyToMessageId,
        });
        return result.message_id.toString();
      }
      throw err;
    }
  }

  async editMessage(update: StatusUpdate): Promise<void> {
    const html = this.markdownToHtml(update.text);
    try {
      await this.apiCall("editMessageText", {
        chat_id: update.chatId,
        message_id: parseInt(update.messageId),
        text: this.truncate(html),
        parse_mode: "HTML",
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes("message is not modified")) {
        return;
      }
      if (err instanceof Error && err.message.includes("can't parse entities")) {
        try {
          await this.apiCall("editMessageText", {
            chat_id: update.chatId,
            message_id: parseInt(update.messageId),
            text: this.truncate(this.stripMarkdown(update.text)),
          });
          return;
        } catch {
          // Ignore fallback errors
        }
      }
      console.error("[Telegram] Edit failed:", err);
    }
  }

  async sendTypingIndicator(chatId: string): Promise<void> {
    await this.apiCall("sendChatAction", {
      chat_id: chatId,
      action: "typing",
    });
  }

  onMessage(handler: (message: IncomingMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  onCommand(
    command: string,
    handler: (message: IncomingMessage, args: string) => Promise<void>
  ): void {
    this.commandHandlers.set(command.toLowerCase(), handler);
  }

  private async apiCall<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}/${method}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: params ? JSON.stringify(params) : undefined,
    });

    const data = (await response.json()) as TelegramResponse<T>;

    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }

    return data.result;
  }

  private truncate(text: string, maxLength = 4096): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + "...";
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  private markdownToHtml(text: string): string {
    // First escape HTML entities in the raw text
    let result = this.escapeHtml(text);
    
    // Convert code blocks: ```lang\ncode\n``` -> <pre><code>code</code></pre>
    result = result.replace(/```[\w]*\n([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
    // Handle unclosed code blocks
    result = result.replace(/```[\w]*\n([\s\S]*)$/, "<pre><code>$1</code></pre>");
    
    // Convert inline code: `code` -> <code>code</code>
    result = result.replace(/`([^`]+)`/g, "<code>$1</code>");
    
    // Convert bold: *text* or **text** -> <b>text</b>
    result = result.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    result = result.replace(/\*([^*]+)\*/g, "<b>$1</b>");
    
    // Convert italic: _text_ -> <i>text</i>
    result = result.replace(/_([^_]+)_/g, "<i>$1</i>");
    
    return result;
  }

  private stripMarkdown(text: string): string {
    return text
      .replace(/```[\w]*\n?/g, "")
      .replace(/`/g, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/_/g, "");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
