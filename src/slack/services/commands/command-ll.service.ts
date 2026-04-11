import { Injectable, Logger } from '@nestjs/common';
import type {
  AllMiddlewareArgs,
  SlackCommandMiddlewareArgs,
} from '@slack/bolt';

import { SlackCommand } from './registry.service';

@Injectable()
export class CommandLlService implements SlackCommand {
  private readonly logger = new Logger(CommandLlService.name);

  readonly command = '/ll';

  async handle({ ack }: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    this.logger.warn('/ll is not yet implemented.');
    await ack(':file_folder: /ll is not yet implemented.');
  }
}
