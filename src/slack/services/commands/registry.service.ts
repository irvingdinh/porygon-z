import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  AllMiddlewareArgs,
  SlackCommandMiddlewareArgs,
} from '@slack/bolt';
import { App } from '@slack/bolt';

export const SLACK_COMMAND = Symbol('SLACK_COMMAND');

export interface SlackCommand {
  command: string;
  handle(args: SlackCommandMiddlewareArgs & AllMiddlewareArgs): Promise<void>;
}

@Injectable()
export class RegistryService {
  private readonly logger = new Logger(RegistryService.name);

  constructor(
    @Inject(SLACK_COMMAND)
    private readonly commands: SlackCommand[],
  ) {}

  registerAll(app: App) {
    for (const cmd of this.commands) {
      app.command(cmd.command, (args) => cmd.handle(args));
      this.logger.log(`Registered command: ${cmd.command}`);
    }
  }
}
