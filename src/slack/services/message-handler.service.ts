import * as fs from 'node:fs';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { WebClient } from '@slack/web-api';

import { TemplateService } from '../../core/services/template.service';
import { AttachmentService } from './attachment.service';
import type { ContentBlock } from './claude.service';
import { ClaudeService } from './claude.service';
import { ClaudeFormatterService } from './claude-formatter.service';
import type { MessageContext } from './message-handler.types';
import { ThreadService } from './thread.service';
import { type WorkspaceConfig, WorkspaceService } from './workspace.service';

// Per-thread serialisation lock — no timeout by design (some Claude runs take hours).
const threadLocks = new Map<string, Promise<void>>();

@Injectable()
export class MessageHandlerService {
  private readonly logger = new Logger(MessageHandlerService.name);

  constructor(
    private readonly claude: ClaudeService,
    private readonly formatter: ClaudeFormatterService,
    private readonly thread: ThreadService,
    private readonly workspace: WorkspaceService,
    private readonly attachment: AttachmentService,
    private readonly template: TemplateService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async processMessageSerialized(ctx: MessageContext): Promise<void> {
    const existing = threadLocks.get(ctx.parentTs);
    if (existing) await existing;

    const promise = this.processMessage(ctx).finally(() => {
      threadLocks.delete(ctx.parentTs);
    });
    threadLocks.set(ctx.parentTs, promise);
    await promise;
  }

  private async processMessage(ctx: MessageContext) {
    const { channelId, userId, parentTs, msgTs, text, files, client } = ctx;

    this.logger.log(
      `Message from ${userId}, channel: ${channelId}, ts: ${msgTs}, thread: ${parentTs}`,
    );

    // React hourglass
    await this.addReaction(client, channelId, msgTs, 'hourglass_flowing_sand');

    // --- Create live message immediately ---
    const liveMsg = await client.chat.postMessage({
      channel: channelId,
      thread_ts: parentTs,
      text: this.formatter.formatLiveInitializing(),
    });
    const liveMessageTs = liveMsg.ts!;

    // --- Session ---
    const sessionExists = this.thread.exists(parentTs);
    let session = this.thread.get(parentTs);
    const isResume = session?.sessionId != null;

    if (!session) {
      if (sessionExists) {
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: parentTs,
          text: this.template.render(
            'slack.listeners.listener-message-session-corrupted',
          ),
        });
      }
      session = this.thread.create(parentTs);
    }

    // --- Workspace & temp dirs ---
    const cwd = this.workspace.resolveCwd(channelId);
    fs.mkdirSync(cwd, { recursive: true });

    const attachDir = this.thread.attachmentsDir(channelId, parentTs);
    const uploadDir = this.thread.uploadsDir(channelId, parentTs, msgTs);

    // --- Download attachments ---
    let downloaded: Awaited<ReturnType<AttachmentService['download']>> = [];

    if (files.length > 0) {
      try {
        downloaded = await this.attachment.download(files, attachDir);
      } catch (err) {
        this.logger.error('Failed to download attachments', err);
      }
    }

    // --- Swap hourglass -> arrows ---
    await this.swapReaction(
      client,
      channelId,
      msgTs,
      'hourglass_flowing_sand',
      'arrows_counterclockwise',
    );

    // --- Build prompt ---
    const hasAttachments = files.length > 0 || this.dirHasFiles(attachDir);
    const attachmentsSection = hasAttachments
      ? this.attachment.buildPromptSection(downloaded, attachDir)
      : '';

    const workspaceConfig = this.workspace.get(channelId);

    const buildPrompt = (forResume: boolean) => {
      const templateName = forResume
        ? 'slack.listeners.listener-message-follow-up-prompt'
        : 'slack.listeners.listener-message-system-prompt';
      return this.template.render(templateName, {
        uploadDir,
        attachmentsSection,
        userMessage: text,
        workspacePrompt: workspaceConfig?.systemPrompt ?? '',
      });
    };

    // --- Run Claude ---
    try {
      let result = await this.runAndStream(
        buildPrompt(isResume),
        cwd,
        isResume ? session.sessionId! : undefined,
        ctx,
        workspaceConfig,
        liveMessageTs,
      );

      // Retry with fresh session if resume failed
      if (result.failed && isResume) {
        this.logger.log(
          `Resume failed for ${parentTs}, starting fresh session`,
        );
        this.thread.clearSessionId(parentTs);

        await client.chat.postMessage({
          channel: channelId,
          thread_ts: parentTs,
          text: this.template.render(
            'slack.listeners.listener-message-session-expired',
          ),
        });

        result = await this.runAndStream(
          buildPrompt(false),
          cwd,
          undefined,
          ctx,
          workspaceConfig,
          liveMessageTs,
        );
      }

      // --- Final message — delete live message, post new ---
      const { text: finalText, fullText } = this.formatter.formatFinal(
        result.finalResult,
      );

      try {
        await client.chat.delete({ channel: channelId, ts: liveMessageTs });
      } catch {
        // best-effort: live message may already be gone
      }

      await client.chat.postMessage({
        channel: channelId,
        thread_ts: parentTs,
        text: finalText || 'No response generated.',
      });

      // Upload full response file if truncated
      if (fullText) {
        const fullResponsePath = path.join(uploadDir, 'response.md');
        fs.writeFileSync(fullResponsePath, fullText, 'utf-8');
      }

      // --- Upload outbound files ---
      const hasUploads = this.dirHasFiles(uploadDir);
      if (hasUploads) {
        await this.swapReaction(
          client,
          channelId,
          msgTs,
          'arrows_counterclockwise',
          'outbox_tray',
        );
        await this.uploadFiles(client, channelId, parentTs, uploadDir);
      }

      // Remove in-progress reaction on success
      await this.removeReaction(
        client,
        channelId,
        msgTs,
        hasUploads ? 'outbox_tray' : 'arrows_counterclockwise',
      );
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Unknown error occurred';
      this.logger.error('Error in processMessage', err);

      await client.chat.postMessage({
        channel: channelId,
        thread_ts: parentTs,
        text: this.template.render('slack.listeners.listener-message-error', {
          message: errorMsg,
        }),
      });
      await this.swapReaction(
        client,
        channelId,
        msgTs,
        'arrows_counterclockwise',
        'x',
      );
    }
  }

  private async runAndStream(
    prompt: string,
    cwd: string,
    resumeSessionId: string | undefined,
    ctx: MessageContext,
    workspaceConfig: WorkspaceConfig | null,
    liveMessageTs: string,
  ): Promise<{
    blocks: ContentBlock[];
    finalResult: string;
    sessionId: string | null;
    failed: boolean;
  }> {
    const { channelId, userId, parentTs, client } = ctx;

    this.eventEmitter.emit('claude.stream.init', {
      parentTs,
      channelId,
      client,
      liveMessageTs,
    });

    const blocks: ContentBlock[] = [];
    let finalResult = '';
    let sessionId: string | null = null;
    let failed = false;

    try {
      for await (const event of this.claude.run({
        prompt,
        cwd,
        resumeSessionId,
        model: workspaceConfig?.model,
        effort: workspaceConfig?.effort,
        permissionMode: workspaceConfig?.permissionMode,
        context: { channelId, userId, threadTs: parentTs },
      })) {
        if (
          event.type === 'system' &&
          event.subtype === 'init' &&
          event.session_id
        ) {
          sessionId = event.session_id;
          this.thread.setSessionId(parentTs, sessionId);
        } else if (event.type === 'assistant' && event.message?.content) {
          const content = event.message.content;

          for (const block of content) {
            blocks.push(block);

            if (block.type === 'thinking') {
              this.eventEmitter.emit('claude.stream.thinking', {
                parentTs,
                block,
              });
            } else if (block.type === 'tool_use') {
              this.eventEmitter.emit('claude.stream.tool', {
                parentTs,
                block,
              });
            }
          }
        } else if (
          event.type === 'system' &&
          event.subtype === 'task_started'
        ) {
          this.eventEmitter.emit('claude.stream.task_started', {
            parentTs,
            taskId: event.task_id,
            description: event.description,
          });
        } else if (
          event.type === 'system' &&
          event.subtype === 'task_progress'
        ) {
          this.eventEmitter.emit('claude.stream.task_progress', {
            parentTs,
            taskId: event.task_id,
            description: event.description,
            toolName: event.last_tool_name,
            toolCount: event.usage?.tool_uses,
            durationMs: event.usage?.duration_ms,
          });
        } else if (
          event.type === 'system' &&
          event.subtype === 'task_notification'
        ) {
          this.eventEmitter.emit('claude.stream.task_completed', {
            parentTs,
            taskId: event.task_id,
          });
        } else if (event.type === 'result' && event.subtype === 'success') {
          finalResult = event.result ?? '';
        }
      }
    } catch {
      failed = true;
    }

    this.eventEmitter.emit('claude.stream.end', { parentTs });

    if (resumeSessionId && !sessionId) {
      failed = true;
    }

    return { blocks, finalResult, sessionId, failed };
  }

  // --- Helpers ---

  private async addReaction(
    client: WebClient,
    channel: string,
    ts: string,
    emoji: string,
  ) {
    try {
      await client.reactions.add({ channel, timestamp: ts, name: emoji });
    } catch {
      // non-critical
    }
  }

  private async removeReaction(
    client: WebClient,
    channel: string,
    ts: string,
    emoji: string,
  ) {
    try {
      await client.reactions.remove({ channel, timestamp: ts, name: emoji });
    } catch {
      // non-critical
    }
  }

  private async swapReaction(
    client: WebClient,
    channel: string,
    ts: string,
    oldEmoji: string,
    newEmoji: string,
  ) {
    await this.removeReaction(client, channel, ts, oldEmoji);
    await this.addReaction(client, channel, ts, newEmoji);
  }

  private async uploadFiles(
    client: WebClient,
    channel: string,
    threadTs: string,
    uploadsDirPath: string,
  ) {
    const filePaths = this.listFilesRecursive(uploadsDirPath);

    for (const filePath of filePaths) {
      const filename = path.basename(filePath);
      try {
        const content = fs.readFileSync(filePath);
        await client.filesUploadV2({
          channel_id: channel,
          thread_ts: threadTs,
          filename,
          file: content,
        });
        this.logger.log(`Uploaded file: ${filename}`);
      } catch (err) {
        this.logger.error(`Failed to upload file ${filename}`, err);
      }
    }
  }

  private listFilesRecursive(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];

    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.listFilesRecursive(fullPath));
      } else {
        results.push(fullPath);
      }
    }

    return results;
  }

  private dirHasFiles(dir: string): boolean {
    return this.listFilesRecursive(dir).length > 0;
  }
}
