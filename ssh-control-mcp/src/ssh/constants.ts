/**
 * Timeout configuration for SSH operations
 */
export const TIMEOUTS = {
  DEFAULT_COMMAND: 30000,
  DEFAULT_SESSION: 600000,
  CONNECTION: 30000,
  KEEP_ALIVE_INTERVAL: 30000,
  FORCE_CLOSE: 3000,
  SESSION_CLOSE: 5000,
} as const;

/**
 * Buffer limits for output buffering
 */
export const BUFFER_LIMITS = {
  MAX_SIZE: 10000,
  TRIM_TO: 5000,
} as const;

/**
 * SSH client configuration
 */
export const SSH_CONFIG = {
  READY_TIMEOUT: 30000,
  KEEPALIVE_INTERVAL: 30000,
  KEEPALIVE_COUNT_MAX: 3,
} as const;
