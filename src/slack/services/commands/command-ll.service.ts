import { execSync } from 'node:child_process';

import { Injectable, Logger } from '@nestjs/common';

import { TemplateService } from '../../../core/services/template.service';
import { WorkspaceService } from '../workspace.service';
import { TextCommand, TextCommandContext } from './registry.service';

@Injectable()
export class CommandLlService implements TextCommand {
  private readonly logger = new Logger(CommandLlService.name);

  readonly name = 'll';

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly template: TemplateService,
  ) {}

  async handle(ctx: TextCommandContext) {
    const channelId = ctx.channelId;
    const cwd = this.workspace.resolveCwd(channelId);

    try {
      const output = execSync('/bin/ls -la', {
        cwd,
        encoding: 'utf-8',
      }).trim();
      await ctx.client.chat.postMessage({
        channel: ctx.channelId,
        thread_ts: ctx.threadTs,
        text: this.template.render('slack.commands.command-ll-ok', {
          cwd,
          output,
        }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ls failed';
      await ctx.client.chat.postMessage({
        channel: ctx.channelId,
        thread_ts: ctx.threadTs,
        text: this.template.render('slack.commands.command-ll-error', {
          cwd,
          message,
        }),
      });
    }
  }
}
