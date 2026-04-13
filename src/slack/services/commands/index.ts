import { CommandCdService } from './command-cd.service';
import { CommandHelpService } from './command-help.service';
import { CommandKillService } from './command-kill.service';
import { CommandKillAllService } from './command-kill-all.service';
import { CommandLlService } from './command-ll.service';
import { CommandSessionsService } from './command-sessions.service';
import { CommandWorkspaceService } from './command-workspace.service';
import { CommandRouterService, TEXT_COMMAND } from './registry.service';

const commandClasses = [
  CommandKillService,
  CommandKillAllService,
  CommandWorkspaceService,
  CommandCdService,
  CommandLlService,
  CommandSessionsService,
  CommandHelpService,
];

export const commandServices = [
  CommandRouterService,
  ...commandClasses,
  {
    provide: TEXT_COMMAND,
    useFactory: (
      ...commands: InstanceType<(typeof commandClasses)[number]>[]
    ) => commands,
    inject: commandClasses,
  },
];
