import * as path from 'node:path';

import * as dotenv from 'dotenv';

dotenv.config({
  path: path.join(__dirname, '..', '..', '.env'),
  override: true,
});

export const TEST_CHANNEL_ID = process.env.TEST_CHANNEL_ID ?? 'C0ARU2TNFGX';

export const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN!;
export const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN!;

export const TEST_SENDING_BOT_TOKEN = process.env.TEST_SENDING_BOT_TOKEN!;
