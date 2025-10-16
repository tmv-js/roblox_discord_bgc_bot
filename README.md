# Discord Roblox Background Check Bot

A Discord bot that performs Roblox background checks — verifying account age, friend count, and group memberships using Roblox’s public API.

## ✨ Features
- Slash command `/bgc`
- Exact Roblox username lookup
- Automatic retry handling for rate limits
- Beautiful Discord embeds
- Secure `.env` configuration
- Caching for efficient API usage

## 🚀 Setup

### 1. Clone the repository
```bash
git clone https://github.com/tmv-js/discord-bgc-bot.git
cd discord-bgc-bot
### 2. Install dependencies
npm install
### 3. Create a .env file
DISCORD_TOKEN=your-discord-bot-token
CLIENT_ID=your-application-client-id
GUILD_ID=your-guild-id
### 4. Start the bot
npm start

### 🧰 Technologies

- Node.js
- discord.js
- Axios
- dotenv
