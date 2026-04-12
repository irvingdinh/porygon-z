import type { ThinkingBlock, ToolUseBlock } from './claude.service';
import { ClaudeFormatterService } from './claude-formatter.service';

describe('ClaudeFormatterService', () => {
  let service: ClaudeFormatterService;

  beforeEach(() => {
    service = new ClaudeFormatterService();
  });

  describe('formatLiveInitializing', () => {
    it('returns hourglass with initializing text', () => {
      expect(service.formatLiveInitializing()).toBe(
        ':hourglass: Initializing...',
      );
    });
  });

  describe('formatLiveToolCall', () => {
    const ts = new Date('2026-04-12T14:30:45Z');

    it('formats a Bash tool call with command', () => {
      const block: ToolUseBlock = {
        type: 'tool_use',
        id: 't1',
        name: 'Bash',
        input: { command: 'ls -la' },
      };
      const result = service.formatLiveToolCall(block, ts);
      expect(result).toContain(':hammer_and_wrench:');
      expect(result).toContain('*Bash*');
      expect(result).toContain('`ls -la`');
      expect(result).toContain('Last updated:');
    });

    it('formats a Read tool call with file path', () => {
      const block: ToolUseBlock = {
        type: 'tool_use',
        id: 't1',
        name: 'Read',
        input: { file_path: '/src/main.ts' },
      };
      const result = service.formatLiveToolCall(block, ts);
      expect(result).toContain('*Read*');
      expect(result).toContain('/src/main.ts');
    });

    it('formats Edit tool with file path', () => {
      const block: ToolUseBlock = {
        type: 'tool_use',
        id: 't1',
        name: 'Edit',
        input: { file_path: '/edit.ts' },
      };
      const result = service.formatLiveToolCall(block, ts);
      expect(result).toContain('/edit.ts');
    });

    it('formats Grep tool with pattern', () => {
      const block: ToolUseBlock = {
        type: 'tool_use',
        id: 't1',
        name: 'Grep',
        input: { pattern: 'TODO' },
      };
      const result = service.formatLiveToolCall(block, ts);
      expect(result).toContain('TODO');
    });

    it('formats Glob tool with pattern', () => {
      const block: ToolUseBlock = {
        type: 'tool_use',
        id: 't1',
        name: 'Glob',
        input: { pattern: '**/*.ts' },
      };
      const result = service.formatLiveToolCall(block, ts);
      expect(result).toContain('**/*.ts');
    });

    it('formats Agent tool with description', () => {
      const block: ToolUseBlock = {
        type: 'tool_use',
        id: 't1',
        name: 'Agent',
        input: { description: 'Search codebase' },
      };
      const result = service.formatLiveToolCall(block, ts);
      expect(result).toContain('Search codebase');
    });

    it('formats WebFetch with url', () => {
      const block: ToolUseBlock = {
        type: 'tool_use',
        id: 't1',
        name: 'WebFetch',
        input: { url: 'https://example.com' },
      };
      const result = service.formatLiveToolCall(block, ts);
      expect(result).toContain('https://example.com');
    });

    it('shows nothing for TodoWrite input', () => {
      const block: ToolUseBlock = {
        type: 'tool_use',
        id: 't1',
        name: 'TodoWrite',
        input: { tasks: [] },
      };
      const result = service.formatLiveToolCall(block, ts);
      expect(result).toContain('*TodoWrite*');
      expect(result).not.toContain('tasks');
    });

    it('summarizes unknown tool with JSON', () => {
      const block: ToolUseBlock = {
        type: 'tool_use',
        id: 't1',
        name: 'CustomTool',
        input: { key: 'value' },
      };
      const result = service.formatLiveToolCall(block, ts);
      expect(result).toContain('key');
    });

    it('includes timestamp', () => {
      const block: ToolUseBlock = {
        type: 'tool_use',
        id: 't1',
        name: 'Bash',
        input: { command: 'echo hi' },
      };
      const result = service.formatLiveToolCall(block, ts);
      expect(result).toMatch(/Last updated: \d{2}:\d{2}:\d{2}/);
    });
  });

  describe('formatLiveIdle', () => {
    it('shows processing spinner with timestamp', () => {
      const ts = new Date('2026-04-12T14:30:45Z');
      const result = service.formatLiveIdle(ts);
      expect(result).toContain(':hourglass:');
      expect(result).toContain('Processing...');
      expect(result).toMatch(/Last updated: \d{2}:\d{2}:\d{2}/);
    });
  });

  describe('formatThinkingMessage', () => {
    it('formats thinking block with brain emoji and blockquote', () => {
      const block: ThinkingBlock = {
        type: 'thinking',
        thinking: 'Let me consider the options',
      };
      const result = service.formatThinkingMessage(block);
      expect(result).toContain(':brain:');
      expect(result).toContain('*Thinking*');
      expect(result).toContain('Let me consider the options');
    });

    it('preserves full thinking text', () => {
      const longThinking = 'A'.repeat(5000);
      const block: ThinkingBlock = {
        type: 'thinking',
        thinking: longThinking,
      };
      const result = service.formatThinkingMessage(block);
      expect(result).toContain('A'.repeat(5000));
    });

    it('truncates at 39000 char safety rail', () => {
      const veryLongThinking = 'B'.repeat(40000);
      const block: ThinkingBlock = {
        type: 'thinking',
        thinking: veryLongThinking,
      };
      const result = service.formatThinkingMessage(block);
      expect(result).not.toContain('B'.repeat(40000));
      expect(result).toContain('...');
    });

    it('trims whitespace', () => {
      const block: ThinkingBlock = {
        type: 'thinking',
        thinking: '  padded text  ',
      };
      const result = service.formatThinkingMessage(block);
      expect(result).toContain('padded text');
    });
  });

  describe('formatFinal', () => {
    it('returns text as-is when under limit', () => {
      const result = service.formatFinal('The answer is 4');
      expect(result.text).toBe('The answer is 4');
      expect(result.fullText).toBeNull();
    });

    it('returns empty string for empty result', () => {
      const result = service.formatFinal('');
      expect(result.text).toBe('');
      expect(result.fullText).toBeNull();
    });

    it('truncates and provides fullText when over limit', () => {
      const longText = 'x'.repeat(5000);
      const result = service.formatFinal(longText);
      expect(result.text.length).toBeLessThan(5000);
      expect(result.text).toContain('Full response attached as file.');
      expect(result.fullText).toBe(longText);
    });

    it('preserves complete text in fullText', () => {
      const longText = 'word '.repeat(1000);
      const result = service.formatFinal(longText);
      expect(result.fullText).toBe(longText);
    });
  });
});
