import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseCliArgs, mergeConfigWithArgs, startCli } from '../src/cli.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testConfigDir = path.join(__dirname, '../config');
const testConfigPath = path.join(testConfigDir, 'test-cli.json');

describe('CLI', () => {
  let originalConfig: string | null = null;
  let configExisted = false;

  beforeEach(async () => {
    try {
      originalConfig = await fs.readFile(testConfigPath, 'utf-8');
      configExisted = true;
    } catch {
      configExisted = false;
      originalConfig = null;
    }
  });

  afterEach(async () => {
    if (configExisted && originalConfig) {
      await fs.writeFile(testConfigPath, originalConfig, 'utf-8');
    } else {
      try {
        await fs.unlink(testConfigPath);
      } catch {
        // Ignore if file doesn't exist
      }
    }
  });

  describe('parseCliArgs', () => {
    it('should parse empty arguments', () => {
      const args = parseCliArgs([]);
      expect(args).toEqual({});
    });

    it('should parse config file path', () => {
      const args = parseCliArgs(['--config', '/path/to/config.json']);
      expect(args.configPath).toBe('/path/to/config.json');
    });

    it('should parse config file path with short flag', () => {
      const args = parseCliArgs(['-c', '/path/to/config.json']);
      expect(args.configPath).toBe('/path/to/config.json');
    });

    it('should parse host override', () => {
      const args = parseCliArgs(['--host', 'example.com']);
      expect(args.host).toBe('example.com');
    });

    it('should parse port override', () => {
      const args = parseCliArgs(['--port', '2222']);
      expect(args.port).toBe(2222);
    });

    it('should parse port at minimum boundary', () => {
      const args = parseCliArgs(['--port', '1']);
      expect(args.port).toBe(1);
    });

    it('should parse port at maximum boundary', () => {
      const args = parseCliArgs(['--port', '65535']);
      expect(args.port).toBe(65535);
    });

    it('should parse username override', () => {
      const args = parseCliArgs(['--username', 'admin']);
      expect(args.username).toBe('admin');
    });

    it('should parse key path override', () => {
      const args = parseCliArgs(['--key', '/path/to/key']);
      expect(args.privateKeyPath).toBe('/path/to/key');
    });

    it('should parse passphrase override', () => {
      const args = parseCliArgs(['--passphrase', 'secret']);
      expect(args.passphrase).toBe('secret');
    });

    it('should parse empty passphrase', () => {
      const args = parseCliArgs(['--passphrase', '']);
      expect(args.passphrase).toBe('');
    });

    it('should parse shell override bash', () => {
      const args = parseCliArgs(['--shell', 'bash']);
      expect(args.shell).toBe('bash');
    });

    it('should parse shell override sh', () => {
      const args = parseCliArgs(['--shell', 'sh']);
      expect(args.shell).toBe('sh');
    });

    it('should parse shell override powershell', () => {
      const args = parseCliArgs(['--shell', 'powershell']);
      expect(args.shell).toBe('powershell');
    });

    it('should parse shell override cmd', () => {
      const args = parseCliArgs(['--shell', 'cmd']);
      expect(args.shell).toBe('cmd');
    });

    it('should parse help flag', () => {
      const args = parseCliArgs(['--help']);
      expect(args.help).toBe(true);
    });

    it('should parse help flag with short option', () => {
      const args = parseCliArgs(['-h']);
      expect(args.help).toBe(true);
    });

    it('should parse version flag', () => {
      const args = parseCliArgs(['--version']);
      expect(args.version).toBe(true);
    });

    it('should parse version flag with short option', () => {
      const args = parseCliArgs(['-v']);
      expect(args.version).toBe(true);
    });

    it('should parse multiple arguments', () => {
      const args = parseCliArgs([
        '--host', 'example.com',
        '--port', '2222',
        '--username', 'admin',
      ]);
      expect(args.host).toBe('example.com');
      expect(args.port).toBe(2222);
      expect(args.username).toBe('admin');
    });

    it('should parse all arguments together', () => {
      const args = parseCliArgs([
        '--config', '/config.json',
        '--host', 'example.com',
        '--port', '2222',
        '--username', 'admin',
        '--key', '/key',
        '--passphrase', 'pass',
        '--shell', 'sh',
      ]);
      expect(args.configPath).toBe('/config.json');
      expect(args.host).toBe('example.com');
      expect(args.port).toBe(2222);
      expect(args.username).toBe('admin');
      expect(args.privateKeyPath).toBe('/key');
      expect(args.passphrase).toBe('pass');
      expect(args.shell).toBe('sh');
    });

    it('should throw error for invalid port value', () => {
      expect(() => parseCliArgs(['--port', 'invalid'])).toThrow();
    });

    it('should throw error for port out of range (too low)', () => {
      expect(() => parseCliArgs(['--port', '0'])).toThrow();
    });

    it('should throw error for port out of range (too high)', () => {
      expect(() => parseCliArgs(['--port', '99999'])).toThrow();
    });

    it('should throw error for negative port', () => {
      expect(() => parseCliArgs(['--port', '-1'])).toThrow();
    });

    it('should parse decimal port as integer (truncates)', () => {
      const args = parseCliArgs(['--port', '22.5']);
      expect(args.port).toBe(22);
    });

    it('should parse port with leading zeros', () => {
      const args = parseCliArgs(['--port', '0022']);
      expect(args.port).toBe(22);
    });

    it('should throw error for invalid shell type', () => {
      expect(() => parseCliArgs(['--shell', 'zsh'])).toThrow();
    });

    it('should throw error for empty config path', () => {
      expect(() => parseCliArgs(['--config', ''])).toThrow();
    });

    it('should throw error for whitespace-only config path', () => {
      expect(() => parseCliArgs(['--config', '   '])).toThrow();
    });

    it('should throw error for empty host', () => {
      expect(() => parseCliArgs(['--host', ''])).toThrow();
    });

    it('should throw error for whitespace-only host', () => {
      expect(() => parseCliArgs(['--host', '   '])).toThrow();
    });

    it('should throw error for empty username', () => {
      expect(() => parseCliArgs(['--username', ''])).toThrow();
    });

    it('should throw error for whitespace-only username', () => {
      expect(() => parseCliArgs(['--username', '   '])).toThrow();
    });

    it('should throw error for empty key path', () => {
      expect(() => parseCliArgs(['--key', ''])).toThrow();
    });

    it('should throw error for whitespace-only key path', () => {
      expect(() => parseCliArgs(['--key', '   '])).toThrow();
    });

    it('should throw error for missing argument value', () => {
      expect(() => parseCliArgs(['--host'])).toThrow();
    });

    it('should throw error for unknown argument', () => {
      expect(() => parseCliArgs(['--unknown', 'value'])).toThrow(/unknown argument/);
    });

    it('should throw error for unknown argument at end of args', () => {
      expect(() => parseCliArgs(['--unknown'])).toThrow(/unknown argument/);
    });
  });

  describe('mergeConfigWithArgs', () => {
    it('should return config unchanged when no args provided', () => {
      const config = {
        name: 'test',
        target: {
          host: 'original.com',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
          shell: 'bash' as const,
        },
      };
      const merged = mergeConfigWithArgs(config, {});
      expect(merged).toEqual(config);
    });

    it('should not mutate original config', () => {
      const config = {
        name: 'test',
        target: {
          host: 'original.com',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
          shell: 'bash' as const,
        },
      };
      const merged = mergeConfigWithArgs(config, { host: 'new.com' });
      expect(config.target.host).toBe('original.com');
      expect(merged.target.host).toBe('new.com');
    });

    it('should override host from args', () => {
      const config = {
        name: 'test',
        target: {
          host: 'original.com',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
          shell: 'bash' as const,
        },
      };
      const merged = mergeConfigWithArgs(config, { host: 'new.com' });
      expect(merged.target.host).toBe('new.com');
    });

    it('should override port from args', () => {
      const config = {
        name: 'test',
        target: {
          host: 'host.com',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
          shell: 'bash' as const,
        },
      };
      const merged = mergeConfigWithArgs(config, { port: 2222 });
      expect(merged.target.port).toBe(2222);
    });

    it('should override username from args', () => {
      const config = {
        name: 'test',
        target: {
          host: 'host.com',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
          shell: 'bash' as const,
        },
      };
      const merged = mergeConfigWithArgs(config, { username: 'admin' });
      expect(merged.target.username).toBe('admin');
    });

    it('should override privateKeyPath from args', () => {
      const config = {
        name: 'test',
        target: {
          host: 'host.com',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
          shell: 'bash' as const,
        },
      };
      const merged = mergeConfigWithArgs(config, { privateKeyPath: '/new/key' });
      expect(merged.target.privateKeyPath).toBe('/new/key');
    });

    it('should override passphrase from args', () => {
      const config = {
        name: 'test',
        target: {
          host: 'host.com',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
          shell: 'bash' as const,
        },
      };
      const merged = mergeConfigWithArgs(config, { passphrase: 'secret' });
      expect(merged.target.passphrase).toBe('secret');
    });

    it('should override shell from args', () => {
      const config = {
        name: 'test',
        target: {
          host: 'host.com',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
          shell: 'bash' as const,
        },
      };
      const merged = mergeConfigWithArgs(config, { shell: 'sh' });
      expect(merged.target.shell).toBe('sh');
    });

    it('should override multiple fields from args', () => {
      const config = {
        name: 'test',
        target: {
          host: 'host.com',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
          shell: 'bash' as const,
        },
      };
      const merged = mergeConfigWithArgs(config, {
        host: 'new.com',
        port: 2222,
        username: 'admin',
        shell: 'sh',
      });
      expect(merged.target.host).toBe('new.com');
      expect(merged.target.port).toBe(2222);
      expect(merged.target.username).toBe('admin');
      expect(merged.target.shell).toBe('sh');
    });

    it('should preserve other config sections when overriding', () => {
      const config = {
        name: 'test',
        target: {
          host: 'host.com',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
          shell: 'bash' as const,
        },
        timeouts: {
          command: 60000,
        },
        logging: {
          level: 'debug' as const,
        },
      };
      const merged = mergeConfigWithArgs(config, { host: 'new.com' });
      expect(merged.timeouts).toEqual({ command: 60000 });
      expect(merged.logging).toEqual({ level: 'debug' });
    });

    it('should throw error if config is null', () => {
      expect(() => mergeConfigWithArgs(null as any, {})).toThrow();
    });

    it('should throw error if config is undefined', () => {
      expect(() => mergeConfigWithArgs(undefined as any, {})).toThrow();
    });

    it('should throw error if args is null', () => {
      const config = {
        name: 'test',
        target: {
          host: 'host.com',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
          shell: 'bash' as const,
        },
      };
      expect(() => mergeConfigWithArgs(config, null as any)).toThrow();
    });

    it('should throw error if args is undefined', () => {
      const config = {
        name: 'test',
        target: {
          host: 'host.com',
          port: 22,
          username: 'user',
          privateKeyPath: '/key',
          shell: 'bash' as const,
        },
      };
      expect(() => mergeConfigWithArgs(config, undefined as any)).toThrow();
    });
  });

  describe('startCli', () => {
    it('should throw error for null argv', async () => {
      await expect(startCli(null as any)).rejects.toThrow();
    });

    it('should throw error for undefined argv', async () => {
      await expect(startCli(undefined as any)).rejects.toThrow();
    });

    it('should not throw for help flag', async () => {
      await expect(startCli(['--help'])).resolves.toBeUndefined();
    });

    it('should not throw for version flag', async () => {
      await expect(startCli(['--version'])).resolves.toBeUndefined();
    });
  });
});
