import { WebClient } from '@slack/web-api';

import {
  SLACK_BOT_TOKEN,
  TEST_CHANNEL_ID,
  TEST_SENDING_BOT_TOKEN,
} from '../helpers/test-env';

describe('Mention → Response (e2e)', () => {
  let senderClient: WebClient;
  let verifierClient: WebClient;

  beforeAll(() => {
    if (!TEST_SENDING_BOT_TOKEN) {
      throw new Error(
        'TEST_SENDING_BOT_TOKEN is required for E2E tests. Set it in .env',
      );
    }
    if (!SLACK_BOT_TOKEN) {
      throw new Error(
        'SLACK_BOT_TOKEN is required for E2E tests. Set it in .env',
      );
    }

    senderClient = new WebClient(TEST_SENDING_BOT_TOKEN);
    verifierClient = new WebClient(SLACK_BOT_TOKEN);
  });

  it('bot responds to a message in a thread', async () => {
    // The "Test Sending" bot posts a message in the channel.
    // Since we can't trigger app_mention from another bot, we rely on
    // channelResponseMode being set to 'all-messages' in the E2E workspace config,
    // OR we post directly to a thread the bot is already watching.
    //
    // For this E2E test, we use the sender bot to post a new message.
    // The test bot (Porygon-Z Testing) should pick it up if channelResponseMode=all-messages.

    const seed = await senderClient.chat.postMessage({
      channel: TEST_CHANNEL_ID,
      text: '[e2e-test] Hello from Test Sending bot — reply with PONG',
    });
    const parentTs = seed.ts!;

    try {
      // Poll for the bot's response (Medium tier: 30s, 3s interval)
      let botReplied = false;
      let lastReply = '';

      for (let i = 0; i < 10; i++) {
        await sleep(3000);

        const replies = await verifierClient.conversations.replies({
          channel: TEST_CHANNEL_ID,
          ts: parentTs,
        });

        const botMessages = (replies.messages ?? []).filter(
          (m) => m.ts !== parentTs && m.bot_id,
        );

        if (botMessages.length > 0) {
          botReplied = true;
          lastReply = botMessages[botMessages.length - 1].text ?? '';
          break;
        }
      }

      expect(botReplied).toBe(true);
      expect(lastReply.length).toBeGreaterThan(0);
    } finally {
      try {
        await senderClient.chat.delete({
          channel: TEST_CHANNEL_ID,
          ts: parentTs,
        });
      } catch {
        // best-effort cleanup
      }
    }
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
