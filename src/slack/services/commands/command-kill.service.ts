import { Injectable, Logger } from '@nestjs/common';
import type {
  AllMiddlewareArgs,
  SlackCommandMiddlewareArgs,
} from '@slack/bolt';

import { TemplateService } from '../../../core/services/template.service';
import { ClaudeService } from '../claude.service';
import { SlackCommand } from './registry.service';

@Injectable()
export class CommandKillService implements SlackCommand {
  private readonly logger = new Logger(CommandKillService.name);

  readonly command = '/kill';

  constructor(
    private readonly claude: ClaudeService,
    private readonly template: TemplateService,
  ) {}

  async handle({ ack }: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    const count = this.claude.killAll();
    await ack(
      this.template.render('slack.commands.command-kill-ok', {
        count,
        plural: count !== 1,
      }),
    );
  }
}
