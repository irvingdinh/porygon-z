import { Injectable, Logger } from '@nestjs/common';
import type {
  AllMiddlewareArgs,
  SlackCommandMiddlewareArgs,
} from '@slack/bolt';

import { SlackCommand } from './registry.service';

@Injectable()
export class CommandShService implements SlackCommand {
  private readonly logger = new Logger(CommandShService.name);

  readonly command = '/sh';

  async handle({
    ack,
    command,
  }: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    const rawCommand = command.text.trim();

    if (!rawCommand) {
      await ack(':x: Usage: `/sh <command>` — e.g. `/sh make restart`');
      return;
    }

    await ack();

    // TODO: Delegate to ShellService
    this.logger.warn('/sh is not yet implemented.');
  }
}
