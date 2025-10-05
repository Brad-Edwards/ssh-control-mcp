import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SSHConnectionManager } from '../ssh/manager.js';
import {
  tools,
  SshExecuteArgsSchema,
  SshSessionCreateArgsSchema,
  SshSessionExecuteArgsSchema,
  SshSessionListArgsSchema,
  SshSessionCloseArgsSchema,
  SshSessionOutputArgsSchema,
  type SshExecuteArgs,
  type SshSessionCreateArgs,
  type SshSessionExecuteArgs,
  type SshSessionListArgs,
  type SshSessionCloseArgs,
  type SshSessionOutputArgs,
} from './tools.js';

/**
 * Register tool handlers on the MCP server
 *
 * @param server - The MCP server instance
 * @param manager - The SSH connection manager instance
 */
export function registerToolHandlers(server: Server, manager: SSHConnectionManager): void {
  // Register tools/list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // Register tools/call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'ssh_execute': {
        const validatedArgs = SshExecuteArgsSchema.parse(args) as SshExecuteArgs;
        const result = await manager.executeCommand(
          validatedArgs.host,
          validatedArgs.username,
          validatedArgs.privateKeyPath,
          validatedArgs.command,
          validatedArgs.port,
          validatedArgs.timeout
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'ssh_session_create': {
        const validatedArgs = SshSessionCreateArgsSchema.parse(args) as SshSessionCreateArgs;
        const session = await manager.createSession(
          validatedArgs.sessionId,
          validatedArgs.host,
          validatedArgs.username,
          validatedArgs.type,
          validatedArgs.privateKeyPath,
          validatedArgs.port,
          validatedArgs.mode,
          undefined, // timeoutMs - use default
          validatedArgs.shellType
        );

        const sessionInfo = session.getSessionInfo();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                sessionId: sessionInfo.sessionId,
                target: sessionInfo.target,
                username: sessionInfo.username,
                type: sessionInfo.type,
                mode: sessionInfo.mode,
                port: sessionInfo.port,
                isActive: sessionInfo.isActive,
                createdAt: sessionInfo.createdAt,
              }, null, 2),
            },
          ],
        };
      }

      case 'ssh_session_execute': {
        const validatedArgs = SshSessionExecuteArgsSchema.parse(args) as SshSessionExecuteArgs;
        const result = await manager.executeInSession(
          validatedArgs.sessionId,
          validatedArgs.command,
          validatedArgs.timeout
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'ssh_session_list': {
        SshSessionListArgsSchema.parse(args); // Validate (even though empty)
        const sessions = manager.listSessions();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(sessions.map(session => ({
                sessionId: session.sessionId,
                target: session.target,
                username: session.username,
                type: session.type,
                mode: session.mode,
                port: session.port,
                isActive: session.isActive,
                createdAt: session.createdAt,
                lastActivity: session.lastActivity,
              })), null, 2),
            },
          ],
        };
      }

      case 'ssh_session_close': {
        const validatedArgs = SshSessionCloseArgsSchema.parse(args) as SshSessionCloseArgs;
        const success = await manager.closeSession(validatedArgs.sessionId);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success }, null, 2),
            },
          ],
        };
      }

      case 'ssh_session_output': {
        const validatedArgs = SshSessionOutputArgsSchema.parse(args) as SshSessionOutputArgs;
        const output = manager.getSessionOutput(
          validatedArgs.sessionId,
          validatedArgs.lines,
          validatedArgs.clear
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ output }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });
}
