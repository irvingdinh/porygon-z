import * as fs from 'node:fs';
import * as os from 'node:os';

import { Injectable, Logger } from '@nestjs/common';
import type {
  AllMiddlewareArgs,
  BlockAction,
  SlackActionMiddlewareArgs,
  SlackViewAction,
  SlackViewMiddlewareArgs,
} from '@slack/bolt';

import { TemplateService } from '../../../core/services/template.service';
import {
  type ChannelResponseMode,
  type EffortLevel,
  type PermissionMode,
  WorkspaceService,
} from '../workspace.service';
import { TextCommand, TextCommandContext } from './registry.service';

@Injectable()
export class CommandWorkspaceService implements TextCommand {
  private readonly logger = new Logger(CommandWorkspaceService.name);

  readonly name = 'workspace';
  readonly actionId = 'workspace_edit_settings';
  readonly callbackId = 'workspace_config_modal';

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly template: TemplateService,
  ) {}

  async handle(ctx: TextCommandContext) {
    const channelId = ctx.channelId;
    const config = this.workspace.get(channelId);

    const cwd = config?.cwd ?? os.homedir();
    const model = config?.model ?? 'opus[1m]';
    const effort = config?.effort ?? 'max';
    const permissionMode = config?.permissionMode ?? 'bypassPermissions';
    const channelResponseMode = config?.channelResponseMode ?? 'mention-only';
    const systemPrompt = config?.systemPrompt ?? '';

    const text = this.template.render('slack.commands.command-workspace-show', {
      cwd,
      model,
      effort,
      permissionLabel: this.permissionLabel(permissionMode),
      channelResponseLabel: this.channelResponseLabel(channelResponseMode),
      hasSystemPrompt: systemPrompt.length > 0,
    });

    await ctx.client.chat.postMessage({
      channel: ctx.channelId,
      thread_ts: ctx.threadTs,
      text,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              action_id: this.actionId,
              text: { type: 'plain_text', text: 'Edit Settings' },
              value: JSON.stringify({
                channelId,
                threadTs: ctx.threadTs,
              }),
              style: 'primary',
            },
          ],
        },
      ],
    });
  }

  async handleAction({
    ack,
    body,
    client,
  }: SlackActionMiddlewareArgs<BlockAction> & AllMiddlewareArgs) {
    await ack();

    const action = body.actions[0];
    const { channelId, threadTs } = JSON.parse(
      'value' in action ? (action.value ?? '{}') : '{}',
    ) as {
      channelId: string;
      threadTs?: string;
    };

    const config = this.workspace.get(channelId);

    const currentCwd = config?.cwd ?? os.homedir();
    const currentSystemPrompt = config?.systemPrompt ?? '';
    const currentModel = config?.model ?? 'opus[1m]';
    const currentEffort = config?.effort ?? 'max';
    const currentPermissionMode = config?.permissionMode ?? 'bypassPermissions';
    const currentChannelResponseMode =
      config?.channelResponseMode ?? 'mention-only';

    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: this.callbackId,
        private_metadata: JSON.stringify({ channelId, threadTs }),
        title: {
          type: 'plain_text',
          text: 'Workspace',
        },
        submit: {
          type: 'plain_text',
          text: 'Save',
        },
        close: {
          type: 'plain_text',
          text: 'Cancel',
        },
        blocks: [
          {
            type: 'input',
            block_id: 'cwd_block',
            label: {
              type: 'plain_text',
              text: 'Working Directory',
            },
            element: {
              type: 'plain_text_input',
              action_id: 'cwd_input',
              initial_value: currentCwd,
              placeholder: {
                type: 'plain_text',
                text: '/absolute/path/to/directory',
              },
            },
          },
          {
            type: 'input',
            block_id: 'model_block',
            label: {
              type: 'plain_text',
              text: 'Model',
            },
            element: {
              type: 'plain_text_input',
              action_id: 'model_input',
              initial_value: currentModel,
              placeholder: {
                type: 'plain_text',
                text: 'e.g. opus[1m]',
              },
            },
            hint: {
              type: 'plain_text',
              text: 'haiku, sonnet, sonnet[1m], opus, opus[1m], mythos',
            },
          },
          {
            type: 'input',
            block_id: 'effort_block',
            label: {
              type: 'plain_text',
              text: 'Effort',
            },
            element: {
              type: 'static_select',
              action_id: 'effort_input',
              initial_option: {
                text: { type: 'plain_text', text: currentEffort },
                value: currentEffort,
              },
              options: [
                { text: { type: 'plain_text', text: 'max' }, value: 'max' },
                { text: { type: 'plain_text', text: 'high' }, value: 'high' },
                {
                  text: { type: 'plain_text', text: 'medium' },
                  value: 'medium',
                },
                { text: { type: 'plain_text', text: 'low' }, value: 'low' },
              ],
            },
          },
          {
            type: 'input',
            block_id: 'permission_block',
            label: {
              type: 'plain_text',
              text: 'Permission Mode',
            },
            element: {
              type: 'static_select',
              action_id: 'permission_input',
              initial_option: {
                text: {
                  type: 'plain_text',
                  text: this.permissionLabel(currentPermissionMode),
                },
                value: currentPermissionMode,
              },
              options: [
                {
                  text: {
                    type: 'plain_text',
                    text: 'Bypass Permissions',
                  },
                  value: 'bypassPermissions',
                },
                {
                  text: { type: 'plain_text', text: 'Auto' },
                  value: 'auto',
                },
                {
                  text: { type: 'plain_text', text: 'Plan (read-only)' },
                  value: 'plan',
                },
              ],
            },
          },
          {
            type: 'input',
            block_id: 'channel_response_block',
            label: {
              type: 'plain_text',
              text: 'Channel Response Mode',
            },
            element: {
              type: 'static_select',
              action_id: 'channel_response_input',
              initial_option: {
                text: {
                  type: 'plain_text',
                  text: this.channelResponseLabel(currentChannelResponseMode),
                },
                value: currentChannelResponseMode,
              },
              options: [
                {
                  text: {
                    type: 'plain_text',
                    text: 'Mentions Only',
                  },
                  value: 'mention-only',
                },
                {
                  text: {
                    type: 'plain_text',
                    text: 'All Messages',
                  },
                  value: 'all-messages',
                },
              ],
            },
            hint: {
              type: 'plain_text',
              text: 'In channels: respond to @mentions only, or all messages',
            },
          },
          {
            type: 'input',
            block_id: 'system_prompt_block',
            optional: true,
            label: {
              type: 'plain_text',
              text: 'Workspace Instruction',
            },
            element: {
              type: 'plain_text_input',
              action_id: 'system_prompt_input',
              multiline: true,
              initial_value: currentSystemPrompt,
              placeholder: {
                type: 'plain_text',
                text: 'Optional instructions for Claude in this workspace...',
              },
            },
          },
        ],
      },
    });
  }

  async handleSubmission({
    ack,
    view,
    client,
  }: SlackViewMiddlewareArgs<SlackViewAction> & AllMiddlewareArgs) {
    const { channelId, threadTs } = JSON.parse(view.private_metadata) as {
      channelId: string;
      threadTs?: string;
    };

    const values = view.state.values;
    const cwd = values.cwd_block.cwd_input.value?.trim() ?? '';
    const model = values.model_block.model_input.value?.trim() ?? 'opus[1m]';
    const effort =
      (values.effort_block.effort_input.selected_option
        ?.value as EffortLevel) ?? 'max';
    const permissionMode =
      (values.permission_block.permission_input.selected_option
        ?.value as PermissionMode) ?? 'bypassPermissions';
    const channelResponseMode =
      (values.channel_response_block.channel_response_input.selected_option
        ?.value as ChannelResponseMode) ?? 'mention-only';
    const systemPrompt =
      values.system_prompt_block.system_prompt_input.value?.trim() ?? '';

    if (!cwd.startsWith('/')) {
      await ack({
        response_action: 'errors',
        errors: {
          cwd_block:
            'Working directory must be an absolute path (starts with /).',
        },
      });
      return;
    }

    let dirCreated = false;
    if (!fs.existsSync(cwd)) {
      try {
        fs.mkdirSync(cwd, { recursive: true });
        dirCreated = true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        await ack({
          response_action: 'errors',
          errors: {
            cwd_block: `Failed to create directory: ${errorMsg}`,
          },
        });
        return;
      }
    } else {
      const stat = fs.statSync(cwd);
      if (!stat.isDirectory()) {
        await ack({
          response_action: 'errors',
          errors: {
            cwd_block: 'Path exists but is not a directory.',
          },
        });
        return;
      }
    }

    await ack();

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

    await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
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
