import { Inject, Injectable, Logger } from '@nestjs/common';
import type { WebClient } from '@slack/web-api';

import { TemplateService } from '../../../core/services/template.service';

export const TEXT_COMMAND = Symbol('TEXT_COMMAND');

export interface TextCommandContext {
  channelId: string;
  userId: string;
  text: string;
  client: WebClient;
  threadTs: string;
}

export interface TextCommand {
  name: string;
  handle(ctx: TextCommandContext): Promise<void>;
}

@Injectable()
export class CommandRouterService {
  private readonly logger = new Logger(CommandRouterService.name);
  private readonly commandMap: Map<string, TextCommand>;

  constructor(
    @Inject(TEXT_COMMAND)
    private readonly commands: TextCommand[],
    private readonly template: TemplateService,
  ) {
    this.commandMap = new Map(commands.map((cmd) => [cmd.name, cmd]));
  }

  async tryHandle(
    text: string,
    channelId: string,
    userId: string,
    client: WebClient,
    threadTs: string,
  ): Promise<boolean> {
    const match = text.match(/^!(\S+)(?:\s+(.*))?$/s);
    if (!match) return false;

    const commandName = match[1];
    const args = (match[2] ?? '').trim();

    const command = this.commandMap.get(commandName);
    if (command) {
      this.logger.log(
        `Dispatching command: !${commandName} (channel=${channelId}, user=${userId})`,
      );
      await command.handle({ channelId, userId, text: args, client, threadTs });
      return true;
    }

    // Unknown command — reply with error + full help content
    const helpText = this.template.render('slack.commands.command-help-ok');
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: `:x: Unknown command \`!${commandName}\`\n\n${helpText}`,
    });

    return true;
  }
}
