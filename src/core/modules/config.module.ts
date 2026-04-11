import { ConfigModule } from '@nestjs/config';

import { config } from '../config/config';

export const configModule = ConfigModule.forRoot({
  isGlobal: true,
  load: [config],
});
