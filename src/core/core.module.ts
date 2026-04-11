import { Global, Module } from '@nestjs/common';

import { modules } from './modules';

@Global()
@Module({
  imports: [...modules],
})
export class CoreModule {}
