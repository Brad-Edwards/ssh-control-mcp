import { describe, it, expect } from 'vitest';
import {
  tools,
  SshExecuteArgsSchema,
  SshSessionCreateArgsSchema,
  SshSessionExecuteArgsSchema,
  SshSessionListArgsSchema,
  SshSessionCloseArgsSchema,
  SshSessionOutputArgsSchema,
} from '../../src/mcp/tools.js';

describe('MCP Tools', () => {
  describe('tools array', () => {
    it('should export 6 tools', () => {
      expect(tools).toHaveLength(6);
    });

    it('should have unique tool names', () => {
      const names = tools.map(t => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should have all required tools', () => {
      const names = tools.map(t => t.name);
      expect(names).toContain('ssh_execute');
      expect(names).toContain('ssh_session_create');
      expect(names).toContain('ssh_session_execute');
      expect(names).toContain('ssh_session_list');
      expect(names).toContain('ssh_session_close');
      expect(names).toContain('ssh_session_output');
    });

    it('should have description for each tool', () => {
      tools.forEach(tool => {
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe('string');
        expect(tool.description.length).toBeGreaterThan(0);
      });
    });

    it('should have inputSchema for each tool', () => {
      tools.forEach(tool => {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      });
    });
  });

  describe('ssh_execute tool', () => {
    const sshExecute = tools.find(t => t.name === 'ssh_execute')!;

    it('should have correct structure', () => {
      expect(sshExecute.name).toBe('ssh_execute');
      expect(sshExecute.inputSchema.type).toBe('object');
      expect(sshExecute.inputSchema.properties).toBeDefined();
    });

    it('should have required parameters', () => {
      expect(sshExecute.inputSchema.required).toContain('host');
      expect(sshExecute.inputSchema.required).toContain('username');
      expect(sshExecute.inputSchema.required).toContain('privateKeyPath');
      expect(sshExecute.inputSchema.required).toContain('command');
    });

    it('should have optional parameters', () => {
      expect(sshExecute.inputSchema.properties.port).toBeDefined();
      expect(sshExecute.inputSchema.properties.timeout).toBeDefined();
      expect(sshExecute.inputSchema.required).not.toContain('port');
      expect(sshExecute.inputSchema.required).not.toContain('timeout');
    });

    it('should validate valid arguments', () => {
      const validArgs = {
        host: 'example.com',
        username: 'user',
        privateKeyPath: '/path/to/key',
        command: 'ls -la',
      };
      const result = SshExecuteArgsSchema.safeParse(validArgs);
      expect(result.success).toBe(true);
    });

    it('should reject missing required arguments', () => {
      const invalidArgs = {
        host: 'example.com',
      };
      const result = SshExecuteArgsSchema.safeParse(invalidArgs);
      expect(result.success).toBe(false);
    });

    it('should reject invalid port', () => {
      const invalidArgs = {
        host: 'example.com',
        username: 'user',
        privateKeyPath: '/path/to/key',
        command: 'ls',
        port: 70000,
      };
      const result = SshExecuteArgsSchema.safeParse(invalidArgs);
      expect(result.success).toBe(false);
    });
  });

  describe('ssh_session_create tool', () => {
    const sessionCreate = tools.find(t => t.name === 'ssh_session_create')!;

    it('should have correct structure', () => {
      expect(sessionCreate.name).toBe('ssh_session_create');
      expect(sessionCreate.inputSchema.type).toBe('object');
    });

    it('should have required parameters', () => {
      expect(sessionCreate.inputSchema.required).toContain('sessionId');
      expect(sessionCreate.inputSchema.required).toContain('host');
      expect(sessionCreate.inputSchema.required).toContain('username');
      expect(sessionCreate.inputSchema.required).toContain('privateKeyPath');
      expect(sessionCreate.inputSchema.required).toContain('type');
    });

    it('should validate valid arguments', () => {
      const validArgs = {
        sessionId: 'test-session',
        host: 'example.com',
        username: 'user',
        privateKeyPath: '/path/to/key',
        type: 'interactive' as const,
      };
      const result = SshSessionCreateArgsSchema.safeParse(validArgs);
      expect(result.success).toBe(true);
    });

    it('should validate type enum', () => {
      const invalidArgs = {
        sessionId: 'test-session',
        host: 'example.com',
        username: 'user',
        privateKeyPath: '/path/to/key',
        type: 'invalid',
      };
      const result = SshSessionCreateArgsSchema.safeParse(invalidArgs);
      expect(result.success).toBe(false);
    });

    it('should accept valid type values', () => {
      const interactiveArgs = {
        sessionId: 'test',
        host: 'example.com',
        username: 'user',
        privateKeyPath: '/path/to/key',
        type: 'interactive' as const,
      };
      expect(SshSessionCreateArgsSchema.safeParse(interactiveArgs).success).toBe(true);

      const backgroundArgs = {
        ...interactiveArgs,
        type: 'background' as const,
      };
      expect(SshSessionCreateArgsSchema.safeParse(backgroundArgs).success).toBe(true);
    });
  });

  describe('ssh_session_execute tool', () => {
    const sessionExecute = tools.find(t => t.name === 'ssh_session_execute')!;

    it('should have correct structure', () => {
      expect(sessionExecute.name).toBe('ssh_session_execute');
      expect(sessionExecute.inputSchema.type).toBe('object');
    });

    it('should have required parameters', () => {
      expect(sessionExecute.inputSchema.required).toContain('sessionId');
      expect(sessionExecute.inputSchema.required).toContain('command');
    });

    it('should validate valid arguments', () => {
      const validArgs = {
        sessionId: 'test-session',
        command: 'echo "hello"',
      };
      const result = SshSessionExecuteArgsSchema.safeParse(validArgs);
      expect(result.success).toBe(true);
    });
  });

  describe('ssh_session_list tool', () => {
    const sessionList = tools.find(t => t.name === 'ssh_session_list')!;

    it('should have correct structure', () => {
      expect(sessionList.name).toBe('ssh_session_list');
      expect(sessionList.inputSchema.type).toBe('object');
    });

    it('should accept empty arguments', () => {
      const result = SshSessionListArgsSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('ssh_session_close tool', () => {
    const sessionClose = tools.find(t => t.name === 'ssh_session_close')!;

    it('should have correct structure', () => {
      expect(sessionClose.name).toBe('ssh_session_close');
      expect(sessionClose.inputSchema.type).toBe('object');
    });

    it('should have required parameters', () => {
      expect(sessionClose.inputSchema.required).toContain('sessionId');
    });

    it('should validate valid arguments', () => {
      const validArgs = { sessionId: 'test-session' };
      const result = SshSessionCloseArgsSchema.safeParse(validArgs);
      expect(result.success).toBe(true);
    });
  });

  describe('ssh_session_output tool', () => {
    const sessionOutput = tools.find(t => t.name === 'ssh_session_output')!;

    it('should have correct structure', () => {
      expect(sessionOutput.name).toBe('ssh_session_output');
      expect(sessionOutput.inputSchema.type).toBe('object');
    });

    it('should have required parameters', () => {
      expect(sessionOutput.inputSchema.required).toContain('sessionId');
    });

    it('should have optional parameters', () => {
      expect(sessionOutput.inputSchema.properties.lines).toBeDefined();
      expect(sessionOutput.inputSchema.properties.clear).toBeDefined();
    });

    it('should validate valid arguments', () => {
      const validArgs = {
        sessionId: 'test-session',
        lines: 10,
        clear: true,
      };
      const result = SshSessionOutputArgsSchema.safeParse(validArgs);
      expect(result.success).toBe(true);
    });

    it('should reject invalid lines value', () => {
      const invalidArgs = {
        sessionId: 'test-session',
        lines: -5,
      };
      const result = SshSessionOutputArgsSchema.safeParse(invalidArgs);
      expect(result.success).toBe(false);
    });

    it('should reject lines value exceeding 50000', () => {
      const invalidArgs = {
        sessionId: 'test-session',
        lines: 50001,
      };
      const result = SshSessionOutputArgsSchema.safeParse(invalidArgs);
      expect(result.success).toBe(false);
    });

    it('should accept lines value at maximum of 50000', () => {
      const validArgs = {
        sessionId: 'test-session',
        lines: 50000,
      };
      const result = SshSessionOutputArgsSchema.safeParse(validArgs);
      expect(result.success).toBe(true);
    });
  });

  describe('Zod Schemas', () => {
    it('should export SshExecuteArgsSchema', () => {
      expect(SshExecuteArgsSchema).toBeDefined();
    });

    it('should export SshSessionCreateArgsSchema', () => {
      expect(SshSessionCreateArgsSchema).toBeDefined();
    });

    it('should export SshSessionExecuteArgsSchema', () => {
      expect(SshSessionExecuteArgsSchema).toBeDefined();
    });

    it('should export SshSessionListArgsSchema', () => {
      expect(SshSessionListArgsSchema).toBeDefined();
    });

    it('should export SshSessionCloseArgsSchema', () => {
      expect(SshSessionCloseArgsSchema).toBeDefined();
    });

    it('should export SshSessionOutputArgsSchema', () => {
      expect(SshSessionOutputArgsSchema).toBeDefined();
    });
  });
});
