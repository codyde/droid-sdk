/**
 * Direct DroidSession example
 * 
 * Shows how to use the low-level DroidSession API for custom integrations.
 * This is useful when you want full control over the droid interaction
 * without the bot abstraction.
 */

import "dotenv/config";
import { DroidSession } from "droid-sdk";

async function main() {
  const session = new DroidSession({
    model: "claude-sonnet-4-5-20250929",
    cwd: process.cwd(),
    autonomyLevel: "medium", // Can install deps, run builds
    reasoningEffort: "low",
  });

  console.log("Starting droid session...\n");

  // First prompt - analyze the project
  console.log("User: What files are in the current directory?\n");
  
  for await (const event of session.send("What files are in the current directory?")) {
    switch (event.type) {
      case "system":
        console.log(`[Session started: ${event.session_id}]`);
        break;
      case "tool_call":
        console.log(`[Tool: ${event.toolName}]`);
        break;
      case "completion":
        console.log(`\nDroid: ${event.finalText}\n`);
        console.log(`[Completed in ${event.durationMs}ms, ${event.numTurns} turns]\n`);
        break;
    }
  }

  // Second prompt - builds on context from first
  console.log("---\nUser: Create a hello.txt file with 'Hello from Droid!'\n");

  for await (const event of session.send("Create a hello.txt file with 'Hello from Droid!'")) {
    switch (event.type) {
      case "tool_call":
        console.log(`[Tool: ${event.toolName}]`);
        break;
      case "completion":
        console.log(`\nDroid: ${event.finalText}\n`);
        break;
    }
  }

  // Clean up
  await session.close();
  console.log("Session closed.");
}

main().catch(console.error);
