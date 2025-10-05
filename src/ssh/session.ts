import { Client, ClientChannel } from 'ssh2';
import { EventEmitter } from 'events';
import { ShellFormatter, ShellType, createShellFormatter } from '../shells.js';
import { INVALID_ARGUMENTS_ERROR, NULL_OR_UNDEFINED_ARGUMENTS_ERROR } from '../constants.js';
import {
  CommandResult,
  SessionType,
  SessionMode,
  SessionMetadata,
  CommandRequest,
} from './types.js';
import { SSHError } from './errors.js';
import { TIMEOUTS, BUFFER_LIMITS } from './constants.js';

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
    if (sessionId == null || target == null || username == null || client == null) {
      throw new SSHError(NULL_OR_UNDEFINED_ARGUMENTS_ERROR);
    }

    if (sessionId === '' || target === '' || username === '') {
      throw new SSHError(`${INVALID_ARGUMENTS_ERROR}: sessionId, target, and username are required`);
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
