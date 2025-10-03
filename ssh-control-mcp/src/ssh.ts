
import { Client, ClientChannel } from 'ssh2';
import { readFile } from 'fs/promises';
import { EventEmitter } from 'events';
import { ShellFormatter, ShellType, createShellFormatter } from './shells.js';
import { INVALID_ARGUMENTS_ERROR, NULL_OR_UNDEFINED_ARGUMENTS_ERROR } from './constants.js';

// Constants for timeouts and limits
const TIMEOUTS = {
  DEFAULT_COMMAND: 30000,
  DEFAULT_SESSION: 600000,
  CONNECTION: 30000,
  KEEP_ALIVE_INTERVAL: 30000,
  FORCE_CLOSE: 3000,
  SESSION_CLOSE: 5000,
} as const;

const BUFFER_LIMITS = {
  MAX_SIZE: 10000,
  TRIM_TO: 5000,
} as const;

const SSH_CONFIG = {
  READY_TIMEOUT: 30000,
  KEEPALIVE_INTERVAL: 30000,
  KEEPALIVE_COUNT_MAX: 3,
} as const;

export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: string | null;
}

export class SSHError extends Error {
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'SSHError';
    this.cause = cause;
  }
}

export type SessionType = 'interactive' | 'background';
export type SessionMode = 'normal' | 'raw';

/**
 * Metadata for a persistent session
 * @typedef {Object} SessionMetadata
 * @property {string} sessionId - The ID of the session
 * @property {string} target - The target host of the session
 * @property {string} username - The username for the session
 * @property {SessionType} type - The type of the session
 * @property {SessionMode} mode - The mode of the session
 * @property {Date} createdAt - The date and time the session was created
 * @property {Date} lastActivity - The date and time the session was last active
 * @property {number} port - The port of the session
 * @property {string} workingDirectory - The working directory of the session
 * @property {Map<string, string>} environmentVars - The environment variables of the session
 * @property {boolean} isActive - Whether the session is active
 * @property {string[]} commandHistory - The command history of the session
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
 * @typedef {Object} CommandRequest
 * @property {string} id - The ID of the command
 * @property {string} command - The command to execute
 * @property {Function} resolve - The function to call when the command completes
 * @property {Function} reject - The function to call when the command fails
 * @property {number} timeout - The timeout for the command
 * @property {boolean} raw - Whether the command should be executed in raw mode
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
 * @typedef {Object} ConnectionInfo
 * @property {Client} client - The SSH client
 * @property {boolean} connected - Whether the connection is active
 */
interface ConnectionInfo {
  client: Client;
  connected: boolean;
}

/**
 * A persistent session with a shell
 */
export class PersistentSession extends EventEmitter {
  private shell: ClientChannel | null = null;
  private outputBuffer: string[] = [];
  private commandQueue: CommandRequest[] = [];
  private currentCommand: CommandRequest | null = null;
  private sessionInfo: SessionMetadata;
  private client: Client;
  private commandDelimiter: string;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private sessionTimeout: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private outputData = '';
  private shellFormatter: ShellFormatter;

  private sessionTimeoutMs: number;

  /**
   * Create a new persistent session
   * @param sessionId - The ID of the session
   * @param target - The target host of the session
   * @param username - The username for the session
   * @param type - The type of the session
   * @param client - The SSH client
   * @param port - The port of the session
   * @param mode - The mode of the session
   * @param timeoutMs - The session timeout in milliseconds
   * @param shellType - The type of shell to use
   * @throws {SSHError} If required parameters are missing or invalid
   */
  constructor(
    sessionId: string,
    target: string,
    username: string,
    type: SessionType,
    client: Client,
    port: number = 22,
    mode: SessionMode = 'normal',
    timeoutMs: number = TIMEOUTS.DEFAULT_SESSION,
    shellType: ShellType = 'bash'
  ) {
    super();

    // Defensive parameter validation
    if (!sessionId || !target || !username) {
      throw new SSHError(`${INVALID_ARGUMENTS_ERROR}: sessionId, target, and username are required`);
    }

    if (client === null || client === undefined) {
      throw new SSHError(`${NULL_OR_UNDEFINED_ARGUMENTS_ERROR}: client is required`);
    }

    if (port <= 0 || port > 65535) {
      throw new SSHError(`${INVALID_ARGUMENTS_ERROR}: port must be between 1 and 65535`);
    }

    if (timeoutMs <= 0) {
      throw new SSHError(`${INVALID_ARGUMENTS_ERROR}: timeoutMs must be positive`);
    }

    this.client = client;
    this.sessionTimeoutMs = timeoutMs;
    this.commandDelimiter = `___CMD_${Date.now()}_${Math.random().toString(36).substring(2, 11)}___`;
    this.shellFormatter = createShellFormatter(shellType);
    
    this.sessionInfo = {
      sessionId,
      target,
      username,
      type,
      mode,
      createdAt: new Date(),
      lastActivity: new Date(),
      port,
      workingDirectory: '~',
      environmentVars: new Map(),
      isActive: false,
      commandHistory: []
    };
  }

  /**
   * Initialize the session
   * @returns A promise that resolves when the session is initialized
   * @throws {SSHError} If the session fails to initialize
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      this.client.shell((err, stream) => {
        if (err) {
          reject(new SSHError(`Failed to create shell: ${err.message}`, err));
          return;
        }

        this.shell = stream;
        this.sessionInfo.isActive = true;
        this.isInitialized = true;

        stream.on('data', (data: Buffer) => {
          this.handleShellOutput(data.toString());
        });

        stream.stderr.on('data', (data: Buffer) => {
          this.handleShellOutput(data.toString());
        });

        stream.on('close', () => {
          this.sessionInfo.isActive = false;
          this.emit('closed');
          this.cleanup();
        });

        stream.on('error', (error: Error) => {
          this.emit('error', new SSHError(`Shell error: ${error.message}`, error));
        });

        this.startKeepAlive();
        this.resetSessionTimeout();

        setTimeout(() => {
          resolve();
        }, 1000); // Shell startup delay
      });
    });
  }

  /**
   * Execute a command in the session
   * @param command - The command to execute
   * @param timeout - The timeout for the command
   * @param raw - Whether the command should be executed in raw mode
   * @returns A promise that resolves when the command completes
   * @throws {SSHError} If the session is not initialized or inactive
   * @throws {SSHError} If command parameter is invalid
   */
  async executeCommand(command: string, timeout: number = TIMEOUTS.DEFAULT_COMMAND, raw?: boolean): Promise<CommandResult> {
    // Defensive parameter validation
    if (!command) {
      throw new SSHError(`${INVALID_ARGUMENTS_ERROR}: command is required`);
    }

    if (timeout <= 0) {
      throw new SSHError(`${INVALID_ARGUMENTS_ERROR}: timeout must be positive`);
    }

    if (!this.isInitialized || !this.shell || !this.sessionInfo.isActive) {
      throw new SSHError('Session not initialized or inactive');
    }

    // Background sessions should return immediately after queuing
    if (this.sessionInfo.type === 'background') {
      const commandId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const request: CommandRequest = {
        id: commandId,
        command,
        resolve: () => {}, // No-op resolve for background
        reject: () => {}, // No-op reject for background  
        timeout,
        raw: raw !== undefined ? raw : this.sessionInfo.mode === 'raw'
      };

      this.commandQueue.push(request);
      this.sessionInfo.commandHistory.push(command);
      this.sessionInfo.lastActivity = new Date();
      this.resetSessionTimeout();

      if (!this.currentCommand) {
        this.processNextCommand();
      }

      // Return immediately for background sessions
      return {
        stdout: `Command '${command}' queued in background session '${this.sessionInfo.sessionId}'`,
        stderr: '',
        code: 0,
        signal: null
      };
    }

    // Interactive sessions wait for completion
    return new Promise((resolve, reject) => {
      const commandId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const request: CommandRequest = {
        id: commandId,
        command,
        resolve,
        reject,
        timeout,
        raw: raw !== undefined ? raw : this.sessionInfo.mode === 'raw'
      };

      this.commandQueue.push(request);
      this.sessionInfo.commandHistory.push(command);
      this.sessionInfo.lastActivity = new Date();
      this.resetSessionTimeout();

      if (!this.currentCommand) {
        this.processNextCommand();
      }
    });
  }

  /**
   * Process the next command in the queue
   * @throws {SSHError} If the session is not initialized or inactive
   */
  private processNextCommand(): void {
    if (this.commandQueue.length === 0 || !this.shell) return;

    this.currentCommand = this.commandQueue.shift()!;
    this.outputData = '';

    if (this.currentCommand.raw) {
      // Raw mode: send command directly without wrapping
      this.shell.write(this.currentCommand.command + '\n');
      
      // For raw mode, we'll use a simpler timeout-based approach
      if (this.currentCommand.timeout) {
        const commandId = this.currentCommand.id;
        const timeoutDuration = this.currentCommand.timeout;
        setTimeout(() => {
          if (this.currentCommand?.id === commandId) {
            // In raw mode, resolve with whatever output we've collected
            const output = this.outputData;
            this.currentCommand!.resolve({
              stdout: output,
              stderr: '',
              code: 0, // Unknown in raw mode
              signal: null
            });
            this.currentCommand = null;
            this.processNextCommand();
          }
        }, timeoutDuration);
      }
    } else {
      // Normal mode: use delimiter wrapping
      const startDelimiter = `${this.commandDelimiter}_START_${this.currentCommand.id}`;
      const endDelimiter = `${this.commandDelimiter}_END_${this.currentCommand.id}`;
      
      const wrappedCommand = this.shellFormatter.formatCommandWithDelimiters(
        this.currentCommand.command,
        startDelimiter,
        endDelimiter
      );
      
      this.shell.write(wrappedCommand + '\n');

      if (this.currentCommand.timeout) {
        const commandId = this.currentCommand.id;
        setTimeout(() => {
          if (this.currentCommand?.id === commandId) {
            this.currentCommand!.reject(new SSHError(`Command timeout: ${this.currentCommand!.command}`));
            this.currentCommand = null;
            this.processNextCommand();
          }
        }, this.currentCommand.timeout);
      }
    }
  }

  /**
   * Handle the output from the shell
   * @param data - The output data
   */
  private handleShellOutput(data: string): void {
    if (this.sessionInfo.type === 'background') {
      this.outputBuffer.push(data);
      if (this.outputBuffer.length > BUFFER_LIMITS.MAX_SIZE) {
        this.outputBuffer = this.outputBuffer.slice(-BUFFER_LIMITS.TRIM_TO);
      }
    }

    if (this.currentCommand) {
      this.outputData += data;
      this.parseCommandOutput();
    }
  }

  /**
   * Parse the output from the command
   * @throws {SSHError} If the command is not found
   */
  private parseCommandOutput(): void {
    if (!this.currentCommand) return;

    // Skip parsing for raw mode commands
    if (this.currentCommand.raw) {
      // Raw mode output is handled by timeout in processNextCommand
      return;
    }

    const endDelimiter = `${this.commandDelimiter}_END_${this.currentCommand.id}`;
    const exitCode = this.shellFormatter.parseExitCode(this.outputData, endDelimiter);
    
    if (exitCode !== null) {
      const startPattern = `${this.commandDelimiter}_START_${this.currentCommand.id}`;
      const startIndex = this.outputData.indexOf(startPattern);
      const endPattern = `${endDelimiter}:${exitCode}`;
      const endIndex = this.outputData.indexOf(endPattern);
      
      if (startIndex !== -1 && endIndex !== -1) {
        const output = this.outputData.substring(
          startIndex + startPattern.length,
          endIndex
        ).trim();

        const lines = output.split('\n');
        if (lines[0] === '') lines.shift();
        if (lines[lines.length - 1] === '') lines.pop();
        
        const cleanOutput = lines.join('\n');

        this.currentCommand.resolve({
          stdout: cleanOutput,
          stderr: '',
          code: exitCode,
          signal: null
        });
        
        this.currentCommand = null;
        this.processNextCommand();
      }
    }
  }

  /**
   * Get the session information
   * @returns The session information
   */
  getSessionInfo(): SessionMetadata {
    return { 
      ...this.sessionInfo,
      commandHistory: [...this.sessionInfo.commandHistory],
      environmentVars: new Map(this.sessionInfo.environmentVars)
    };
  }

  /**
   * Get the buffered output
   * @param lines - The number of lines to get
   * @param clear - Whether to clear the output buffer
   * @returns The buffered output
   * @throws {SSHError} If lines parameter is invalid
   */
  getBufferedOutput(lines?: number, clear: boolean = false): string[] {
    // Defensive parameter validation
    if (lines !== undefined && lines <= 0) {
      throw new SSHError(`${INVALID_ARGUMENTS_ERROR}: lines must be positive`);
    }

    const result = lines ? this.outputBuffer.slice(-lines) : [...this.outputBuffer];
    if (clear) {
      this.outputBuffer = [];
    }
    return result;
  }

  /**
   * Start the keep-alive interval
   */
  private startKeepAlive(): void {
    this.keepAliveInterval = setInterval(() => {
      if (this.shell && this.sessionInfo.isActive && this.commandQueue.length === 0 && !this.currentCommand) {
        this.shell.write(this.shellFormatter.getKeepAliveCommand());
      }
    }, TIMEOUTS.KEEP_ALIVE_INTERVAL);
  }

  /**
   * Reset the session timeout
   */
  private resetSessionTimeout(): void {
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
    }
    
    this.sessionTimeout = setTimeout(() => {
      this.emit('timeout');
      this.close();
    }, this.sessionTimeoutMs);
  }

  /**
   * Close the session
   */
  close(): void {
    this.cleanup();
    if (this.shell) {
      this.shell.end();
    }
  }

  /**
   * Cleanup the session
   */
  private cleanup(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
      this.sessionTimeout = null;
    }
    
    this.sessionInfo.isActive = false;
    this.currentCommand = null;
    this.commandQueue = [];
  }
}

/**
 * A manager for SSH connections and sessions
 */
export class SSHConnectionManager {
  private connections: Map<string, ConnectionInfo> = new Map();
  private sessions: Map<string, PersistentSession> = new Map();

  /**
   * Execute a command on a target host via SSH
   * @param host - The host to execute the command on
   * @param username - The username to use for the command
   * @param privateKeyPath - The path to the private key to use for the command
   * @param command - The command to execute
   * @param port - The port to use for the command
   * @param timeout - The timeout for the command
   * @returns A promise that resolves when the command completes
   * @throws {SSHError} If the command fails to execute or parameters are invalid
   */
  public async executeCommand(
    host: string,
    username: string,
    privateKeyPath: string,
    command: string,
    port: number = 22,
    timeout: number = TIMEOUTS.DEFAULT_COMMAND
  ): Promise<CommandResult> {
    // Defensive parameter validation
    if (!host || !username || !privateKeyPath || !command) {
      throw new SSHError(`${INVALID_ARGUMENTS_ERROR}: host, username, privateKeyPath, and command are required`);
    }

    if (port <= 0 || port > 65535) {
      throw new SSHError(`${INVALID_ARGUMENTS_ERROR}: port must be between 1 and 65535`);
    }

    if (timeout <= 0) {
      throw new SSHError(`${INVALID_ARGUMENTS_ERROR}: timeout must be positive`);
    }

    const client = await this.getConnection(host, username, privateKeyPath, port);
    
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let hasTimedOut = false;

      const timeoutId = setTimeout(() => {
        hasTimedOut = true;
        reject(new SSHError(`Command timeout after ${timeout}ms: ${command}`));
      }, timeout);

      client.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeoutId);
          reject(new SSHError(`Failed to execute command: ${err.message}`, err));
          return;
        }

        stream.on('close', (code: number | null, signal: string | null) => {
          clearTimeout(timeoutId);
          if (!hasTimedOut) {
            resolve({ stdout, stderr, code, signal });
          }
        });

        stream.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on('error', (error: Error) => {
          clearTimeout(timeoutId);
          if (!hasTimedOut) {
            reject(new SSHError(`Stream error: ${error.message}`, error));
          }
        });
      });
    });
  }

  /**
   * Get or create an SSH connection to a host
   * @param host - The host to get the connection for
   * @param username - The username to use for the connection
   * @param privateKeyPath - The path to the private key to use for the connection
   * @param port - The port to use for the connection
   * @returns A promise that resolves when the connection is created
   * @throws {SSHError} If the connection fails to create
   */
  private async getConnection(
    host: string,
    username: string,
    privateKeyPath: string,
    port: number = 22
  ): Promise<Client> {
    const connectionKey = `ssh-${username}@${host}:${port}`;
    console.error(`[SSH-CLIENT] getConnection called with key: ${connectionKey}`);
    
    if (this.connections.has(connectionKey)) {
      const connInfo = this.connections.get(connectionKey)!;
      if (connInfo.connected) {
        console.error(`[SSH-CLIENT] Reusing existing connection for: ${connectionKey}`);
        return connInfo.client;
      }
      // Connection is dead, remove it
      console.error(`[SSH-CLIENT] Removing dead connection for: ${connectionKey}`);
      this.connections.delete(connectionKey);
    }

    // Create new connection
    console.error(`[SSH-CLIENT] Creating new connection for: ${connectionKey}`);
    const client = await this.createConnection(host, username, privateKeyPath, port);
    this.connections.set(connectionKey, { client, connected: true });
    console.error(`[SSH-CLIENT] Connection cache now has ${this.connections.size} connections`);
    
    return client;
  }

  /**
   * Create a new SSH connection
   * @param host - The host to create the connection for
   * @param username - The username to use for the connection
   * @param privateKeyPath - The path to the private key to use for the connection
   * @param port - The port to use for the connection
   * @returns A promise that resolves when the connection is created
   * @throws {SSHError} If the connection fails to create
   */
  private async createConnection(
    host: string,
    username: string,
    privateKeyPath: string,
    port: number = 22
  ): Promise<Client> {
    let privateKey: Buffer;
    try {
      privateKey = await readFile(privateKeyPath);
    } catch (error) {
      throw new SSHError(
        `Failed to read SSH private key from ${privateKeyPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    const client = new Client();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new SSHError('Connection timeout'));
      }, TIMEOUTS.KEEP_ALIVE_INTERVAL);

      client.on('ready', () => {
        clearTimeout(timeout);
        resolve(client);
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        reject(new SSHError(`Connection failed to ${host}:${port}: ${err.message}`, err));
      });

      client.on('close', () => {
        // Mark connection as disconnected
        const connectionKey = `ssh-${username}@${host}:${port}`;
        const connInfo = this.connections.get(connectionKey);
        if (connInfo) {
          connInfo.connected = false;
        }
      });

      client.connect({
        host,
        port,
        username,
        privateKey,
        timeout: SSH_CONFIG.READY_TIMEOUT,
        readyTimeout: SSH_CONFIG.READY_TIMEOUT,
        keepaliveInterval: SSH_CONFIG.KEEPALIVE_INTERVAL,
        keepaliveCountMax: SSH_CONFIG.KEEPALIVE_COUNT_MAX,
      });
    });
  }

  /**
   * Create a new persistent session
   * @param sessionId - The ID of the session
   * @param target - The target host of the session
   * @param username - The username for the session
   * @param type - The type of the session
   * @param privateKeyPath - The path to the private key to use for the session
   * @param port - The port to use for the session
   * @param mode - The mode of the session
   * @param timeoutMs - The session timeout in milliseconds
   * @param shellType - The type of shell to use
   * @returns A promise that resolves when the session is created
   * @throws {SSHError} If the session fails to create or parameters are invalid
   */
  public async createSession(
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
    // Defensive parameter validation
    if (!sessionId || !target || !username || !privateKeyPath) {
      throw new SSHError(`${INVALID_ARGUMENTS_ERROR}: sessionId, target, username, and privateKeyPath are required`);
    }

    if (this.sessions.has(sessionId)) {
      throw new SSHError(`Session with ID '${sessionId}' already exists`);
    }

    const client = await this.getConnection(target, username, privateKeyPath, port);
    const session = new PersistentSession(sessionId, target, username, type, client, port, mode, timeoutMs, shellType);
    
    await session.initialize();
    this.sessions.set(sessionId, session);

    session.on('closed', () => {
      this.sessions.delete(sessionId);
    });

    session.on('error', (error) => {
      console.error(`[SSH] Session ${sessionId} error:`, error);
      this.sessions.delete(sessionId);
    });

    session.on('timeout', () => {
      console.error(`[SSH] Session ${sessionId} timed out`);
      this.sessions.delete(sessionId);
    });

    return session;
  }

  /**
   * Get an existing session by ID
   * @param sessionId - The ID of the session
   * @returns The session or undefined if not found
   * @throws {SSHError} If sessionId is invalid
   */
  public getSession(sessionId: string): PersistentSession | undefined {
    if (!sessionId) {
      throw new SSHError(`${INVALID_ARGUMENTS_ERROR}: sessionId is required`);
    }
    return this.sessions.get(sessionId);
  }

  /**
   * List all active sessions
   */
  public listSessions(): SessionMetadata[] {
    return Array.from(this.sessions.values()).map(session => session.getSessionInfo());
  }

  /**
   * Close a specific session
   * @param sessionId - The ID of the session to close
   * @returns True if the session was closed, false if not found
   * @throws {SSHError} If sessionId is invalid
   */
  public async closeSession(sessionId: string): Promise<boolean> {
    if (!sessionId) {
      throw new SSHError(`${INVALID_ARGUMENTS_ERROR}: sessionId is required`);
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        // Force cleanup even if 'closed' event doesn't fire
        this.sessions.delete(sessionId);
        resolve(true);
      }, TIMEOUTS.FORCE_CLOSE);
      
      // Use once() instead of on() to avoid multiple event listeners
      session.once('closed', () => {
        clearTimeout(timeout);
        this.sessions.delete(sessionId);
        resolve(true);
      });
      
      session.close();
    });
  }

  /**
   * Execute a command in a specific session
   * @param sessionId - The ID of the session
   * @param command - The command to execute
   * @param timeout - The timeout for the command
   * @param raw - Whether the command should be executed in raw mode
   * @returns A promise that resolves when the command completes
   * @throws {SSHError} If the session is not found
   */
  public async executeInSession(
    sessionId: string,
    command: string,
    timeout?: number,
    raw?: boolean
  ): Promise<CommandResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SSHError(`Session '${sessionId}' not found`);
    }

    return session.executeCommand(command, timeout, raw);
  }

  /**
   * Get buffered output from a background session
   * @param sessionId - The ID of the session
   * @param lines - The number of lines to get
   * @param clear - Whether to clear the output buffer
   * @returns The buffered output
   * @throws {SSHError} If the session is not found
   */
  public getSessionOutput(sessionId: string, lines?: number, clear?: boolean): string[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SSHError(`Session '${sessionId}' not found`);
    }

    return session.getBufferedOutput(lines, clear);
  }

  /**
   * Close all connections and sessions
   * @throws {SSHError} If the session is not found
   */
  public async disconnectAll(): Promise<void> {
    const sessionPromises = Array.from(this.sessions.values()).map(session => {
      return new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          resolve(); // Resolve even if 'closed' event doesn't fire
        }, TIMEOUTS.SESSION_CLOSE);
        
        // Use once() instead of on() to avoid multiple event listeners
        session.once('closed', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        session.close();
      });
    });

    const connectionPromises = Array.from(this.connections.values()).map(connInfo => {
      return new Promise<void>((resolve) => {
        if (connInfo.connected) {
          const timeout = setTimeout(() => {
            resolve(); // Resolve even if 'close' event doesn't fire
          }, TIMEOUTS.SESSION_CLOSE);
          
          // Use once() instead of on() to avoid multiple event listeners
          connInfo.client.once('close', () => {
            clearTimeout(timeout);
            resolve();
          });
          
          connInfo.client.end();
        } else {
          resolve();
        }
      });
    });

    try {
      await Promise.all([...sessionPromises, ...connectionPromises]);
    } catch (error) {
      console.error('[SSH] Error during disconnectAll:', error);
    } finally {
      this.sessions.clear();
      this.connections.clear();
    }
  }
} 