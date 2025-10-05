import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { registerToolHandlers } from '../src/mcp/handlers.js';
import { SSHConnectionManager } from '../src/ssh/manager.js';
import { CommandResult, SessionMetadata } from '../src/ssh/types.js';
import pkg from '../package.json' with { type: 'json' };

vi.mock('../src/ssh/manager.js');

describe('MCP Integration Tests', () => {
  let server: Server;
  let mockManager: any;
  let listToolsHandler: any;
  let callToolHandler: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create real MCP server instance
    server = new Server(
      {
        name: 'ssh-control-mcp',
        version: pkg.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Create mock SSH manager
    mockManager = {
      executeCommand: vi.fn(),
      createSession: vi.fn(),
      executeInSession: vi.fn(),
      listSessions: vi.fn(),
      closeSession: vi.fn(),
      getSessionOutput: vi.fn(),
    };

    // Spy on setRequestHandler to capture the handlers
    const originalSetRequestHandler = server.setRequestHandler.bind(server);
    vi.spyOn(server, 'setRequestHandler').mockImplementation((schema: any, handler: any) => {
      const method = schema.shape?.method?._def?.value;

      if (method === 'tools/list') {
        listToolsHandler = handler;
      } else if (method === 'tools/call') {
        callToolHandler = handler;
      }

      return originalSetRequestHandler(schema, handler);
    });

    // Register handlers with real server
    registerToolHandlers(server, mockManager);
  });

  describe('End-to-End Request/Response Flow', () => {
    describe('tools/list', () => {
      it('should return all 6 tools with proper MCP structure', async () => {
        const request = {};
        const response = await listToolsHandler(request);

        expect(response).toHaveProperty('tools');
        expect(response.tools).toHaveLength(6);

        // Verify each tool has proper MCP structure
        response.tools.forEach((tool: any) => {
          expect(tool).toHaveProperty('name');
          expect(tool).toHaveProperty('description');
          expect(tool).toHaveProperty('inputSchema');
          expect(tool.inputSchema).toHaveProperty('type', 'object');
          expect(tool.inputSchema).toHaveProperty('properties');
          // Note: 'required' may be empty array for tools with no required params (like ssh_session_list)
          if (tool.inputSchema.required && tool.inputSchema.required.length > 0) {
            expect(Array.isArray(tool.inputSchema.required)).toBe(true);
          }
        });
      });

      it('should include all expected tool names', async () => {
        const response = await listToolsHandler({});
        const toolNames = response.tools.map((t: any) => t.name);

        expect(toolNames).toEqual([
          'ssh_execute',
          'ssh_session_create',
          'ssh_session_execute',
          'ssh_session_list',
          'ssh_session_close',
          'ssh_session_output',
        ]);
      });
    });

    describe('ssh_execute', () => {
      it('should execute command and return formatted MCP response', async () => {
        const mockResult: CommandResult = {
          stdout: 'total 64\ndrwxr-xr-x 2 user user 4096',
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
              username: 'testuser',
              privateKeyPath: '/home/user/.ssh/id_rsa',
              command: 'ls -la',
            },
          },
        };

        const response = await callToolHandler(request);

        expect(response).toHaveProperty('content');
        expect(response.content).toHaveLength(1);
        expect(response.content[0]).toHaveProperty('type', 'text');
        expect(response.content[0]).toHaveProperty('text');

        const result = JSON.parse(response.content[0].text);
        expect(result).toEqual(mockResult);
        expect(result.stdout).toBe('total 64\ndrwxr-xr-x 2 user user 4096');
        expect(result.code).toBe(0);
      });

      it('should handle command with optional parameters', async () => {
        const mockResult: CommandResult = {
          stdout: 'success',
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
              username: 'testuser',
              privateKeyPath: '/home/user/.ssh/id_rsa',
              command: 'echo test',
              port: 2222,
              timeout: 60000,
            },
          },
        };

        await callToolHandler(request);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          'example.com',
          'testuser',
          '/home/user/.ssh/id_rsa',
          'echo test',
          2222,
          60000
        );
      });

      it('should return non-zero exit codes correctly', async () => {
        const mockResult: CommandResult = {
          stdout: '',
          stderr: 'command not found',
          code: 127,
          signal: null,
        };
        mockManager.executeCommand.mockResolvedValue(mockResult);

        const request = {
          params: {
            name: 'ssh_execute',
            arguments: {
              host: 'example.com',
              username: 'testuser',
              privateKeyPath: '/home/user/.ssh/id_rsa',
              command: 'nonexistent',
            },
          },
        };

        const response = await callToolHandler(request);
        const result = JSON.parse(response.content[0].text);

        expect(result.code).toBe(127);
        expect(result.stderr).toBe('command not found');
      });
    });

    describe('ssh_session_create', () => {
      it('should create session and return session info', async () => {
        const mockSessionInfo = {
          sessionId: 'test-session-1',
          target: 'example.com',
          username: 'testuser',
          type: 'interactive' as const,
          mode: 'normal' as const,
          port: 22,
          isActive: true,
          createdAt: new Date('2024-01-01T00:00:00Z'),
        };

        const mockSession = {
          getSessionInfo: vi.fn().mockReturnValue(mockSessionInfo),
        };
        mockManager.createSession.mockResolvedValue(mockSession);

        const request = {
          params: {
            name: 'ssh_session_create',
            arguments: {
              sessionId: 'test-session-1',
              host: 'example.com',
              username: 'testuser',
              privateKeyPath: '/home/user/.ssh/id_rsa',
              type: 'interactive',
            },
          },
        };

        const response = await callToolHandler(request);
        const result = JSON.parse(response.content[0].text);

        expect(result.sessionId).toBe('test-session-1');
        expect(result.type).toBe('interactive');
        expect(result.isActive).toBe(true);
      });

      it('should create background session with raw mode', async () => {
        const mockSessionInfo = {
          sessionId: 'bg-session',
          target: 'example.com',
          username: 'testuser',
          type: 'background' as const,
          mode: 'raw' as const,
          port: 22,
          isActive: true,
          createdAt: new Date(),
        };

        const mockSession = {
          getSessionInfo: vi.fn().mockReturnValue(mockSessionInfo),
        };
        mockManager.createSession.mockResolvedValue(mockSession);

        const request = {
          params: {
            name: 'ssh_session_create',
            arguments: {
              sessionId: 'bg-session',
              host: 'example.com',
              username: 'testuser',
              privateKeyPath: '/home/user/.ssh/id_rsa',
              type: 'background',
              mode: 'raw',
            },
          },
        };

        await callToolHandler(request);

        expect(mockManager.createSession).toHaveBeenCalledWith(
          'bg-session',
          'example.com',
          'testuser',
          'background',
          '/home/user/.ssh/id_rsa',
          22,
          'raw',
          undefined,
          'bash'
        );
      });
    });

    describe('ssh_session_execute', () => {
      it('should execute command in session and return result', async () => {
        const mockResult: CommandResult = {
          stdout: '/home/testuser',
          stderr: '',
          code: 0,
          signal: null,
        };
        mockManager.executeInSession.mockResolvedValue(mockResult);

        const request = {
          params: {
            name: 'ssh_session_execute',
            arguments: {
              sessionId: 'test-session-1',
              command: 'pwd',
            },
          },
        };

        const response = await callToolHandler(request);
        const result = JSON.parse(response.content[0].text);

        expect(result.stdout).toBe('/home/testuser');
        expect(result.code).toBe(0);
        expect(mockManager.executeInSession).toHaveBeenCalledWith(
          'test-session-1',
          'pwd',
          30000
        );
      });

      it('should respect custom timeout', async () => {
        const mockResult: CommandResult = {
          stdout: 'done',
          stderr: '',
          code: 0,
          signal: null,
        };
        mockManager.executeInSession.mockResolvedValue(mockResult);

        const request = {
          params: {
            name: 'ssh_session_execute',
            arguments: {
              sessionId: 'test-session-1',
              command: 'sleep 5',
              timeout: 10000,
            },
          },
        };

        await callToolHandler(request);

        expect(mockManager.executeInSession).toHaveBeenCalledWith(
          'test-session-1',
          'sleep 5',
          10000
        );
      });
    });

    describe('ssh_session_list', () => {
      it('should return empty array when no sessions exist', async () => {
        mockManager.listSessions.mockReturnValue([]);

        const request = {
          params: {
            name: 'ssh_session_list',
            arguments: {},
          },
        };

        const response = await callToolHandler(request);
        const result = JSON.parse(response.content[0].text);

        expect(result).toEqual([]);
      });

      it('should return all active sessions', async () => {
        const mockSessions: SessionMetadata[] = [
          {
            sessionId: 'session-1',
            target: 'host1.com',
            username: 'user1',
            type: 'interactive',
            mode: 'normal',
            port: 22,
            isActive: true,
            createdAt: new Date('2024-01-01'),
            lastActivity: new Date('2024-01-01'),
            workingDirectory: '/home/user1',
            environmentVars: new Map(),
            commandHistory: ['ls', 'pwd'],
          },
          {
            sessionId: 'session-2',
            target: 'host2.com',
            username: 'user2',
            type: 'background',
            mode: 'raw',
            port: 2222,
            isActive: true,
            createdAt: new Date('2024-01-02'),
            lastActivity: new Date('2024-01-02'),
            workingDirectory: '/tmp',
            environmentVars: new Map(),
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

        const response = await callToolHandler(request);
        const result = JSON.parse(response.content[0].text);

        expect(result).toHaveLength(2);
        expect(result[0].sessionId).toBe('session-1');
        expect(result[1].sessionId).toBe('session-2');
      });
    });

    describe('ssh_session_close', () => {
      it('should close session and return success', async () => {
        mockManager.closeSession.mockResolvedValue(true);

        const request = {
          params: {
            name: 'ssh_session_close',
            arguments: {
              sessionId: 'test-session-1',
            },
          },
        };

        const response = await callToolHandler(request);
        const result = JSON.parse(response.content[0].text);

        expect(result.success).toBe(true);
        expect(mockManager.closeSession).toHaveBeenCalledWith('test-session-1');
      });

      it('should return false when session does not exist', async () => {
        mockManager.closeSession.mockResolvedValue(false);

        const request = {
          params: {
            name: 'ssh_session_close',
            arguments: {
              sessionId: 'nonexistent',
            },
          },
        };

        const response = await callToolHandler(request);
        const result = JSON.parse(response.content[0].text);

        expect(result.success).toBe(false);
      });
    });

    describe('ssh_session_output', () => {
      it('should return buffered output from background session', async () => {
        const mockOutput = [
          'line 1',
          'line 2',
          'line 3',
        ];
        mockManager.getSessionOutput.mockReturnValue(mockOutput);

        const request = {
          params: {
            name: 'ssh_session_output',
            arguments: {
              sessionId: 'bg-session',
            },
          },
        };

        const response = await callToolHandler(request);
        const result = JSON.parse(response.content[0].text);

        expect(result.output).toEqual(mockOutput);
        expect(mockManager.getSessionOutput).toHaveBeenCalledWith(
          'bg-session',
          undefined,
          false  // clear defaults to false when not specified
        );
      });

      it('should limit output lines when specified', async () => {
        const mockOutput = ['line 1', 'line 2'];
        mockManager.getSessionOutput.mockReturnValue(mockOutput);

        const request = {
          params: {
            name: 'ssh_session_output',
            arguments: {
              sessionId: 'bg-session',
              lines: 10,
              clear: true,
            },
          },
        };

        await callToolHandler(request);

        expect(mockManager.getSessionOutput).toHaveBeenCalledWith(
          'bg-session',
          10,
          true
        );
      });
    });
  });

  describe('Error Handling', () => {
    describe('Invalid Tool Names', () => {
      it('should throw error for unknown tool', async () => {
        const request = {
          params: {
            name: 'unknown_tool',
            arguments: {},
          },
        };

        await expect(callToolHandler(request)).rejects.toThrow('Unknown tool: unknown_tool');
      });

      it('should throw error for empty tool name', async () => {
        const request = {
          params: {
            name: '',
            arguments: {},
          },
        };

        await expect(callToolHandler(request)).rejects.toThrow();
      });
    });

    describe('Validation Errors', () => {
      it('should reject ssh_execute with missing required parameters', async () => {
        const request = {
          params: {
            name: 'ssh_execute',
            arguments: {
              host: 'example.com',
              // Missing username, privateKeyPath, command
            },
          },
        };

        await expect(callToolHandler(request)).rejects.toThrow();
      });

      it('should reject invalid port number', async () => {
        const request = {
          params: {
            name: 'ssh_execute',
            arguments: {
              host: 'example.com',
              username: 'user',
              privateKeyPath: '/path/to/key',
              command: 'ls',
              port: 70000, // Invalid port
            },
          },
        };

        await expect(callToolHandler(request)).rejects.toThrow();
      });

      it('should reject invalid session type', async () => {
        const request = {
          params: {
            name: 'ssh_session_create',
            arguments: {
              sessionId: 'test',
              host: 'example.com',
              username: 'user',
              privateKeyPath: '/path/to/key',
              type: 'invalid_type',
            },
          },
        };

        await expect(callToolHandler(request)).rejects.toThrow();
      });

      it('should reject negative timeout values', async () => {
        const request = {
          params: {
            name: 'ssh_execute',
            arguments: {
              host: 'example.com',
              username: 'user',
              privateKeyPath: '/path/to/key',
              command: 'ls',
              timeout: -1000,
            },
          },
        };

        await expect(callToolHandler(request)).rejects.toThrow();
      });

      it('should reject invalid lines parameter in session output', async () => {
        const request = {
          params: {
            name: 'ssh_session_output',
            arguments: {
              sessionId: 'test',
              lines: -5,
            },
          },
        };

        await expect(callToolHandler(request)).rejects.toThrow();
      });

      it('should reject lines exceeding maximum', async () => {
        const request = {
          params: {
            name: 'ssh_session_output',
            arguments: {
              sessionId: 'test',
              lines: 50001,
            },
          },
        };

        await expect(callToolHandler(request)).rejects.toThrow();
      });
    });

    describe('SSH Operation Errors', () => {
      it('should propagate SSH connection errors', async () => {
        const sshError = new Error('Connection refused');
        mockManager.executeCommand.mockRejectedValue(sshError);

        const request = {
          params: {
            name: 'ssh_execute',
            arguments: {
              host: 'unreachable.com',
              username: 'user',
              privateKeyPath: '/path/to/key',
              command: 'ls',
            },
          },
        };

        await expect(callToolHandler(request)).rejects.toThrow('Connection refused');
      });

      it('should propagate session creation errors', async () => {
        const authError = new Error('Authentication failed');
        mockManager.createSession.mockRejectedValue(authError);

        const request = {
          params: {
            name: 'ssh_session_create',
            arguments: {
              sessionId: 'test',
              host: 'example.com',
              username: 'wronguser',
              privateKeyPath: '/wrong/key',
              type: 'interactive',
            },
          },
        };

        await expect(callToolHandler(request)).rejects.toThrow('Authentication failed');
      });

      it('should propagate command execution errors in sessions', async () => {
        const timeoutError = new Error('Command timeout');
        mockManager.executeInSession.mockRejectedValue(timeoutError);

        const request = {
          params: {
            name: 'ssh_session_execute',
            arguments: {
              sessionId: 'test',
              command: 'sleep 1000',
            },
          },
        };

        await expect(callToolHandler(request)).rejects.toThrow('Command timeout');
      });

      it('should propagate session not found errors', async () => {
        const notFoundError = new Error('Session not found: missing-session');
        mockManager.executeInSession.mockRejectedValue(notFoundError);

        const request = {
          params: {
            name: 'ssh_session_execute',
            arguments: {
              sessionId: 'missing-session',
              command: 'ls',
            },
          },
        };

        await expect(callToolHandler(request)).rejects.toThrow('Session not found: missing-session');
      });

      it('should propagate output retrieval errors', async () => {
        const error = new Error('Session not found: missing');
        mockManager.getSessionOutput.mockImplementation(() => {
          throw error;
        });

        const request = {
          params: {
            name: 'ssh_session_output',
            arguments: {
              sessionId: 'missing',
            },
          },
        };

        await expect(callToolHandler(request)).rejects.toThrow('Session not found: missing');
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty command output', async () => {
        const mockResult: CommandResult = {
          stdout: '',
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
              command: 'true',
            },
          },
        };

        const response = await callToolHandler(request);
        const result = JSON.parse(response.content[0].text);

        expect(result.stdout).toBe('');
        expect(result.code).toBe(0);
      });

      it('should handle very long command output', async () => {
        const longOutput = 'x'.repeat(100000);
        const mockResult: CommandResult = {
          stdout: longOutput,
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
              command: 'cat large_file',
            },
          },
        };

        const response = await callToolHandler(request);
        const result = JSON.parse(response.content[0].text);

        expect(result.stdout).toBe(longOutput);
        expect(result.stdout.length).toBe(100000);
      });

      it('should handle special characters in session IDs', async () => {
        mockManager.closeSession.mockResolvedValue(true);

        const request = {
          params: {
            name: 'ssh_session_close',
            arguments: {
              sessionId: 'session-with-special-chars_123.test',
            },
          },
        };

        const response = await callToolHandler(request);
        const result = JSON.parse(response.content[0].text);

        expect(result.success).toBe(true);
        expect(mockManager.closeSession).toHaveBeenCalledWith('session-with-special-chars_123.test');
      });

      it('should handle null values in optional parameters', async () => {
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
              command: 'ls',
              port: undefined,
              timeout: undefined,
            },
          },
        };

        const response = await callToolHandler(request);
        expect(response.content).toHaveLength(1);
      });
    });
  });

  describe('Response Format Validation', () => {
    it('should always return content array with text type', async () => {
      const mockResult: CommandResult = {
        stdout: 'test',
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

      const response = await callToolHandler(request);

      expect(response).toHaveProperty('content');
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content[0]).toHaveProperty('type', 'text');
      expect(response.content[0]).toHaveProperty('text');
      expect(typeof response.content[0].text).toBe('string');
    });

    it('should return valid JSON in response text', async () => {
      mockManager.listSessions.mockReturnValue([]);

      const request = {
        params: {
          name: 'ssh_session_list',
          arguments: {},
          },
        };

      const response = await callToolHandler(request);

      expect(() => JSON.parse(response.content[0].text)).not.toThrow();
    });

    it('should serialize Date objects correctly in session info', async () => {
      const testDate = new Date('2024-01-01T12:00:00Z');
      const mockSessionInfo = {
        sessionId: 'test',
        target: 'example.com',
        username: 'user',
        type: 'interactive' as const,
        mode: 'normal' as const,
        port: 22,
        isActive: true,
        createdAt: testDate,
      };

      const mockSession = {
        getSessionInfo: vi.fn().mockReturnValue(mockSessionInfo),
      };
      mockManager.createSession.mockResolvedValue(mockSession);

      const request = {
        params: {
          name: 'ssh_session_create',
          arguments: {
            sessionId: 'test',
            host: 'example.com',
            username: 'user',
            privateKeyPath: '/path/to/key',
            type: 'interactive',
          },
        },
      };

      const response = await callToolHandler(request);
      const result = JSON.parse(response.content[0].text);

      expect(typeof result.createdAt).toBe('string');
      expect(new Date(result.createdAt).toISOString()).toBe(testDate.toISOString());
    });
  });
});
