import { Injectable, Logger } from '@nestjs/common';
import type {
  AllMiddlewareArgs,
  SlackCommandMiddlewareArgs,
} from '@slack/bolt';

import { TemplateService } from '../../../core/services/template.service';
import { ClaudeService } from '../claude.service';
import { SlackCommand } from './registry.service';

@Injectable()
export class CommandKillAllService implements SlackCommand {
  private readonly logger = new Logger(CommandKillAllService.name);

  readonly command = '/kill-all';

  constructor(
    private readonly claude: ClaudeService,
    private readonly template: TemplateService,
  ) {}

  async handle({ ack }: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    const count = this.claude.killAll();
    await ack(
      this.template.render('slack.commands.command-kill-all-ok', {
        count,
        plural: count !== 1,
      }),
    );
  }
}
