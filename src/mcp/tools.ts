import { z } from 'zod';

/**
 * Zod schema for ssh_execute tool parameters
 */
export const SshExecuteArgsSchema = z.object({
  host: z.string().min(1).describe('The SSH host to connect to'),
  username: z.string().min(1).describe('The username for SSH authentication'),
  privateKeyPath: z.string().min(1).describe('Path to the private key file for authentication'),
  command: z.string().min(1).describe('The command to execute on the remote host'),
  port: z.number().int().min(1).max(65535).optional().default(22).describe('The SSH port (default: 22)'),
  timeout: z.number().int().positive().optional().default(30000).describe('Command timeout in milliseconds (default: 30000)'),
});

/**
 * Zod schema for ssh_session_create tool parameters
 */
export const SshSessionCreateArgsSchema = z.object({
  sessionId: z.string().min(1).describe('Unique identifier for the session'),
  host: z.string().min(1).describe('The SSH host to connect to'),
  username: z.string().min(1).describe('The username for SSH authentication'),
  privateKeyPath: z.string().min(1).describe('Path to the private key file for authentication'),
  type: z.enum(['interactive', 'background']).describe('Session type: interactive for command-response, background for continuous output'),
  port: z.number().int().min(1).max(65535).optional().default(22).describe('The SSH port (default: 22)'),
  mode: z.enum(['normal', 'raw']).optional().default('normal').describe('Session mode: normal for structured output, raw for direct stream'),
  shellType: z.enum(['bash', 'sh', 'powershell', 'cmd']).optional().default('bash').describe('The shell type to use (default: bash)'),
});

/**
 * Zod schema for ssh_session_execute tool parameters
 */
export const SshSessionExecuteArgsSchema = z.object({
  sessionId: z.string().min(1).describe('The session ID to execute the command in'),
  command: z.string().min(1).describe('The command to execute in the session'),
  timeout: z.number().int().positive().optional().default(30000).describe('Command timeout in milliseconds (default: 30000)'),
});

/**
 * Zod schema for ssh_session_list tool parameters
 */
export const SshSessionListArgsSchema = z.object({});

/**
 * Zod schema for ssh_session_close tool parameters
 */
export const SshSessionCloseArgsSchema = z.object({
  sessionId: z.string().min(1).describe('The session ID to close'),
});

/**
 * Zod schema for ssh_session_output tool parameters
 */
export const SshSessionOutputArgsSchema = z.object({
  sessionId: z.string().min(1).describe('The session ID to get output from'),
  lines: z.number().int().positive().max(50000).optional().describe('Number of lines to retrieve (max: 50000, default: all)'),
  clear: z.boolean().optional().default(false).describe('Whether to clear the buffer after retrieving (default: false)'),
});

/**
 * Type definitions for tool arguments
 */
export type SshExecuteArgs = z.infer<typeof SshExecuteArgsSchema>;
export type SshSessionCreateArgs = z.infer<typeof SshSessionCreateArgsSchema>;
export type SshSessionExecuteArgs = z.infer<typeof SshSessionExecuteArgsSchema>;
export type SshSessionListArgs = z.infer<typeof SshSessionListArgsSchema>;
export type SshSessionCloseArgs = z.infer<typeof SshSessionCloseArgsSchema>;
export type SshSessionOutputArgs = z.infer<typeof SshSessionOutputArgsSchema>;

/**
 * Helper function to convert Zod schema to JSON Schema format for MCP
 */
function zodToJsonSchema(schema: z.ZodObject<any>): { type: 'object'; properties: Record<string, any>; required?: string[] } {
  const shape = schema.shape;
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    let zodType = value as z.ZodTypeAny;
    let isRequired = true;

    const description = (zodType as any)._def?.description || '';

    // Unwrap optional and default wrappers to get the inner type
    // Need to unwrap recursively in case of nested wrappers (e.g., ZodDefault containing ZodOptional)
    while (zodType instanceof z.ZodOptional || zodType instanceof z.ZodDefault) {
      isRequired = false;
      zodType = (zodType as any)._def.innerType;
    }

    if (zodType instanceof z.ZodString) {
      properties[key] = { type: 'string', description };
    } else if (zodType instanceof z.ZodNumber) {
      properties[key] = { type: 'number', description };
    } else if (zodType instanceof z.ZodBoolean) {
      properties[key] = { type: 'boolean', description };
    } else if (zodType instanceof z.ZodEnum) {
      properties[key] = {
        type: 'string',
        enum: (zodType as any)._def.values,
        description
      };
    }

    if (isRequired) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {})
  };
}

/**
 * MCP tool definitions for SSH operations
 */
export const tools = [
  {
    name: 'ssh_execute',
    description: 'Execute a single SSH command on a remote host without creating a persistent session. Use this for one-off commands that complete quickly.',
    inputSchema: zodToJsonSchema(SshExecuteArgsSchema),
  },
  {
    name: 'ssh_session_create',
    description: 'Create a persistent SSH session for executing multiple commands. Interactive sessions wait for each command to complete. Background sessions queue commands and buffer output.',
    inputSchema: zodToJsonSchema(SshSessionCreateArgsSchema),
  },
  {
    name: 'ssh_session_execute',
    description: 'Execute a command in an existing SSH session. The session must have been created with ssh_session_create first.',
    inputSchema: zodToJsonSchema(SshSessionExecuteArgsSchema),
  },
  {
    name: 'ssh_session_list',
    description: 'List all active SSH sessions with their metadata including session ID, host, type, and status.',
    inputSchema: zodToJsonSchema(SshSessionListArgsSchema),
  },
  {
    name: 'ssh_session_close',
    description: 'Close a specific SSH session and clean up its resources. Returns true if the session was closed, false if it was not found.',
    inputSchema: zodToJsonSchema(SshSessionCloseArgsSchema),
  },
  {
    name: 'ssh_session_output',
    description: 'Get buffered output from a background SSH session. Optionally retrieve a specific number of lines and clear the buffer.',
    inputSchema: zodToJsonSchema(SshSessionOutputArgsSchema),
  },
] as const;

/**
 * Tool names type for type safety
 */
export type ToolName = typeof tools[number]['name'];
