import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppConfig } from '../../core/config/config';

export interface WorkspaceConfig {
  cwd: string;
}

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);

  private readonly workspacesDir: string;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.get<AppConfig>('root')!;
    this.workspacesDir = path.join(config.dir.home, 'workspaces');
    fs.mkdirSync(this.workspacesDir, { recursive: true });
  }

  get(channelId: string): WorkspaceConfig | null {
    const filePath = this.configPath(channelId);

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as WorkspaceConfig;
    } catch {
      return null;
    }
  }

  set(channelId: string, partial: Partial<WorkspaceConfig>): void {
    const existing = this.get(channelId) ?? ({} as WorkspaceConfig);
    const merged = { ...existing, ...partial };

    fs.writeFileSync(
      this.configPath(channelId),
      JSON.stringify(merged, null, 2),
    );
  }

  resolveCwd(channelId: string): string {
    return this.get(channelId)?.cwd ?? os.homedir();
  }

  resolveRelativePath(base: string, target: string): string {
    const resolved = path.resolve(base, target);
    const normalizedBase = path.resolve(base);

    if (
      resolved !== normalizedBase &&
      !resolved.startsWith(normalizedBase + path.sep)
    ) {
      throw new Error(`Path escapes the base directory: ${target}`);
    }

    return resolved;
  }

  private configPath(channelId: string): string {
    return path.join(this.workspacesDir, `${channelId}.json`);
  }
}
