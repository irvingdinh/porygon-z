import { Injectable, Logger } from '@nestjs/common';
import type {
  AllMiddlewareArgs,
  SlackCommandMiddlewareArgs,
} from '@slack/bolt';

import { SlackCommand } from './registry.service';

@Injectable()
export class CommandCdService implements SlackCommand {
  private readonly logger = new Logger(CommandCdService.name);

  readonly command = '/cd';

  async handle({ ack }: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    this.logger.warn('/cd is not yet implemented.');
    await ack(':file_folder: /cd is not yet implemented.');
  }
}
