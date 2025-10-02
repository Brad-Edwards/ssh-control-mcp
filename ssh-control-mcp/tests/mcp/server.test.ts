import { describe, it, expect, vi } from 'vitest';
import { createServer, startServer } from '../../src/mcp/server.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');

describe('MCP Server', () => {
  describe('createServer', () => {
    it('should instantiate Server with correct config', () => {
      createServer();

      expect(Server).toHaveBeenCalledWith(
        {
          name: 'ssh-control-mcp',
          version: '1.0.0',
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
  });
});
