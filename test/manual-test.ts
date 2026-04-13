import * as os from 'node:os';

import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WebClient } from '@slack/web-api';

import { TemplateService } from '../src/core/services/template.service';
import { AttachmentService } from '../src/slack/services/attachment.service';
import { ClaudeService } from '../src/slack/services/claude.service';
import { ClaudeFormatterService } from '../src/slack/services/claude-formatter.service';
import { MessageHandlerService } from '../src/slack/services/message-handler.service';
import { StreamingUpdateService } from '../src/slack/services/streaming-update.service';
import { ThreadService } from '../src/slack/services/thread.service';
import { WorkspaceService } from '../src/slack/services/workspace.service';

const DATA_DIR = process.env.DATA_DIR || `${os.homedir()}/.porygon-z-testing`;
const CHANNEL_ID = 'C0ARU2TNFGX';
const PARENT_TS = process.argv[2];
const PROMPT = process.argv[3] || 'what is 2+2?';

if (!PARENT_TS) {
  console.error('Usage: ts-node manual-test.ts <parentTs> [prompt]');
  process.exit(1);
}

async function main() {
  const configService = {
    get: () => ({
      dir: { home: DATA_DIR, temp: os.tmpdir() },
      slack: { appToken: 'unused', botToken: process.env.SLACK_BOT_TOKEN },
    }),
  } as unknown as ConfigService;

  const templateService = new TemplateService();
  const claude = new ClaudeService();
  const formatter = new ClaudeFormatterService();
  const threadService = new ThreadService(configService);
  threadService.onModuleInit();
  const workspaceService = new WorkspaceService(configService);
  workspaceService.onModuleInit();
  const attachment = new AttachmentService(configService, templateService);
  const eventEmitter = new EventEmitter2();
  const streamingUpdate = new StreamingUpdateService(formatter);

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

  const flushInterval = setInterval(() => {
    void streamingUpdate.flushAll();
  }, 2000);

  const messageHandler = new MessageHandlerService(
    claude,
    formatter,
    threadService,
    workspaceService,
    attachment,
    templateService,
    eventEmitter,
  );

  const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

  console.log(`Processing message in thread ${PARENT_TS}...`);

  await messageHandler.processMessageSerialized({
    channelId: CHANNEL_ID,
    userId: 'U_MANUAL_TEST',
    parentTs: PARENT_TS,
    msgTs: PARENT_TS,
    text: PROMPT,
    files: [],
    client: slackClient,
  });

  clearInterval(flushInterval);
  console.log('Done! Fetching thread...');

  const replies = await slackClient.conversations.replies({
    channel: CHANNEL_ID,
    ts: PARENT_TS,
  });

  console.log('\n=== THREAD ===');
  for (const msg of replies.messages || []) {
    const from = msg.bot_id ? `[Bot]` : `[User]`;
    const text = (msg.text || '').slice(0, 500);
    console.log(`\n${from} ts=${msg.ts}`);
    console.log(text);
  }
  console.log('\n=== END ===');

  claude.killAll();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
