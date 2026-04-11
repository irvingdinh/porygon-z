import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface AppConfig {
  slack: {
    appToken: string;
    botToken: string;
  };
  dir: {
    home: string;
    temp: string;
  };
}

const ensureHomeDir = (): string => {
  const dir = process.env.DATA_DIR || path.join(os.homedir(), '.porygon-z');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const ensureTempDir = (): string => {
  return os.tmpdir();
};

const ensureEnv = (env: string): string => {
  if (process.env[env] === undefined) {
    throw new Error(`${env} is required`);
  }

  return process.env[env];
};

export const config = (): { root: AppConfig } => ({
  root: {
    slack: {
      appToken: ensureEnv('SLACK_APP_TOKEN'),
      botToken: ensureEnv('SLACK_BOT_TOKEN'),
    },
    dir: {
      home: ensureHomeDir(),
      temp: ensureTempDir(),
    },
  },
});
