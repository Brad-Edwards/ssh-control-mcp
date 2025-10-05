import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../../src/config/loader.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testConfigDir = path.join(__dirname, '../../config');
const testConfigPath = path.join(testConfigDir, 'default.json');

describe('Configuration Loader', () => {
  let originalConfig: string | null = null;
  let configExisted = false;

  beforeEach(async () => {
    // Backup existing config if it exists
    try {
      originalConfig = await fs.readFile(testConfigPath, 'utf-8');
      configExisted = true;
    } catch {
      configExisted = false;
      originalConfig = null;
    }
  });

  afterEach(async () => {
    // Restore original config or remove test config
    if (configExisted && originalConfig) {
      await fs.writeFile(testConfigPath, originalConfig, 'utf-8');
    } else {
      try {
        await fs.unlink(testConfigPath);
      } catch {
        // File may not exist, ignore
      }
    }
  });

  describe('loadConfig', () => {
    it('should load valid configuration from default.json', async () => {
      const validConfig = {
        name: 'test-instance',
        target: {
          host: 'test.local',
          port: 22,
          username: 'testuser',
          privateKeyPath: '/path/to/key',
          shell: 'bash',
        },
      };

      await fs.mkdir(testConfigDir, { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(validConfig, null, 2), 'utf-8');

      const config = await loadConfig();

      expect(config.name).toBe('test-instance');
      expect(config.target.host).toBe('test.local');
      expect(config.target.port).toBe(22);
      expect(config.target.username).toBe('testuser');
      expect(config.target.privateKeyPath).toBe('/path/to/key');
      expect(config.target.shell).toBe('bash');
    });

    it('should merge loaded config with defaults', async () => {
      const minimalConfig = {
        name: 'minimal',
        target: {
          host: 'host',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
        },
      };

      await fs.mkdir(testConfigDir, { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(minimalConfig, null, 2), 'utf-8');

      const config = await loadConfig();

      expect(config.name).toBe('minimal');
      expect(config.timeouts).toBeDefined();
      expect(config.timeouts?.command).toBe(30000);
      expect(config.buffers).toBeDefined();
      expect(config.buffers?.maxSize).toBe(10000);
      expect(config.security).toBeDefined();
      expect(config.logging).toBeDefined();
    });

    it('should load config with all optional sections', async () => {
      const fullConfig = {
        name: 'full',
        target: {
          host: 'host',
          port: 2222,
          username: 'user',
          privateKeyPath: '/key',
          passphrase: 'secret',
          shell: 'sh',
        },
        timeouts: {
          command: 60000,
          session: 300000,
        },
        buffers: {
          maxSize: 5000,
          trimTo: 2500,
        },
        security: {
          blockedCommands: ['^rm'],
          maxSessions: 5,
        },
        logging: {
          level: 'debug',
          includeCommands: false,
        },
      };

      await fs.mkdir(testConfigDir, { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(fullConfig, null, 2), 'utf-8');

      const config = await loadConfig();

      expect(config.name).toBe('full');
      expect(config.target.port).toBe(2222);
      expect(config.target.passphrase).toBe('secret');
      expect(config.target.shell).toBe('sh');
      expect(config.timeouts?.command).toBe(60000);
      expect(config.buffers?.maxSize).toBe(5000);
      expect(config.security?.blockedCommands).toEqual(['^rm']);
      expect(config.logging?.level).toBe('debug');
    });

    it('should throw error if config file does not exist', async () => {
      // Ensure config file doesn't exist
      try {
        await fs.unlink(testConfigPath);
      } catch {
        // Ignore if already doesn't exist
      }

      await expect(loadConfig()).rejects.toThrow();
    });

    it('should throw error for invalid JSON', async () => {
      const invalidJson = '{ name: "invalid", missing quotes }';

      await fs.mkdir(testConfigDir, { recursive: true });
      await fs.writeFile(testConfigPath, invalidJson, 'utf-8');

      await expect(loadConfig()).rejects.toThrow();
    });

    it('should throw error for config missing required fields', async () => {
      const invalidConfig = {
        name: 'missing-target',
        // Missing target field
      };

      await fs.mkdir(testConfigDir, { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(invalidConfig), 'utf-8');

      await expect(loadConfig()).rejects.toThrow();
    });

    it('should throw error for config with invalid port', async () => {
      const invalidConfig = {
        name: 'invalid-port',
        target: {
          host: 'host',
          port: 99999, // Invalid port
          username: 'user',
          privateKeyPath: '/key',
        },
      };

      await fs.mkdir(testConfigDir, { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(invalidConfig), 'utf-8');

      await expect(loadConfig()).rejects.toThrow();
    });

    it('should throw error for config with invalid shell type', async () => {
      const invalidConfig = {
        name: 'invalid-shell',
        target: {
          host: 'host',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
          shell: 'zsh', // Invalid shell type
        },
      };

      await fs.mkdir(testConfigDir, { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(invalidConfig), 'utf-8');

      await expect(loadConfig()).rejects.toThrow();
    });

    it('should throw error for config with invalid regex patterns', async () => {
      const invalidConfig = {
        name: 'invalid-regex',
        target: {
          host: 'host',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
        },
        security: {
          blockedCommands: ['[invalid'], // Invalid regex
        },
      };

      await fs.mkdir(testConfigDir, { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(invalidConfig), 'utf-8');

      await expect(loadConfig()).rejects.toThrow();
    });

    it('should throw error for config with empty required strings', async () => {
      const invalidConfig = {
        name: '',
        target: {
          host: 'host',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
        },
      };

      await fs.mkdir(testConfigDir, { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(invalidConfig), 'utf-8');

      await expect(loadConfig()).rejects.toThrow();
    });

    it('should throw error for config with negative timeout values', async () => {
      const invalidConfig = {
        name: 'invalid-timeout',
        target: {
          host: 'host',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
        },
        timeouts: {
          command: -1000,
        },
      };

      await fs.mkdir(testConfigDir, { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(invalidConfig), 'utf-8');

      await expect(loadConfig()).rejects.toThrow();
    });

    it('should throw error for config with trimTo > maxSize', async () => {
      const invalidConfig = {
        name: 'invalid-buffers',
        target: {
          host: 'host',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
        },
        buffers: {
          maxSize: 1000,
          trimTo: 5000,
        },
      };

      await fs.mkdir(testConfigDir, { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(invalidConfig), 'utf-8');

      await expect(loadConfig()).rejects.toThrow();
    });
  });
});
