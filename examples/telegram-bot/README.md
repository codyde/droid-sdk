# Telegram Bot Example

A simple Telegram bot using the droid-sdk.

## Setup

1. Get a bot token from [@BotFather](https://t.me/botfather)
2. Get a Factory API key from [Factory Settings](https://app.factory.ai/settings/api-keys)
3. Make sure you have the [Factory CLI](https://docs.factory.ai/cli/getting-started/quickstart) installed

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your tokens

# Run
npm start
```

## Usage

Once running, message your bot on Telegram:

- Send any message to chat with Droid
- `/start` - Initialize
- `/reset` - Fresh conversation  
- `/status` - Session info
- `/model claude-opus-4-5-20251101` - Change model
- `/cwd /path/to/project` - Change working directory
- `/skill add review You are a code reviewer...` - Add skill
- `/help` - All commands

## Example Conversation

```
You: Clone the repo https://github.com/user/project

Bot: 🔧 Running: git clone https://github.com/user/project
     Done! Cloned to ./project

You: What's in the src folder?

Bot: 🔧 Listing: ./project/src
     The src folder contains:
     - index.ts (entry point)
     - utils/ (helper functions)
     - components/ (React components)

You: Start the dev server

Bot: 🔧 Running: npm run dev
     Dev server started at http://localhost:3000
```
