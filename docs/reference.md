# Droid SDK Reference

Complete implementation guide and API reference for the Droid SDK.

## Table of Contents

- [Core Concepts](#core-concepts)
- [DroidSession](#droidsession)
- [DroidBot](#droidbot)
- [Bot Adapters](#bot-adapters)
- [Skills System](#skills-system)
- [Runtime Management](#runtime-management)
- [Event Types](#event-types)
- [Examples](#examples)

---

## Core Concepts

### Architecture Overview

The Droid SDK provides multiple layers of abstraction:

```
┌─────────────────────────────────────────────────────────┐
│                      Your Application                    │
├─────────────────────────────────────────────────────────┤
│  DroidBot          │  RuntimeManager  │  Direct Usage   │
│  (High-level bot)  │  (Task workers)  │  (DroidSession) │
├─────────────────────────────────────────────────────────┤
│                    DroidSession                          │
│              (Core droid process wrapper)                │
├─────────────────────────────────────────────────────────┤
│              Factory CLI (droid exec)                    │
└─────────────────────────────────────────────────────────┘
```

### Installation & Setup

```bash
npm install droid-sdk
```

Create a `.env` file:

```env
FACTORY_API_KEY=fk-your-api-key-here
DROID_MODEL=claude-sonnet-4-5-20250929
DROID_CWD=/path/to/your/project
DROID_REASONING=medium
DROID_AUTONOMY=high
```

---

## DroidSession

Low-level wrapper around `droid exec --stream-json`. Provides direct access to the droid process with streaming events.

### Basic Usage

```typescript
import { DroidSession } from 'droid-sdk';

const session = new DroidSession({
  model: 'claude-sonnet-4-5-20250929',
  cwd: process.cwd(),
  autonomyLevel: 'high',
  reasoningEffort: 'medium',
});

// Simple one-shot request
for await (const event of session.send('Analyze this codebase')) {
  if (event.type === 'completion') {
    console.log(event.finalText);
  }
}
```

### Configuration Options

```typescript
interface DroidSessionOptions {
  model?: string;                    // AI model to use
  reasoningEffort?: 'off' | 'low' | 'medium' | 'high';
  autonomyLevel?: 'low' | 'medium' | 'high';
  cwd?: string;                      // Working directory
  enabledTools?: string[];           // Whitelist tools (e.g., ['Read', 'Grep'])
  disabledTools?: string[];          // Blacklist tools
  systemPrompt?: string;             // Custom system prompt
}
```

### Multi-Turn Conversations

Sessions maintain context across multiple calls:

```typescript
const session = new DroidSession({
  model: 'claude-sonnet-4-5-20250929',
  cwd: '/my-project',
});

// First message
for await (const event of session.send('List all files')) {
  // Handle events...
}

// Second message - has context from first
for await (const event of session.send('Now find all TODOs in those files')) {
  // Droid remembers the file list from previous message
}

await session.close(); // Clean up
```

### Per-Request Overrides

Override options for individual requests:

```typescript
// Use different model for this specific request
for await (const event of session.send('Complex analysis task', {
  model: 'claude-opus-4',
  reasoningEffort: 'high',
})) {
  // Events use the override settings
}

// Next request uses session defaults again
for await (const event of session.send('Simple task')) {
  // Uses original session model
}
```

### Event Streaming

Handle all event types for real-time updates:

```typescript
for await (const event of session.send('Refactor the main module')) {
  switch (event.type) {
    case 'system':
      console.log(`Session started: ${event.session_id}`);
      console.log(`Available tools: ${event.tools.join(', ')}`);
      break;

    case 'message':
      console.log(`${event.role}: ${event.text}`);
      break;

    case 'tool_call':
      console.log(`→ Using ${event.toolName}`);
      console.log(`   Params:`, event.parameters);
      break;

    case 'tool_result':
      console.log(`← ${event.toolName} result:`);
      console.log(event.value.substring(0, 200));
      break;

    case 'completion':
      console.log('\n✓ Done!');
      console.log(`Turns: ${event.numTurns}`);
      console.log(`Duration: ${event.durationMs}ms`);
      break;
  }
}
```

### Tool Control

Restrict which tools droid can use:

```typescript
// Only allow read-only operations
const session = new DroidSession({
  enabledTools: ['Read', 'Grep', 'Glob', 'LS'],
});

// Disable potentially destructive tools
const safeSession = new DroidSession({
  disabledTools: ['Execute', 'Edit', 'Create'],
});

// Per-request tool control
for await (const event of session.send('Analyze code', {
  enabledTools: ['Read', 'Grep'], // Temporary restriction
})) {
  // ...
}
```

### Spec Mode

Plan before executing:

```typescript
for await (const event of session.send('Build a REST API', {
  useSpec: true,
  specModel: 'claude-sonnet-4-5-20250929',
  specReasoningEffort: 'high',
})) {
  // First generates a spec, then executes it
}
```

### Session Lifecycle Methods

```typescript
const session = new DroidSession();

// Check if session is active
if (session.isAlive()) {
  console.log('Session ID:', session.getSessionId());
  console.log('Uptime:', session.getUptime(), 'ms');
}

// Update configuration
session.updateOptions({
  model: 'claude-opus-4',
  cwd: '/new/project/path',
});

// Get current settings
console.log('Model:', session.getModel());
console.log('CWD:', session.getCwd());

// Clean up
await session.close();
```

### EventEmitter Interface

```typescript
const session = new DroidSession();

// Listen to all events
session.on('event', (event) => {
  console.log('Event:', event.type);
});

// Listen for session close
session.on('close', (code) => {
  console.log('Session closed with code:', code);
});

// Handle errors
session.on('error', (err) => {
  console.error('Session error:', err);
});

for await (const event of session.send('Do something')) {
  // Process events...
}
```

---

## DroidBot

High-level bot framework with built-in commands, platform adapters, and skills.

### Basic Setup

```typescript
import { DroidBot, TelegramAdapter } from 'droid-sdk';

const adapter = new TelegramAdapter(process.env.TELEGRAM_BOT_TOKEN!);

const bot = new DroidBot(adapter, {
  model: 'claude-sonnet-4-5-20250929',
  cwd: process.cwd(),
  reasoning: 'low',
  autonomy: 'high',
});

await bot.start();

// Graceful shutdown
process.on('SIGINT', async () => {
  await bot.stop();
  process.exit(0);
});
```

### Configuration

```typescript
interface DroidBotConfig {
  model?: string;        // AI model
  cwd?: string;          // Working directory
  reasoning?: 'off' | 'low' | 'medium' | 'high';
  autonomy?: 'low' | 'medium' | 'high';
}
```

### Built-in Commands

| Command | Usage | Description |
|---------|-------|-------------|
| `/start` | `/start` | Initialize bot, show welcome message |
| `/reset` | `/reset` | Reset session for fresh conversation |
| `/status` | `/status` | Show session info (ID, uptime, model) |
| `/model` | `/model claude-opus-4` | Change AI model |
| `/cwd` | `/cwd /new/path` | Change working directory |
| `/skill add` | `/skill add refactor "Focus on code quality"` | Add a skill |
| `/skill remove` | `/skill remove refactor` | Remove a skill |
| `/skill list` | `/skill list` | List all skills |
| `/help` | `/help` | Show available commands |

### Extending DroidBot

```typescript
class MyCustomBot extends DroidBot {
  constructor(adapter: BotAdapter, config: DroidBotConfig) {
    super(adapter, config);
    // Custom initialization
  }

  protected async handleMessage(msg: IncomingMessage): Promise<void> {
    // Add pre-processing
    if (msg.text.includes('urgent')) {
      await this.adapter.sendMessage({
        chatId: msg.chatId,
        text: 'Processing urgent request...',
      });
    }

    // Call parent handler
    await super.handleMessage(msg);
  }
}
```

---

## Bot Adapters

Adapters implement the `BotAdapter` interface to connect DroidBot to different platforms.

### BotAdapter Interface

```typescript
interface BotAdapter {
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
```

### Telegram Adapter

```typescript
import { TelegramAdapter } from 'droid-sdk';

const adapter = new TelegramAdapter(process.env.TELEGRAM_BOT_TOKEN!);

// Manual usage (without DroidBot)
adapter.onCommand('hello', async (msg, args) => {
  await adapter.sendMessage({
    chatId: msg.chatId,
    text: `Hello ${msg.userId}!`,
  });
});

adapter.onMessage(async (msg) => {
  await adapter.sendMessage({
    chatId: msg.chatId,
    text: `You said: ${msg.text}`,
  });
});

await adapter.start();
```

### Custom Adapter

```typescript
import { BotAdapter, IncomingMessage, OutgoingMessage, StatusUpdate } from 'droid-sdk';

class SlackAdapter implements BotAdapter {
  readonly platform = 'slack';
  private slackClient: any;

  constructor(token: string) {
    // Initialize Slack SDK
  }

  async start(): Promise<void> {
    // Connect to Slack
  }

  async stop(): Promise<void> {
    // Disconnect
  }

  async sendMessage(message: OutgoingMessage): Promise<string> {
    // Send to Slack, return message ID
    const result = await this.slackClient.chat.postMessage({
      channel: message.chatId,
      text: message.text,
    });
    return result.ts;
  }

  async editMessage(update: StatusUpdate): Promise<void> {
    // Update message in Slack
  }

  async sendTypingIndicator(chatId: string): Promise<void> {
    // Show typing indicator
  }

  onMessage(handler: (message: IncomingMessage) => Promise<void>): void {
    // Register message handler
  }

  onCommand(
    command: string,
    handler: (message: IncomingMessage, args: string) => Promise<void>
  ): void {
    // Register command handler
  }
}
```

---

## Skills System

Skills are reusable prompt templates that can be triggered automatically or manually.

### Skill Structure

```typescript
interface Skill {
  name: string;           // Unique identifier
  description?: string;   // Human-readable description
  trigger?: string;       // Regex pattern for auto-trigger
  prompt: string;         // The prompt to prepend
}
```

### Using Skills

```typescript
import { SkillsManager } from 'droid-sdk';

const skills = new SkillsManager();

// Add a skill
skills.add({
  name: 'refactor',
  description: 'Code refactoring mode',
  trigger: 'refactor|improve|clean up',
  prompt: `You are a code refactoring expert. Focus on:
- Improving readability
- Reducing complexity
- Following best practices
- Maintaining functionality`,
});

// Add another skill
skills.add({
  name: 'docs',
  description: 'Documentation mode',
  trigger: 'document|docs|readme',
  prompt: `You are a technical documentation expert. Create clear,
concise documentation with examples.`,
});

// List all skills
const allSkills = skills.list();
console.log(allSkills);

// Find matching skill
const message = 'Can you refactor this function?';
const matchedSkill = skills.findByTrigger(message);

if (matchedSkill) {
  const prompt = skills.applySkill(matchedSkill, message);
  // Send prompt to droid...
}
```

### Skills with DroidBot

Skills in DroidBot are managed via bot commands:

```
/skill add refactor "You are a refactoring expert..."
/skill list
/skill remove refactor
```

When a user sends a message matching a skill's trigger pattern, the skill prompt is automatically prepended.

### Persistence

Skills are automatically saved to `~/.droid-bot/skills.json`:

```json
{
  "skills": [
    {
      "name": "refactor",
      "description": "Code refactoring mode",
      "trigger": "refactor|improve|clean up",
      "prompt": "You are a code refactoring expert..."
    }
  ]
}
```

---

## Runtime Management

Runtime Management provides a higher-level abstraction for managing multiple concurrent AI tasks.

### Runtime

A `Runtime` represents a single AI task execution with lifecycle management:

```typescript
import { Runtime, RuntimeConfig } from 'droid-sdk';

const config: RuntimeConfig = {
  name: 'Code Analyzer',
  model: 'claude-sonnet-4-5-20250929',
  reasoning: 'medium',
  autonomy: 'high',
  systemPrompt: 'You are a code analysis expert.',
};

const runtime = new Runtime('rt-001', config, 'Analyze codebase', '/my-project');

// Execute task
for await (const event of runtime.run()) {
  console.log(event.type);
}

// Check status
console.log(runtime.status);
console.log(runtime.isActive());   // true if running or idle
console.log(runtime.isReady());    // true if active and not processing

// Send follow-up message
for await (const event of runtime.send('What about the tests?')) {
  // Continues conversation...
}

// Clean up
await runtime.close();
```

### RuntimeManager

Manage multiple runtimes:

```typescript
import { RuntimeManager } from 'droid-sdk';

const manager = new RuntimeManager('/projects');

// Spawn a new runtime
const id = await manager.spawn({
  name: 'Bug Fixer',
  model: 'claude-sonnet-4-5-20250929',
}, 'Fix the authentication bug');

// Listen for events
manager.on('event', (id, event) => {
  console.log(`[${id}] ${event.type}`);
});

manager.on('complete', (id, result) => {
  console.log(`[${id}] Completed:`, result.summary);
});

manager.on('error', (id, error) => {
  console.error(`[${id}] Error:`, error.message);
});

// Interact with running runtime
for await (const event of manager.send(id, 'Also check the tests')) {
  // ...
}

// List all runtimes
const statuses = manager.list();
for (const status of statuses) {
  console.log(`${status.id}: ${status.status} (${status.model})`);
}

// Get specific runtime info
const status = manager.get(id);
const result = manager.getResult(id);
const history = manager.getHistory(id);

// Check state
console.log(manager.isActive(id));
console.log(manager.isReady(id));

// Cancel running runtime
await manager.cancel(id);

// Close runtime
await manager.close(id);

// Clean up old runtimes
manager.prune(10); // Keep only 10 most recent inactive runtimes
```

---

## Event Types

### SystemEvent

```typescript
interface SystemEvent {
  type: 'system';
  subtype: 'init';
  cwd: string;
  session_id: string;
  tools: string[];
  model: string;
  timestamp?: number;
}
```

### MessageEvent

```typescript
interface MessageEvent {
  type: 'message';
  role: 'user' | 'assistant';
  id: string;
  text: string;
  timestamp: number;
  session_id: string;
}
```

### ToolCallEvent

```typescript
interface ToolCallEvent {
  type: 'tool_call';
  id: string;
  messageId: string;
  toolId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  timestamp: number;
  session_id: string;
}
```

### ToolResultEvent

```typescript
interface ToolResultEvent {
  type: 'tool_result';
  id: string;
  messageId: string;
  toolId: string;
  isError: boolean;
  value: string;
  timestamp: number;
  session_id: string;
}
```

### CompletionEvent

```typescript
interface CompletionEvent {
  type: 'completion';
  finalText: string;
  numTurns: number;
  durationMs: number;
  session_id: string;
  timestamp: number;
}
```

---

## Examples

### Example 1: File Analysis Tool

```typescript
import { DroidSession } from 'droid-sdk';
import { writeFile } from 'fs/promises';

async function analyzeProject(projectPath: string) {
  const session = new DroidSession({
    model: 'claude-sonnet-4-5-20250929',
    cwd: projectPath,
    autonomyLevel: 'low', // Safer for analysis
  });

  let analysis = '';

  for await (const event of session.send(`
    Analyze this codebase and provide:
    1. Project structure overview
    2. Main technologies used
    3. Potential areas for improvement
    4. Any security concerns
  `)) {
    if (event.type === 'tool_call') {
      console.log(`Analyzing: ${event.toolName}`);
    }
    if (event.type === 'completion') {
      analysis = event.finalText;
    }
  }

  await session.close();

  // Save analysis
  await writeFile('analysis.md', analysis);
  console.log('Analysis saved to analysis.md');

  return analysis;
}

analyzeProject('/path/to/project').catch(console.error);
```

### Example 2: Automated Testing Bot

```typescript
import { DroidBot, TelegramAdapter } from 'droid-sdk';

class TestingBot extends DroidBot {
  protected async handleMessage(msg: IncomingMessage): Promise<void> {
    // Auto-detect test requests
    if (msg.text.match(/test|spec|coverage/i)) {
      // Prepend testing context
      const testPrompt = `Focus on comprehensive testing:
- Unit tests for edge cases
- Integration tests
- Error handling tests
- Mock external dependencies

Task: ${msg.text}`;

      // Override with modified message
      msg = { ...msg, text: testPrompt };
    }

    await super.handleMessage(msg);
  }
}

const adapter = new TelegramAdapter(process.env.TELEGRAM_BOT_TOKEN!);
const bot = new TestingBot(adapter, {
  model: 'claude-sonnet-4-5-20250929',
  cwd: process.env.PROJECT_ROOT,
  autonomy: 'medium',
});

await bot.start();
```

### Example 3: Multi-Runtime Dashboard

```typescript
import { RuntimeManager } from 'droid-sdk';
import express from 'express';

const app = express();
const manager = new RuntimeManager('/projects');

// Spawn a new task
app.post('/tasks', async (req, res) => {
  const { name, task } = req.body;

  const id = await manager.spawn({
    name,
    model: 'claude-sonnet-4-5-20250929',
  }, task);

  res.json({ id, status: 'started' });
});

// Get all tasks
app.get('/tasks', (req, res) => {
  const tasks = manager.list();
  res.json(tasks);
});

// Get task result
app.get('/tasks/:id/result', (req, res) => {
  const result = manager.getResult(req.params.id);
  res.json(result || { error: 'Not found' });
});

// Send message to running task
app.post('/tasks/:id/message', async (req, res) => {
  const { message } = req.body;

  const events = [];
  for await (const event of manager.send(req.params.id, message)) {
    events.push(event);
  }

  res.json({ events });
});

// WebSocket for real-time updates
io.on('connection', (socket) => {
  manager.on('event', (id, event) => {
    socket.emit('event', { id, event });
  });

  manager.on('complete', (id, result) => {
    socket.emit('complete', { id, result });
  });
});

app.listen(3000);
```

### Example 4: Custom Skill for Code Review

```typescript
import { DroidBot, SkillsManager } from 'droid-sdk';

// Create skills programmatically
const skills = new SkillsManager();

skills.add({
  name: 'security-review',
  description: 'Security-focused code review',
  trigger: 'security|audit|vulnerability',
  prompt: `Perform a security audit focusing on:
- Input validation
- SQL injection risks
- XSS vulnerabilities
- Authentication/authorization flaws
- Sensitive data exposure
- Dependency vulnerabilities

Provide specific line references and remediation suggestions.`,
});

skills.add({
  name: 'performance-review',
  description: 'Performance optimization review',
  trigger: 'performance|optimize|slow|memory',
  prompt: `Analyze for performance issues:
- Algorithmic complexity
- Memory leaks
- Inefficient loops
- Database query optimization
- Caching opportunities
- Async/await usage

Include before/after code examples.`,
});

// Use with DroidSession
const session = new DroidSession();

const userMessage = 'Can you do a security review of auth.js?';
const skill = skills.findByTrigger(userMessage);

if (skill) {
  const prompt = skills.applySkill(skill, userMessage);
  // prompt now includes the security review instructions + user message

  for await (const event of session.send(prompt)) {
    // ...
  }
}
```

### Example 5: Progress Tracking with Status Updates

```typescript
import { DroidBot, TelegramAdapter } from 'droid-sdk';

class ProgressTrackingBot extends DroidBot {
  protected async handleDroidEvent(
    event: DroidEvent,
    chatId: string,
    statusMsgId: string,
    lastToolCall: string
  ): Promise<void> {
    // Custom status messages
    const statusMessages: Record<string, string> = {
      Execute: 'Running command...',
      Read: 'Reading file...',
      Grep: 'Searching code...',
      Glob: 'Finding files...',
      Create: 'Creating file...',
      Edit: 'Modifying file...',
      LS: 'Listing directory...',
    };

    if (event.type === 'tool_call') {
      const message = statusMessages[event.toolName] || `Using ${event.toolName}...`;

      // Add progress indicator
      const progress = this.getProgressIndicator();

      await this.adapter.editMessage({
        chatId,
        messageId: statusMsgId,
        text: `${message} ${progress}`,
      });
    }

    await this.adapter.sendTypingIndicator(chatId);
  }

  private getProgressIndicator(): string {
    const indicators = ['⏳', '⌛', '⏱️', '⏲️'];
    return indicators[Math.floor(Date.now() / 1000) % indicators.length];
  }
}
```

---

## Best Practices

### Security

1. **Use `autonomyLevel: 'low'`** for untrusted inputs
2. **Whitelist tools** with `enabledTools` for restricted environments
3. **Validate paths** before passing to `cwd` option
4. **Sanitize user input** before sending to droid

### Performance

1. **Reuse sessions** for related tasks (maintains context)
2. **Close sessions** when done to free resources
3. **Use RuntimeManager.prune()** to clean up old runtimes
4. **Choose appropriate models** (smaller models for simple tasks)

### Error Handling

```typescript
const session = new DroidSession();

try {
  for await (const event of session.send('Task')) {
    // ...
  }
} catch (err) {
  if (err.message.includes('droid: command not found')) {
    console.error('Factory CLI not installed');
  } else if (err.message.includes('FACTORY_API_KEY')) {
    console.error('API key not configured');
  } else {
    console.error('Droid error:', err);
  }
} finally {
  await session.close();
}
```

### Testing

```typescript
import { DroidSession } from 'droid-sdk';

// Mock for testing
class MockDroidSession {
  async *send(prompt: string) {
    yield { type: 'system', subtype: 'init', session_id: 'test-123', tools: [], model: 'test', cwd: '/test' };
    yield { type: 'completion', finalText: 'Mock response', numTurns: 1, durationMs: 100, session_id: 'test-123', timestamp: Date.now() };
  }

  async close() {}
  isAlive() { return true; }
}

// Use dependency injection for testability
function createService(sessionClass: typeof DroidSession) {
  return {
    async analyze() {
      const session = new sessionClass();
      // ...
    },
  };
}
```

---

## Troubleshooting

### Common Issues

**"droid: command not found"**
- Install Factory CLI: `npm install -g @factoryai/cli`
- Or download from [docs.factory.ai](https://docs.factory.ai)

**"FACTORY_API_KEY not set"**
- Set environment variable: `export FACTORY_API_KEY=fk-...`
- Or create `.env` file with the key

**Session not maintaining context**
- Don't call `session.close()` between related requests
- Ensure you're using the same session instance

**Large outputs truncated**
- Telegram has a 4096 character limit (handled automatically)
- For other platforms, implement pagination

**Tool calls failing**
- Check `cwd` is set correctly
- Verify file paths exist
- Check tool is not in `disabledTools`

---

For more information, visit the [GitHub repository](https://github.com/codyde/droid-sdk).
