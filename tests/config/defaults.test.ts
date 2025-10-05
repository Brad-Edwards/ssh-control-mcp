import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TIMEOUTS,
  DEFAULT_BUFFERS,
  DEFAULT_SECURITY,
  DEFAULT_LOGGING,
  createDefaultConfig,
  mergeWithDefaults,
} from '../../src/config/defaults.js';
import { TIMEOUTS, BUFFER_LIMITS, SSH_CONFIG } from '../../src/ssh/constants.js';
import type { ServerConfig } from '../../src/config/schema.js';

describe('Configuration Defaults', () => {
  describe('DEFAULT_TIMEOUTS', () => {
    it('should match current SSH timeout constants', () => {
      expect(DEFAULT_TIMEOUTS.command).toBe(TIMEOUTS.DEFAULT_COMMAND);
      expect(DEFAULT_TIMEOUTS.session).toBe(TIMEOUTS.DEFAULT_SESSION);
      expect(DEFAULT_TIMEOUTS.connection).toBe(TIMEOUTS.CONNECTION);
      expect(DEFAULT_TIMEOUTS.keepAlive).toBe(TIMEOUTS.KEEP_ALIVE_INTERVAL);
    });

    it('should have all positive timeout values', () => {
      expect(DEFAULT_TIMEOUTS.command).toBeGreaterThan(0);
      expect(DEFAULT_TIMEOUTS.session).toBeGreaterThan(0);
      expect(DEFAULT_TIMEOUTS.connection).toBeGreaterThan(0);
      expect(DEFAULT_TIMEOUTS.keepAlive).toBeGreaterThan(0);
    });
  });

  describe('DEFAULT_BUFFERS', () => {
    it('should match current buffer limit constants', () => {
      expect(DEFAULT_BUFFERS.maxSize).toBe(BUFFER_LIMITS.MAX_SIZE);
      expect(DEFAULT_BUFFERS.trimTo).toBe(BUFFER_LIMITS.TRIM_TO);
    });

    it('should have trimTo less than maxSize', () => {
      expect(DEFAULT_BUFFERS.trimTo).toBeLessThan(DEFAULT_BUFFERS.maxSize);
    });

    it('should have all positive buffer values', () => {
      expect(DEFAULT_BUFFERS.maxSize).toBeGreaterThan(0);
      expect(DEFAULT_BUFFERS.trimTo).toBeGreaterThan(0);
    });
  });

  describe('DEFAULT_SECURITY', () => {
    it('should have unrestricted command filters by default', () => {
      expect(DEFAULT_SECURITY.allowedCommands).toBeUndefined();
      expect(DEFAULT_SECURITY.blockedCommands).toEqual([]);
    });

    it('should match current SSH config constants', () => {
      expect(DEFAULT_SECURITY.maxConnectionsPerHost).toBe(SSH_CONFIG.MAX_CONNECTIONS_PER_HOST);
    });

    it('should have reasonable session limits', () => {
      expect(DEFAULT_SECURITY.maxSessions).toBe(10);
      expect(DEFAULT_SECURITY.sessionTimeout).toBe(TIMEOUTS.DEFAULT_SESSION);
    });

    it('should have all positive limit values', () => {
      expect(DEFAULT_SECURITY.maxSessions).toBeGreaterThan(0);
      expect(DEFAULT_SECURITY.sessionTimeout).toBeGreaterThan(0);
      expect(DEFAULT_SECURITY.maxConnectionsPerHost).toBeGreaterThan(0);
    });
  });

  describe('DEFAULT_LOGGING', () => {
    it('should have sensible logging defaults', () => {
      expect(DEFAULT_LOGGING.level).toBe('info');
      expect(DEFAULT_LOGGING.includeCommands).toBe(true);
      expect(DEFAULT_LOGGING.includeResponses).toBe(false);
      expect(DEFAULT_LOGGING.maxResponseLength).toBe(1000);
    });

    it('should have positive maxResponseLength', () => {
      expect(DEFAULT_LOGGING.maxResponseLength).toBeGreaterThan(0);
    });
  });

  describe('createDefaultConfig', () => {
    it('should create complete default configuration', () => {
      const config = createDefaultConfig('test-instance', {
        host: 'test.local',
        port: 22,
        username: 'testuser',
        privateKeyPath: '/path/to/key',
      });

      expect(config.name).toBe('test-instance');
      expect(config.target.host).toBe('test.local');
      expect(config.target.port).toBe(22);
      expect(config.target.username).toBe('testuser');
      expect(config.target.privateKeyPath).toBe('/path/to/key');
      expect(config.target.shell).toBe('bash');
      expect(config.timeouts).toEqual(DEFAULT_TIMEOUTS);
      expect(config.buffers).toEqual(DEFAULT_BUFFERS);
      expect(config.security).toEqual(DEFAULT_SECURITY);
      expect(config.logging).toEqual(DEFAULT_LOGGING);
    });

    it('should use provided target shell type', () => {
      const config = createDefaultConfig('test', {
        host: 'test',
        port: 22,
        username: 'user',
        privateKeyPath: '/key',
        shell: 'powershell',
      });

      expect(config.target.shell).toBe('powershell');
    });

    it('should default to bash if shell not provided', () => {
      const config = createDefaultConfig('test', {
        host: 'test',
        port: 22,
        username: 'user',
        privateKeyPath: '/key',
      });

      expect(config.target.shell).toBe('bash');
    });

    it('should include passphrase if provided', () => {
      const config = createDefaultConfig('test', {
        host: 'test',
        port: 22,
        username: 'user',
        privateKeyPath: '/key',
        passphrase: 'secret',
      });

      expect(config.target.passphrase).toBe('secret');
    });
  });

  describe('mergeWithDefaults', () => {
    it('should merge partial config with defaults', () => {
      const partial: Partial<ServerConfig> = {
        name: 'custom',
        target: {
          host: 'custom.local',
          port: 2222,
          username: 'custom',
          privateKeyPath: '/custom/key',
        },
      };

      const merged = mergeWithDefaults(partial as ServerConfig);

      expect(merged.name).toBe('custom');
      expect(merged.target.host).toBe('custom.local');
      expect(merged.target.port).toBe(2222);
      expect(merged.timeouts).toEqual(DEFAULT_TIMEOUTS);
      expect(merged.buffers).toEqual(DEFAULT_BUFFERS);
      expect(merged.security).toEqual(DEFAULT_SECURITY);
      expect(merged.logging).toEqual(DEFAULT_LOGGING);
    });

    it('should override default timeouts with custom values', () => {
      const partial: Partial<ServerConfig> = {
        name: 'test',
        target: {
          host: 'test',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
        },
        timeouts: {
          command: 60000,
        },
      };

      const merged = mergeWithDefaults(partial as ServerConfig);

      expect(merged.timeouts?.command).toBe(60000);
      expect(merged.timeouts?.session).toBe(DEFAULT_TIMEOUTS.session);
      expect(merged.timeouts?.connection).toBe(DEFAULT_TIMEOUTS.connection);
      expect(merged.timeouts?.keepAlive).toBe(DEFAULT_TIMEOUTS.keepAlive);
    });

    it('should override default buffers with custom values', () => {
      const partial: Partial<ServerConfig> = {
        name: 'test',
        target: {
          host: 'test',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
        },
        buffers: {
          maxSize: 20000,
        },
      };

      const merged = mergeWithDefaults(partial as ServerConfig);

      expect(merged.buffers?.maxSize).toBe(20000);
      expect(merged.buffers?.trimTo).toBe(DEFAULT_BUFFERS.trimTo);
    });

    it('should override default security with custom values', () => {
      const partial: Partial<ServerConfig> = {
        name: 'test',
        target: {
          host: 'test',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
        },
        security: {
          maxSessions: 5,
          blockedCommands: ['^rm'],
        },
      };

      const merged = mergeWithDefaults(partial as ServerConfig);

      expect(merged.security?.maxSessions).toBe(5);
      expect(merged.security?.blockedCommands).toEqual(['^rm']);
      expect(merged.security?.sessionTimeout).toBe(DEFAULT_SECURITY.sessionTimeout);
      expect(merged.security?.maxConnectionsPerHost).toBe(DEFAULT_SECURITY.maxConnectionsPerHost);
    });

    it('should override default logging with custom values', () => {
      const partial: Partial<ServerConfig> = {
        name: 'test',
        target: {
          host: 'test',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
        },
        logging: {
          level: 'debug',
          includeResponses: true,
        },
      };

      const merged = mergeWithDefaults(partial as ServerConfig);

      expect(merged.logging?.level).toBe('debug');
      expect(merged.logging?.includeResponses).toBe(true);
      expect(merged.logging?.includeCommands).toBe(DEFAULT_LOGGING.includeCommands);
      expect(merged.logging?.maxResponseLength).toBe(DEFAULT_LOGGING.maxResponseLength);
    });

    it('should handle completely custom configuration', () => {
      const custom: ServerConfig = {
        name: 'fully-custom',
        target: {
          host: 'custom.host',
          port: 2222,
          username: 'customuser',
          privateKeyPath: '/custom/key',
          shell: 'sh',
        },
        timeouts: {
          command: 15000,
          session: 300000,
          connection: 10000,
          keepAlive: 15000,
        },
        buffers: {
          maxSize: 5000,
          trimTo: 2500,
        },
        security: {
          allowedCommands: ['^ls', '^cd'],
          blockedCommands: ['^rm'],
          maxSessions: 3,
          sessionTimeout: 120000,
          maxConnectionsPerHost: 5,
        },
        logging: {
          level: 'debug',
          includeCommands: false,
          includeResponses: true,
          maxResponseLength: 500,
        },
      };

      const merged = mergeWithDefaults(custom);

      expect(merged).toEqual(custom);
    });

    it('should preserve target passphrase if provided', () => {
      const partial: Partial<ServerConfig> = {
        name: 'test',
        target: {
          host: 'test',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
          passphrase: 'secret',
        },
      };

      const merged = mergeWithDefaults(partial as ServerConfig);

      expect(merged.target.passphrase).toBe('secret');
    });

    it('should allow empty arrays in security config', () => {
      const partial: Partial<ServerConfig> = {
        name: 'test',
        target: {
          host: 'test',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
        },
        security: {
          allowedCommands: [],
          blockedCommands: [],
        },
      };

      const merged = mergeWithDefaults(partial as ServerConfig);

      expect(merged.security?.allowedCommands).toEqual([]);
      expect(merged.security?.blockedCommands).toEqual([]);
    });
  });
});
