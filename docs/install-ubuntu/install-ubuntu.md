# Install on Ubuntu (systemd)

Run Porygon-Z as a persistent systemd user service on Ubuntu. The service starts automatically on boot, restarts on failure, and inherits your shell environment (so tools like `fnm`, `nvm`, or anything in your `.bashrc` are available).

## Prerequisites

- Ubuntu 20.04+ with systemd
- Node.js >= 20 (via `fnm`, `nvm`, or system install)
- Claude CLI installed and authenticated
- Slack app tokens ready (see [Slack App Setup](../../README.md#appendix-slack-app-setup))

## 1. Enable user lingering

Lingering allows your user services to run at boot, even without an active login session:

```bash
sudo loginctl enable-linger $USER
```

## 2. Create the service file

```bash
mkdir -p ~/.config/systemd/user
```

Create `~/.config/systemd/user/porygon-z.service`:

```ini
[Unit]
Description=Porygon-Z Slack Bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment=SLACK_APP_TOKEN=xapp-...
Environment=SLACK_BOT_TOKEN=xoxb-...
ExecStart=/bin/bash -ic 'npx @irvingdinh/porygon-z@latest'
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

Replace the token values with your own.

### Why `bash -ic`?

systemd services run in a minimal environment — shell profiles (`.bashrc`, `.profile`) are not sourced by default. Using `bash -ic` starts an interactive shell, which sources `.bashrc` and makes tools like `fnm` or `nvm` available. The harmless warning `bash: no job control in this shell` can be ignored.

If your Node.js is installed system-wide (e.g., via `apt`), you can simplify to:

```ini
ExecStart=npx @irvingdinh/porygon-z@latest
```

## 3. Enable and start

```bash
systemctl --user daemon-reload
systemctl --user enable porygon-z.service
systemctl --user start porygon-z.service
```

## 4. Verify

Check the service status:

```bash
systemctl --user status porygon-z
```

You should see `Active: active (running)`. Tail the logs to confirm startup:

```bash
journalctl --user -u porygon-z -f
```

Look for `Porygon-Z is running!` in the output.

## Managing the service

| Action | Command |
|---|---|
| Check status | `systemctl --user status porygon-z` |
| View logs | `journalctl --user -u porygon-z -f` |
| Restart | `systemctl --user restart porygon-z` |
| Stop | `systemctl --user stop porygon-z` |
| Disable on boot | `systemctl --user disable porygon-z` |

## Updating

The service uses `npx @irvingdinh/porygon-z@latest`, which checks for the latest version on every start. To pick up a new release, simply restart:

```bash
systemctl --user restart porygon-z
```

## Uninstall

```bash
systemctl --user stop porygon-z
systemctl --user disable porygon-z
rm ~/.config/systemd/user/porygon-z.service
systemctl --user daemon-reload
```
