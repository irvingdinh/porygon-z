import { type ChildProcess, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';

import type { EffortLevel, PermissionMode } from './workspace.service';

// --- Stream event types ---

export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
}

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<{ type: string; text?: string }>;
}

export type ContentBlock =
  | ThinkingBlock
  | TextBlock
  | ToolUseBlock
  | ToolResultBlock;

export interface StreamEvent {
  type: string;
  subtype?: string;
  session_id?: string;
  task_id?: string;
  tool_use_id?: string;
  description?: string;
  status?: string;
  summary?: string;
  last_tool_name?: string;
  parent_tool_use_id?: string | null;
  usage?: {
    total_tokens?: number;
    tool_uses?: number;
    duration_ms?: number;
  };
  message?: {
    content: ContentBlock[];
  };
  result?: string;
}

// --- Process tracking ---

export interface ProcessInfo {
  process: ChildProcess;
  channelId: string;
  userId: string;
  threadTs: string;
  startedAt: Date;
}

// --- Service ---

@Injectable()
export class ClaudeService implements OnApplicationShutdown {
  private readonly logger = new Logger(ClaudeService.name);

  private readonly processes = new Map<number, ProcessInfo>();

  onApplicationShutdown() {
    this.killAll();
  }

  async *run(options: {
    prompt: string;
    cwd: string;
    resumeSessionId?: string;
    model?: string;
    effort?: EffortLevel;
    permissionMode?: PermissionMode;
    context?: {
      channelId: string;
      userId: string;
      threadTs: string;
    };
  }): AsyncGenerator<StreamEvent> {
    const model = options.model ?? 'opus[1m]';
    const effort = options.effort ?? 'max';
    const permissionMode = options.permissionMode ?? 'bypassPermissions';

    this.logger.log(
      `Spawning process, cwd: ${options.cwd}, prompt length: ${options.prompt.length}, resume: ${options.resumeSessionId ?? 'none'}, model: ${model}, effort: ${effort}, permission: ${permissionMode}`,
    );

    const args: string[] = [];
    if (options.resumeSessionId) {
      args.push('--resume', options.resumeSessionId);
    }
    args.push('--print', '--output-format', 'stream-json', '--verbose');

    if (permissionMode === 'bypassPermissions') {
      args.push('--dangerously-skip-permissions');
    } else {
      args.push('--permission-mode', permissionMode);
    }

    args.push('--model', model, '--effort', effort);

    const proc = spawn('claude', args, {
      cwd: options.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.logger.log(`Process started, pid: ${proc.pid}`);
    this.processes.set(proc.pid!, {
      process: proc,
      channelId: options.context?.channelId ?? '',
      userId: options.context?.userId ?? '',
      threadTs: options.context?.threadTs ?? '',
      startedAt: new Date(),
    });

    proc.on('exit', (code) => {
      this.logger.log(`Process ${proc.pid} exited with code: ${code}`);
      this.processes.delete(proc.pid!);
    });

    // Drain stderr in background
    if (proc.stderr) {
      proc.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text) {
          this.logger.warn(`[stderr:${proc.pid}] ${text}`);
        }
      });
    }

    // Write prompt to stdin and close
    proc.stdin.write(options.prompt);
    proc.stdin.end();

    // Read stdout line-by-line
    const rl = createInterface({ input: proc.stdout });

    try {
      for await (const line of rl) {
        if (line.trim() === '') continue;
        try {
          const event = JSON.parse(line) as StreamEvent;
          this.logger.debug(
            `[stdout:${proc.pid}] type=${event.type} subtype=${event.subtype ?? '-'}`,
          );
          yield event;
        } catch {
          this.logger.debug(
            `[stdout:${proc.pid}] (unparseable) ${line.slice(0, 200)}`,
          );
        }
      }
    } finally {
      await new Promise<void>((resolve) => {
        if (proc.exitCode !== null) {
          resolve();
        } else {
          proc.on('exit', () => resolve());
        }
      });
      this.processes.delete(proc.pid!);
    }
  }

  killAll(): number {
    const count = this.processes.size;

    for (const info of this.processes.values()) {
      info.process.kill('SIGKILL');
    }
    this.processes.clear();

    return count;
  }

  killByChannel(channelId: string): number {
    let count = 0;
    for (const [pid, info] of this.processes) {
      if (info.channelId === channelId) {
        info.process.kill('SIGKILL');
        this.processes.delete(pid);
        count++;
      }
    }
    return count;
  }

  killByUser(userId: string): number {
    let count = 0;
    for (const [pid, info] of this.processes) {
      if (info.userId === userId) {
        info.process.kill('SIGKILL');
        this.processes.delete(pid);
        count++;
      }
    }
    return count;
  }
}
