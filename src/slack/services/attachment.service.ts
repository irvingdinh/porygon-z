import * as fs from 'node:fs';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppConfig } from '../../core/config/config';
import { TemplateService } from '../../core/services/template.service';

// --- Types ---

export interface SlackFile {
  id: string;
  name: string;
  url_private_download: string;
  mimetype?: string;
}

export interface DownloadedAttachment {
  originalName: string;
  savedName: string;
  path: string;
}

// --- Service ---

@Injectable()
export class AttachmentService {
  private readonly logger = new Logger(AttachmentService.name);
  private readonly botToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly template: TemplateService,
  ) {
    const config = this.configService.get<AppConfig>('root')!;
    this.botToken = config.slack.botToken;
  }

  async download(
    files: SlackFile[],
    destDir: string,
  ): Promise<DownloadedAttachment[]> {
    const results: DownloadedAttachment[] = [];

    for (const file of files) {
      const savedName = this.buildSafeName(destDir, file.name);
      const destPath = path.join(destDir, savedName);

      const res = await fetch(file.url_private_download, {
        headers: { Authorization: `Bearer ${this.botToken}` },
      });

      if (!res.ok) {
        this.logger.error(
          `Failed to download ${file.name}: ${res.status} ${res.statusText}`,
        );
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(destPath, buffer);

      this.logger.log(
        `Downloaded ${file.name} -> ${savedName} (${buffer.byteLength} bytes)`,
      );

      results.push({
        originalName: file.name,
        savedName,
        path: destPath,
      });
    }

    return results;
  }

  buildPromptSection(
    attachments: DownloadedAttachment[],
    attachmentsDirPath: string,
  ): string {
    return this.template.render(
      'slack.listeners.listener-message-attachments',
      {
        attachments: attachments.map((a) => ({
          ...a,
          renamed: a.originalName !== a.savedName,
        })),
        attachmentsDirPath,
      },
    );
  }

  private buildSafeName(dir: string, name: string): string {
    const ext = path.extname(name);
    const base = name.slice(0, name.length - ext.length);

    let candidate = name;
    let counter = 2;

    while (fs.existsSync(path.join(dir, candidate))) {
      candidate = `${base}_${counter}${ext}`;
      counter++;
    }

    return candidate;
  }
}
