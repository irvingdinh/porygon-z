import { Injectable, Logger } from '@nestjs/common';
import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt';

import { SlackListener } from './registry.service';

@Injectable()
export class ListenerMessageService implements SlackListener<'message'> {
  private readonly logger = new Logger(ListenerMessageService.name);

  readonly event = 'message' as const;

  // eslint-disable-next-line @typescript-eslint/require-await
  async handle({
    message,
    context,
  }: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs) {
    if (message.subtype && message.subtype !== 'file_share') return;

    const msg = message;

    if (msg.user === context.botUserId) return;

    this.logger.log(
      `Message from ${msg.user} in ${msg.channel}: ${(msg.text ?? '').slice(0, 80)}`,
    );

    // TODO: Delegate to MessageHandlerService
  }
}
