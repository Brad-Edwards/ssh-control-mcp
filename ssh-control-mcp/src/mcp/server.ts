import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

/**
 * Create and configure the MCP server instance
 */
export function createServer(): Server {
  const server = new Server(
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

  // Tool registration framework placeholder
  // Tools will be registered in subsequent issues

  return server;
}

/**
 * Start the MCP server with stdio transport
 */
export async function startServer(server: Server): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
