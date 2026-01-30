import "dotenv/config";
import { DroidBot, TelegramAdapter } from "droid-sdk";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is required");
  process.exit(1);
}

const adapter = new TelegramAdapter(token);

const bot = new DroidBot(adapter, {
  model: process.env.DROID_MODEL || "claude-sonnet-4-5-20250929",
  cwd: process.env.DROID_CWD || process.cwd(),
  reasoning: "low",
  autonomy: "high",
});

process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  await bot.stop();
  process.exit(0);
});

console.log("Starting Telegram bot...");
await bot.start();
