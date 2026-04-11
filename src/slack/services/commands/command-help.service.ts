import { Injectable, Logger } from '@nestjs/common';
import type {
  AllMiddlewareArgs,
  SlackCommandMiddlewareArgs,
} from '@slack/bolt';

import { TemplateService } from '../../../core/services/template.service';
import { SlackCommand } from './registry.service';

@Injectable()
export class CommandHelpService implements SlackCommand {
  private readonly logger = new Logger(CommandHelpService.name);

  readonly command = '/help';

  constructor(private readonly template: TemplateService) {}

  async handle({ ack }: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    await ack(this.template.render('slack.commands.command-help-ok'));
  }
}
