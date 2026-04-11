import { type ChildProcess, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';

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
  message?: {
    content: ContentBlock[];
  };
  result?: string;
}

// --- Service ---

@Injectable()
export class ClaudeService implements OnApplicationShutdown {
  private readonly logger = new Logger(ClaudeService.name);

  private readonly processes = new Set<ChildProcess>();

  onApplicationShutdown() {
    this.killAll();
  }

  async *run(options: {
    prompt: string;
    cwd: string;
    resumeSessionId?: string;
  }): AsyncGenerator<StreamEvent> {
    this.logger.log(
      `Spawning process, cwd: ${options.cwd}, prompt length: ${options.prompt.length}, resume: ${options.resumeSessionId ?? 'none'}`,
    );

    const args: string[] = [];
    if (options.resumeSessionId) {
      args.push('--resume', options.resumeSessionId);
    }
    args.push(
      '--print',
      '--output-format',
      'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
      '--model',
      'opus[1m]',
      '--effort',
      'max',
    );

    const proc = spawn('claude', args, {
      cwd: options.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.logger.log(`Process started, pid: ${proc.pid}`);
    this.processes.add(proc);

    proc.on('exit', (code) => {
      this.logger.log(`Process ${proc.pid} exited with code: ${code}`);
      this.processes.delete(proc);
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
          console.log(line);
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
      this.processes.delete(proc);
    }
  }

  killAll(): number {
    const count = this.processes.size;

    for (const proc of this.processes) {
      proc.kill('SIGKILL');
    }
    this.processes.clear();

    return count;
  }
}
