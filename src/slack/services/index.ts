import { BotService } from './bot.service';
import { commandServices } from './commands';
import { listenerServices } from './listeners';

export const services = [BotService, ...commandServices, ...listenerServices];
