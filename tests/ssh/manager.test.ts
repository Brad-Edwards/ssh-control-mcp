import { describe, it, expect, beforeEach } from 'vitest';
import { SSHConnectionManager } from '../../src/ssh/manager.js';
import { createDefaultConfig } from '../../src/config/defaults.js';
import type { ServerConfig } from '../../src/config/schema.js';

describe('SSHConnectionManager', () => {
  let manager: SSHConnectionManager;

  beforeEach(() => {
    manager = new SSHConnectionManager();
  });

  describe('Constructor', () => {
    it('should create manager without config', () => {
      const mgr = new SSHConnectionManager();
      expect(mgr).toBeDefined();
      expect(mgr).toBeInstanceOf(SSHConnectionManager);
    });

    it('should create manager with config', () => {
      const config = createDefaultConfig('test', {
        host: 'test.local',
        port: 22,
        username: 'user',
        privateKeyPath: '/key',
      });
      const mgr = new SSHConnectionManager(config);
      expect(mgr).toBeDefined();
      expect(mgr).toBeInstanceOf(SSHConnectionManager);
    });

    it('should accept partial config', () => {
      const config: ServerConfig = {
        name: 'test',
        target: {
          host: 'host',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
          shell: 'bash',
        },
        timeouts: {
          command: 60000,
        },
      };
      const mgr = new SSHConnectionManager(config);
      expect(mgr).toBeDefined();
    });
  });

  describe('Session Management', () => {
    it('should start with empty session list', () => {
      expect(manager.listSessions()).toEqual([]);
    });

    it('should return false for closing non-existent session', async () => {
      const result = await manager.closeSession('does-not-exist');
      expect(result).toBe(false);
    });

    it('should return undefined for non-existent session', () => {
      const session = manager.getSession('does-not-exist');
      expect(session).toBeUndefined();
    });

    it('should handle empty session output requests gracefully', () => {
      expect(() => {
        manager.getSessionOutput('non-existent');
      }).toThrow("Session not found: non-existent");
    });

    it('should handle empty session command requests gracefully', async () => {
      await expect(
        manager.executeInSession('non-existent', 'test command')
      ).rejects.toThrow("Session not found: non-existent");
    });
  });

  describe('Connection Management', () => {
    it('should create a manager instance', () => {
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(SSHConnectionManager);
    });

    it('should track connection count', () => {
      const count = manager.getConnectionCount();
      expect(count).toBe(0);
    });
  });
});
