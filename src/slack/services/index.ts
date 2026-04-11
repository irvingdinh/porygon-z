import { BotService } from './bot.service';
import { ClaudeService } from './claude.service';
import { commandServices } from './commands';
import { listenerServices } from './listeners';
import { WorkspaceService } from './workspace.service';

export const services = [
  BotService,
  ClaudeService,
  WorkspaceService,
  ...commandServices,
  ...listenerServices,
];
