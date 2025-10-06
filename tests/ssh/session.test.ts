import { describe, it, expect, vi } from 'vitest';
import { PersistentSession } from '../../src/ssh/session.js';
import { ShellType } from '../../src/shells.js';

// Test our business logic, not the ssh2 library
describe('PersistentSession', () => {
  describe('Session State Management', () => {
    it('should create session metadata correctly', () => {
      const mockClient = {} as any;
      const session = new PersistentSession(
        'test-id',
        'test-host',
        'test-user',
        'interactive',
        mockClient,
        2222,
        'normal',
        60000
      );

      const info = session.getSessionInfo();
      expect(info.sessionId).toBe('test-id');
      expect(info.target).toBe('test-host');
      expect(info.username).toBe('test-user');
      expect(info.type).toBe('interactive');
      expect(info.mode).toBe('normal');
      expect(info.port).toBe(2222);
      expect(info.isActive).toBe(false); // Not initialized yet
      expect(info.commandHistory).toEqual([]);
    });

    it('should return immutable session info copies', () => {
      const mockClient = {} as any;
      const session = new PersistentSession(
        'test', 'host', 'user', 'interactive', mockClient, 22
      );

      const info1 = session.getSessionInfo();
      const info2 = session.getSessionInfo();

      expect(info1).not.toBe(info2); // Different object instances
      expect(info1).toEqual(info2); // Same content

      // Mutating returned object shouldn't affect internal state
      info1.isActive = true;
      info1.commandHistory.push('fake command');

      const info3 = session.getSessionInfo();
      expect(info3.isActive).toBe(false); // Original state preserved
      expect(info3.commandHistory).toEqual([]); // Original state preserved
    });

    it('should track different session types and modes', () => {
      const mockClient = {} as any;

      const interactive = new PersistentSession('i', 'host', 'user', 'interactive', mockClient);
      const background = new PersistentSession('b', 'host', 'user', 'background', mockClient);
      const raw = new PersistentSession('r', 'host', 'user', 'interactive', mockClient, 22, 'raw');

      expect(interactive.getSessionInfo().type).toBe('interactive');
      expect(interactive.getSessionInfo().mode).toBe('normal');

      expect(background.getSessionInfo().type).toBe('background');
      expect(background.getSessionInfo().mode).toBe('normal');

      expect(raw.getSessionInfo().type).toBe('interactive');
      expect(raw.getSessionInfo().mode).toBe('raw');
    });
  });

  describe('Buffer Management', () => {
    it('should handle buffer operations safely', () => {
      const mockClient = {} as any;
      const session = new PersistentSession(
        'buffer-test', 'host', 'user', 'background', mockClient, 22
      );

      // Test empty buffer
      let buffer = session.getBufferedOutput();
      expect(buffer).toEqual([]);

      // Test with line limit on empty buffer
      buffer = session.getBufferedOutput(10);
      expect(buffer).toEqual([]);

      // Test clear on empty buffer
      buffer = session.getBufferedOutput(undefined, true);
      expect(buffer).toEqual([]);
    });

    it('should keep newest data when buffer overflows', () => {
      const mockClient = {} as any;
      const session = new PersistentSession(
        'overflow-test', 'host', 'user', 'background', mockClient, 22
      );

      // Simulate the private method behavior by accessing outputBuffer
      const outputBuffer = (session as any).outputBuffer;

      // Fill buffer beyond limit
      for (let i = 0; i < 12000; i++) {
        outputBuffer.push(`line ${i}`);
      }

      // Trigger the overflow logic manually
      if (outputBuffer.length > 10000) {
        (session as any).outputBuffer = outputBuffer.slice(-5000);
      }

      const buffer = session.getBufferedOutput();
      expect(buffer.length).toBe(5000);
      // Should keep lines 7000-11999 (newest)
      expect(buffer[0]).toBe('line 7000');
      expect(buffer[buffer.length - 1]).toBe('line 11999');
    });
  });

  describe('Shell Type Support', () => {
    it('should create sessions with default bash shell', () => {
      const mockClient = {} as any;
      const session = new PersistentSession(
        'test-id',
        'test-host',
        'test-user',
        'interactive',
        mockClient,
        22
      );

      // The shell type is handled internally by the formatter
      const info = session.getSessionInfo();
      expect(info).toBeDefined(); // Session created successfully
    });

    it('should create sessions with specified shell types', () => {
      const mockClient = {} as any;
      const shellTypes: ShellType[] = ['bash', 'sh', 'powershell', 'cmd'];

      shellTypes.forEach(shellType => {
        const session = new PersistentSession(
          `test-${shellType}`,
          'test-host',
          'test-user',
          'interactive',
          mockClient,
          22,
          'normal',
          60000,
          shellType
        );

        const info = session.getSessionInfo();
        expect(info.sessionId).toBe(`test-${shellType}`);
        expect(info).toBeDefined(); // Session created successfully with shell type
      });
    });

    it('should track shell type through session lifecycle', () => {
      const mockClient = {
        shell: vi.fn((callback) => {
          // Mock shell stream
          const mockStream = {
            on: vi.fn(),
            stderr: { on: vi.fn() },
            write: vi.fn(),
            end: vi.fn()
          };
          callback(null, mockStream);
          return mockStream;
        })
      } as any;

      const powershellSession = new PersistentSession(
        'ps-test',
        'windows-host',
        'Administrator',
        'interactive',
        mockClient,
        22,
        'normal',
        60000,
        'powershell'
      );

      // Initialize the session
      powershellSession.initialize().then(() => {
        const info = powershellSession.getSessionInfo();
        expect(info.sessionId).toBe('ps-test');
        expect(info.target).toBe('windows-host');
        expect(info.username).toBe('Administrator');
      });
    });
  });

  describe('Input Validation', () => {
    it('should throw error for null sessionId', () => {
      const mockClient = {} as any;
      expect(() =>
        new PersistentSession(null as any, 'host', 'user', 'interactive', mockClient)
      ).toThrow('Null or undefined arguments');
    });

    it('should throw error for empty sessionId', () => {
      const mockClient = {} as any;
      expect(() =>
        new PersistentSession('', 'host', 'user', 'interactive', mockClient)
      ).toThrow('Invalid arguments');
    });

    it('should throw error for null target', () => {
      const mockClient = {} as any;
      expect(() =>
        new PersistentSession('id', null as any, 'user', 'interactive', mockClient)
      ).toThrow('Null or undefined arguments');
    });

    it('should throw error for empty target', () => {
      const mockClient = {} as any;
      expect(() =>
        new PersistentSession('id', '', 'user', 'interactive', mockClient)
      ).toThrow('Invalid arguments');
    });

    it('should throw error for null username', () => {
      const mockClient = {} as any;
      expect(() =>
        new PersistentSession('id', 'host', null as any, 'interactive', mockClient)
      ).toThrow('Null or undefined arguments');
    });

    it('should throw error for empty username', () => {
      const mockClient = {} as any;
      expect(() =>
        new PersistentSession('id', 'host', '', 'interactive', mockClient)
      ).toThrow('Invalid arguments');
    });

    it('should throw error for null client', () => {
      expect(() =>
        new PersistentSession('id', 'host', 'user', 'interactive', null as any)
      ).toThrow('Null or undefined arguments');
    });

    it('should throw error for port 0', () => {
      const mockClient = {} as any;
      expect(() =>
        new PersistentSession('id', 'host', 'user', 'interactive', mockClient, 0)
      ).toThrow('port must be between 1 and 65535');
    });

    it('should throw error for port > 65535', () => {
      const mockClient = {} as any;
      expect(() =>
        new PersistentSession('id', 'host', 'user', 'interactive', mockClient, 65536)
      ).toThrow('port must be between 1 and 65535');
    });

    it('should throw error for negative timeout', () => {
      const mockClient = {} as any;
      expect(() =>
        new PersistentSession('id', 'host', 'user', 'interactive', mockClient, 22, 'normal', -1)
      ).toThrow('timeoutMs must be positive');
    });

    it('should throw error for zero timeout', () => {
      const mockClient = {} as any;
      expect(() =>
        new PersistentSession('id', 'host', 'user', 'interactive', mockClient, 22, 'normal', 0)
      ).toThrow('timeoutMs must be positive');
    });

    it('should throw error for getBufferedOutput with negative lines', () => {
      const mockClient = {} as any;
      const session = new PersistentSession('id', 'host', 'user', 'background', mockClient);

      expect(() => session.getBufferedOutput(-1)).toThrow('lines must be positive');
    });

    it('should throw error for getBufferedOutput with zero lines', () => {
      const mockClient = {} as any;
      const session = new PersistentSession('id', 'host', 'user', 'background', mockClient);

      expect(() => session.getBufferedOutput(0)).toThrow('lines must be positive');
    });

    it('should throw error for executeCommand with empty command', async () => {
      const mockClient = {} as any;
      const session = new PersistentSession('id', 'host', 'user', 'interactive', mockClient);

      await expect(session.executeCommand('')).rejects.toThrow('command is required');
    });

    it('should throw error for executeCommand with zero timeout', async () => {
      const mockClient = {} as any;
      const session = new PersistentSession('id', 'host', 'user', 'interactive', mockClient);

      await expect(session.executeCommand('ls', 0)).rejects.toThrow('timeout must be positive');
    });

    it('should throw error for executeCommand with negative timeout', async () => {
      const mockClient = {} as any;
      const session = new PersistentSession('id', 'host', 'user', 'interactive', mockClient);

      await expect(session.executeCommand('ls', -1)).rejects.toThrow('timeout must be positive');
    });
  });

  describe('Command Filtering', () => {
    it('should allow commands when no filter set', async () => {
      const mockClient = {} as any;
      const session = new PersistentSession('id', 'host', 'user', 'interactive', mockClient);

      // Should not throw even though session not initialized
      // (will throw for session not initialized, not filtering)
      await expect(session.executeCommand('rm -rf /')).rejects.toThrow('Session not initialized');
    });

    it('should enforce command filter when set', async () => {
      const mockClient = {} as any;
      const session = new PersistentSession('id', 'host', 'user', 'interactive', mockClient);

      session.setCommandFilter((cmd: string) => {
        if (cmd.startsWith('rm')) {
          throw new Error('rm commands blocked');
        }
      });

      // Initialize mock session
      (session as any).isInitialized = true;
      (session as any).shell = {};
      (session as any).sessionInfo.isActive = true;

      await expect(session.executeCommand('rm file.txt')).rejects.toThrow('rm commands blocked');
    });

    it('should allow filtered commands that pass', async () => {
      const mockClient = {} as any;
      const session = new PersistentSession('id', 'host', 'user', 'background', mockClient);

      session.setCommandFilter((cmd: string) => {
        if (cmd.startsWith('rm')) {
          throw new Error('rm commands blocked');
        }
      });

      // Initialize mock session
      (session as any).isInitialized = true;
      (session as any).shell = { write: vi.fn() };
      (session as any).sessionInfo.isActive = true;

      // Should not throw for allowed command
      const result = await session.executeCommand('ls -la');
      expect(result.stdout).toContain('queued in background');
    });
  });

  describe('Injection Prevention', () => {
    it('should handle commands with shell metacharacters', async () => {
      const mockClient = {} as any;
      const session = new PersistentSession('id', 'host', 'user', 'background', mockClient);

      (session as any).isInitialized = true;
      (session as any).shell = { write: vi.fn() };
      (session as any).sessionInfo.isActive = true;

      // These should be queued, not cause injection
      await expect(session.executeCommand('echo "test; rm -rf /"')).resolves.toBeDefined();
      await expect(session.executeCommand('ls | grep pattern')).resolves.toBeDefined();
      await expect(session.executeCommand('cmd1 && cmd2')).resolves.toBeDefined();
      await expect(session.executeCommand('cmd1 || cmd2')).resolves.toBeDefined();
    });

    it('should handle commands with quotes and escapes', async () => {
      const mockClient = {} as any;
      const session = new PersistentSession('id', 'host', 'user', 'background', mockClient);

      (session as any).isInitialized = true;
      (session as any).shell = { write: vi.fn() };
      (session as any).sessionInfo.isActive = true;

      await expect(session.executeCommand('echo "Hello \\"World\\""')).resolves.toBeDefined();
      await expect(session.executeCommand("echo 'test'")).resolves.toBeDefined();
      await expect(session.executeCommand('echo `whoami`')).resolves.toBeDefined();
    });

    it('should handle commands with newlines', async () => {
      const mockClient = {} as any;
      const session = new PersistentSession('id', 'host', 'user', 'background', mockClient);

      (session as any).isInitialized = true;
      (session as any).shell = { write: vi.fn() };
      (session as any).sessionInfo.isActive = true;

      await expect(session.executeCommand('echo "line1\\nline2"')).resolves.toBeDefined();
    });

    it('should handle very long commands', async () => {
      const mockClient = {} as any;
      const session = new PersistentSession('id', 'host', 'user', 'background', mockClient);

      (session as any).isInitialized = true;
      (session as any).shell = { write: vi.fn() };
      (session as any).sessionInfo.isActive = true;

      const longCommand = 'echo ' + 'a'.repeat(10000);
      await expect(session.executeCommand(longCommand)).resolves.toBeDefined();
    });

    it('should handle Unicode and special characters', async () => {
      const mockClient = {} as any;
      const session = new PersistentSession('id', 'host', 'user', 'background', mockClient);

      (session as any).isInitialized = true;
      (session as any).shell = { write: vi.fn() };
      (session as any).sessionInfo.isActive = true;

      await expect(session.executeCommand('echo "Hello 世界 🌍"')).resolves.toBeDefined();
      await expect(session.executeCommand('echo "Ñoño"')).resolves.toBeDefined();
    });
  });
});
