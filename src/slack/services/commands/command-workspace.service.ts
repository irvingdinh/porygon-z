import { Injectable, Logger } from '@nestjs/common';
import type {
  AllMiddlewareArgs,
  SlackCommandMiddlewareArgs,
} from '@slack/bolt';

import { SlackCommand } from './registry.service';

@Injectable()
export class CommandWorkspaceService implements SlackCommand {
  private readonly logger = new Logger(CommandWorkspaceService.name);

  readonly command = '/workspace';

  async handle({ ack }: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    this.logger.warn('/workspace is not yet implemented.');
    await ack(':file_folder: /workspace is not yet implemented.');
  }
}
