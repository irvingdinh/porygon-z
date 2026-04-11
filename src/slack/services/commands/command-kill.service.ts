import { Injectable, Logger } from '@nestjs/common';
import type {
  AllMiddlewareArgs,
  SlackCommandMiddlewareArgs,
} from '@slack/bolt';

import { SlackCommand } from './registry.service';

@Injectable()
export class CommandKillService implements SlackCommand {
  private readonly logger = new Logger(CommandKillService.name);

  readonly command = '/kill';

  async handle({ ack }: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    this.logger.warn('/kill is not yet implemented.');
    await ack(':skull_and_crossbones: /kill is not yet implemented.');
  }
}
