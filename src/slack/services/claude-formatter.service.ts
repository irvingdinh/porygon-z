import { Injectable } from '@nestjs/common';

import type { ContentBlock } from './claude.service';

const MAX_MESSAGE_LENGTH = 3800;
const MAX_BLOCKS_SHOWN = 8;

@Injectable()
export class ClaudeFormatterService {
  formatStreaming(blocks: ContentBlock[], activeToolName?: string): string {
    const recentBlocks = blocks.slice(-MAX_BLOCKS_SHOWN);
    const skipped = blocks.length - recentBlocks.length;

    const parts: string[] = [];

    if (skipped > 0) {
      parts.push(`_...${skipped} earlier steps hidden..._`);
    }

    parts.push(...recentBlocks.map((b) => this.formatBlock(b)).filter(Boolean));

    if (activeToolName) {
      parts.push(`> :hourglass: _Running \`${activeToolName}\`..._`);
    }

    const joined = parts.join('\n\n');
    return this.truncate(joined, MAX_MESSAGE_LENGTH);
  }

  formatFinal(resultText: string): string {
    return resultText || '';
  }

  // --- Private helpers ---

  private formatBlock(block: ContentBlock): string {
    switch (block.type) {
      case 'thinking': {
        const snippet = this.truncate(block.thinking.trim(), 200);
        return `> :brain: *Thinking*\n${this.quoteLines(snippet)}`;
      }

      case 'tool_use': {
        const summary = this.summarizeToolInput(block.name, block.input);
        const detail = summary ? `\n> ${summary}` : '';
        return `> :hammer_and_wrench: *${block.name}*${detail}`;
      }

      case 'tool_result': {
        const raw =
          typeof block.content === 'string'
            ? block.content
            : block.content
                .map((c) => c.text ?? '')
                .filter(Boolean)
                .join('\n');
        const snippet = this.truncate(raw.trim(), 200);
        return `> :white_check_mark: *Tool result*\n${this.quoteLines(snippet)}`;
      }

      case 'text': {
        const t = block.text.trim();
        if (!t) return '';
        return this.truncate(t, 1500);
      }

      default:
        return '';
    }
  }

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
}
