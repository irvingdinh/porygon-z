import { execSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import * as dotenv from 'dotenv';

dotenv.config({
  path: path.join(__dirname, '..', '..', '.env'),
  override: true,
});

const DATA_DIR = '/tmp/porygon-z-test-e2e';
const LOG_FILE = '/tmp/porygon-z-test-e2e.log';
const PID_FILE = '/tmp/porygon-z-test-e2e.pid';
const READINESS_SIGNAL = 'Porygon-Z is running!';

export default async function globalSetup() {
  if (process.env.SKIP_APP_BOOT) {
    console.log('[e2e] SKIP_APP_BOOT set — assuming app is already running');
    return;
  }

  const existingPid = safeReadFile(PID_FILE);
  if (existingPid) {
    try {
      process.kill(Number(existingPid), 0);
      console.log(`[e2e] App already running (pid ${existingPid}), reusing`);
      return;
    } catch {
      // stale PID file
    }
  }

  // Clean and prepare
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(DATA_DIR, 'workspaces'), { recursive: true });

  const channelId = process.env.TEST_CHANNEL_ID ?? 'C0ARU2TNFGX';
  fs.writeFileSync(
    path.join(DATA_DIR, 'workspaces', `${channelId}.json`),
    JSON.stringify(
      {
        cwd: '/tmp/porygon-z-test-cwd',
        model: 'haiku',
        effort: 'low',
        permissionMode: 'plan',
        channelResponseMode: 'all-messages',
      },
      null,
      2,
    ),
  );
  fs.mkdirSync('/tmp/porygon-z-test-cwd', { recursive: true });

  // Build first
  console.log('[e2e] Building...');
  execSync('npm run build', {
    cwd: path.join(__dirname, '..', '..'),
    stdio: 'pipe',
  });

  // Start app
  console.log('[e2e] Starting app...');
  const logFd = fs.openSync(LOG_FILE, 'w');
  const child = spawn('node', ['dist/main.js'], {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env, DATA_DIR },
    stdio: ['ignore', logFd, logFd],
    detached: true,
  });
  child.unref();
  fs.writeFileSync(PID_FILE, String(child.pid));

  // Wait for readiness
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await sleep(1000);
    const log = safeReadFile(LOG_FILE);
    if (log?.includes(READINESS_SIGNAL)) {
      console.log(`[e2e] App ready (pid ${child.pid})`);
      return;
    }
  }

  throw new Error('[e2e] App failed to start within 30s');
}

function safeReadFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
