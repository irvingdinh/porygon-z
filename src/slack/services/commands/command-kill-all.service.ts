import { Injectable, Logger } from '@nestjs/common';

import { TemplateService } from '../../../core/services/template.service';
import { ClaudeService } from '../claude.service';
import { TextCommand, TextCommandContext } from './registry.service';

@Injectable()
export class CommandKillAllService implements TextCommand {
  private readonly logger = new Logger(CommandKillAllService.name);

  readonly name = 'kill-all';

  constructor(
    private readonly claude: ClaudeService,
    private readonly template: TemplateService,
  ) {}

  async handle(ctx: TextCommandContext) {
    const count = this.claude.killAll();
    await ctx.client.chat.postMessage({
      channel: ctx.channelId,
      thread_ts: ctx.threadTs,
      text: this.template.render('slack.commands.command-kill-all-ok', {
        count,
        plural: count !== 1,
      }),
    });
  }
}
