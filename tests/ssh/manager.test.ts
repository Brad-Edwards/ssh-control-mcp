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

  describe('Input Validation - executeCommand', () => {
    it('should throw error for null host', async () => {
      await expect(
        manager.executeCommand(null as any, 'user', '/key', 'ls')
      ).rejects.toThrow('Null or undefined arguments');
    });

    it('should throw error for undefined host', async () => {
      await expect(
        manager.executeCommand(undefined as any, 'user', '/key', 'ls')
      ).rejects.toThrow('Null or undefined arguments');
    });

    it('should throw error for empty host', async () => {
      await expect(
        manager.executeCommand('', 'user', '/key', 'ls')
      ).rejects.toThrow('Invalid arguments');
    });

    it('should throw error for null username', async () => {
      await expect(
        manager.executeCommand('host', null as any, '/key', 'ls')
      ).rejects.toThrow('Null or undefined arguments');
    });

    it('should throw error for empty username', async () => {
      await expect(
        manager.executeCommand('host', '', '/key', 'ls')
      ).rejects.toThrow('Invalid arguments');
    });

    it('should throw error for null privateKeyPath', async () => {
      await expect(
        manager.executeCommand('host', 'user', null as any, 'ls')
      ).rejects.toThrow('Null or undefined arguments');
    });

    it('should throw error for empty privateKeyPath', async () => {
      await expect(
        manager.executeCommand('host', 'user', '', 'ls')
      ).rejects.toThrow('Invalid arguments');
    });

    it('should throw error for null command', async () => {
      await expect(
        manager.executeCommand('host', 'user', '/key', null as any)
      ).rejects.toThrow('Null or undefined arguments');
    });

    it('should throw error for empty command', async () => {
      await expect(
        manager.executeCommand('host', 'user', '/key', '')
      ).rejects.toThrow('Invalid arguments');
    });

    it('should throw error for port 0', async () => {
      await expect(
        manager.executeCommand('host', 'user', '/key', 'ls', 0)
      ).rejects.toThrow('port must be between 1 and 65535');
    });

    it('should throw error for port > 65535', async () => {
      await expect(
        manager.executeCommand('host', 'user', '/key', 'ls', 65536)
      ).rejects.toThrow('port must be between 1 and 65535');
    });

    it('should throw error for negative port', async () => {
      await expect(
        manager.executeCommand('host', 'user', '/key', 'ls', -1)
      ).rejects.toThrow('port must be between 1 and 65535');
    });

    it('should throw error for zero timeout', async () => {
      await expect(
        manager.executeCommand('host', 'user', '/key', 'ls', 22, 0)
      ).rejects.toThrow('timeout must be positive');
    });

    it('should throw error for negative timeout', async () => {
      await expect(
        manager.executeCommand('host', 'user', '/key', 'ls', 22, -1)
      ).rejects.toThrow('timeout must be positive');
    });
  });

  describe('Input Validation - createSession', () => {
    it('should throw error for null sessionId', async () => {
      await expect(
        manager.createSession(null as any, 'host', 'user', 'interactive', '/key')
      ).rejects.toThrow('Null or undefined arguments');
    });

    it('should throw error for empty sessionId', async () => {
      await expect(
        manager.createSession('', 'host', 'user', 'interactive', '/key')
      ).rejects.toThrow('Invalid arguments');
    });

    it('should throw error for null target', async () => {
      await expect(
        manager.createSession('id', null as any, 'user', 'interactive', '/key')
      ).rejects.toThrow('Null or undefined arguments');
    });

    it('should throw error for empty target', async () => {
      await expect(
        manager.createSession('id', '', 'user', 'interactive', '/key')
      ).rejects.toThrow('Invalid arguments');
    });

    it('should throw error for null username', async () => {
      await expect(
        manager.createSession('id', 'host', null as any, 'interactive', '/key')
      ).rejects.toThrow('Null or undefined arguments');
    });

    it('should throw error for empty username', async () => {
      await expect(
        manager.createSession('id', 'host', '', 'interactive', '/key')
      ).rejects.toThrow('Invalid arguments');
    });

    it('should throw error for null privateKeyPath', async () => {
      await expect(
        manager.createSession('id', 'host', 'user', 'interactive', null as any)
      ).rejects.toThrow('Null or undefined arguments');
    });

    it('should throw error for empty privateKeyPath', async () => {
      await expect(
        manager.createSession('id', 'host', 'user', 'interactive', '')
      ).rejects.toThrow('Invalid arguments');
    });
  });

  describe('Input Validation - getSession', () => {
    it('should throw error for null sessionId', () => {
      expect(() => manager.getSession(null as any)).toThrow('Null or undefined arguments');
    });

    it('should throw error for empty sessionId', () => {
      expect(() => manager.getSession('')).toThrow('Session ID is required');
    });
  });

  describe('Input Validation - closeSession', () => {
    it('should throw error for null sessionId', async () => {
      await expect(manager.closeSession(null as any)).rejects.toThrow('Null or undefined arguments');
    });

    it('should throw error for empty sessionId', async () => {
      await expect(manager.closeSession('')).rejects.toThrow('Session ID is required');
    });
  });

  describe('Command Filtering', () => {
    it('should allow all commands by default', async () => {
      const config = createDefaultConfig('test', {
        host: 'test.local',
        port: 22,
        username: 'user',
        privateKeyPath: '/nonexistent',
      });
      const mgr = new SSHConnectionManager(config);

      // This will fail on connection, but should not fail on filtering
      await expect(
        mgr.executeCommand('test.local', 'user', '/nonexistent', 'rm -rf /')
      ).rejects.toThrow(/Connection|read.*private key|ENOENT/);
    });

    it('should block commands when blockedCommands is configured', async () => {
      const config = createDefaultConfig('test', {
        host: 'test.local',
        port: 22,
        username: 'user',
        privateKeyPath: '/key',
      });
      config.security = {
        ...config.security,
        blockedCommands: ['^rm\\s', '^dd\\s', '^mkfs\\.'],
      };
      const mgr = new SSHConnectionManager(config);

      await expect(
        mgr.executeCommand('test.local', 'user', '/key', 'rm -rf /')
      ).rejects.toThrow('Command blocked by security policy');

      await expect(
        mgr.executeCommand('test.local', 'user', '/key', 'dd if=/dev/zero of=/dev/sda')
      ).rejects.toThrow('Command blocked by security policy');
    });

    it('should allow only whitelisted commands when allowedCommands is configured', async () => {
      const config = createDefaultConfig('test', {
        host: 'test.local',
        port: 22,
        username: 'user',
        privateKeyPath: '/key',
      });
      config.security = {
        ...config.security,
        allowedCommands: ['^ls', '^pwd', '^echo'],
      };
      const mgr = new SSHConnectionManager(config);

      await expect(
        mgr.executeCommand('test.local', 'user', '/key', 'rm file.txt')
      ).rejects.toThrow('Command not allowed by security policy');
    });

    it('should allow whitelisted commands when allowedCommands is configured', async () => {
      const config = createDefaultConfig('test', {
        host: 'test.local',
        port: 22,
        username: 'user',
        privateKeyPath: '/nonexistent',
      });
      config.security = {
        ...config.security,
        allowedCommands: ['^ls', '^pwd'],
      };
      const mgr = new SSHConnectionManager(config);

      // Will fail on connection, not filtering
      await expect(
        mgr.executeCommand('test.local', 'user', '/nonexistent', 'ls -la')
      ).rejects.toThrow(/Connection|read.*private key|ENOENT/);
    });

    it('should prioritize allowedCommands over blockedCommands', async () => {
      const config = createDefaultConfig('test', {
        host: 'test.local',
        port: 22,
        username: 'user',
        privateKeyPath: '/nonexistent',
      });
      config.security = {
        ...config.security,
        allowedCommands: ['^ls'],
        blockedCommands: ['^ls'],
      };
      const mgr = new SSHConnectionManager(config);

      // Should be allowed because allowedCommands takes precedence
      await expect(
        mgr.executeCommand('test.local', 'user', '/nonexistent', 'ls')
      ).rejects.toThrow(/Connection|read.*private key|ENOENT/);
    });
  });

  describe('Resource Limits', () => {
    it('should enforce maxSessions limit', async () => {
      const config = createDefaultConfig('test', {
        host: 'test.local',
        port: 22,
        username: 'user',
        privateKeyPath: '/key',
      });
      config.security = {
        ...config.security,
        maxSessions: 0,
      };
      const mgr = new SSHConnectionManager(config);

      await expect(
        mgr.createSession('session-1', 'test.local', 'user', 'interactive', '/key')
      ).rejects.toThrow('Maximum session limit');
    });
  });
});
