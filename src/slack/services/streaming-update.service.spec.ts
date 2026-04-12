import type { ThinkingBlock, ToolUseBlock } from './claude.service';
import { ClaudeFormatterService } from './claude-formatter.service';
import { StreamingUpdateService } from './streaming-update.service';

describe('StreamingUpdateService', () => {
  let service: StreamingUpdateService;
  let formatter: ClaudeFormatterService;

  const mockClient = () => ({
    chat: {
      postMessage: jest.fn().mockResolvedValue({ ts: 'thinking.msg.ts' }),
      update: jest.fn().mockResolvedValue({}),
    },
  });

  beforeEach(() => {
    formatter = new ClaudeFormatterService();
    service = new StreamingUpdateService(formatter);
  });

  afterEach(() => {
    service.onApplicationShutdown();
  });

  describe('handleInit', () => {
    it('stores state with provided liveMessageTs', () => {
      const client = mockClient() as any;
      service.handleInit({
        parentTs: '1234.5678',
        channelId: 'C_TEST',
        client,
        liveMessageTs: 'live.msg.ts',
      });

      expect(service.getLiveMessageTs('1234.5678')).toBe('live.msg.ts');
    });
  });

  describe('handleThinking', () => {
    it('posts a new message with formatted thinking block', async () => {
      const client = mockClient() as any;
      service.handleInit({
        parentTs: '1234.5678',
        channelId: 'C_TEST',
        client,
        liveMessageTs: 'live.msg.ts',
      });

      const block: ThinkingBlock = {
        type: 'thinking',
        thinking: 'Let me consider',
      };
      service.handleThinking({ parentTs: '1234.5678', block });

      await new Promise((r) => setTimeout(r, 10));

      expect(client.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C_TEST',
          thread_ts: '1234.5678',
        }),
      );
      const callText = client.chat.postMessage.mock.calls[0][0].text;
      expect(callText).toContain(':brain:');
      expect(callText).toContain('Let me consider');
    });

    it('ignores thinking for unknown parentTs', () => {
      const block: ThinkingBlock = {
        type: 'thinking',
        thinking: 'Orphan thought',
      };
      service.handleThinking({ parentTs: 'unknown', block });
      // Should not throw
    });
  });

  describe('handleTool', () => {
    it('updates currentToolBlock in state', () => {
      const client = mockClient() as any;
      service.handleInit({
        parentTs: '1234.5678',
        channelId: 'C_TEST',
        client,
        liveMessageTs: 'live.msg.ts',
      });

      const block: ToolUseBlock = {
        type: 'tool_use',
        id: 't1',
        name: 'Bash',
        input: { command: 'ls' },
      };
      service.handleTool({ parentTs: '1234.5678', block });

      // Verify via flushAll behavior — should use tool format
    });

    it('ignores tool for unknown parentTs', () => {
      const block: ToolUseBlock = {
        type: 'tool_use',
        id: 't1',
        name: 'Bash',
        input: { command: 'ls' },
      };
      service.handleTool({ parentTs: 'unknown', block });
      // Should not throw
    });
  });

  describe('flushAll', () => {
    it('updates live message with tool call format when tool is active', async () => {
      const client = mockClient() as any;
      service.handleInit({
        parentTs: '1234.5678',
        channelId: 'C_TEST',
        client,
        liveMessageTs: 'live.msg.ts',
      });

      const block: ToolUseBlock = {
        type: 'tool_use',
        id: 't1',
        name: 'Bash',
        input: { command: 'ls -la' },
      };
      service.handleTool({ parentTs: '1234.5678', block });
      await service.flushAll();

      expect(client.chat.update).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C_TEST',
          ts: 'live.msg.ts',
        }),
      );
      const callText = client.chat.update.mock.calls[0][0].text;
      expect(callText).toContain(':hammer_and_wrench:');
      expect(callText).toContain('Bash');
      expect(callText).toContain('Last updated:');
    });

    it('updates live message with idle format when no tool is active', async () => {
      const client = mockClient() as any;
      service.handleInit({
        parentTs: '1234.5678',
        channelId: 'C_TEST',
        client,
        liveMessageTs: 'live.msg.ts',
      });

      await service.flushAll();

      expect(client.chat.update).toHaveBeenCalled();
      const callText = client.chat.update.mock.calls[0][0].text;
      expect(callText).toContain('Processing...');
      expect(callText).toContain('Last updated:');
    });

    it('always updates even when content has not changed', async () => {
      const client = mockClient() as any;
      service.handleInit({
        parentTs: '1234.5678',
        channelId: 'C_TEST',
        client,
        liveMessageTs: 'live.msg.ts',
      });

      await service.flushAll();
      await service.flushAll();

      expect(client.chat.update).toHaveBeenCalledTimes(2);
    });

    it('skips finalized streams', async () => {
      const client = mockClient() as any;
      service.handleInit({
        parentTs: '1234.5678',
        channelId: 'C_TEST',
        client,
        liveMessageTs: 'live.msg.ts',
      });

      service.handleEnd({ parentTs: '1234.5678' });
      await service.flushAll();

      expect(client.chat.update).not.toHaveBeenCalled();
    });

    it('handles Slack API errors gracefully', async () => {
      const client = {
        chat: {
          postMessage: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockRejectedValue(new Error('rate_limited')),
        },
      } as any;

      service.handleInit({
        parentTs: '1234.5678',
        channelId: 'C_TEST',
        client,
        liveMessageTs: 'live.msg.ts',
      });

      await expect(service.flushAll()).resolves.not.toThrow();
    });
  });

  describe('handleEnd', () => {
    it('cleans up state', () => {
      const client = mockClient() as any;
      service.handleInit({
        parentTs: '1234.5678',
        channelId: 'C_TEST',
        client,
        liveMessageTs: 'live.msg.ts',
      });

      service.handleEnd({ parentTs: '1234.5678' });
      expect(service.getLiveMessageTs('1234.5678')).toBeNull();
    });

    it('ignores end for unknown parentTs', () => {
      service.handleEnd({ parentTs: 'unknown' });
      // Should not throw
    });
  });
});
