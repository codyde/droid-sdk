#!/usr/bin/env node
import { TelegramAdapter, DroidBot } from "../lib/index.js";
import { config } from "./config.js";

async function main() {
  let adapter;

  switch (config.platform) {
    case "telegram":
      if (!config.telegram.token) {
        console.error("TELEGRAM_BOT_TOKEN is required");
        process.exit(1);
      }
      adapter = new TelegramAdapter(config.telegram.token);
      break;

    case "discord":
      console.error("Discord adapter not yet implemented. Coming soon!");
      process.exit(1);

    default:
      console.error(`Unknown platform: ${config.platform}`);
      process.exit(1);
  }

  const bot = new DroidBot(adapter, {
    model: config.droid.model,
    cwd: config.droid.cwd,
    reasoning: config.droid.reasoning,
    autonomy: config.droid.autonomy,
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await bot.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\nShutting down...");
    await bot.stop();
    process.exit(0);
  });

  await bot.start();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
