# Droid SDK

[![npm version](https://img.shields.io/npm/v/@openbuilder/droid-sdk.svg)](https://www.npmjs.com/package/@openbuilder/droid-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

TypeScript SDK for Factory Droid - build AI-powered bots and applications.

## Overview

Droid SDK provides a powerful, type-safe interface for building AI-powered applications using Factory Droid. Whether you need low-level session control for custom integrations or a full-featured chatbot with built-in commands, this SDK has you covered.

## Features

- **DroidSession** - Low-level API for direct droid process control with streaming events
- **DroidBot** - High-level bot framework with built-in commands and skills
- **Platform Adapters** - Ready-to-use Telegram adapter (Discord coming soon)
- **Skills System** - Extensible skill framework for reusable prompt templates
- **Runtime Management** - Manage multiple concurrent AI runtimes
- **Full TypeScript Support** - Complete type definitions for all APIs

## Installation

```bash
npm install droid-sdk
```

**Prerequisites:**
- Node.js 18+
- [Factory CLI](https://docs.factory.ai/cli/getting-started/quickstart) installed and authenticated
- `FACTORY_API_KEY` environment variable set

## Quick Start

### Direct Session Usage

```typescript
import { DroidSession } from 'droid-sdk';

const session = new DroidSession({
  model: 'claude-sonnet-4-5-20250929',
  cwd: '/path/to/project',
  autonomyLevel: 'high',
});

for await (const event of session.send('List all TypeScript files')) {
  if (event.type === 'tool_call') {
    console.log(`Using: ${event.toolName}`);
  }
  if (event.type === 'completion') {
    console.log(event.finalText);
  }
}
```

### Telegram Bot

```typescript
import { DroidBot, TelegramAdapter } from 'droid-sdk';

const adapter = new TelegramAdapter(process.env.TELEGRAM_BOT_TOKEN!);
const bot = new DroidBot(adapter, {
  model: 'claude-sonnet-4-5-20250929',
  cwd: '/path/to/project',
});

await bot.start();
```

### CLI Usage

```bash
# Install globally
npm install -g droid-sdk

# Or run with npx
npx droid-sdk

# Configure via environment
export TELEGRAM_BOT_TOKEN=your-token
export FACTORY_API_KEY=fk-...
export DROID_CWD=/path/to/projects

droid-bot
```

## Documentation

- **[Implementation Reference](./reference)** - Complete API documentation with examples

## Bot Commands

When using `DroidBot`, the following commands are available:

| Command | Description |
|---------|-------------|
| `/start` | Initialize bot |
| `/reset` | Reset session (fresh conversation) |
| `/status` | Show session info |
| `/model <id>` | Change AI model |
| `/cwd <path>` | Change working directory |
| `/skill add <name> <prompt>` | Add custom skill |
| `/skill remove <name>` | Remove skill |
| `/skill list` | List skills |
| `/help` | Show help message |

## Environment Variables

```env
# Platform
BOT_PLATFORM=telegram          # telegram | discord (coming soon)
TELEGRAM_BOT_TOKEN=your-token

# Droid Configuration
FACTORY_API_KEY=fk-...
DROID_MODEL=claude-sonnet-4-5-20250929
DROID_CWD=/path/to/projects
DROID_REASONING=low            # off | low | medium | high
DROID_AUTONOMY=high            # low | medium | high
```

## License

MIT License - see [LICENSE](https://github.com/codyde/droid-sdk/blob/main/LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Built with ❤️ for the Factory Droid ecosystem.
