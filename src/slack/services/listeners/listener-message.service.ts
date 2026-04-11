import { Injectable, Logger } from '@nestjs/common';
import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt';

import { MessageHandlerService } from '../message-handler.service';
import { WorkspaceService } from '../workspace.service';
import { SlackListener } from './registry.service';

@Injectable()
export class ListenerMessageService implements SlackListener<'message'> {
  private readonly logger = new Logger(ListenerMessageService.name);

  readonly event = 'message' as const;

  constructor(
    private readonly messageHandler: MessageHandlerService,
    private readonly workspace: WorkspaceService,
  ) {}

  async handle(args: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs) {
    const { message, context } = args;

    if (message.subtype && message.subtype !== 'file_share') return;

    const msg = message as any;
    if (msg.user === context.botUserId) return;

    // In channels (non-DM), only respond if channelResponseMode is 'all-messages'
    const channelType = msg.channel_type as string | undefined;
    if (channelType && channelType !== 'im') {
      const config = this.workspace.get(msg.channel);
      if (config?.channelResponseMode !== 'all-messages') return;
    }

    const parentTs = msg.thread_ts ?? msg.ts;

    await this.messageHandler.processMessageSerialized({
      channelId: msg.channel,
      userId: msg.user,
      parentTs,
      msgTs: msg.ts,
      text: msg.text ?? '',
      files: msg.files ?? [],
      client: args.client,
    });
  }
}
