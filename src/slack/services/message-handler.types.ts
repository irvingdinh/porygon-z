import type { WebClient } from '@slack/web-api';

import type { SlackFile } from './attachment.service';

/**
 * Normalized message context — both DM and channel listeners
 * construct this and hand it off to MessageHandlerService.
 */
export interface MessageContext {
  channelId: string;
  userId: string;
  parentTs: string; // thread parent (msg.thread_ts ?? msg.ts)
  msgTs: string; // this message's timestamp
  text: string;
  files: SlackFile[];
  client: WebClient;
}
