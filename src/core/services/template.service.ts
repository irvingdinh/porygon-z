import * as fs from 'node:fs';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';
import Handlebars from 'handlebars';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private readonly templates = new Map<string, Handlebars.TemplateDelegate>();

  constructor() {
    const templatesDir = path.join(__dirname, '..', 'templates');
    this.loadTemplates(templatesDir, '');
    this.logger.log(`Loaded ${this.templates.size} template(s)`);
  }

  render(name: string, context: Record<string, unknown> = {}): string {
    const template = this.templates.get(name);
    if (!template) {
      throw new Error(`Template not found: ${name}`);
    }
    return template(context);
  }

  private loadTemplates(dir: string, prefix: string): void {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const nextPrefix = prefix ? `${prefix}.${entry.name}` : entry.name;
        this.loadTemplates(fullPath, nextPrefix);
      } else if (entry.name.endsWith('.handlebars')) {
        const name = entry.name.replace(/\.handlebars$/, '');
        const key = prefix ? `${prefix}.${name}` : name;
        try {
          const source = fs.readFileSync(fullPath, 'utf-8');
          this.templates.set(key, Handlebars.compile(source));
        } catch (err) {
          throw new Error(
            `Failed to load template ${fullPath}: ${(err as Error).message}`,
          );
        }
      }
    }
  }
}
