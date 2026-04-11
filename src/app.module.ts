import { Module } from '@nestjs/common';

import { CoreModule } from './core/core.module';
import { SlackModule } from './slack/slack.module';

@Module({
  imports: [CoreModule, SlackModule],
})
export class AppModule {}
