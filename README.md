# Porygon-Z

[![npm version](https://img.shields.io/npm/v/@irvingdinh/porygon-z.svg)](https://www.npmjs.com/package/@irvingdinh/porygon-z)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/@irvingdinh/porygon-z.svg)](https://nodejs.org)

Run Claude Code directly from Slack. Porygon-Z connects your Slack workspace to Claude's coding capabilities — ask questions, execute tasks, and manage files without leaving your chat.

## Quick Start

```bash
SLACK_APP_TOKEN=xapp-... SLACK_BOT_TOKEN=xoxb-... npx @irvingdinh/porygon-z@latest
```

## Deployment Guides

- [Install on macOS (launchd)](docs/install-macos/install-macos.md) — run as a persistent LaunchAgent that starts on login
- [Install on Ubuntu (systemd)](docs/install-ubuntu/install-ubuntu.md) — run as a persistent service that starts on boot

## Prerequisites

- **Node.js** >= 20
- **Claude CLI** — installed, configured, and authenticated ([installation guide](https://docs.anthropic.com/en/docs/claude-code/getting-started))
- **Slack App** — with Socket Mode enabled and the required scopes (see [Appendix: Slack App Setup](#appendix-slack-app-setup))

## Configuration

Porygon-Z is configured through environment variables:

| Variable | Required | Description |
|---|---|---|
| `SLACK_APP_TOKEN` | Yes | Slack app-level token (`xapp-...`) for Socket Mode |
| `SLACK_BOT_TOKEN` | Yes | Slack bot token (`xoxb-...`) for API calls |
| `DATA_DIR` | No | Data directory (defaults to `~/.porygon-z`) |

You can set these inline, export them, or use a `.env` file in your working directory.

## Usage

Once running, send a direct message to the Porygon-Z bot in Slack. It will spawn a Claude Code session to handle your request and stream the response back to your thread.

### Slash Commands

| Command | Description |
|---|---|
| `/workspace` | Configure the workspace for the current channel — set working directory, Claude model, effort level, and permission mode |
| `/cd <path>` | Change the working directory for the current channel |
| `/ll` | List files in the current working directory |
| `/kill` | Kill all running Claude processes |

### Features

- **Streaming responses** — see Claude's thinking and tool usage in real-time
- **Session persistence** — continue conversations across messages in the same thread
- **File handling** — attach files to your message; generated files are uploaded back
- **Per-channel workspaces** — configure different working directories, models, and settings per channel
- **Thread serialization** — requests within a thread are processed one at a time to prevent conflicts

### Workspace Configuration

Use the `/workspace` command to configure per-channel settings:

- **Working directory** — where Claude executes commands
- **Model** — Claude model to use (e.g., `sonnet`, `opus`)
- **Effort level** — Claude's effort level (`low`, `medium`, `high`, `max`)
- **Permission mode** — controls Claude's autonomy (`plan`, `auto`, `bypassPermissions`)

## Development

```bash
# Install dependencies
npm install

# Run in watch mode
npm run start:dev

# Build
npm run build

# Lint
npm run lint
```

## License

[MIT](LICENSE)

---

## Appendix: Slack App Setup

Follow these steps to create and configure a Slack app for Porygon-Z.

### 1. Create a New Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**
2. Choose **From scratch**
3. Enter an app name (e.g., "Porygon-Z") and select your workspace
4. Click **Create App**

### 2. Enable Socket Mode

1. In the left sidebar, go to **Socket Mode**
2. Toggle **Enable Socket Mode** on
3. When prompted, create an app-level token with the `connections:write` scope
4. Name it (e.g., "socket-token") and click **Generate**
5. Copy the token (`xapp-...`) — this is your `SLACK_APP_TOKEN`

### 3. Configure Bot Token Scopes

1. Go to **OAuth & Permissions** in the left sidebar
2. Under **Scopes > Bot Token Scopes**, add the following:

| Scope | Purpose |
|---|---|
| `chat:write` | Send messages |
| `chat:write.customize` | Send messages with custom username/avatar |
| `files:read` | Download user-attached files |
| `files:write` | Upload generated files |
| `reactions:write` | Add status emoji reactions |
| `app_mentions:read` | Detect @mentions |
| `channels:read` | Access channel info |
| `channels:history` | Read channel messages |
| `groups:read` | Access private channel info |
| `groups:history` | Read private channel messages |
| `im:read` | Access DM info |
| `im:history` | Read DM messages |
| `mpim:history` | Read group DM messages |
| `users:read` | Access user info |

3. Click **Install to Workspace** (or **Reinstall** if already installed)
4. Copy the **Bot User OAuth Token** (`xoxb-...`) — this is your `SLACK_BOT_TOKEN`

### 4. Subscribe to Bot Events

1. Go to **Event Subscriptions** in the left sidebar
2. Toggle **Enable Events** on
3. Under **Subscribe to bot events**, add:
   - `message.im` — listens for direct messages to the bot

### 5. Register Slash Commands

1. Go to **Slash Commands** in the left sidebar
2. Create the following commands:

| Command | Short Description |
|---|---|
| `/workspace` | Configure workspace settings |
| `/cd` | Change working directory |
| `/ll` | List files |
| `/kill` | Kill running processes |

For each command, set the **Request URL** to any placeholder (Socket Mode does not use it).

### 6. Configure App Home

1. Go to **App Home** in the left sidebar
2. Under **Show Tabs**, enable **Messages Tab**
3. Check **Allow users to send Slash commands and messages from the messages tab**

### 7. Start Porygon-Z

```bash
SLACK_APP_TOKEN=xapp-... SLACK_BOT_TOKEN=xoxb-... npx @irvingdinh/porygon-z@latest
```

Send a direct message to your bot in Slack — you should see it respond with Claude's output.
