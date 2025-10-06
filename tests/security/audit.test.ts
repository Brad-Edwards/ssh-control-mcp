import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { AuditLogger, AuditEvent } from '../../src/security/audit.js';
import type { LoggingConfig } from '../../src/config/schema.js';

describe('AuditLogger', () => {
  const testLogDir = path.join(process.cwd(), 'test-logs');
  const testLogFile = path.join(testLogDir, 'test-audit.log');

  /**
   * Helper to find the actual log file created by winston-daily-rotate-file
   * which appends the date pattern to the filename
   */
  async function findLogFile(): Promise<string> {
    const files = await fs.readdir(testLogDir);
    const logFiles = files.filter(f => f.startsWith('test-audit-') && f.endsWith('.log'));
    if (logFiles.length === 0) {
      throw new Error('No log files found');
    }
    return path.join(testLogDir, logFiles[0]);
  }

  beforeEach(async () => {
    // Clean up test logs before each test
    try {
      await fs.rm(testLogDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
    await fs.mkdir(testLogDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test logs after each test
    try {
      await fs.rm(testLogDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    it('should create logger with default config', () => {
      const logger = new AuditLogger();
      expect(logger).toBeDefined();
    });

    it('should create logger with custom config', () => {
      const config: LoggingConfig = {
        level: 'debug',
        includeCommands: true,
        includeResponses: true,
        maxResponseLength: 500,
      };
      const logger = new AuditLogger(config, testLogFile);
      expect(logger).toBeDefined();
    });

    it('should allow undefined config', () => {
      const logger = new AuditLogger(undefined, testLogFile);
      expect(logger).toBeDefined();
    });

    it('should throw error for empty file path', () => {
      expect(() => new AuditLogger({}, '')).toThrow();
    });
  });

  describe('event logging', () => {
    it('should log SESSION_CREATED event', async () => {
      const logger = new AuditLogger({}, testLogFile);

      logger.logEvent(AuditEvent.SESSION_CREATED, {
        sessionId: 'test-session-1',
        target: 'localhost:22',
        username: 'testuser',
        type: 'interactive',
        mode: 'normal',
      });

      // Wait for async write
      await new Promise(resolve => setTimeout(resolve, 100));

      const actualLogFile = await findLogFile();
      const logContent = await fs.readFile(actualLogFile, 'utf-8');
      expect(logContent).toContain('SESSION_CREATED');
      expect(logContent).toContain('test-session-1');
      expect(logContent).toContain('localhost:22');
      expect(logContent).toContain('testuser');
    });

    it('should log SESSION_CLOSED event', async () => {
      const logger = new AuditLogger({}, testLogFile);

      logger.logEvent(AuditEvent.SESSION_CLOSED, {
        sessionId: 'test-session-1',
        target: 'localhost:22',
        username: 'testuser',
        reason: 'user_requested',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const actualLogFile = await findLogFile();
      const logContent = await fs.readFile(actualLogFile, 'utf-8');
      expect(logContent).toContain('SESSION_CLOSED');
      expect(logContent).toContain('user_requested');
    });

    it('should log COMMAND_EXECUTED event', async () => {
      const logger = new AuditLogger({ includeCommands: true }, testLogFile);

      logger.logEvent(AuditEvent.COMMAND_EXECUTED, {
        sessionId: 'test-session-1',
        target: 'localhost:22',
        username: 'testuser',
        command: 'ls -la',
        exitCode: 0,
        duration: 150,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const actualLogFile = await findLogFile();
      const logContent = await fs.readFile(actualLogFile, 'utf-8');
      expect(logContent).toContain('COMMAND_EXECUTED');
      expect(logContent).toContain('ls -la');
      expect(logContent).toContain('"exitCode":0');
      expect(logContent).toContain('"duration":150');
    });

    it('should log CONNECTION_ESTABLISHED event', async () => {
      const logger = new AuditLogger({}, testLogFile);

      logger.logEvent(AuditEvent.CONNECTION_ESTABLISHED, {
        target: 'localhost:22',
        username: 'testuser',
        connectionId: 'conn-123',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const actualLogFile = await findLogFile();
      const logContent = await fs.readFile(actualLogFile, 'utf-8');
      expect(logContent).toContain('CONNECTION_ESTABLISHED');
      expect(logContent).toContain('conn-123');
    });

    it('should log CONNECTION_FAILED event', async () => {
      const logger = new AuditLogger({}, testLogFile);

      logger.logEvent(AuditEvent.CONNECTION_FAILED, {
        target: 'localhost:22',
        username: 'testuser',
        error: 'Connection timeout',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const actualLogFile = await findLogFile();
      const logContent = await fs.readFile(actualLogFile, 'utf-8');
      expect(logContent).toContain('CONNECTION_FAILED');
      expect(logContent).toContain('Connection timeout');
    });

    it('should log ERROR_OCCURRED event', async () => {
      const logger = new AuditLogger({}, testLogFile);

      logger.logEvent(AuditEvent.ERROR_OCCURRED, {
        sessionId: 'test-session-1',
        target: 'localhost:22',
        error: 'Command execution failed',
        errorCode: 'EXEC_FAILED',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const actualLogFile = await findLogFile();
      const logContent = await fs.readFile(actualLogFile, 'utf-8');
      expect(logContent).toContain('ERROR_OCCURRED');
      expect(logContent).toContain('EXEC_FAILED');
    });

    it('should include timestamp in all events', async () => {
      const logger = new AuditLogger({}, testLogFile);

      logger.logEvent(AuditEvent.SESSION_CREATED, {
        sessionId: 'test-session-1',
        target: 'localhost:22',
        username: 'testuser',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const actualLogFile = await findLogFile();
      const logContent = await fs.readFile(actualLogFile, 'utf-8');
      expect(logContent).toMatch(/"timestamp":".*Z"/);
    });

    it('should throw error for null event data', () => {
      const logger = new AuditLogger({}, testLogFile);
      expect(() => logger.logEvent(AuditEvent.SESSION_CREATED, null as any)).toThrow();
    });

    it('should throw error for undefined event data', () => {
      const logger = new AuditLogger({}, testLogFile);
      expect(() => logger.logEvent(AuditEvent.SESSION_CREATED, undefined as any)).toThrow();
    });
  });

  describe('sanitization', () => {
    it('should sanitize private key paths', async () => {
      const logger = new AuditLogger({ includeCommands: true }, testLogFile);

      logger.logEvent(AuditEvent.SESSION_CREATED, {
        sessionId: 'test-session-1',
        target: 'localhost:22',
        username: 'testuser',
        privateKeyPath: '/home/user/.ssh/id_rsa',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const actualLogFile = await findLogFile();
      const logContent = await fs.readFile(actualLogFile, 'utf-8');
      expect(logContent).not.toContain('/home/user/.ssh/id_rsa');
      expect(logContent).toContain('id_rsa');
    });

    it('should sanitize passphrases', async () => {
      const logger = new AuditLogger({}, testLogFile);

      logger.logEvent(AuditEvent.SESSION_CREATED, {
        sessionId: 'test-session-1',
        target: 'localhost:22',
        username: 'testuser',
        passphrase: 'secret123',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const actualLogFile = await findLogFile();
      const logContent = await fs.readFile(actualLogFile, 'utf-8');
      expect(logContent).not.toContain('secret123');
      expect(logContent).toContain('[REDACTED]');
    });

    it('should sanitize commands with passwords', async () => {
      const logger = new AuditLogger({ includeCommands: true }, testLogFile);

      logger.logEvent(AuditEvent.COMMAND_EXECUTED, {
        sessionId: 'test-session-1',
        target: 'localhost:22',
        username: 'testuser',
        command: 'mysql -u root -pSecretPass123',
        exitCode: 0,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const actualLogFile = await findLogFile();
      const logContent = await fs.readFile(actualLogFile, 'utf-8');
      expect(logContent).not.toContain('SecretPass123');
      expect(logContent).toContain('[REDACTED]');
    });

    it('should sanitize commands with tokens', async () => {
      const logger = new AuditLogger({ includeCommands: true }, testLogFile);

      logger.logEvent(AuditEvent.COMMAND_EXECUTED, {
        sessionId: 'test-session-1',
        target: 'localhost:22',
        username: 'testuser',
        command: 'curl -H "Bearer abc123xyz"',
        exitCode: 0,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const actualLogFile = await findLogFile();
      const logContent = await fs.readFile(actualLogFile, 'utf-8');
      expect(logContent).not.toContain('abc123xyz');
      expect(logContent).toContain('[REDACTED]');
    });

    it('should sanitize commands with API keys', async () => {
      const logger = new AuditLogger({ includeCommands: true }, testLogFile);

      logger.logEvent(AuditEvent.COMMAND_EXECUTED, {
        sessionId: 'test-session-1',
        target: 'localhost:22',
        username: 'testuser',
        command: 'export API_KEY=sk-1234567890abcdef',
        exitCode: 0,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const actualLogFile = await findLogFile();
      const logContent = await fs.readFile(actualLogFile, 'utf-8');
      expect(logContent).not.toContain('sk-1234567890abcdef');
      expect(logContent).toContain('[REDACTED]');
    });

    it('should truncate long responses', async () => {
      const logger = new AuditLogger({
        includeResponses: true,
        maxResponseLength: 50
      }, testLogFile);

      const longOutput = 'a'.repeat(1000);

      logger.logEvent(AuditEvent.COMMAND_EXECUTED, {
        sessionId: 'test-session-1',
        target: 'localhost:22',
        username: 'testuser',
        command: 'echo test',
        exitCode: 0,
        stdout: longOutput,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const actualLogFile = await findLogFile();
      const logContent = await fs.readFile(actualLogFile, 'utf-8');
      const match = logContent.match(/"stdout":"(.*?)"/);
      expect(match).toBeDefined();
      if (match) {
        expect(match[1].length).toBeLessThanOrEqual(70); // 50 + truncation marker
      }
    });

    it('should not include responses when includeResponses is false', async () => {
      const logger = new AuditLogger({
        includeResponses: false
      }, testLogFile);

      logger.logEvent(AuditEvent.COMMAND_EXECUTED, {
        sessionId: 'test-session-1',
        target: 'localhost:22',
        username: 'testuser',
        command: 'echo test',
        exitCode: 0,
        stdout: 'test output',
        stderr: 'test error',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const actualLogFile = await findLogFile();
      const logContent = await fs.readFile(actualLogFile, 'utf-8');
      expect(logContent).not.toContain('test output');
      expect(logContent).not.toContain('test error');
    });

    it('should not include commands when includeCommands is false', async () => {
      const logger = new AuditLogger({
        includeCommands: false
      }, testLogFile);

      logger.logEvent(AuditEvent.COMMAND_EXECUTED, {
        sessionId: 'test-session-1',
        target: 'localhost:22',
        username: 'testuser',
        command: 'ls -la /secret',
        exitCode: 0,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const actualLogFile = await findLogFile();
      const logContent = await fs.readFile(actualLogFile, 'utf-8');
      expect(logContent).not.toContain('ls -la /secret');
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings in event data', async () => {
      const logger = new AuditLogger({}, testLogFile);

      logger.logEvent(AuditEvent.SESSION_CREATED, {
        sessionId: '',
        target: '',
        username: '',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const actualLogFile = await findLogFile();
      const logContent = await fs.readFile(actualLogFile, 'utf-8');
      expect(logContent).toContain('SESSION_CREATED');
    });

    it('should handle special characters in event data', async () => {
      const logger = new AuditLogger({ includeCommands: true }, testLogFile);

      logger.logEvent(AuditEvent.COMMAND_EXECUTED, {
        sessionId: 'test-session-1',
        target: 'localhost:22',
        username: 'testuser',
        command: 'echo "Hello \\"World\\"" && echo \'test\'',
        exitCode: 0,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const actualLogFile = await findLogFile();
      const logContent = await fs.readFile(actualLogFile, 'utf-8');
      expect(logContent).toContain('COMMAND_EXECUTED');
    });

    it('should handle Unicode characters', async () => {
      const logger = new AuditLogger({ includeCommands: true }, testLogFile);

      logger.logEvent(AuditEvent.COMMAND_EXECUTED, {
        sessionId: 'test-session-1',
        target: 'localhost:22',
        username: 'testuser',
        command: 'echo "Hello 世界 🌍"',
        exitCode: 0,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const actualLogFile = await findLogFile();
      const logContent = await fs.readFile(actualLogFile, 'utf-8');
      expect(logContent).toBeDefined();
    });

    it('should handle very long event data', async () => {
      const logger = new AuditLogger({ includeCommands: true }, testLogFile);

      const longCommand = 'echo ' + 'a'.repeat(10000);

      logger.logEvent(AuditEvent.COMMAND_EXECUTED, {
        sessionId: 'test-session-1',
        target: 'localhost:22',
        username: 'testuser',
        command: longCommand,
        exitCode: 0,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const actualLogFile = await findLogFile();
      const logContent = await fs.readFile(actualLogFile, 'utf-8');
      expect(logContent).toContain('COMMAND_EXECUTED');
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent logging without race conditions', async () => {
      const logger = new AuditLogger({}, testLogFile);

      const promises = Array.from({ length: 100 }, (_, i) =>
        logger.logEvent(AuditEvent.COMMAND_EXECUTED, {
          sessionId: `session-${i}`,
          target: 'localhost:22',
          username: 'testuser',
          command: `echo ${i}`,
          exitCode: 0,
        })
      );

      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, 200));

      const actualLogFile = await findLogFile();
      const logContent = await fs.readFile(actualLogFile, 'utf-8');
      const lines = logContent.trim().split('\n').filter(l => l);

      // Should have all 100 entries
      expect(lines.length).toBe(100);
    });
  });

  describe('log levels', () => {
    it('should respect log level config', async () => {
      const logger = new AuditLogger({ level: 'error' }, testLogFile);

      logger.logEvent(AuditEvent.SESSION_CREATED, {
        sessionId: 'test-session-1',
        target: 'localhost:22',
        username: 'testuser',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Info level events should not be logged with error level config
      const exists = await fs.access(testLogFile).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('should log errors with error level', async () => {
      const logger = new AuditLogger({ level: 'error' }, testLogFile);

      logger.logEvent(AuditEvent.ERROR_OCCURRED, {
        sessionId: 'test-session-1',
        target: 'localhost:22',
        error: 'Test error',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const actualLogFile = await findLogFile();
      const logContent = await fs.readFile(actualLogFile, 'utf-8');
      expect(logContent).toContain('ERROR_OCCURRED');
    });
  });
});
