import * as fs from 'node:fs';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import { TemplateService } from '../../../core/services/template.service';
import { WorkspaceService } from '../workspace.service';
import { TextCommand, TextCommandContext } from './registry.service';

@Injectable()
export class CommandCdService implements TextCommand {
  private readonly logger = new Logger(CommandCdService.name);

  readonly name = 'cd';

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly template: TemplateService,
  ) {}

  async handle(ctx: TextCommandContext) {
    const target = ctx.text;
    const channelId = ctx.channelId;
    const currentDir = this.workspace.resolveCwd(channelId);

    if (!target) {
      await ctx.client.chat.postMessage({
        channel: ctx.channelId,
        thread_ts: ctx.threadTs,
        text: this.template.render('slack.commands.command-cd-show', {
          cwd: currentDir,
        }),
      });
      return;
    }

    const resolved = path.resolve(currentDir, target);

    if (!fs.existsSync(resolved)) {
      await ctx.client.chat.postMessage({
        channel: ctx.channelId,
        thread_ts: ctx.threadTs,
        text: this.template.render(
          'slack.commands.command-cd-error-not-found',
          {
            resolved,
          },
        ),
      });
      return;
    }

    this.workspace.set(channelId, { cwd: resolved });
    await ctx.client.chat.postMessage({
      channel: ctx.channelId,
      thread_ts: ctx.threadTs,
      text: this.template.render('slack.commands.command-cd-ok', {
        cwd: resolved,
      }),
    });
  }
}
