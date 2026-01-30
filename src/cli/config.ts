import { config as loadEnv } from "dotenv";

loadEnv();

export const config = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || "",
  },
  discord: {
    token: process.env.DISCORD_BOT_TOKEN || "",
  },
  droid: {
    model: process.env.DROID_MODEL || "claude-sonnet-4-5-20250929",
    cwd: process.env.DROID_CWD || process.cwd(),
    reasoning: (process.env.DROID_REASONING || "low") as "off" | "low" | "medium" | "high",
    autonomy: (process.env.DROID_AUTONOMY || "high") as "low" | "medium" | "high",
  },
  platform: process.env.BOT_PLATFORM || "telegram",
};
