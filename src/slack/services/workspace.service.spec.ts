import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { WorkspaceService } from './workspace.service';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-test-'));

    const configService = {
      get: () => ({
        dir: { home: tmpDir, temp: os.tmpdir() },
        slack: { appToken: 'xapp-test', botToken: 'xoxb-test' },
      }),
    } as any;

    service = new WorkspaceService(configService);
    service.onModuleInit();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('get / set', () => {
    it('returns null for non-existent channel', () => {
      expect(service.get('C_NONEXISTENT')).toBeNull();
    });

    it('persists and retrieves workspace config', () => {
      service.set('C_TEST', { cwd: '/home/user/project', model: 'haiku' });

      const config = service.get('C_TEST');
      expect(config).not.toBeNull();
      expect(config!.cwd).toBe('/home/user/project');
      expect(config!.model).toBe('haiku');
    });

    it('merges partial updates with existing config', () => {
      service.set('C_TEST', { cwd: '/first', model: 'haiku' });
      service.set('C_TEST', { effort: 'low' });

      const config = service.get('C_TEST');
      expect(config!.cwd).toBe('/first');
      expect(config!.model).toBe('haiku');
      expect(config!.effort).toBe('low');
    });

    it('overwrites existing fields on update', () => {
      service.set('C_TEST', { cwd: '/old', model: 'haiku' });
      service.set('C_TEST', { model: 'opus' });

      expect(service.get('C_TEST')!.model).toBe('opus');
    });

    it('writes valid JSON to disk', () => {
      service.set('C_TEST', { cwd: '/test' });

      const filePath = path.join(tmpDir, 'workspaces', 'C_TEST.json');
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as { cwd: string };
      expect(parsed.cwd).toBe('/test');
    });
  });

  describe('resolveCwd', () => {
    it('returns configured cwd for known channel', () => {
      service.set('C_TEST', { cwd: '/project/dir' });
      expect(service.resolveCwd('C_TEST')).toBe('/project/dir');
    });

    it('falls back to homedir for unknown channel', () => {
      expect(service.resolveCwd('C_UNKNOWN')).toBe(os.homedir());
    });
  });

  describe('resolveRelativePath', () => {
    it('resolves a valid relative path', () => {
      const result = service.resolveRelativePath('/base/dir', 'sub/folder');
      expect(result).toBe('/base/dir/sub/folder');
    });

    it('resolves current directory', () => {
      const result = service.resolveRelativePath('/base/dir', '.');
      expect(result).toBe('/base/dir');
    });

    it('throws when path escapes base directory', () => {
      expect(() =>
        service.resolveRelativePath('/base/dir', '../../etc/passwd'),
      ).toThrow('Path escapes the base directory');
    });

    it('throws for absolute path outside base', () => {
      expect(() =>
        service.resolveRelativePath('/base/dir', '/etc/passwd'),
      ).toThrow('Path escapes the base directory');
    });

    it('allows path that stays within base', () => {
      const result = service.resolveRelativePath(
        '/base/dir',
        'sub/../sub/file',
      );
      expect(result).toBe('/base/dir/sub/file');
    });
  });
});
