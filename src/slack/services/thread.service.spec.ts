import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { ThreadService } from './thread.service';

describe('ThreadService', () => {
  let service: ThreadService;
  let tmpHome: string;
  let tmpTemp: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'thread-home-'));
    tmpTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'thread-temp-'));

    const configService = {
      get: () => ({
        dir: { home: tmpHome, temp: tmpTemp },
        slack: { appToken: 'xapp-test', botToken: 'xoxb-test' },
      }),
    } as any;

    service = new ThreadService(configService);
    service.onModuleInit();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    fs.rmSync(tmpTemp, { recursive: true, force: true });
  });

  describe('exists / get / create', () => {
    it('returns false for non-existent session', () => {
      expect(service.exists('1234.5678')).toBe(false);
    });

    it('returns null for non-existent session', () => {
      expect(service.get('1234.5678')).toBeNull();
    });

    it('creates a new session with null sessionId', () => {
      const session = service.create('1234.5678');
      expect(session.sessionId).toBeNull();
      expect(session.createdAt).toBeDefined();
    });

    it('persists session to disk', () => {
      service.create('1234.5678');
      expect(service.exists('1234.5678')).toBe(true);

      const retrieved = service.get('1234.5678');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.sessionId).toBeNull();
    });
  });

  describe('setSessionId / clearSessionId', () => {
    it('sets a sessionId on an existing session', () => {
      service.create('1234.5678');
      service.setSessionId('1234.5678', 'session-abc');

      const session = service.get('1234.5678');
      expect(session!.sessionId).toBe('session-abc');
    });

    it('creates session if it does not exist when setting sessionId', () => {
      service.setSessionId('new.thread', 'session-xyz');

      const session = service.get('new.thread');
      expect(session).not.toBeNull();
      expect(session!.sessionId).toBe('session-xyz');
    });

    it('clears sessionId on an existing session', () => {
      service.create('1234.5678');
      service.setSessionId('1234.5678', 'session-abc');
      service.clearSessionId('1234.5678');

      expect(service.get('1234.5678')!.sessionId).toBeNull();
    });

    it('does nothing when clearing non-existent session', () => {
      expect(() => service.clearSessionId('nonexistent')).not.toThrow();
    });
  });

  describe('attachmentsDir / uploadsDir', () => {
    it('creates and returns attachments directory', () => {
      const dir = service.attachmentsDir('C_TEST', '1234.5678');
      expect(fs.existsSync(dir)).toBe(true);
      expect(dir).toContain('C_TEST-1234.5678');
      expect(dir).toContain('attachments');
    });

    it('creates and returns uploads directory', () => {
      const dir = service.uploadsDir('C_TEST', '1234.5678', 'msg.ts');
      expect(fs.existsSync(dir)).toBe(true);
      expect(dir).toContain('uploads');
      expect(dir).toContain('msg.ts');
    });

    it('returns same path on repeated calls', () => {
      const dir1 = service.attachmentsDir('C_TEST', '1234.5678');
      const dir2 = service.attachmentsDir('C_TEST', '1234.5678');
      expect(dir1).toBe(dir2);
    });
  });

  describe('corruption handling', () => {
    it('returns null for corrupted JSON', () => {
      const sessionsDir = path.join(tmpHome, 'sessions');
      fs.writeFileSync(
        path.join(sessionsDir, '1234.5678.json'),
        'INVALID JSON',
      );

      expect(service.exists('1234.5678')).toBe(true);
      expect(service.get('1234.5678')).toBeNull();
    });
  });
});
