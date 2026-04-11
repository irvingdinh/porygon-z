import * as fs from 'node:fs';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';
import type {
  AllMiddlewareArgs,
  SlackCommandMiddlewareArgs,
} from '@slack/bolt';

import { TemplateService } from '../../../core/services/template.service';
import { WorkspaceService } from '../workspace.service';
import { SlackCommand } from './registry.service';

@Injectable()
export class CommandCdService implements SlackCommand {
  private readonly logger = new Logger(CommandCdService.name);

  readonly command = '/cd';

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly template: TemplateService,
  ) {}

  async handle({
    ack,
    command,
  }: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    const target = command.text.trim();
    const channelId = command.channel_id;
    const currentDir = this.workspace.resolveCwd(channelId);

    if (!target) {
      await ack(
        this.template.render('slack.commands.command-cd-show', {
          cwd: currentDir,
        }),
      );
      return;
    }

    const resolved = path.resolve(currentDir, target);

    if (!fs.existsSync(resolved)) {
      await ack(
        this.template.render('slack.commands.command-cd-error-not-found', {
          resolved,
        }),
      );
      return;
    }

    this.workspace.set(channelId, { cwd: resolved });
    await ack(
      this.template.render('slack.commands.command-cd-ok', { cwd: resolved }),
    );
  }
}
