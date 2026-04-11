import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App } from '@slack/bolt';

import { AppConfig } from '../../core/config/config';

@Injectable()
export class BotService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(BotService.name);
  private app!: InstanceType<typeof App>;

  constructor(private readonly configService: ConfigService) {}

  async onApplicationBootstrap() {
    const config = this.configService.get<AppConfig>('root')!;

    this.app = new App({
      token: config.slack.botToken,
      appToken: config.slack.appToken,
      socketMode: true,
    });

    this.registerCommands();
    this.registerMessageListener();

    await this.app.start();
    this.logger.log('Porygon-Z is running!');
  }

  async onApplicationShutdown() {
    if (this.app) {
      await this.app.stop();
      this.logger.log('Porygon-Z stopped.');
    }
  }

  private registerCommands() {
    this.app.command('/kill', async ({ ack }) => {
      // TODO: Delegate to a ProcessRegistryService
      await ack(':skull_and_crossbones: /kill is not yet implemented.');
    });

    this.app.command('/workspace', async ({ ack, command }) => {
      const path = command.text.trim();

      if (!path) {
        // TODO: Delegate to SessionService to get current workspace
        await ack(':file_folder: /workspace is not yet implemented.');
        return;
      }

      // TODO: Delegate to SessionService to set workspace
      await ack(':file_folder: /workspace is not yet implemented.');
    });

    this.app.command('/cd', async ({ ack, command }) => {
      const target = command.text.trim();

      if (!target) {
        // TODO: Delegate to SessionService
        await ack(':file_folder: /cd is not yet implemented.');
        return;
      }

      // TODO: Delegate to SessionService
      await ack(':file_folder: /cd is not yet implemented.');
    });

    this.app.command('/ll', async ({ ack }) => {
      // TODO: Delegate to SessionService for cwd, then exec ls -la
      await ack(':file_folder: /ll is not yet implemented.');
    });

    this.app.command('/sh', async ({ ack, command }) => {
      const rawCommand = command.text.trim();

      if (!rawCommand) {
        await ack(':x: Usage: `/sh <command>` — e.g. `/sh make restart`');
        return;
      }

      await ack();

      // TODO: Delegate to ShellService
      this.logger.warn('/sh is not yet implemented.');
    });
  }

  private registerMessageListener() {
    // eslint-disable-next-line @typescript-eslint/require-await
    this.app.message(async ({ message, context }) => {
      if (message.subtype && message.subtype !== 'file_share') return;

      const msg = message;

      if (msg.user === context.botUserId) return;

      this.logger.log(
        `Message from ${msg.user} in ${msg.channel}: ${(msg.text ?? '').slice(0, 80)}`,
      );

      // TODO: Delegate to MessageHandlerService
    });
  }
}
