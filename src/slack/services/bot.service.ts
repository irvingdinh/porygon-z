import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App } from '@slack/bolt';

import { AppConfig } from '../../core/config/config';
import { CommandWorkspaceService } from './commands/command-workspace.service';
import { RegistryService as ListenerRegistryService } from './listeners/registry.service';

@Injectable()
export class BotService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(BotService.name);
  private app!: App;

  constructor(
    private readonly configService: ConfigService,
    private readonly listenerRegistry: ListenerRegistryService,
    private readonly commandWorkspace: CommandWorkspaceService,
  ) {}

  async onApplicationBootstrap() {
    const config = this.configService.get<AppConfig>('root')!;

    this.app = new App({
      token: config.slack.botToken,
      appToken: config.slack.appToken,
      socketMode: true,
    });

    this.listenerRegistry.registerAll(this.app);

    this.app.action(this.commandWorkspace.actionId, (args) =>
      this.commandWorkspace.handleAction(args as any),
    );
    this.app.view(this.commandWorkspace.callbackId, (args) =>
      this.commandWorkspace.handleSubmission(args),
    );

    await this.app.start();
    this.logger.log('Porygon-Z is running!');
  }

  async onApplicationShutdown() {
    if (this.app) {
      await this.app.stop();
      this.logger.log('Porygon-Z stopped.');
    }
  }
}
