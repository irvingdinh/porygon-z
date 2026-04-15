import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppConfig } from '../../core/config/config';

export type EffortLevel = 'low' | 'medium' | 'high' | 'max';
export type PermissionMode = 'auto' | 'plan' | 'bypassPermissions';
export type ChannelResponseMode = 'mention-only' | 'all-messages';

export interface WorkspaceConfig {
  cwd: string;
  systemPrompt?: string;
  model?: string;
  effort?: EffortLevel;
  permissionMode?: PermissionMode;
  channelResponseMode?: ChannelResponseMode;
}

@Injectable()
export class WorkspaceService implements OnModuleInit {
  private readonly logger = new Logger(WorkspaceService.name);

  private readonly workspacesDir: string;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.get<AppConfig>('root')!;
    this.workspacesDir = path.join(config.dir.home, 'workspaces');
  }

  onModuleInit() {
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

    try {
      fs.writeFileSync(
        this.configPath(channelId),
        JSON.stringify(merged, null, 2),
      );
    } catch (err) {
      this.logger.error(
        `Failed to write workspace config for ${channelId}`,
        err,
      );
      throw err;
    }
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
