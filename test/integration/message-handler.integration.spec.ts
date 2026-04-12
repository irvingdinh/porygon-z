import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WebClient } from '@slack/web-api';

import { TemplateService } from '../../src/core/services/template.service';
import { AttachmentService } from '../../src/slack/services/attachment.service';
import { ClaudeService } from '../../src/slack/services/claude.service';
import { ClaudeFormatterService } from '../../src/slack/services/claude-formatter.service';
import { MessageHandlerService } from '../../src/slack/services/message-handler.service';
import type { MessageContext } from '../../src/slack/services/message-handler.types';
import { StreamingUpdateService } from '../../src/slack/services/streaming-update.service';
import { ThreadService } from '../../src/slack/services/thread.service';
import { WorkspaceService } from '../../src/slack/services/workspace.service';
import { SLACK_BOT_TOKEN, TEST_CHANNEL_ID } from '../helpers/test-env';

const DATA_DIR = `/tmp/porygon-z-integration-test-${Date.now()}`;

describe('MessageHandlerService (integration)', () => {
  let messageHandler: MessageHandlerService;
  let claude: ClaudeService;
  let slackClient: WebClient;
  let threadService: ThreadService;
  let workspaceService: WorkspaceService;
  let streamingUpdate: StreamingUpdateService;

  beforeAll(() => {
    if (!SLACK_BOT_TOKEN) {
      throw new Error(
        'SLACK_BOT_TOKEN is required for integration tests. Set it in .env',
      );
    }

    // Set up isolated data directory
    fs.mkdirSync(path.join(DATA_DIR, 'workspaces'), { recursive: true });
    fs.mkdirSync(path.join(DATA_DIR, 'sessions'), { recursive: true });

    // Write workspace config: haiku + low effort for speed
    fs.writeFileSync(
      path.join(DATA_DIR, 'workspaces', `${TEST_CHANNEL_ID}.json`),
      JSON.stringify({
        cwd: '/tmp/porygon-z-integration-cwd',
        model: 'haiku',
        effort: 'low',
        permissionMode: 'bypassPermissions',
        channelResponseMode: 'mention-only',
      }),
    );
    fs.mkdirSync('/tmp/porygon-z-integration-cwd', { recursive: true });

    // Wire up real services (no NestJS module — manual DI)
    const configService = {
      get: () => ({
        dir: { home: DATA_DIR, temp: os.tmpdir() },
        slack: { appToken: 'unused', botToken: SLACK_BOT_TOKEN },
      }),
    } as unknown as ConfigService;

    const templateService = new TemplateService();
    claude = new ClaudeService();
    const formatter = new ClaudeFormatterService();
    threadService = new ThreadService(configService);
    threadService.onModuleInit();
    workspaceService = new WorkspaceService(configService);
    workspaceService.onModuleInit();
    const attachment = new AttachmentService(configService, templateService);
    const eventEmitter = new EventEmitter2();
    streamingUpdate = new StreamingUpdateService(formatter);

    // Manually register event handlers (NestJS would do this via decorators)
    eventEmitter.on('claude.stream.init', (p: any) =>
      streamingUpdate.handleInit(p),
    );
    eventEmitter.on('claude.stream.thinking', (p: any) =>
      streamingUpdate.handleThinking(p),
    );
    eventEmitter.on('claude.stream.tool', (p: any) =>
      streamingUpdate.handleTool(p),
    );
    eventEmitter.on('claude.stream.end', (p: any) =>
      streamingUpdate.handleEnd(p),
    );

    messageHandler = new MessageHandlerService(
      claude,
      formatter,
      threadService,
      workspaceService,
      attachment,
      templateService,
      eventEmitter,
    );

    slackClient = new WebClient(SLACK_BOT_TOKEN);
  });

  afterAll(() => {
    claude.killAll();
    streamingUpdate.onApplicationShutdown();
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    fs.rmSync('/tmp/porygon-z-integration-cwd', {
      recursive: true,
      force: true,
    });
  });

  it('processes a simple message and posts response to Slack', async () => {
    // Post a seed message to create a thread
    const seed = await slackClient.chat.postMessage({
      channel: TEST_CHANNEL_ID,
      text: '[integration-test] seed message',
    });
    const parentTs = seed.ts!;

    try {
      const ctx: MessageContext = {
        channelId: TEST_CHANNEL_ID,
        userId: 'U_INTEGRATION_TEST',
        parentTs,
        msgTs: parentTs,
        text: 'Reply with exactly the word PONG and nothing else.',
        files: [],
        client: slackClient,
      };

      await messageHandler.processMessageSerialized(ctx);

      // Verify: session was created with a sessionId
      const session = threadService.get(parentTs);
      expect(session).not.toBeNull();
      expect(session!.sessionId).not.toBeNull();

      // Verify: bot posted at least one message in the thread
      const replies = await slackClient.conversations.replies({
        channel: TEST_CHANNEL_ID,
        ts: parentTs,
      });
      const botMessages = replies.messages!.filter(
        (m) => m.ts !== parentTs && m.bot_id,
      );
      expect(botMessages.length).toBeGreaterThanOrEqual(1);

      // Verify: final message contains PONG (light pattern assertion)
      const lastBotMsg = botMessages[botMessages.length - 1];
      expect(lastBotMsg.text!.toLowerCase()).toContain('pong');
    } finally {
      // Clean up the test thread
      try {
        await slackClient.chat.delete({
          channel: TEST_CHANNEL_ID,
          ts: parentTs,
        });
      } catch {
        // best-effort cleanup
      }
    }
  }, 30_000);

  it('resumes a session in the same thread', async () => {
    const seed = await slackClient.chat.postMessage({
      channel: TEST_CHANNEL_ID,
      text: '[integration-test] session resume seed',
    });
    const parentTs = seed.ts!;

    try {
      // First message
      await messageHandler.processMessageSerialized({
        channelId: TEST_CHANNEL_ID,
        userId: 'U_INTEGRATION_TEST',
        parentTs,
        msgTs: parentTs,
        text: 'Remember this secret code: ALPHA-7.',
        files: [],
        client: slackClient,
      });

      const sessionAfterFirst = threadService.get(parentTs);
      expect(sessionAfterFirst!.sessionId).not.toBeNull();

      // Second message — should resume the session
      const secondMsgTs = `${parentTs.split('.')[0]}.${String(Date.now()).slice(-6)}`;
      await messageHandler.processMessageSerialized({
        channelId: TEST_CHANNEL_ID,
        userId: 'U_INTEGRATION_TEST',
        parentTs,
        msgTs: secondMsgTs,
        text: 'What was the secret code I told you?',
        files: [],
        client: slackClient,
      });

      const sessionAfterSecond = threadService.get(parentTs);
      expect(sessionAfterSecond!.sessionId).not.toBeNull();

      // Verify the response references the code
      const replies = await slackClient.conversations.replies({
        channel: TEST_CHANNEL_ID,
        ts: parentTs,
      });
      const botMessages = replies.messages!.filter(
        (m) => m.ts !== parentTs && m.bot_id,
      );
      const lastMsg = botMessages[botMessages.length - 1];
      expect(lastMsg.text!).toContain('ALPHA-7');
    } finally {
      try {
        await slackClient.chat.delete({
          channel: TEST_CHANNEL_ID,
          ts: parentTs,
        });
      } catch {
        // best-effort
      }
    }
  }, 60_000);
});
