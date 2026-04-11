import { Injectable, Logger } from '@nestjs/common';
import type {
  AllMiddlewareArgs,
  SlackCommandMiddlewareArgs,
} from '@slack/bolt';

import { TemplateService } from '../../../core/services/template.service';
import { SlackCommand } from './registry.service';

@Injectable()
export class CommandShService implements SlackCommand {
  private readonly logger = new Logger(CommandShService.name);

  readonly command = '/sh';

  constructor(private readonly template: TemplateService) {}

  async handle({
    ack,
    command,
  }: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    const rawCommand = command.text.trim();

    if (!rawCommand) {
      await ack(this.template.render('slack.commands.command-sh-error-usage'));
      return;
    }

    await ack();

    // TODO: Delegate to ShellService
    this.logger.warn('/sh is not yet implemented.');
  }
}
