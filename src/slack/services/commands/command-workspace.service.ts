import * as fs from 'node:fs';
import * as os from 'node:os';

import { Injectable, Logger } from '@nestjs/common';

import { TemplateService } from '../../../core/services/template.service';
import {
  type ChannelResponseMode,
  type EffortLevel,
  type PermissionMode,
  WorkspaceService,
} from '../workspace.service';
import { TextCommand, TextCommandContext } from './registry.service';

const VALID_EFFORTS: EffortLevel[] = ['low', 'medium', 'high', 'max'];
const VALID_PERMISSIONS: PermissionMode[] = [
  'plan',
  'auto',
  'bypassPermissions',
];
const VALID_RESPONSES: ChannelResponseMode[] = ['mention-only', 'all-messages'];

const VALID_KEYS = [
  'cwd',
  'model',
  'effort',
  'permission',
  'response',
  'prompt',
];

@Injectable()
export class CommandWorkspaceService implements TextCommand {
  private readonly logger = new Logger(CommandWorkspaceService.name);

  readonly name = 'workspace';

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly template: TemplateService,
  ) {}

  async handle(ctx: TextCommandContext) {
    const channelId = ctx.channelId;

    if (!ctx.text) {
      await this.showConfig(ctx, channelId);
      return;
    }

    await this.updateConfig(ctx, channelId);
  }

  private async showConfig(ctx: TextCommandContext, channelId: string) {
    const config = this.workspace.get(channelId);

    const cwd = config?.cwd ?? os.homedir();
    const model = config?.model ?? 'opus[1m]';
    const effort = config?.effort ?? 'max';
    const permissionMode = config?.permissionMode ?? 'bypassPermissions';
    const channelResponseMode = config?.channelResponseMode ?? 'mention-only';
    const systemPrompt = config?.systemPrompt ?? '';

    await ctx.client.chat.postMessage({
      channel: ctx.channelId,
      thread_ts: ctx.threadTs,
      text: this.template.render('slack.commands.command-workspace-show', {
        cwd,
        model,
        effort,
        permissionLabel: this.permissionLabel(permissionMode),
        channelResponseLabel: this.channelResponseLabel(channelResponseMode),
        hasSystemPrompt: systemPrompt.length > 0,
      }),
    });
  }

  private async updateConfig(ctx: TextCommandContext, channelId: string) {
    const parsed = this.parseKeyValues(ctx.text);

    if (parsed.error) {
      await ctx.client.chat.postMessage({
        channel: ctx.channelId,
        thread_ts: ctx.threadTs,
        text: `:x: ${parsed.error}`,
      });
      return;
    }

    const updates = parsed.entries!;

    // Validate all entries before applying
    const config = this.workspace.get(channelId);
    const currentCwd = config?.cwd ?? os.homedir();
    const currentModel = config?.model ?? 'opus[1m]';
    const currentEffort = config?.effort ?? 'max';
    const currentPermissionMode = config?.permissionMode ?? 'bypassPermissions';
    const currentChannelResponseMode =
      config?.channelResponseMode ?? 'mention-only';
    const currentSystemPrompt = config?.systemPrompt ?? '';

    let cwd = currentCwd;
    let model = currentModel;
    let effort: EffortLevel = currentEffort;
    let permissionMode: PermissionMode = currentPermissionMode;
    let channelResponseMode: ChannelResponseMode = currentChannelResponseMode;
    let systemPrompt = currentSystemPrompt;
    let dirCreated = false;

    for (const [key, value] of updates) {
      switch (key) {
        case 'cwd':
          if (!value.startsWith('/')) {
            await ctx.client.chat.postMessage({
              channel: ctx.channelId,
              thread_ts: ctx.threadTs,
              text: ':x: Working directory must be an absolute path (starts with `/`).',
            });
            return;
          }
          if (!fs.existsSync(value)) {
            try {
              fs.mkdirSync(value, { recursive: true });
              dirCreated = true;
            } catch (err) {
              const errorMsg =
                err instanceof Error ? err.message : 'Unknown error';
              await ctx.client.chat.postMessage({
                channel: ctx.channelId,
                thread_ts: ctx.threadTs,
                text: `:x: Failed to create directory: ${errorMsg}`,
              });
              return;
            }
          } else {
            const stat = fs.statSync(value);
            if (!stat.isDirectory()) {
              await ctx.client.chat.postMessage({
                channel: ctx.channelId,
                thread_ts: ctx.threadTs,
                text: ':x: Path exists but is not a directory.',
              });
              return;
            }
          }
          cwd = value;
          break;

        case 'model':
          model = value;
          break;

        case 'effort':
          if (!VALID_EFFORTS.includes(value as EffortLevel)) {
            await ctx.client.chat.postMessage({
              channel: ctx.channelId,
              thread_ts: ctx.threadTs,
              text: `:x: Invalid effort \`${value}\`. Valid values: ${VALID_EFFORTS.map((e) => `\`${e}\``).join(', ')}`,
            });
            return;
          }
          effort = value as EffortLevel;
          break;

        case 'permission':
          if (!VALID_PERMISSIONS.includes(value as PermissionMode)) {
            await ctx.client.chat.postMessage({
              channel: ctx.channelId,
              thread_ts: ctx.threadTs,
              text: `:x: Invalid permission \`${value}\`. Valid values: ${VALID_PERMISSIONS.map((p) => `\`${p}\``).join(', ')}`,
            });
            return;
          }
          permissionMode = value as PermissionMode;
          break;

        case 'response':
          if (!VALID_RESPONSES.includes(value as ChannelResponseMode)) {
            await ctx.client.chat.postMessage({
              channel: ctx.channelId,
              thread_ts: ctx.threadTs,
              text: `:x: Invalid response mode \`${value}\`. Valid values: ${VALID_RESPONSES.map((r) => `\`${r}\``).join(', ')}`,
            });
            return;
          }
          channelResponseMode = value as ChannelResponseMode;
          break;

        case 'prompt':
          systemPrompt = value;
          break;
      }
    }

    // Apply the update
    this.workspace.set(channelId, {
      cwd,
      model,
      effort,
      permissionMode,
      channelResponseMode,
      systemPrompt,
    });

    this.logger.log(
      `Workspace config updated for channel ${channelId}: cwd=${cwd}, model=${model}, effort=${effort}, permissionMode=${permissionMode}, channelResponseMode=${channelResponseMode}`,
    );

    const templateName = dirCreated
      ? 'slack.commands.command-workspace-ok-created'
      : 'slack.commands.command-workspace-ok';

    await ctx.client.chat.postMessage({
      channel: ctx.channelId,
      thread_ts: ctx.threadTs,
      text: this.template.render(templateName, {
        cwd,
        model,
        effort,
        permissionLabel: this.permissionLabel(permissionMode),
        channelResponseLabel: this.channelResponseLabel(channelResponseMode),
        hasSystemPrompt: systemPrompt.length > 0,
      }),
    });
  }

  private parseKeyValues(
    text: string,
  ):
    | { entries: [string, string][]; error?: undefined }
    | { entries?: undefined; error: string } {
    const entries: [string, string][] = [];
    const regex = /(\w+)=("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\S+)/g;
    let match: RegExpExecArray | null;

    // Check for content that doesn't match key=value pattern
    const stripped = text.replace(regex, '').trim();
    if (stripped.length > 0) {
      return {
        error: `Invalid format. Use \`key=value\` pairs.\nValid keys: ${VALID_KEYS.map((k) => `\`${k}\``).join(', ')}`,
      };
    }

    // Reset regex state after replace
    regex.lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      const key = match[1];
      let value = match[2];

      // Strip surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
      }

      if (!VALID_KEYS.includes(key)) {
        return {
          error: `Unknown key \`${key}\`. Valid keys: ${VALID_KEYS.map((k) => `\`${k}\``).join(', ')}`,
        };
      }

      entries.push([key, value]);
    }

    if (entries.length === 0) {
      return {
        error: `Invalid format. Use \`key=value\` pairs.\nValid keys: ${VALID_KEYS.map((k) => `\`${k}\``).join(', ')}`,
      };
    }

    return { entries };
  }

  private permissionLabel(mode: PermissionMode): string {
    switch (mode) {
      case 'bypassPermissions':
        return 'Bypass Permissions';
      case 'auto':
        return 'Auto';
      case 'plan':
        return 'Plan (read-only)';
    }
  }

  private channelResponseLabel(mode: ChannelResponseMode): string {
    switch (mode) {
      case 'mention-only':
        return 'Mentions Only';
      case 'all-messages':
        return 'All Messages';
    }
  }
}
