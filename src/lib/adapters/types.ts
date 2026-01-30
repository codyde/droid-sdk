export interface IncomingMessage {
  id: string;
  chatId: string;
  userId: string;
  text: string;
  platform: "telegram" | "discord" | "cli";
}

export interface OutgoingMessage {
  chatId: string;
  text: string;
  replyToMessageId?: string;
}

export interface StatusUpdate {
  chatId: string;
  messageId: string;
  text: string;
}

export interface BotAdapter {
  readonly platform: string;

  start(): Promise<void>;
  stop(): Promise<void>;

  sendMessage(message: OutgoingMessage): Promise<string>; // Returns message ID
  editMessage(update: StatusUpdate): Promise<void>;
  sendTypingIndicator(chatId: string): Promise<void>;

  onMessage(handler: (message: IncomingMessage) => Promise<void>): void;
  onCommand(
    command: string,
    handler: (message: IncomingMessage, args: string) => Promise<void>
  ): void;
}
