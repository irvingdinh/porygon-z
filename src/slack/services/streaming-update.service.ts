import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import type { WebClient } from '@slack/web-api';

import type { ThinkingBlock, ToolUseBlock } from './claude.service';
import { ClaudeFormatterService } from './claude-formatter.service';

// --- Internal state ---

interface ThreadStreamState {
  channelId: string;
  parentTs: string;
  client: WebClient;
  liveMessageTs: string;
  currentToolBlock: ToolUseBlock | null;
  finalized: boolean;
}

// --- Service ---

@Injectable()
export class StreamingUpdateService implements OnApplicationShutdown {
  private readonly logger = new Logger(StreamingUpdateService.name);
  private readonly streams = new Map<string, ThreadStreamState>();

  constructor(private readonly formatter: ClaudeFormatterService) {}

  // --- Event handlers ---

  @OnEvent('claude.stream.init')
  handleInit(payload: {
    parentTs: string;
    channelId: string;
    client: WebClient;
    liveMessageTs: string;
  }) {
    this.streams.set(payload.parentTs, {
      channelId: payload.channelId,
      parentTs: payload.parentTs,
      client: payload.client,
      liveMessageTs: payload.liveMessageTs,
      currentToolBlock: null,
      finalized: false,
    });
  }

  @OnEvent('claude.stream.thinking')
  handleThinking(payload: { parentTs: string; block: ThinkingBlock }) {
    const state = this.streams.get(payload.parentTs);
    if (!state) return;

    const text = this.formatter.formatThinkingMessage(payload.block);

    state.client.chat
      .postMessage({
        channel: state.channelId,
        thread_ts: state.parentTs,
        text,
      })
      .catch((err) => {
        this.logger.error(
          `Failed to post thinking message for ${payload.parentTs}`,
          err,
        );
      });
  }

  @OnEvent('claude.stream.tool')
  handleTool(payload: { parentTs: string; block: ToolUseBlock | null }) {
    const state = this.streams.get(payload.parentTs);
    if (!state) return;
    state.currentToolBlock = payload.block;
  }

  @OnEvent('claude.stream.end')
  handleEnd(payload: { parentTs: string }) {
    const state = this.streams.get(payload.parentTs);
    if (!state) return;
    state.finalized = true;
    this.streams.delete(payload.parentTs);
  }

  // --- Throttled flush ---

  @Interval(2000)
  async flushAll() {
    for (const state of this.streams.values()) {
      if (state.finalized) continue;
      await this.flushOne(state);
    }
  }

  // --- Public ---

  getLiveMessageTs(parentTs: string): string | null {
    return this.streams.get(parentTs)?.liveMessageTs ?? null;
  }

  // --- Lifecycle ---

  onApplicationShutdown() {
    this.streams.clear();
  }

  // --- Internal ---

  private async flushOne(state: ThreadStreamState) {
    const now = new Date();
    const text = state.currentToolBlock
      ? this.formatter.formatLiveToolCall(state.currentToolBlock, now)
      : this.formatter.formatLiveIdle(now);

    try {
      await state.client.chat.update({
        channel: state.channelId,
        ts: state.liveMessageTs,
        text,
      });
    } catch (err) {
      this.logger.error(
        `Failed to update live message for ${state.parentTs}`,
        err,
      );
    }
  }
}
