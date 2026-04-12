import * as fs from 'node:fs';

const PID_FILE = '/tmp/porygon-z-test-e2e.pid';
const DATA_DIR = '/tmp/porygon-z-test-e2e';
const LOG_FILE = '/tmp/porygon-z-test-e2e.log';

export default async function globalTeardown() {
  if (process.env.SKIP_APP_BOOT) return;

  const pidStr = safeReadFile(PID_FILE);
  if (pidStr) {
    const pid = Number(pidStr);
    try {
      // Kill the process group (detached child)
      process.kill(-pid, 'SIGTERM');
      await sleep(2000);
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        // already dead
      }
    } catch {
      // already dead
    }
    fs.rmSync(PID_FILE, { force: true });
  }

  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  fs.rmSync('/tmp/porygon-z-test-cwd', { recursive: true, force: true });
  fs.rmSync(LOG_FILE, { force: true });

  console.log('[e2e] Cleaned up');
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
