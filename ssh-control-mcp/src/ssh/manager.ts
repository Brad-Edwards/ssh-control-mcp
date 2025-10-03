import { PersistentSession } from './session.js';
import { ConnectionPool } from './connection-pool.js';
import { CommandResult, SessionType, SessionMode, SessionMetadata } from './types.js';
import { SSHError } from './errors.js';
import { ShellType } from '../shells.js';
import { INVALID_ARGUMENTS_ERROR, NULL_OR_UNDEFINED_ARGUMENTS_ERROR } from '../constants.js';
import { TIMEOUTS } from './constants.js';

/**
 * Manages SSH connections and persistent sessions
 */
export class SSHConnectionManager {
  private pool: ConnectionPool;
  private sessions: Map<string, PersistentSession>;

  constructor() {
    this.pool = new ConnectionPool();
    this.sessions = new Map();
  }

  /**
   * Execute a one-off SSH command without creating a persistent session
   * @param host - The host to connect to
   * @param username - The username to use for the connection
   * @param privateKeyPath - The path to the private key to use for the connection
   * @param command - The command to execute
   * @param port - The port to use for the connection
   * @param timeout - The timeout for the command execution in milliseconds
   * @returns A promise that resolves with the command result
   * @throws {SSHError} If the command execution fails
   * @throws {Error} If arguments are null, undefined, empty, or invalid
   */
  async executeCommand(
    host: string,
    username: string,
    privateKeyPath: string,
    command: string,
    port: number = 22,
    timeout: number = TIMEOUTS.DEFAULT_COMMAND
  ): Promise<CommandResult> {
    // Validate arguments
    if (host === null || host === undefined || username === null || username === undefined ||
        privateKeyPath === null || privateKeyPath === undefined || command === null || command === undefined) {
      throw new SSHError(NULL_OR_UNDEFINED_ARGUMENTS_ERROR);
    }
    if (!host || !username || !privateKeyPath || !command) {
      throw new SSHError(`${INVALID_ARGUMENTS_ERROR}: host, username, privateKeyPath, and command are required`);
    }
    if (port <= 0 || port > 65535) {
      throw new SSHError(`${INVALID_ARGUMENTS_ERROR}: port must be between 1 and 65535`);
    }
    if (timeout <= 0) {
      throw new SSHError(`${INVALID_ARGUMENTS_ERROR}: timeout must be positive`);
    }

    const client = await this.pool.getConnection(host, username, privateKeyPath, port);

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new SSHError('Command timeout'));
      }, timeout);

      let stdout = '';
      let stderr = '';

      client.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeoutHandle);
          reject(new SSHError(`Failed to execute command: ${err.message}`, err));
          return;
        }

        stream.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on('close', (code: number, signal: string) => {
          clearTimeout(timeoutHandle);
          resolve({
            stdout,
            stderr,
            code: code ?? null,
            signal: signal ?? null,
          });
        });

        stream.on('error', (err: Error) => {
          clearTimeout(timeoutHandle);
          reject(new SSHError(`Stream error: ${err.message}`, err));
        });
      });
    });
  }

  /**
   * Create a new persistent SSH session
   * @param sessionId - The unique session ID
   * @param target - The target host to connect to
   * @param username - The username to use for the connection
   * @param type - The type of session (interactive or background)
   * @param privateKeyPath - The path to the private key to use for the connection
   * @param port - The port to use for the connection
   * @param mode - The mode of session (normal or raw)
   * @param timeoutMs - The timeout for the session in milliseconds
   * @param shellType - The type of shell to use
   * @returns A promise that resolves with the created session
   * @throws {SSHError} If the session creation fails
   * @throws {Error} If arguments are null, undefined, empty, or invalid
   */
  async createSession(
    sessionId: string,
    target: string,
    username: string,
    type: SessionType,
    privateKeyPath: string,
    port: number = 22,
    mode: SessionMode = 'normal',
    timeoutMs: number = TIMEOUTS.DEFAULT_SESSION,
    shellType: ShellType = 'bash'
  ): Promise<PersistentSession> {
    // Validate arguments
    if (sessionId === null || sessionId === undefined || target === null || target === undefined ||
        username === null || username === undefined || privateKeyPath === null || privateKeyPath === undefined) {
      throw new SSHError(NULL_OR_UNDEFINED_ARGUMENTS_ERROR);
    }
    if (!sessionId || !target || !username || !privateKeyPath) {
      throw new SSHError(`${INVALID_ARGUMENTS_ERROR}: sessionId, target, username, and privateKeyPath are required`);
    }

    if (this.sessions.has(sessionId)) {
      throw new SSHError(`Session '${sessionId}' already exists`);
    }

    const client = await this.pool.getConnection(target, username, privateKeyPath, port);

    const session = new PersistentSession(
      sessionId,
      target,
      username,
      type,
      client,
      port,
      mode,
      timeoutMs,
      shellType
    );

    await session.initialize();
    this.sessions.set(sessionId, session);

    return session;
  }

  /**
   * Get an existing session by ID
   * @param sessionId - The session ID to retrieve
   * @returns The session or undefined if not found
   * @throws {Error} If sessionId is null, undefined, or empty
   */
  getSession(sessionId: string): PersistentSession | undefined {
    if (sessionId === null || sessionId === undefined) {
      throw new Error(NULL_OR_UNDEFINED_ARGUMENTS_ERROR);
    }
    if (!sessionId) {
      throw new Error(`${INVALID_ARGUMENTS_ERROR}: sessionId is required`);
    }

    return this.sessions.get(sessionId);
  }

  /**
   * List all active sessions
   * @returns An array of session metadata
   */
  listSessions(): SessionMetadata[] {
    return Array.from(this.sessions.values()).map(session => session.getSessionInfo());
  }

  /**
   * Close a session
   * @param sessionId - The session ID to close
   * @returns A promise that resolves with true if the session was closed, false if not found
   * @throws {Error} If sessionId is null, undefined, or empty
   */
  async closeSession(sessionId: string): Promise<boolean> {
    if (sessionId === null || sessionId === undefined) {
      throw new Error(NULL_OR_UNDEFINED_ARGUMENTS_ERROR);
    }
    if (!sessionId) {
      throw new Error(`${INVALID_ARGUMENTS_ERROR}: sessionId is required`);
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    await session.close();
    this.sessions.delete(sessionId);
    return true;
  }

  /**
   * Close all sessions and disconnect all connections
   * @returns A promise that resolves when all sessions are closed
   */
  async closeAll(): Promise<void> {
    // Close all sessions first
    const closePromises = Array.from(this.sessions.values()).map(session => session.close());
    await Promise.all(closePromises);
    this.sessions.clear();

    // Disconnect all connections
    await this.pool.disconnectAll();
  }

  /**
   * Execute a command in an existing session
   * @param sessionId - The session ID to execute the command in
   * @param command - The command to execute
   * @param timeout - The timeout for the command execution in milliseconds
   * @returns A promise that resolves with the command result
   * @throws {SSHError} If the session is not found or the command execution fails
   */
  async executeInSession(
    sessionId: string,
    command: string,
    timeout?: number
  ): Promise<CommandResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SSHError(`Session '${sessionId}' not found`);
    }

    return session.executeCommand(command, timeout);
  }

  /**
   * Get buffered output from a background session
   * @param sessionId - The session ID to get output from
   * @param lines - The number of lines to retrieve (optional, retrieves all if not specified)
   * @param clear - Whether to clear the buffer after retrieving (default: false)
   * @returns An array of buffered output lines
   * @throws {SSHError} If the session is not found
   */
  getSessionOutput(sessionId: string, lines?: number, clear?: boolean): string[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SSHError(`Session '${sessionId}' not found`);
    }

    return session.getBufferedOutput(lines, clear);
  }

  /**
   * Get the number of active connections in the pool
   * @returns The number of connections
   */
  getConnectionCount(): number {
    return this.pool.getConnectionCount();
  }
}
