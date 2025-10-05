import { describe, it, expect } from 'vitest';
import {
  SSHTargetConfigSchema,
  TimeoutsConfigSchema,
  BuffersConfigSchema,
  SecurityConfigSchema,
  LoggingConfigSchema,
  ServerConfigSchema,
  type SSHTargetConfig,
  type TimeoutsConfig,
  type BuffersConfig,
  type SecurityConfig,
  type LoggingConfig,
  type ServerConfig,
} from '../../src/config/schema.js';

describe('Configuration Schema', () => {
  describe('SSHTargetConfigSchema', () => {
    it('should validate valid SSH target configuration', () => {
      const validConfig: SSHTargetConfig = {
        host: 'kali.example.com',
        port: 22,
        username: 'root',
        privateKeyPath: '/home/user/.ssh/id_rsa',
        shell: 'bash',
      };

      const result = SSHTargetConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validConfig);
      }
    });

    it('should accept optional passphrase', () => {
      const config = {
        host: 'target.local',
        port: 22,
        username: 'user',
        privateKeyPath: '/path/to/key',
        passphrase: 'secret',
      };

      const result = SSHTargetConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept all valid shell types', () => {
      const shells: Array<'bash' | 'sh' | 'powershell' | 'cmd'> = ['bash', 'sh', 'powershell', 'cmd'];

      for (const shell of shells) {
        const config = {
          host: 'target',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
          shell,
        };
        const result = SSHTargetConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      }
    });

    it('should default shell to bash when not provided', () => {
      const config = {
        host: 'target',
        port: 22,
        username: 'user',
        privateKeyPath: '/key',
      };

      const result = SSHTargetConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.shell).toBe('bash');
      }
    });

    it('should reject invalid port numbers', () => {
      const invalidPorts = [0, -1, 65536, 100000];

      for (const port of invalidPorts) {
        const config = {
          host: 'target',
          port,
          username: 'user',
          privateKeyPath: '/key',
        };
        const result = SSHTargetConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      }
    });

    it('should reject empty required fields', () => {
      const invalidConfigs = [
        { host: '', port: 22, username: 'user', privateKeyPath: '/key' },
        { host: 'target', port: 22, username: '', privateKeyPath: '/key' },
        { host: 'target', port: 22, username: 'user', privateKeyPath: '' },
      ];

      for (const config of invalidConfigs) {
        const result = SSHTargetConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      }
    });

    it('should reject invalid shell types', () => {
      const config = {
        host: 'target',
        port: 22,
        username: 'user',
        privateKeyPath: '/key',
        shell: 'zsh',
      };

      const result = SSHTargetConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const invalidConfigs = [
        { port: 22, username: 'user', privateKeyPath: '/key' },
        { host: 'target', username: 'user', privateKeyPath: '/key' },
        { host: 'target', port: 22, privateKeyPath: '/key' },
        { host: 'target', port: 22, username: 'user' },
      ];

      for (const config of invalidConfigs) {
        const result = SSHTargetConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('TimeoutsConfigSchema', () => {
    it('should validate valid timeout configuration', () => {
      const validConfig: TimeoutsConfig = {
        command: 30000,
        session: 600000,
        connection: 30000,
        keepAlive: 30000,
      };

      const result = TimeoutsConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validConfig);
      }
    });

    it('should accept all fields as optional', () => {
      const configs = [
        {},
        { command: 60000 },
        { session: 300000 },
        { connection: 15000 },
        { keepAlive: 15000 },
      ];

      for (const config of configs) {
        const result = TimeoutsConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      }
    });

    it('should reject negative timeout values', () => {
      const invalidConfigs = [
        { command: -1 },
        { session: -100 },
        { connection: -5000 },
        { keepAlive: -1000 },
      ];

      for (const config of invalidConfigs) {
        const result = TimeoutsConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      }
    });

    it('should reject zero timeout values', () => {
      const invalidConfigs = [
        { command: 0 },
        { session: 0 },
        { connection: 0 },
        { keepAlive: 0 },
      ];

      for (const config of invalidConfigs) {
        const result = TimeoutsConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      }
    });

    it('should reject excessively large timeout values', () => {
      const maxTimeout = 3600000; // 1 hour
      const invalidConfigs = [
        { command: maxTimeout + 1 },
        { session: maxTimeout + 1000 },
        { connection: maxTimeout + 1 },
        { keepAlive: maxTimeout + 1 },
      ];

      for (const config of invalidConfigs) {
        const result = TimeoutsConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('BuffersConfigSchema', () => {
    it('should validate valid buffer configuration', () => {
      const validConfig: BuffersConfig = {
        maxSize: 10000,
        trimTo: 5000,
      };

      const result = BuffersConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validConfig);
      }
    });

    it('should accept all fields as optional', () => {
      const configs = [
        {},
        { maxSize: 20000 },
        { trimTo: 10000 },
      ];

      for (const config of configs) {
        const result = BuffersConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      }
    });

    it('should reject negative buffer values', () => {
      const invalidConfigs = [
        { maxSize: -1 },
        { trimTo: -100 },
      ];

      for (const config of invalidConfigs) {
        const result = BuffersConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      }
    });

    it('should reject zero buffer values', () => {
      const invalidConfigs = [
        { maxSize: 0 },
        { trimTo: 0 },
      ];

      for (const config of invalidConfigs) {
        const result = BuffersConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      }
    });

    it('should reject excessively large buffer values', () => {
      const maxBuffer = 100000;
      const invalidConfigs = [
        { maxSize: maxBuffer + 1 },
        { trimTo: maxBuffer + 1 },
      ];

      for (const config of invalidConfigs) {
        const result = BuffersConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      }
    });

    it('should reject trimTo greater than maxSize', () => {
      const config = {
        maxSize: 5000,
        trimTo: 10000,
      };

      const result = BuffersConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('SecurityConfigSchema', () => {
    it('should validate valid security configuration', () => {
      const validConfig: SecurityConfig = {
        allowedCommands: ['^ls', '^cd'],
        blockedCommands: ['^rm -rf /$'],
        maxSessions: 10,
        sessionTimeout: 600000,
        maxConnectionsPerHost: 10,
      };

      const result = SecurityConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validConfig);
      }
    });

    it('should accept all fields as optional', () => {
      const configs = [
        {},
        { allowedCommands: ['^ls'] },
        { blockedCommands: ['^rm'] },
        { maxSessions: 5 },
        { sessionTimeout: 300000 },
        { maxConnectionsPerHost: 20 },
      ];

      for (const config of configs) {
        const result = SecurityConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      }
    });

    it('should accept empty arrays for command filters', () => {
      const config = {
        allowedCommands: [],
        blockedCommands: [],
      };

      const result = SecurityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should validate regex patterns are valid', () => {
      const validConfig = {
        allowedCommands: ['^ls.*', '\\bcd\\b', 'echo.*'],
        blockedCommands: ['^rm\\s+-rf', '^dd\\s+if='],
      };

      const result = SecurityConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should reject invalid regex patterns', () => {
      const invalidConfigs = [
        { allowedCommands: ['[invalid'] },
        { blockedCommands: ['(unclosed'] },
        { allowedCommands: ['**invalid'] },
      ];

      for (const config of invalidConfigs) {
        const result = SecurityConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      }
    });

    it('should reject negative session limits', () => {
      const invalidConfigs = [
        { maxSessions: -1 },
        { sessionTimeout: -1000 },
        { maxConnectionsPerHost: -5 },
      ];

      for (const config of invalidConfigs) {
        const result = SecurityConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      }
    });

    it('should reject zero session limits', () => {
      const invalidConfigs = [
        { maxSessions: 0 },
        { maxConnectionsPerHost: 0 },
      ];

      for (const config of invalidConfigs) {
        const result = SecurityConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      }
    });

    it('should reject excessively large session limits', () => {
      const config = {
        maxSessions: 101,
      };

      const result = SecurityConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('LoggingConfigSchema', () => {
    it('should validate valid logging configuration', () => {
      const validConfig: LoggingConfig = {
        level: 'info',
        includeCommands: true,
        includeResponses: false,
        maxResponseLength: 1000,
      };

      const result = LoggingConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validConfig);
      }
    });

    it('should accept all valid log levels', () => {
      const levels: Array<'debug' | 'info' | 'warn' | 'error'> = ['debug', 'info', 'warn', 'error'];

      for (const level of levels) {
        const config = { level };
        const result = LoggingConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      }
    });

    it('should accept all fields as optional', () => {
      const configs = [
        {},
        { level: 'debug' },
        { includeCommands: true },
        { includeResponses: false },
        { maxResponseLength: 500 },
      ];

      for (const config of configs) {
        const result = LoggingConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid log levels', () => {
      const config = {
        level: 'verbose',
      };

      const result = LoggingConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject negative maxResponseLength', () => {
      const config = {
        maxResponseLength: -1,
      };

      const result = LoggingConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject zero maxResponseLength', () => {
      const config = {
        maxResponseLength: 0,
      };

      const result = LoggingConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject excessively large maxResponseLength', () => {
      const config = {
        maxResponseLength: 100001,
      };

      const result = LoggingConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('ServerConfigSchema', () => {
    it('should validate complete server configuration', () => {
      const validConfig: ServerConfig = {
        name: 'kali-red-team',
        target: {
          host: 'kali.local',
          port: 22,
          username: 'root',
          privateKeyPath: '/keys/kali_rsa',
          shell: 'bash',
        },
        timeouts: {
          command: 30000,
          session: 600000,
          connection: 30000,
          keepAlive: 30000,
        },
        buffers: {
          maxSize: 10000,
          trimTo: 5000,
        },
        security: {
          maxSessions: 10,
          sessionTimeout: 600000,
        },
        logging: {
          level: 'info',
          includeCommands: true,
          includeResponses: false,
        },
      };

      const result = ServerConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validConfig);
      }
    });

    it('should require name and target fields only', () => {
      const minimalConfig = {
        name: 'test-instance',
        target: {
          host: 'target.local',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
        },
      };

      const result = ServerConfigSchema.safeParse(minimalConfig);
      expect(result.success).toBe(true);
    });

    it('should reject missing name field', () => {
      const config = {
        target: {
          host: 'target.local',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
        },
      };

      const result = ServerConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject empty name field', () => {
      const config = {
        name: '',
        target: {
          host: 'target.local',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
        },
      };

      const result = ServerConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject missing target field', () => {
      const config = {
        name: 'test-instance',
      };

      const result = ServerConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should accept partial nested configurations', () => {
      const config = {
        name: 'test',
        target: {
          host: 'host',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
        },
        timeouts: {
          command: 60000,
        },
        security: {
          maxSessions: 5,
        },
      };

      const result = ServerConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });
});
