import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServer, startServer, stopServer } from '../../src/mcp/server.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import pkg from '../../package.json' with { type: 'json' };

vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');

describe('MCP Server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createServer', () => {
    it('should instantiate Server with correct config', () => {
      createServer();

      expect(Server).toHaveBeenCalledWith(
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
    });

    it('should return a Server instance', () => {
      const server = createServer();
      expect(server).toBeInstanceOf(Server);
    });

    it('should use version from package.json', () => {
      createServer();

      expect(Server).toHaveBeenCalledWith(
        expect.objectContaining({
          version: pkg.version,
        }),
        expect.any(Object)
      );
    });
  });

  describe('startServer', () => {
    it('should create StdioServerTransport', async () => {
      const mockServer = {
        connect: vi.fn().mockResolvedValue(undefined),
      } as any;

      await startServer(mockServer);

      expect(StdioServerTransport).toHaveBeenCalled();
    });

    it('should connect server to transport', async () => {
      const mockServer = {
        connect: vi.fn().mockResolvedValue(undefined),
      } as any;
      const mockTransport = {};

      vi.mocked(StdioServerTransport).mockReturnValue(mockTransport as any);

      await startServer(mockServer);

      expect(mockServer.connect).toHaveBeenCalledWith(mockTransport);
    });

    it('should throw error when transport connection fails', async () => {
      const mockServer = {
        connect: vi.fn().mockRejectedValue(new Error('Connection failed')),
      } as any;

      await expect(startServer(mockServer)).rejects.toThrow('Failed to start MCP server');
    });

    it('should propagate underlying error as cause', async () => {
      const underlyingError = new Error('Transport unavailable');
      const mockServer = {
        connect: vi.fn().mockRejectedValue(underlyingError),
      } as any;

      try {
        await startServer(mockServer);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).cause).toBe(underlyingError);
      }
    });

    it('should return void on successful connection', async () => {
      const mockServer = {
        connect: vi.fn().mockResolvedValue(undefined),
      } as any;

      const result = await startServer(mockServer);

      expect(result).toBeUndefined();
    });
  });

  describe('Integration', () => {
    it('should support complete startup flow', async () => {
      const mockServer = {
        connect: vi.fn().mockResolvedValue(undefined),
      } as any;
      const mockTransport = {};

      vi.mocked(Server).mockReturnValue(mockServer as any);
      vi.mocked(StdioServerTransport).mockReturnValue(mockTransport as any);

      const server = createServer();
      await startServer(server);

      expect(Server).toHaveBeenCalledTimes(1);
      expect(StdioServerTransport).toHaveBeenCalledTimes(1);
      expect(mockServer.connect).toHaveBeenCalledWith(mockTransport);
    });
  });

  describe('stopServer', () => {
    it('should throw error for null server', async () => {
      await expect(stopServer(null as any)).rejects.toThrow('Null or undefined arguments');
    });

    it('should throw error for undefined server', async () => {
      await expect(stopServer(undefined as any)).rejects.toThrow('Null or undefined arguments');
    });

    it('should call server.close()', async () => {
      const mockServer = {
        close: vi.fn().mockResolvedValue(undefined),
      } as any;

      await stopServer(mockServer);

      expect(mockServer.close).toHaveBeenCalledTimes(1);
    });

    it('should return void on successful close', async () => {
      const mockServer = {
        close: vi.fn().mockResolvedValue(undefined),
      } as any;

      const result = await stopServer(mockServer);

      expect(result).toBeUndefined();
    });

    it('should throw error when server.close() fails', async () => {
      const mockServer = {
        close: vi.fn().mockRejectedValue(new Error('Close failed')),
      } as any;

      await expect(stopServer(mockServer)).rejects.toThrow('Failed to stop MCP server');
    });

    it('should propagate underlying error as cause', async () => {
      const underlyingError = new Error('Transport close error');
      const mockServer = {
        close: vi.fn().mockRejectedValue(underlyingError),
      } as any;

      try {
        await stopServer(mockServer);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).cause).toBe(underlyingError);
      }
    });
  });

  describe('Lifecycle', () => {
    it('should support start and stop cycle', async () => {
      const mockServer = {
        connect: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      } as any;

      vi.mocked(Server).mockReturnValue(mockServer as any);

      const server = createServer();
      await startServer(server);
      await stopServer(server);

      expect(mockServer.connect).toHaveBeenCalledTimes(1);
      expect(mockServer.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('Signal Handling', () => {
    let processListeners: Map<string, Function>;
    let originalOn: any;
    let originalExit: any;

    beforeEach(() => {
      processListeners = new Map();
      originalOn = process.on;
      originalExit = process.exit;

      process.on = vi.fn((event: string, handler: Function) => {
        processListeners.set(event, handler);
        return process;
      }) as any;

      process.exit = vi.fn() as any;
    });

    afterEach(() => {
      process.on = originalOn;
      process.exit = originalExit;
      processListeners.clear();
    });

    it('should register SIGTERM handler when registerSignalHandlers is true', async () => {
      const mockServer = {
        connect: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      } as any;

      await startServer(mockServer, { registerSignalHandlers: true });

      expect(processListeners.has('SIGTERM')).toBe(true);
    });

    it('should register SIGINT handler when registerSignalHandlers is true', async () => {
      const mockServer = {
        connect: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      } as any;

      await startServer(mockServer, { registerSignalHandlers: true });

      expect(processListeners.has('SIGINT')).toBe(true);
    });

    it('should not register handlers when registerSignalHandlers is false', async () => {
      const mockServer = {
        connect: vi.fn().mockResolvedValue(undefined),
      } as any;

      await startServer(mockServer, { registerSignalHandlers: false });

      expect(processListeners.size).toBe(0);
    });

    it('should not register handlers by default', async () => {
      const mockServer = {
        connect: vi.fn().mockResolvedValue(undefined),
      } as any;

      await startServer(mockServer);

      expect(processListeners.size).toBe(0);
    });

    it('should call stopServer and exit on SIGTERM', async () => {
      const mockServer = {
        connect: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      } as any;

      await startServer(mockServer, { registerSignalHandlers: true });

      const sigtermHandler = processListeners.get('SIGTERM');
      expect(sigtermHandler).toBeDefined();

      await sigtermHandler!();

      expect(mockServer.close).toHaveBeenCalledTimes(1);
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should call stopServer and exit on SIGINT', async () => {
      const mockServer = {
        connect: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      } as any;

      await startServer(mockServer, { registerSignalHandlers: true });

      const sigintHandler = processListeners.get('SIGINT');
      expect(sigintHandler).toBeDefined();

      await sigintHandler!();

      expect(mockServer.close).toHaveBeenCalledTimes(1);
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should exit with code 1 if shutdown fails', async () => {
      const mockServer = {
        connect: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockRejectedValue(new Error('Shutdown failed')),
      } as any;

      await startServer(mockServer, { registerSignalHandlers: true });

      const sigtermHandler = processListeners.get('SIGTERM');
      await sigtermHandler!();

      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('Exported Functions', () => {
    it('should export createServer function', () => {
      expect(createServer).toBeDefined();
      expect(typeof createServer).toBe('function');
    });

    it('should export startServer function', () => {
      expect(startServer).toBeDefined();
      expect(typeof startServer).toBe('function');
    });

    it('should export stopServer function', () => {
      expect(stopServer).toBeDefined();
      expect(typeof stopServer).toBe('function');
    });
  });
});
