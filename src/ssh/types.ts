/**
 * Result of executing a command via SSH
 */
export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: string | null;
}

/**
 * Type of persistent session
 */
export type SessionType = 'interactive' | 'background';

/**
 * Mode of session command execution
 */
export type SessionMode = 'normal' | 'raw';

/**
 * Metadata for a persistent session
 */
export interface SessionMetadata {
  sessionId: string;
  target: string;
  username: string;
  type: SessionType;
  mode: SessionMode;
  createdAt: Date;
  lastActivity: Date;
  port: number;
  workingDirectory: string;
  environmentVars: Map<string, string>;
  isActive: boolean;
  commandHistory: string[];
}

/**
 * Request for a command to be executed
 */
export interface CommandRequest {
  id: string;
  command: string;
  resolve: (result: CommandResult) => void;
  reject: (error: Error) => void;
  timeout?: number;
  raw?: boolean;
}

/**
 * Information about a connection to a host
 */
export interface ConnectionInfo {
  client: any; // ssh2 Client type
  connected: boolean;
}
