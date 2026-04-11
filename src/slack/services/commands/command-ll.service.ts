import { execSync } from 'node:child_process';

import { Injectable, Logger } from '@nestjs/common';
import type {
  AllMiddlewareArgs,
  SlackCommandMiddlewareArgs,
} from '@slack/bolt';

import { TemplateService } from '../../../core/services/template.service';
import { WorkspaceService } from '../workspace.service';
import { SlackCommand } from './registry.service';

@Injectable()
export class CommandLlService implements SlackCommand {
  private readonly logger = new Logger(CommandLlService.name);

  readonly command = '/ll';

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly template: TemplateService,
  ) {}

  async handle({
    ack,
    command,
  }: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    const channelId = command.channel_id;
    const cwd = this.workspace.resolveCwd(channelId);

    try {
      const output = execSync('/bin/ls -la', {
        cwd,
        encoding: 'utf-8',
      }).trim();
      await ack(
        this.template.render('slack.commands.command-ll-ok', { cwd, output }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ls failed';
      await ack(
        this.template.render('slack.commands.command-ll-error', {
          cwd,
          message,
        }),
      );
    }
  }
}
