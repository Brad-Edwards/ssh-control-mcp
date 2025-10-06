import { TIMEOUTS, BUFFER_LIMITS, SSH_CONFIG } from '../ssh/constants.js';
import type {
  TimeoutsConfig,
  BuffersConfig,
  SecurityConfig,
  AuditConfig,
  LoggingConfig,
  ServerConfig,
  SSHTargetConfig,
} from './schema.js';

/**
 * Default timeout values in milliseconds
 * Based on current SSH timeout constants
 */
export const DEFAULT_TIMEOUTS: Required<TimeoutsConfig> = {
  command: TIMEOUTS.DEFAULT_COMMAND,
  session: TIMEOUTS.DEFAULT_SESSION,
  connection: TIMEOUTS.CONNECTION,
  keepAlive: TIMEOUTS.KEEP_ALIVE_INTERVAL,
};

/**
 * Default buffer limits for background sessions
 * Based on current buffer limit constants
 */
export const DEFAULT_BUFFERS: Required<BuffersConfig> = {
  maxSize: BUFFER_LIMITS.MAX_SIZE,
  trimTo: BUFFER_LIMITS.TRIM_TO,
};

/**
 * Default security configuration
 * Unrestricted by default - security boundary is target selection, not command filtering
 */
export const DEFAULT_SECURITY: Required<SecurityConfig> = {
  allowedCommands: undefined as any, // No whitelist - allow all commands
  blockedCommands: [], // No blocklist - unrestricted access
  maxSessions: 10,
  sessionTimeout: TIMEOUTS.DEFAULT_SESSION,
  maxConnectionsPerHost: SSH_CONFIG.MAX_CONNECTIONS_PER_HOST,
};

/**
 * Default audit configuration
 * Audit logging enabled by default with 30-day retention
 */
export const DEFAULT_AUDIT: Required<AuditConfig> = {
  enabled: true,
  filePath: './logs/audit.log',
  maxFiles: '30d',
  maxSize: '20m',
  sanitizePatterns: [],
};

/**
 * Default logging configuration
 * Log commands for audit but not responses by default
 */
export const DEFAULT_LOGGING: Required<LoggingConfig> = {
  level: 'info',
  includeCommands: true,
  includeResponses: false,
  maxResponseLength: 1000,
  audit: DEFAULT_AUDIT,
};

/**
 * Create a complete default configuration with specified target
 *
 * @param name - The instance name
 * @param target - The SSH target configuration
 * @returns A complete server configuration with all defaults applied
 *
 * @example
 * ```typescript
 * const config = createDefaultConfig('kali-red-team', {
 *   host: 'kali.local',
 *   port: 22,
 *   username: 'root',
 *   privateKeyPath: '/keys/kali_rsa',
 * });
 * ```
 */
export function createDefaultConfig(
  name: string,
  target: Omit<SSHTargetConfig, 'shell'> & { shell?: SSHTargetConfig['shell'] }
): ServerConfig {
  return {
    name,
    target: {
      ...target,
      shell: target.shell || 'bash',
    },
    timeouts: DEFAULT_TIMEOUTS,
    buffers: DEFAULT_BUFFERS,
    security: DEFAULT_SECURITY,
    logging: DEFAULT_LOGGING,
  };
}

/**
 * Merge a partial configuration with default values
 *
 * @param config - Partial server configuration
 * @returns Complete server configuration with defaults applied to missing fields
 *
 * @example
 * ```typescript
 * const partial = {
 *   name: 'my-instance',
 *   target: { host: 'target', port: 22, username: 'user', privateKeyPath: '/key' },
 *   timeouts: { command: 60000 }
 * };
 * const complete = mergeWithDefaults(partial);
 * ```
 */
export function mergeWithDefaults(config: ServerConfig): ServerConfig {
  return {
    name: config.name,
    target: {
      ...config.target,
      shell: config.target.shell || 'bash',
    },
    timeouts: config.timeouts
      ? {
          command: config.timeouts.command ?? DEFAULT_TIMEOUTS.command,
          session: config.timeouts.session ?? DEFAULT_TIMEOUTS.session,
          connection: config.timeouts.connection ?? DEFAULT_TIMEOUTS.connection,
          keepAlive: config.timeouts.keepAlive ?? DEFAULT_TIMEOUTS.keepAlive,
        }
      : DEFAULT_TIMEOUTS,
    buffers: config.buffers
      ? {
          maxSize: config.buffers.maxSize ?? DEFAULT_BUFFERS.maxSize,
          trimTo: config.buffers.trimTo ?? DEFAULT_BUFFERS.trimTo,
        }
      : DEFAULT_BUFFERS,
    security: config.security
      ? {
          allowedCommands: config.security.allowedCommands ?? DEFAULT_SECURITY.allowedCommands,
          blockedCommands: config.security.blockedCommands ?? DEFAULT_SECURITY.blockedCommands,
          maxSessions: config.security.maxSessions ?? DEFAULT_SECURITY.maxSessions,
          sessionTimeout: config.security.sessionTimeout ?? DEFAULT_SECURITY.sessionTimeout,
          maxConnectionsPerHost: config.security.maxConnectionsPerHost ?? DEFAULT_SECURITY.maxConnectionsPerHost,
        }
      : DEFAULT_SECURITY,
    logging: config.logging
      ? {
          level: config.logging.level ?? DEFAULT_LOGGING.level,
          includeCommands: config.logging.includeCommands ?? DEFAULT_LOGGING.includeCommands,
          includeResponses: config.logging.includeResponses ?? DEFAULT_LOGGING.includeResponses,
          maxResponseLength: config.logging.maxResponseLength ?? DEFAULT_LOGGING.maxResponseLength,
          audit: config.logging.audit
            ? {
                enabled: config.logging.audit.enabled ?? DEFAULT_AUDIT.enabled,
                filePath: config.logging.audit.filePath ?? DEFAULT_AUDIT.filePath,
                maxFiles: config.logging.audit.maxFiles ?? DEFAULT_AUDIT.maxFiles,
                maxSize: config.logging.audit.maxSize ?? DEFAULT_AUDIT.maxSize,
                sanitizePatterns: config.logging.audit.sanitizePatterns ?? DEFAULT_AUDIT.sanitizePatterns,
              }
            : DEFAULT_AUDIT,
        }
      : DEFAULT_LOGGING,
  };
}
