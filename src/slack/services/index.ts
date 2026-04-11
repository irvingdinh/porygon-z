import { AttachmentService } from './attachment.service';
import { BotService } from './bot.service';
import { ClaudeService } from './claude.service';
import { ClaudeFormatterService } from './claude-formatter.service';
import { commandServices } from './commands';
import { listenerServices } from './listeners';
import { ThreadService } from './thread.service';
import { WorkspaceService } from './workspace.service';

export const services = [
  AttachmentService,
  BotService,
  ClaudeFormatterService,
  ClaudeService,
  ThreadService,
  WorkspaceService,
  ...commandServices,
  ...listenerServices,
];
