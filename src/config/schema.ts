import { z } from 'zod';

/**
 * Validates that a string is a valid regular expression
 * @param pattern - The regex pattern to validate
 * @returns True if valid, false otherwise
 */
function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

/**
 * SSH target configuration schema
 * Defines the remote host connection parameters
 */
export const SSHTargetConfigSchema = z.object({
  host: z.string().min(1, 'Host cannot be empty'),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1, 'Username cannot be empty'),
  privateKeyPath: z.string().min(1, 'Private key path cannot be empty'),
  passphrase: z.string().optional(),
  shell: z.enum(['bash', 'sh', 'powershell', 'cmd']).default('bash'),
});

/**
 * Timeout configuration schema
 * All timeout values are in milliseconds
 */
export const TimeoutsConfigSchema = z.object({
  command: z.number().int().min(1).max(3600000).optional(),
  session: z.number().int().min(1).max(3600000).optional(),
  connection: z.number().int().min(1).max(3600000).optional(),
  keepAlive: z.number().int().min(1).max(3600000).optional(),
});

/**
 * Buffer configuration schema
 * Defines output buffer limits for background sessions
 */
export const BuffersConfigSchema = z.object({
  maxSize: z.number().int().min(1).max(100000).optional(),
  trimTo: z.number().int().min(1).max(100000).optional(),
}).refine(
  (data) => {
    if (data.maxSize !== undefined && data.trimTo !== undefined) {
      return data.trimTo <= data.maxSize;
    }
    return true;
  },
  {
    message: 'trimTo must be less than or equal to maxSize',
  }
);

/**
 * Security configuration schema
 * Defines command filtering and resource limits
 */
export const SecurityConfigSchema = z.object({
  allowedCommands: z.array(z.string().refine(isValidRegex, {
    message: 'Invalid regex pattern',
  })).optional(),
  blockedCommands: z.array(z.string().refine(isValidRegex, {
    message: 'Invalid regex pattern',
  })).optional(),
  maxSessions: z.number().int().min(1).max(100).optional(),
  sessionTimeout: z.number().int().min(1).optional(),
  maxConnectionsPerHost: z.number().int().min(1).optional(),
});

/**
 * Audit logging configuration schema
 * Defines audit trail settings
 */
export const AuditConfigSchema = z.object({
  enabled: z.boolean().optional(),
  filePath: z.string().optional(),
  maxFiles: z.string().optional(),
  maxSize: z.string().optional(),
  sanitizePatterns: z.array(z.string().refine(isValidRegex, {
    message: 'Invalid regex pattern',
  })).optional(),
});

/**
 * Logging configuration schema
 * Defines what and how to log
 */
export const LoggingConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  includeCommands: z.boolean().optional(),
  includeResponses: z.boolean().optional(),
  maxResponseLength: z.number().int().min(1).max(100000).optional(),
  audit: AuditConfigSchema.optional(),
});

/**
 * Complete server configuration schema
 * Combines all configuration sections
 */
export const ServerConfigSchema = z.object({
  name: z.string().min(1, 'Instance name cannot be empty'),
  target: SSHTargetConfigSchema,
  timeouts: TimeoutsConfigSchema.optional(),
  buffers: BuffersConfigSchema.optional(),
  security: SecurityConfigSchema.optional(),
  logging: LoggingConfigSchema.optional(),
});

/**
 * TypeScript types inferred from Zod schemas
 */
export type SSHTargetConfig = z.infer<typeof SSHTargetConfigSchema>;
export type TimeoutsConfig = z.infer<typeof TimeoutsConfigSchema>;
export type BuffersConfig = z.infer<typeof BuffersConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type AuditConfig = z.infer<typeof AuditConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
