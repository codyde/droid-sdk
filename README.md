# droid-sdk

TypeScript SDK for Factory Droid - build AI-powered bots and applications.

## Installation

```bash
npm install droid-sdk
```

**Prerequisites:**
- Node.js 18+
- [Factory CLI](https://docs.factory.ai/cli/getting-started/quickstart) installed and authenticated
- `FACTORY_API_KEY` environment variable set

## Usage

### As a Library

```typescript
import { DroidSession, DroidBot, TelegramAdapter } from 'droid-sdk';

// Low-level: Direct session control
const session = new DroidSession({
  model: 'claude-sonnet-4-5-20250929',
  cwd: '/path/to/project',
  autonomyLevel: 'high',
});

await session.start();

for await (const event of session.send('List all TypeScript files')) {
  if (event.type === 'tool_call') {
    console.log(`Using: ${event.toolName}`);
  }
  if (event.type === 'completion') {
    console.log(event.finalText);
  }
}

// High-level: Full bot with Telegram
const adapter = new TelegramAdapter(process.env.TELEGRAM_BOT_TOKEN!);
const bot = new DroidBot(adapter, {
  model: 'claude-sonnet-4-5-20250929',
  cwd: '/path/to/project',
});

await bot.start();
```

### As a CLI

```bash
# Install globally
npm install -g droid-sdk

# Or run with npx
npx droid-sdk

# Configure via environment variables
export TELEGRAM_BOT_TOKEN=your-token
export FACTORY_API_KEY=fk-...
export DROID_CWD=/path/to/projects

droid-bot
```

## API Reference

### DroidSession

Low-level wrapper around `droid exec --stream-jsonrpc`.

```typescript
const session = new DroidSession(options?: DroidSessionOptions);

interface DroidSessionOptions {
  model?: string;
  reasoningEffort?: 'off' | 'low' | 'medium' | 'high';
  autonomyLevel?: 'low' | 'medium' | 'high';
  cwd?: string;
  enabledTools?: string[];
  disabledTools?: string[];
}

// Methods
await session.start();
for await (const event of session.send(prompt)) { ... }
await session.close();
session.isAlive();
session.getSessionId();
```

### DroidBot

High-level bot with built-in commands and skills.

```typescript
const bot = new DroidBot(adapter: BotAdapter, config?: DroidBotConfig);

interface DroidBotConfig {
  model?: string;
  cwd?: string;
  reasoning?: 'off' | 'low' | 'medium' | 'high';
  autonomy?: 'low' | 'medium' | 'high';
}

await bot.start();
await bot.stop();
```

### Adapters

Implement `BotAdapter` to add new platforms:

```typescript
interface BotAdapter {
  readonly platform: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  sendMessage(message: OutgoingMessage): Promise<string>;
  editMessage(update: StatusUpdate): Promise<void>;
  sendTypingIndicator(chatId: string): Promise<void>;
  onMessage(handler: (msg: IncomingMessage) => Promise<void>): void;
  onCommand(cmd: string, handler: (msg: IncomingMessage, args: string) => Promise<void>): void;
}
```

Built-in: `TelegramAdapter`

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Initialize bot |
| `/reset` | Reset session |
| `/status` | Show session info |
| `/model <id>` | Change AI model |
| `/cwd <path>` | Change working directory |
| `/skill add <name> <prompt>` | Add custom skill |
| `/skill list` | List skills |
| `/help` | Show help |

## Environment Variables

```env
BOT_PLATFORM=telegram
TELEGRAM_BOT_TOKEN=your-token
FACTORY_API_KEY=fk-...
DROID_MODEL=claude-sonnet-4-5-20250929
DROID_CWD=/path/to/projects
DROID_REASONING=low
DROID_AUTONOMY=high
```

## Publishing to npm

```bash
# 1. Update version in package.json
npm version patch  # or minor/major

# 2. Build
npm run build

# 3. Publish
npm publish
```

## Project Structure

```
src/
├── lib/              # Library exports
│   ├── adapters/     # Platform adapters
│   ├── droid/        # DroidSession
│   ├── skills/       # Skills system
│   ├── bot.ts        # DroidBot class
│   └── index.ts      # Main exports
└── cli/              # CLI entry point
    ├── config.ts
    └── index.ts
```

## License

MIT
