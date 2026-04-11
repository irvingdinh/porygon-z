export interface AppConfig {
  slack: {
    appToken: string;
    botToken: string;
  };
}

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
  },
});
