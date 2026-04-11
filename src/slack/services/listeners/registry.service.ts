import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt';
import { App } from '@slack/bolt';

export const SLACK_LISTENER = Symbol('SLACK_LISTENER');

export interface SlackListener<E extends string = string> {
  event: E;
  handle(args: SlackEventMiddlewareArgs<E> & AllMiddlewareArgs): Promise<void>;
}

@Injectable()
export class RegistryService {
  private readonly logger = new Logger(RegistryService.name);

  constructor(
    @Inject(SLACK_LISTENER)
    private readonly listeners: SlackListener[],
  ) {}

  registerAll(app: App) {
    for (const listener of this.listeners) {
      app.event(listener.event, (args: any) => listener.handle(args));
      this.logger.log(`Registered listener: ${listener.event}`);
    }
  }
}
