# Install on macOS (launchd)

Run Porygon-Z as a persistent LaunchAgent on macOS. The service starts automatically on login, restarts on failure, and uses a wrapper script to inherit your shell environment (so tools like `fnm`, `nvm`, or anything in your `.zprofile` are available).

## Prerequisites

- macOS 12+ with launchd
- Node.js >= 20 (via `fnm`, `nvm`, or Homebrew)
- Claude CLI installed and authenticated
- Slack app tokens ready (see [Slack App Setup](../../README.md#appendix-slack-app-setup))

## 1. Create the wrapper script

LaunchAgents run in a minimal environment — shell profiles (`.zshrc`, `.zprofile`) are not sourced by default. A small wrapper script ensures tools like `fnm` or `nvm` are available.

```bash
mkdir -p ~/.local/bin
```

Create `~/.local/bin/porygon-z-start.sh`:

```bash
#!/bin/zsh

eval "$(/opt/homebrew/bin/brew shellenv zsh)"
eval "$(fnm env)"
export PATH="$HOME/.local/bin:$PATH"

export SLACK_APP_TOKEN="xapp-..."
export SLACK_BOT_TOKEN="xoxb-..."

exec npx @irvingdinh/porygon-z@latest
```

Replace the token values with your own. If you use `nvm` instead of `fnm`, replace the `eval` line:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
```

If your Node.js is installed system-wide (e.g., via Homebrew `node` formula directly), you can drop the version manager lines entirely.

Make the script executable:

```bash
chmod +x ~/.local/bin/porygon-z-start.sh
```

### Why a wrapper script?

Unlike the Ubuntu (systemd) guide which uses `bash -ic` to source shell profiles, macOS LaunchAgents do not support interactive shell flags. Additionally, `fnm` creates session-specific paths via `fnm env` that must be evaluated fresh — hardcoded paths from `.zprofile` become stale. The wrapper script solves both problems.

## 2. Create the LaunchAgent plist

Create `~/Library/LaunchAgents/com.irvingdinh.porygon-z.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>com.irvingdinh.porygon-z</string>

	<key>ProgramArguments</key>
	<array>
		<string>/Users/YOUR_USERNAME/.local/bin/porygon-z-start.sh</string>
	</array>

	<key>RunAtLoad</key>
	<true/>

	<key>KeepAlive</key>
	<true/>

	<key>StandardOutPath</key>
	<string>/tmp/porygon-z.stdout.log</string>

	<key>StandardErrorPath</key>
	<string>/tmp/porygon-z.stderr.log</string>
</dict>
</plist>
```

Replace `YOUR_USERNAME` with your macOS username (run `whoami` to check).

### Plist fields explained

| Field | Purpose |
|---|---|
| `Label` | Unique identifier for the service |
| `ProgramArguments` | Path to the wrapper script |
| `RunAtLoad` | Start automatically when the agent is loaded (i.e., on login) |
| `KeepAlive` | Restart automatically if the process exits |
| `StandardOutPath` | Where stdout is written (logs rotate naturally on reboot) |
| `StandardErrorPath` | Where stderr is written |

## 3. Load and start

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.irvingdinh.porygon-z.plist
```

The service starts immediately and will auto-start on every future login.

## 4. Verify

Check the service state:

```bash
launchctl print gui/$(id -u)/com.irvingdinh.porygon-z
```

You should see `state = running`. Tail the logs to confirm startup:

```bash
tail -f /tmp/porygon-z.stdout.log
```

Look for `Porygon-Z is running!` in the output.

## Managing the service

| Action | Command |
|---|---|
| Check status | `launchctl print gui/$(id -u)/com.irvingdinh.porygon-z` |
| View logs | `tail -f /tmp/porygon-z.stdout.log` |
| View errors | `tail -f /tmp/porygon-z.stderr.log` |
| Restart | `launchctl kickstart -k gui/$(id -u)/com.irvingdinh.porygon-z` |
| Stop | `launchctl bootout gui/$(id -u)/com.irvingdinh.porygon-z.plist` |
| Start | `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.irvingdinh.porygon-z.plist` |

## Updating

The wrapper script uses `npx @irvingdinh/porygon-z@latest`, which checks for the latest version on every start. To pick up a new release, simply restart:

```bash
launchctl kickstart -k gui/$(id -u)/com.irvingdinh.porygon-z
```

## Uninstall

```bash
launchctl bootout gui/$(id -u)/com.irvingdinh.porygon-z.plist
rm ~/Library/LaunchAgents/com.irvingdinh.porygon-z.plist
rm ~/.local/bin/porygon-z-start.sh
```
