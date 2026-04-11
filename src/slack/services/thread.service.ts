import * as fs from 'node:fs';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppConfig } from '../../core/config/config';

// --- Session data ---

export interface ThreadSession {
  sessionId: string | null;
  createdAt: string;
}

// --- Service ---

@Injectable()
export class ThreadService {
  private readonly logger = new Logger(ThreadService.name);
  private readonly sessionsDir: string;
  private readonly tempBase: string;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.get<AppConfig>('root')!;
    this.sessionsDir = path.join(config.dir.home, 'sessions');
    this.tempBase = path.join(config.dir.temp, 'porygon-z', 'threads');

    fs.mkdirSync(this.sessionsDir, { recursive: true });
    fs.mkdirSync(this.tempBase, { recursive: true });
  }

  // --- Session management ---

  exists(threadTs: string): boolean {
    return fs.existsSync(this.sessionPath(threadTs));
  }

  get(threadTs: string): ThreadSession | null {
    const filePath = this.sessionPath(threadTs);

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as ThreadSession;
    } catch {
      return null;
    }
  }

  create(threadTs: string): ThreadSession {
    const session: ThreadSession = {
      sessionId: null,
      createdAt: new Date().toISOString(),
    };
    this.writeSession(threadTs, session);
    return session;
  }

  setSessionId(threadTs: string, sessionId: string): void {
    const session = this.get(threadTs) ?? {
      sessionId: null,
      createdAt: new Date().toISOString(),
    };
    session.sessionId = sessionId;
    this.writeSession(threadTs, session);
  }

  clearSessionId(threadTs: string): void {
    const session = this.get(threadTs);
    if (!session) return;
    session.sessionId = null;
    this.writeSession(threadTs, session);
  }

  // --- Temp directories ---

  attachmentsDir(channelId: string, parentTs: string): string {
    const dir = path.join(this.threadBase(channelId, parentTs), 'attachments');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  uploadsDir(channelId: string, parentTs: string, tempMsgTs: string): string {
    const dir = path.join(
      this.threadBase(channelId, parentTs),
      'uploads',
      tempMsgTs,
    );
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  // --- Private helpers ---

  private sessionPath(threadTs: string): string {
    return path.join(this.sessionsDir, `${threadTs}.json`);
  }

  private threadBase(channelId: string, parentTs: string): string {
    return path.join(this.tempBase, `${channelId}-${parentTs}`);
  }

  private writeSession(threadTs: string, session: ThreadSession): void {
    fs.writeFileSync(
      this.sessionPath(threadTs),
      JSON.stringify(session, null, 2),
    );
  }
}
