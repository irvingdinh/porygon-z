import * as fs from 'node:fs';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';
import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt';
import type { WebClient } from '@slack/web-api';

import { TemplateService } from '../../../core/services/template.service';
import { AttachmentService, type SlackFile } from '../attachment.service';
import type { ContentBlock } from '../claude.service';
import { ClaudeService } from '../claude.service';
import { ClaudeFormatterService } from '../claude-formatter.service';
import { ThreadService } from '../thread.service';
import { WorkspaceService } from '../workspace.service';
import { SlackListener } from './registry.service';

// Per-thread serialisation lock — no timeout by design (some Claude runs take hours).
const threadLocks = new Map<string, Promise<void>>();

@Injectable()
export class ListenerMessageService implements SlackListener<'message'> {
  private readonly logger = new Logger(ListenerMessageService.name);

  readonly event = 'message' as const;

  constructor(
    private readonly claude: ClaudeService,
    private readonly formatter: ClaudeFormatterService,
    private readonly thread: ThreadService,
    private readonly workspace: WorkspaceService,
    private readonly attachment: AttachmentService,
    private readonly template: TemplateService,
  ) {}

  async handle(args: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs) {
    const { message, context, client } = args;

    if (message.subtype && message.subtype !== 'file_share') return;

    const msg = message;
    if (msg.user === context.botUserId) return;

    const parentTs = msg.thread_ts ?? msg.ts;
    const channelId = msg.channel;

    // Serialise per thread
    const existing = threadLocks.get(parentTs);
    if (existing) await existing;

    const promise = this.handleMessage(
      msg,
      client,
      channelId,
      parentTs,
    ).finally(() => {
      threadLocks.delete(parentTs);
    });
    threadLocks.set(parentTs, promise);
    await promise;
  }

  private async handleMessage(
    msg: any,
    client: WebClient,
    channelId: string,
    parentTs: string,
  ) {
    const msgTs: string = msg.ts;

    this.logger.log(
      `Message from ${msg.user}, channel: ${channelId}, ts: ${msgTs}, thread: ${msg.thread_ts ?? 'none'}`,
    );

    // React ⏳
    await this.addReaction(client, channelId, msgTs, 'hourglass_flowing_sand');

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
    const slackFiles: SlackFile[] = msg.files ?? [];
    let downloaded: Awaited<ReturnType<AttachmentService['download']>> = [];

    if (slackFiles.length > 0) {
      try {
        downloaded = await this.attachment.download(slackFiles, attachDir);
      } catch (err) {
        this.logger.error('Failed to download attachments', err);
      }
    }

    // --- Swap ⏳ → 🔄 ---
    await this.swapReaction(
      client,
      channelId,
      msgTs,
      'hourglass_flowing_sand',
      'arrows_counterclockwise',
    );

    // --- Build prompt ---
    const hasAttachments = slackFiles.length > 0 || this.dirHasFiles(attachDir);
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
        userMessage: msg.text ?? '',
        workspacePrompt: workspaceConfig?.systemPrompt ?? '',
      });
    };

    const prompt = buildPrompt(isResume);

    // --- Run Claude ---
    try {
      let result = await this.runAndStream(
        prompt,
        cwd,
        isResume ? session.sessionId! : undefined,
        parentTs,
        channelId,
        client,
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
          parentTs,
          channelId,
          client,
        );
      }

      // --- Final message ---
      const finalText =
        this.formatter.formatFinal(result.finalResult) ||
        this.formatter.formatStreaming(result.blocks);

      await client.chat.postMessage({
        channel: channelId,
        thread_ts: parentTs,
        text: finalText || 'No response generated.',
      });

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
      this.logger.error('Error in handleMessage', err);

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
    threadTs: string,
    channelId: string,
    client: WebClient,
  ): Promise<{
    blocks: ContentBlock[];
    finalResult: string;
    sessionId: string | null;
    failed: boolean;
  }> {
    let blocks: ContentBlock[] = [];
    let finalResult = '';
    let sessionId: string | null = null;
    let failed = false;
    let lastThinkingPosted = '';

    try {
      for await (const event of this.claude.run({
        prompt,
        cwd,
        resumeSessionId,
      })) {
        if (
          event.type === 'system' &&
          event.subtype === 'init' &&
          event.session_id
        ) {
          sessionId = event.session_id;
          this.thread.setSessionId(threadTs, sessionId);
        } else if (event.type === 'assistant' && event.message?.content) {
          blocks = event.message.content;

          // Post new thinking blocks as separate thread messages
          for (const block of blocks) {
            if (block.type !== 'thinking') continue;

            const text = block.thinking.trim();
            if (!text || text === lastThinkingPosted) continue;

            lastThinkingPosted = text;
            await client.chat.postMessage({
              channel: channelId,
              thread_ts: threadTs,
              text: this.formatter.formatStreaming([block]),
            });
          }
        } else if (event.type === 'result' && event.subtype === 'success') {
          finalResult = event.result ?? '';
        }
      }
    } catch {
      failed = true;
    }

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
    const files = this.listFilesRecursive(uploadsDirPath);

    for (const filePath of files) {
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
