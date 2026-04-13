import { Injectable, Logger } from '@nestjs/common';

import { TemplateService } from '../../../core/services/template.service';
import { TextCommand, TextCommandContext } from './registry.service';

@Injectable()
export class CommandHelpService implements TextCommand {
  private readonly logger = new Logger(CommandHelpService.name);

  readonly name = 'help';

  constructor(private readonly template: TemplateService) {}

  async handle(ctx: TextCommandContext) {
    await ctx.client.chat.postMessage({
      channel: ctx.channelId,
      thread_ts: ctx.threadTs,
      text: this.template.render('slack.commands.command-help-ok'),
    });
  }
}
