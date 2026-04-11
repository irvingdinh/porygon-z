import * as fs from 'node:fs';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AllMiddlewareArgs,
  SlackCommandMiddlewareArgs,
} from '@slack/bolt';

import { AppConfig } from '../../../core/config/config';
import { TemplateService } from '../../../core/services/template.service';
import type { ThreadSession } from '../thread.service';
import { SlackCommand } from './registry.service';

@Injectable()
export class CommandSessionsService implements SlackCommand {
  private readonly logger = new Logger(CommandSessionsService.name);

  readonly command = '/sessions';

  private readonly sessionsDir: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly template: TemplateService,
  ) {
    const config = this.configService.get<AppConfig>('root')!;
    this.sessionsDir = path.join(config.dir.home, 'sessions');
  }

  async handle({ ack }: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    const sessions = this.listSessions();
    await ack(
      this.template.render('slack.commands.command-sessions-ok', {
        sessions,
        count: sessions.length,
        empty: sessions.length === 0,
      }),
    );
  }

  private listSessions(): Array<{
    threadTs: string;
    sessionId: string | null;
    createdAt: string;
  }> {
    if (!fs.existsSync(this.sessionsDir)) return [];

    return fs
      .readdirSync(this.sessionsDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try {
          const raw = fs.readFileSync(path.join(this.sessionsDir, f), 'utf-8');
          const data = JSON.parse(raw) as ThreadSession;
          return {
            threadTs: f.replace('.json', ''),
            sessionId: data.sessionId,
            createdAt: data.createdAt,
          };
        } catch {
          return null;
        }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
