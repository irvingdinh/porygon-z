import { Injectable } from '@nestjs/common';

import type { ThinkingBlock, ToolUseBlock } from './claude.service';

const MAX_MESSAGE_LENGTH = 3800;
const MAX_THINKING_LENGTH = 39000;

@Injectable()
export class ClaudeFormatterService {
  formatLiveInitializing(): string {
    return ':hourglass: Initializing...';
  }

  formatLiveToolCall(block: ToolUseBlock, timestamp: Date): string {
    const summary = this.summarizeToolInput(block.name, block.input);
    const detail = summary ? `\n> ${summary}` : '';
    const ts = this.formatTimestamp(timestamp);
    return `> :hammer_and_wrench: *${block.name}*${detail}\n_Last updated: ${ts}_`;
  }

  formatLiveIdle(timestamp: Date): string {
    const ts = this.formatTimestamp(timestamp);
    return `> :hourglass: _Processing..._\n_Last updated: ${ts}_`;
  }

  formatThinkingMessage(block: ThinkingBlock): string {
    const text = this.truncate(block.thinking.trim(), MAX_THINKING_LENGTH);
    return `> :brain: *Thinking*\n${this.quoteLines(text)}`;
  }

  formatFinal(resultText: string): { text: string; fullText: string | null } {
    const raw = resultText || '';
    if (raw.length <= MAX_MESSAGE_LENGTH) {
      return { text: raw, fullText: null };
    }
    const truncated =
      this.truncate(raw, MAX_MESSAGE_LENGTH) +
      '\n\n_Full response attached as file._';
    return { text: truncated, fullText: raw };
  }

  // --- Private helpers ---

  private summarizeToolInput(
    name: string,
    input: Record<string, unknown>,
  ): string {
    switch (name) {
      case 'Bash': {
        const cmd = typeof input.command === 'string' ? input.command : '';
        return `\`${this.truncate(cmd, 120)}\``;
      }
      case 'Read':
      case 'Write':
      case 'Edit': {
        const filePath =
          typeof input.file_path === 'string' ? input.file_path : '';
        return `\`${filePath}\``;
      }
      case 'Glob':
      case 'Grep': {
        const pattern = typeof input.pattern === 'string' ? input.pattern : '';
        return `\`${pattern}\``;
      }
      case 'WebFetch':
      case 'WebSearch': {
        const url =
          typeof input.url === 'string'
            ? input.url
            : typeof input.query === 'string'
              ? input.query
              : '';
        return this.truncate(url, 120);
      }
      case 'Agent': {
        const desc =
          typeof input.description === 'string' ? input.description : '';
        return desc ? `_${desc}_` : '';
      }
      case 'TodoWrite':
        return '';
      default: {
        const raw = JSON.stringify(input);
        return raw.length > 2 ? `\`${this.truncate(raw, 100)}\`` : '';
      }
    }
  }

  private truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '...';
  }

  private quoteLines(text: string): string {
    return text
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
  }

  private formatTimestamp(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
}
