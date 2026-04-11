import { CommandCdService } from './command-cd.service';
import { CommandKillService } from './command-kill.service';
import { CommandLlService } from './command-ll.service';
import { CommandShService } from './command-sh.service';
import { CommandWorkspaceService } from './command-workspace.service';
import { RegistryService, SLACK_COMMAND } from './registry.service';

const commandClasses = [
  CommandKillService,
  CommandWorkspaceService,
  CommandCdService,
  CommandLlService,
  CommandShService,
];

export const commandServices = [
  RegistryService,
  ...commandClasses,
  {
    provide: SLACK_COMMAND,
    useFactory: (
      ...commands: InstanceType<(typeof commandClasses)[number]>[]
    ) => commands,
    inject: commandClasses,
  },
];
