import { ListenerMessageService } from './listener-message.service';
import { RegistryService, SLACK_LISTENER } from './registry.service';

const listenerClasses = [ListenerMessageService];

export const listenerServices = [
  RegistryService,
  ...listenerClasses,
  {
    provide: SLACK_LISTENER,
    useFactory: (
      ...listeners: InstanceType<(typeof listenerClasses)[number]>[]
    ) => listeners,
    inject: listenerClasses,
  },
];
