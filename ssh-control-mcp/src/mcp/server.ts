import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { NULL_OR_UNDEFINED_ARGUMENTS_ERROR, FAILED_TO_START_MCP_SERVER_ERROR } from '../constants.js';
import pkg from '../../package.json' with { type: 'json' };

/**
 * Create and configure the MCP server instance
 *
 * @returns A configured MCP server instance ready to be started
 *
 * @example
 * ```typescript
 * const server = createServer();
 * await startServer(server);
 * ```
 */
export function createServer(): Server {
  const server = new Server(
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

  // Tool registration framework placeholder
  // Tools will be registered in subsequent issues

  return server;
}

/**
 * Options for starting the MCP server
 */
export interface StartServerOptions {
  /**
   * Whether to register signal handlers for graceful shutdown
   * When true, SIGTERM and SIGINT will trigger graceful shutdown
   * @default false
   */
  registerSignalHandlers?: boolean;
}

/**
 * Start the MCP server with stdio transport
 *
 * @param server - The MCP server instance to start
 * @param options - Optional configuration for server startup
 * @returns A promise that resolves when the server is connected
 * @throws {Error} Throws an error if the transport connection fails
 *
 * @example
 * ```typescript
 * const server = createServer();
 * await startServer(server);
 * ```
 *
 * @example
 * ```typescript
 * const server = createServer();
 * await startServer(server, { registerSignalHandlers: true });
 * ```
 */
export async function startServer(server: Server, options?: StartServerOptions): Promise<void> {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);

    if (options?.registerSignalHandlers) {
      setupSignalHandlers(server);
    }
  } catch (error) {
    throw new Error(FAILED_TO_START_MCP_SERVER_ERROR, { cause: error });  
  }
}

/**
 * Set up signal handlers for graceful shutdown
 *
 * @param server - The MCP server instance to manage
 */
function setupSignalHandlers(server: Server): void {
  const handleShutdown = async (signal: string) => {
    try {
      await stopServer(server);
      process.exit(0);
    } catch (error) {
      console.error(`Error during ${signal} shutdown:`, error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

/**
 * Stop the MCP server and cleanly close the transport connection
 *
 * @param server - The MCP server instance to stop
 * @returns A promise that resolves when the server is stopped
 * @throws {Error} Throws an error if the server parameter is null or undefined
 * @throws {Error} Throws an error if the transport close operation fails
 *
 * @example
 * ```typescript
 * const server = createServer();
 * await startServer(server);
 * await stopServer(server);
 * ```
 */
export async function stopServer(server: Server): Promise<void> {
  if (server === null || server === undefined) {
    throw new Error(NULL_OR_UNDEFINED_ARGUMENTS_ERROR);
  }

  try {
    await server.close();
  } catch (error) {
    throw new Error('Failed to stop MCP server', { cause: error });
  }
}
