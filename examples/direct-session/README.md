# Direct Session Example

Shows how to use `DroidSession` directly for custom integrations.

## When to Use

Use `DroidSession` directly when:
- Building a custom chat interface (not Telegram/Discord)
- Integrating into an existing application
- Need fine-grained control over events
- Building automation scripts

Use `DroidBot` when:
- Building a Telegram/Discord bot
- Want built-in commands (/reset, /status, etc.)
- Want the skills system

## Run

```bash
npm install
npm start
```

## Key Concepts

```typescript
// Create session with options
const session = new DroidSession({
  model: "claude-sonnet-4-5-20250929",
  cwd: "/path/to/project",
  autonomyLevel: "high",
});

// Session persists across multiple send() calls
// Context is maintained (multi-turn conversation)

for await (const event of session.send("first message")) {
  // Handle events...
}

for await (const event of session.send("follow-up that references first")) {
  // Still has context from first message
}

// Always close when done
await session.close();
```

## Event Types

| Event | Description |
|-------|-------------|
| `system` | Session initialized with tools/model info |
| `message` | User or assistant text |
| `tool_call` | Droid is calling a tool (Read, Execute, etc.) |
| `tool_result` | Result from tool execution |
| `completion` | Final response with `finalText` |
