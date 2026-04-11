import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import type { WebClient } from '@slack/web-api';

import type { ContentBlock } from './claude.service';
import { ClaudeFormatterService } from './claude-formatter.service';

// --- Internal state ---

interface ThreadStreamState {
  channelId: string;
  parentTs: string;
  client: WebClient;
  progressMessageTs: string | null;
  blocks: ContentBlock[];
  activeToolName: string | undefined;
  dirty: boolean;
  finalized: boolean;
}

// --- Service ---

@Injectable()
export class StreamingUpdateService implements OnApplicationShutdown {
  private readonly logger = new Logger(StreamingUpdateService.name);
  private readonly streams = new Map<string, ThreadStreamState>();
  private readonly completedProgressTs = new Map<string, string>();

  constructor(private readonly formatter: ClaudeFormatterService) {}

  // --- Event handlers ---

  @OnEvent('claude.stream.init')
  handleInit(payload: {
    parentTs: string;
    channelId: string;
    client: WebClient;
  }) {
    this.streams.set(payload.parentTs, {
      channelId: payload.channelId,
      parentTs: payload.parentTs,
      client: payload.client,
      progressMessageTs: null,
      blocks: [],
      activeToolName: undefined,
      dirty: false,
      finalized: false,
    });
  }

  @OnEvent('claude.stream.blocks')
  handleBlocks(payload: {
    parentTs: string;
    blocks: ContentBlock[];
    activeToolName?: string;
  }) {
    const state = this.streams.get(payload.parentTs);
    if (!state) return;
    state.blocks = payload.blocks;
    state.activeToolName = payload.activeToolName;
    state.dirty = true;
  }

  @OnEvent('claude.stream.end')
  async handleEnd(payload: { parentTs: string }) {
    const state = this.streams.get(payload.parentTs);
    if (!state) return;
    state.finalized = true;
    await this.flushOne(state);
    if (state.progressMessageTs) {
      this.completedProgressTs.set(payload.parentTs, state.progressMessageTs);
    }
    this.streams.delete(payload.parentTs);
  }

  // --- Throttled flush ---

  @Interval(2000)
  async flushAll() {
    for (const state of this.streams.values()) {
      if (state.dirty && !state.finalized) {
        await this.flushOne(state);
      }
    }
  }

  // --- Public ---

  getProgressMessageTs(parentTs: string): string | null {
    return (
      this.streams.get(parentTs)?.progressMessageTs ??
      this.completedProgressTs.get(parentTs) ??
      null
    );
  }

  clearProgressMessageTs(parentTs: string) {
    this.completedProgressTs.delete(parentTs);
  }

  // --- Lifecycle ---

  async onApplicationShutdown() {
    for (const state of this.streams.values()) {
      await this.flushOne(state);
    }
    this.streams.clear();
  }

  // --- Internal ---

  private async flushOne(state: ThreadStreamState) {
    if (!state.dirty && state.progressMessageTs) return;

    const text = this.formatter.formatStreaming(
      state.blocks,
      state.activeToolName,
    );
    if (!text) return;

    try {
      if (!state.progressMessageTs) {
        const result = await state.client.chat.postMessage({
          channel: state.channelId,
          thread_ts: state.parentTs,
          text,
        });
        state.progressMessageTs = result.ts ?? null;
      } else {
        await state.client.chat.update({
          channel: state.channelId,
          ts: state.progressMessageTs,
          text,
        });
      }
      state.dirty = false;
    } catch (err) {
      this.logger.error(`Failed to flush progress for ${state.parentTs}`, err);
    }
  }
}
