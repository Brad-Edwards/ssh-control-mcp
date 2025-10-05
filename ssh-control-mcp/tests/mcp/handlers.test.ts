import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSHConnectionManager } from '../../src/ssh/manager.js';
import { registerToolHandlers } from '../../src/mcp/handlers.js';
import { CommandResult, SessionMetadata } from '../../src/ssh/types.js';

vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('../../src/ssh/manager.js');

describe('MCP Handlers', () => {
  let mockServer: any;
  let mockManager: any;
  let listToolsHandler: any;
  let callToolHandler: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock server with handler registration tracking
    mockServer = {
      setRequestHandler: vi.fn((schema, handler) => {
        if (schema.shape?.method?._def?.value === 'tools/list') {
          listToolsHandler = handler;
        } else if (schema.shape?.method?._def?.value === 'tools/call') {
          callToolHandler = handler;
        }
      }),
    };

    // Create mock SSH manager
    mockManager = {
      executeCommand: vi.fn(),
      createSession: vi.fn(),
      executeInSession: vi.fn(),
      listSessions: vi.fn(),
      closeSession: vi.fn(),
      getSessionOutput: vi.fn(),
    };

    registerToolHandlers(mockServer, mockManager);
  });

  describe('registerToolHandlers', () => {
    it('should register tools/list handler', () => {
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Function)
      );
      expect(listToolsHandler).toBeDefined();
    });

    it('should register tools/call handler', () => {
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Function)
      );
      expect(callToolHandler).toBeDefined();
    });
  });

  describe('tools/list handler', () => {
    it('should return all 6 tools', async () => {
      const result = await listToolsHandler({});

      expect(result.tools).toHaveLength(6);
    });

    it('should return tools with correct structure', async () => {
      const result = await listToolsHandler({});

      result.tools.forEach((tool: any) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.inputSchema).toHaveProperty('type', 'object');
        expect(tool.inputSchema).toHaveProperty('properties');
      });
    });

    it('should include all required tools', async () => {
      const result = await listToolsHandler({});
      const toolNames = result.tools.map((t: any) => t.name);

      expect(toolNames).toContain('ssh_execute');
      expect(toolNames).toContain('ssh_session_create');
      expect(toolNames).toContain('ssh_session_execute');
      expect(toolNames).toContain('ssh_session_list');
      expect(toolNames).toContain('ssh_session_close');
      expect(toolNames).toContain('ssh_session_output');
    });
  });

  describe('tools/call handler - ssh_execute', () => {
    it('should call manager.executeCommand with correct parameters', async () => {
      const mockResult: CommandResult = {
        stdout: 'output',
        stderr: '',
        code: 0,
        signal: null,
      };
      mockManager.executeCommand.mockResolvedValue(mockResult);

      const request = {
        params: {
          name: 'ssh_execute',
          arguments: {
            host: 'example.com',
            username: 'user',
            privateKeyPath: '/path/to/key',
            command: 'ls -la',
          },
        },
      };

      await callToolHandler(request);

      expect(mockManager.executeCommand).toHaveBeenCalledWith(
        'example.com',
        'user',
        '/path/to/key',
        'ls -la',
        22, // default port
        30000 // default timeout
      );
    });

    it('should return command result as JSON', async () => {
      const mockResult: CommandResult = {
        stdout: 'test output',
        stderr: '',
        code: 0,
        signal: null,
      };
      mockManager.executeCommand.mockResolvedValue(mockResult);

      const request = {
        params: {
          name: 'ssh_execute',
          arguments: {
            host: 'example.com',
            username: 'user',
            privateKeyPath: '/path/to/key',
            command: 'echo test',
          },
        },
      };

      const result = await callToolHandler(request);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      const parsedContent = JSON.parse(result.content[0].text);
      expect(parsedContent).toEqual(mockResult);
    });
  });

  describe('tools/call handler - ssh_session_create', () => {
    it('should call manager.createSession with correct parameters', async () => {
      const mockSession = {
        getSessionInfo: vi.fn().mockReturnValue({
          sessionId: 'test-session',
          target: 'example.com',
          username: 'user',
          type: 'interactive',
          mode: 'normal',
          port: 22,
          isActive: true,
          createdAt: new Date(),
        }),
      };
      mockManager.createSession.mockResolvedValue(mockSession);

      const request = {
        params: {
          name: 'ssh_session_create',
          arguments: {
            sessionId: 'test-session',
            host: 'example.com',
            username: 'user',
            privateKeyPath: '/path/to/key',
            type: 'interactive',
          },
        },
      };

      await callToolHandler(request);

      expect(mockManager.createSession).toHaveBeenCalledWith(
        'test-session',
        'example.com',
        'user',
        'interactive',
        '/path/to/key',
        22,
        'normal',
        undefined,
        'bash'
      );
    });

    it('should return session info as JSON', async () => {
      const mockSessionInfo = {
        sessionId: 'test-session',
        target: 'example.com',
        username: 'user',
        type: 'interactive' as const,
        mode: 'normal' as const,
        port: 22,
        isActive: true,
        createdAt: new Date('2024-01-01'),
      };

      const mockSession = {
        getSessionInfo: vi.fn().mockReturnValue(mockSessionInfo),
      };
      mockManager.createSession.mockResolvedValue(mockSession);

      const request = {
        params: {
          name: 'ssh_session_create',
          arguments: {
            sessionId: 'test-session',
            host: 'example.com',
            username: 'user',
            privateKeyPath: '/path/to/key',
            type: 'interactive',
          },
        },
      };

      const result = await callToolHandler(request);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      const parsedContent = JSON.parse(result.content[0].text);
      expect(parsedContent.sessionId).toBe('test-session');
    });
  });

  describe('tools/call handler - ssh_session_execute', () => {
    it('should call manager.executeInSession with correct parameters', async () => {
      const mockResult: CommandResult = {
        stdout: 'output',
        stderr: '',
        code: 0,
        signal: null,
      };
      mockManager.executeInSession.mockResolvedValue(mockResult);

      const request = {
        params: {
          name: 'ssh_session_execute',
          arguments: {
            sessionId: 'test-session',
            command: 'pwd',
          },
        },
      };

      await callToolHandler(request);

      expect(mockManager.executeInSession).toHaveBeenCalledWith(
        'test-session',
        'pwd',
        30000
      );
    });
  });

  describe('tools/call handler - ssh_session_list', () => {
    it('should call manager.listSessions', async () => {
      const mockSessions: SessionMetadata[] = [
        {
          sessionId: 'session-1',
          target: 'host1.com',
          username: 'user1',
          type: 'interactive',
          mode: 'normal',
          createdAt: new Date(),
          lastActivity: new Date(),
          port: 22,
          workingDirectory: '~',
          environmentVars: new Map(),
          isActive: true,
          commandHistory: [],
        },
      ];
      mockManager.listSessions.mockReturnValue(mockSessions);

      const request = {
        params: {
          name: 'ssh_session_list',
          arguments: {},
        },
      };

      const result = await callToolHandler(request);

      expect(mockManager.listSessions).toHaveBeenCalled();
      expect(result.content).toHaveLength(1);
      const parsedContent = JSON.parse(result.content[0].text);
      expect(parsedContent).toHaveLength(1);
      expect(parsedContent[0].sessionId).toBe('session-1');
    });
  });

  describe('tools/call handler - ssh_session_close', () => {
    it('should call manager.closeSession with correct sessionId', async () => {
      mockManager.closeSession.mockResolvedValue(true);

      const request = {
        params: {
          name: 'ssh_session_close',
          arguments: {
            sessionId: 'test-session',
          },
        },
      };

      await callToolHandler(request);

      expect(mockManager.closeSession).toHaveBeenCalledWith('test-session');
    });

    it('should return success status', async () => {
      mockManager.closeSession.mockResolvedValue(true);

      const request = {
        params: {
          name: 'ssh_session_close',
          arguments: {
            sessionId: 'test-session',
          },
        },
      };

      const result = await callToolHandler(request);
      const parsedContent = JSON.parse(result.content[0].text);
      expect(parsedContent.success).toBe(true);
    });
  });

  describe('tools/call handler - ssh_session_output', () => {
    it('should call manager.getSessionOutput with correct parameters', async () => {
      mockManager.getSessionOutput.mockReturnValue(['line1', 'line2']);

      const request = {
        params: {
          name: 'ssh_session_output',
          arguments: {
            sessionId: 'test-session',
            lines: 10,
            clear: true,
          },
        },
      };

      await callToolHandler(request);

      expect(mockManager.getSessionOutput).toHaveBeenCalledWith(
        'test-session',
        10,
        true
      );
    });

    it('should return output as JSON array', async () => {
      const mockOutput = ['line1', 'line2', 'line3'];
      mockManager.getSessionOutput.mockReturnValue(mockOutput);

      const request = {
        params: {
          name: 'ssh_session_output',
          arguments: {
            sessionId: 'test-session',
          },
        },
      };

      const result = await callToolHandler(request);
      const parsedContent = JSON.parse(result.content[0].text);
      expect(parsedContent.output).toEqual(mockOutput);
    });
  });

  describe('tools/call handler - error cases', () => {
    it('should throw error for unknown tool', async () => {
      const request = {
        params: {
          name: 'unknown_tool',
          arguments: {},
        },
      };

      await expect(callToolHandler(request)).rejects.toThrow('Unknown tool: unknown_tool');
    });

    it('should throw validation error for invalid arguments', async () => {
      const request = {
        params: {
          name: 'ssh_execute',
          arguments: {
            // Missing required fields
            host: 'example.com',
          },
        },
      };

      await expect(callToolHandler(request)).rejects.toThrow();
    });
  });
});
