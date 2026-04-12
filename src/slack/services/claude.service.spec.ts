import { ClaudeService } from './claude.service';

describe('ClaudeService', () => {
  let service: ClaudeService;

  beforeEach(() => {
    service = new ClaudeService();
  });

  afterEach(() => {
    service.onApplicationShutdown();
  });

  describe('killAll', () => {
    it('returns 0 when no processes are running', () => {
      expect(service.killAll()).toBe(0);
    });
  });

  describe('killByChannel', () => {
    it('returns 0 when no processes match', () => {
      expect(service.killByChannel('C_NONEXISTENT')).toBe(0);
    });
  });

  describe('killByUser', () => {
    it('returns 0 when no processes match', () => {
      expect(service.killByUser('U_NONEXISTENT')).toBe(0);
    });
  });

  describe('process tracking', () => {
    it('killByChannel only kills matching channel processes', () => {
      expect(service.killByChannel('C_OTHER')).toBe(0);
      expect(service.killByChannel('C_TEST')).toBe(0);
    });
  });
});
