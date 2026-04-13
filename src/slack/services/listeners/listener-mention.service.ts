import { Injectable, Logger } from '@nestjs/common';
import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt';

import { CommandRouterService } from '../commands/registry.service';
import { MessageHandlerService } from '../message-handler.service';
import { SlackListener } from './registry.service';

@Injectable()
export class ListenerMentionService implements SlackListener<'app_mention'> {
  private readonly logger = new Logger(ListenerMentionService.name);

  readonly event = 'app_mention' as const;

  constructor(
    private readonly commandRouter: CommandRouterService,
    private readonly messageHandler: MessageHandlerService,
  ) {}

  async handle(
    args: SlackEventMiddlewareArgs<'app_mention'> & AllMiddlewareArgs,
  ) {
    const { event, context, client } = args;

    // Don't respond to own mentions or missing user
    if (!event.user || event.user === context.botUserId) return;

    // Strip the bot mention from text
    const text = (event.text ?? '')
      .replace(new RegExp(`<@${context.botUserId}>`, 'g'), '')
      .trim();

    // Check for ! text commands
    if (text.startsWith('!')) {
      const threadTs = event.thread_ts ?? event.ts;
      const handled = await this.commandRouter.tryHandle(
        text,
        event.channel,
        event.user,
        client,
        threadTs,
      );
      if (handled) return;
    }

    const parentTs = event.thread_ts ?? event.ts;

    await this.messageHandler.processMessageSerialized({
      channelId: event.channel,
      userId: event.user,
      parentTs,
      msgTs: event.ts,
      text,
      files: (event as any).files ?? [],
      client,
    });
  }
}
