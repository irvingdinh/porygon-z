import { Module } from '@nestjs/common';

import { CoreModule } from '../core/core.module';
import { services } from './services';

@Module({
  imports: [CoreModule],
  providers: [...services],
  exports: [...services],
})
export class SlackModule {}
