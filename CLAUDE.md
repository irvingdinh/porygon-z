# CLAUDE.md

## Build

- Always run `npm run format && npm run lint && npm run build` after making changes to verify the project compiles successfully.

## playwright-cli

- Always use --headed
- Always use ./.playwright-cli/profile to persist the profile.
- Always put assets (snapshot, screenshot, etc.) into gitignored ./.playwright-cli to not pollute the repository.

## Manual Testing

No automated tests exist. After any code change, verify via Playwright against the real Slack workspace.

### Environment Setup

**1. Clean test data** (isolated from production `~/.porygon-z`):

```bash
rm -rf $HOME/.porygon-z-testing
```

**2. Pre-flight check** — abort if already running:

```bash
pgrep -f "nest start" && echo "ERROR: app already running" && exit 1
```

**3. Start the app and wait for readiness:**

```bash
DATA_DIR=$HOME/.porygon-z-testing npm start > /tmp/porygon-z-test.log 2>&1 &
APP_PID=$!
for i in $(seq 1 30); do
  sleep 1
  grep -q "Porygon-Z is running!" /tmp/porygon-z-test.log 2>/dev/null && break
done
```

The readiness signal is `"Porygon-Z is running!"` logged by `BotService`.

**4. Write default workspace config** (haiku for speed):

```bash
mkdir -p $HOME/.porygon-z-testing/workspaces
cat > $HOME/.porygon-z-testing/workspaces/C0ARU2TNFGX.json << 'EOF'
{
  "cwd": "/tmp/porygon-z-test-cwd",
  "model": "haiku",
  "effort": "low",
  "permissionMode": "plan",
  "channelResponseMode": "mention-only"
}
EOF
mkdir -p /tmp/porygon-z-test-cwd
```

Use haiku + direct JSON for general tests. Use any model or the `/workspace` Playwright modal when testing that specific flow.

**5. Open Playwright browser** (persisted profile is logged into Slack):

```bash
playwright-cli kill-all
playwright-cli open --headed --persistent --profile=.playwright-cli/profile \
  "https://app.slack.com/client/T0A48HA5PGD/C0ARU2TNFGX"
```

Verify: `playwright-cli snapshot` should show `porygon-z-playground` channel.

### Polling / Wait Strategy

| Tier | Timeout | Poll interval | Use for |
|------|---------|---------------|---------|
| Fast | 5s | 1s | Slash command responses, reactions |
| Medium | 30s | 3s | Simple Claude responses (haiku, short prompts) |
| Long | 120s | 5s | Complex responses (opus, multi-tool runs) |

**Polling pattern** — snapshot, check, retry:

```bash
for i in $(seq 1 10); do
  sleep 3
  playwright-cli snapshot | grep -q "EXPECTED_TEXT" && break
done
```

### Tiered Test Coverage

Always run **Smoke Tests** after any change. Run **Deep Tests** when touching the corresponding code area.

#### Smoke Tests (mandatory, ~2 min)

| # | Test | Steps | Verify |
|---|------|-------|--------|
| S1 | @mention response | Type `@Porygon-Z (Testing) hello` in channel | Reaction chain: hourglass -> arrows -> removed. Bot replies in thread. |
| S2 | /help command | Type `/help` | Ephemeral message listing all 7 commands |
| S3 | /sessions | Type `/sessions` | Lists session from S1 or "No active sessions" |

#### Deep Tests — Code Area Mapping

| Code area | Required tests |
|-----------|---------------|
| `message-handler.service.ts`, `listener-*.ts` | D1, D2, D3, D4 |
| `streaming-update.service.ts`, `claude-formatter.service.ts` | D5 |
| `command-workspace.service.ts`, `workspace.service.ts` | D6, D7 |
| `command-cd.service.ts`, `command-ll.service.ts` | D7 |
| `command-kill.service.ts`, `command-kill-all.service.ts` | D8, D9 |
| `thread.service.ts`, `command-sessions.service.ts` | D10 |
| `attachment.service.ts` | D11 |

### Deep Test Procedures

**D1 — @mention in channel:**
Type `@Porygon-Z (Testing) what is 2+2` in channel. Verify: hourglass reaction appears, swaps to arrows, bot posts progress message in thread (updates every ~2s), final response posted, arrows reaction removed.

**D2 — Thread resume (session continuity):**
Reply in the same thread from D1: `what was my previous question?`. Verify: bot references "2+2". Check `$HOME/.porygon-z-testing/sessions/` — session JSON should have non-null `sessionId`.

**D3 — DM response:**
Open DM with "Porygon-Z (Testing)" via Slack sidebar. Send `hi`. Verify: bot responds (DMs always respond, no @mention needed).

**D4 — All-messages channel mode:**
Update workspace config: set `"channelResponseMode": "all-messages"` in `$HOME/.porygon-z-testing/workspaces/C0ARU2TNFGX.json`. Restart the app. Send a plain message (no @mention) in channel. Verify: bot responds. Reset to `mention-only` after.

**D5 — Streaming progress updates:**
Send `@Porygon-Z (Testing) write a 200 word essay about testing`. Observe: progress message appears in thread and updates at ~2s intervals showing tool use / thinking blocks. After completion, progress message shows checkmark. Final response posted separately.

**D6 — /workspace modal:**

```bash
playwright-cli fill '[contenteditable]' '/workspace'
playwright-cli press Enter
# Wait for modal
sleep 2
playwright-cli snapshot  # Should show modal with cwd, model, effort, permission, channel response mode fields
# Interact with modal fields and submit
```

Verify: confirmation message in channel. Check `$HOME/.porygon-z-testing/workspaces/C0ARU2TNFGX.json` is updated.

**D7 — /cd and /ll:**
Type `/cd /tmp` then `/ll`. Verify: `/cd` shows updated directory, `/ll` lists contents of `/tmp`.

**D8 — /kill:**
Start a long-running request (`@Porygon-Z (Testing) write a very long essay...`). While arrows reaction is active, type `/kill`. Verify: ephemeral message reports killed process count.

**D9 — /kill-all:**
Same as D8 but use `/kill-all`. Verify: reports total killed count globally.

**D10 — Session corruption recovery:**
Corrupt a session file: `echo "INVALID" > $HOME/.porygon-z-testing/sessions/<threadTs>.json`. Send a message in that thread. Verify: bot posts session corrupted/expired warning, creates new session, responds normally.

**D11 — File attachment:**
Upload a text file to the channel with an @mention. Verify: bot downloads file (check app logs), references content in response. If Claude produces output files, verify `outbox_tray` reaction and files uploaded to thread.

### Playwright Interaction Patterns

```bash
# Send a message in channel
playwright-cli fill '[contenteditable]' 'your message here'
playwright-cli press Enter

# Take a snapshot to read channel state
playwright-cli snapshot

# Screenshot for proof of work
playwright-cli screenshot --filename=proof-S1.png

# Navigate to bot DM (click bot name in sidebar or search)
playwright-cli click '[data-qa="channel_sidebar_name_porygon-z-testing"]'
```

Note: The `[contenteditable]` selector targets Slack's message composer. If it changes, use `playwright-cli snapshot` to find the correct ref and update.

### Proof of Work

Take a screenshot at each verification checkpoint:

```bash
playwright-cli screenshot --filename=proof-S1-mention.png
playwright-cli screenshot --filename=proof-D2-resume.png
```

- **Self-testing (during implementation):** Save screenshots locally in the project directory.
- **Remote-controlled (via Porygon-Z bot in Slack):** Upload screenshots to the controlling Slack thread as attachments to prove the work.
- **Minimum:** One screenshot per smoke test executed, one per deep test executed.

### Cleanup

```bash
# Stop the app
kill $APP_PID 2>/dev/null; wait $APP_PID 2>/dev/null

# Close browser
playwright-cli close

# Clean test data
rm -rf $HOME/.porygon-z-testing
rm -rf /tmp/porygon-z-test-cwd
rm -rf /tmp/porygon-z/threads/
rm -f /tmp/porygon-z-test.log
```
