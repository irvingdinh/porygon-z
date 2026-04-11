import { AttachmentService } from './attachment.service';
import { BotService } from './bot.service';
import { ClaudeService } from './claude.service';
import { ClaudeFormatterService } from './claude-formatter.service';
import { commandServices } from './commands';
import { listenerServices } from './listeners';
import { MessageHandlerService } from './message-handler.service';
import { StreamingUpdateService } from './streaming-update.service';
import { ThreadService } from './thread.service';
import { WorkspaceService } from './workspace.service';

export const services = [
  AttachmentService,
  BotService,
  ClaudeFormatterService,
  ClaudeService,
  MessageHandlerService,
  StreamingUpdateService,
  ThreadService,
  WorkspaceService,
  ...commandServices,
  ...listenerServices,
];
