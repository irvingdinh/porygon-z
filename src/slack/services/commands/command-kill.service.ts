import { Injectable, Logger } from '@nestjs/common';

import { TemplateService } from '../../../core/services/template.service';
import { ClaudeService } from '../claude.service';
import { TextCommand, TextCommandContext } from './registry.service';

@Injectable()
export class CommandKillService implements TextCommand {
  private readonly logger = new Logger(CommandKillService.name);

  readonly name = 'kill';

  constructor(
    private readonly claude: ClaudeService,
    private readonly template: TemplateService,
  ) {}

  async handle(ctx: TextCommandContext) {
    const channelId = ctx.channelId;
    const count = this.claude.killByChannel(channelId);
    await ctx.client.chat.postMessage({
      channel: ctx.channelId,
      thread_ts: ctx.threadTs,
      text: this.template.render('slack.commands.command-kill-ok', {
        count,
        plural: count !== 1,
      }),
    });
  }
}
