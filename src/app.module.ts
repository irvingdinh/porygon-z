import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

import { CoreModule } from './core/core.module';
import { SlackModule } from './slack/slack.module';

@Module({
  imports: [
    CoreModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    SlackModule,
  ],
})
export class AppModule {}
