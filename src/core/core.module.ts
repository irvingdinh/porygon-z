import { Global, Module } from '@nestjs/common';

import { modules } from './modules';
import { services } from './services';

@Global()
@Module({
  imports: [...modules],
  providers: [...services],
  exports: [...services],
})
export class CoreModule {}
