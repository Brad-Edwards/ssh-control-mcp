import { INVALID_ARGUMENTS_ERROR, ShellNames } from './constants.js';

/**
 * Shell-specific command formatting for cross-platform SSH session support
 */

export type ShellType = 'bash' | 'sh' | 'powershell' | 'cmd';

export interface ShellFormatter {
  formatCommandWithDelimiters(command: string, startDelimiter: string, endDelimiter: string): string;
  getKeepAliveCommand(): string;
  parseExitCode(output: string, endDelimiter: string): number | null;
  getShellName(): string;
}

/**
 * Formatter for Bash and sh shells (Linux/Unix)
 * 
 * @param shellName - The name of the shell to use
 * @throws {Error} If the shell name is not provided
 */
export class BashShellFormatter implements ShellFormatter {
  private shellName: string;

  constructor(shellName: string) {
    if (!shellName) {
      throw new Error(`${INVALID_ARGUMENTS_ERROR}: shellName is required`);
    }
    this.shellName = shellName;
  }

  /**
   * Formats a command with delimiters
   * @param command - The command to format
   * @param startDelimiter - The delimiter to start the command
   * @param endDelimiter - The delimiter to end the command
   * @throws {Error} If the command, startDelimiter, or endDelimiter is not provided
   * @returns The formatted command
   */
  formatCommandWithDelimiters(command: string, startDelimiter: string, endDelimiter: string): string {
    if (!command || !startDelimiter || !endDelimiter) {
      throw new Error(`${INVALID_ARGUMENTS_ERROR}: command, startDelimiter, and endDelimiter are required`);
    }
    return `echo "${startDelimiter}"; ${command}; echo "${endDelimiter}:$?"`;
  }
  
  /**
   * Gets the keep-alive command
   * @returns The keep-alive command
   */
  getKeepAliveCommand(): string {
    return '\n';
  }
  
  /**
   * Parses the exit code from the output
   * @param output - The output to parse
   * @param endDelimiter - The delimiter to end the command
   * @throws {Error} If the output or endDelimiter is not provided
   * @returns The exit code
   */
  parseExitCode(output: string, endDelimiter: string): number | null {
    if (!output || !endDelimiter) {
      throw new Error(INVALID_ARGUMENTS_ERROR);
    }
    const pattern = `${endDelimiter}:(\\d+)`;
    const match = output.match(new RegExp(pattern));
    
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  getShellName(): string {
    return this.shellName;
  }
}

/**
 * Formatter for PowerShell (Windows) 
 */
export class PowerShellFormatter implements ShellFormatter {
  /**
   * Formats a command with delimiters
   * @param command - The command to format
   * @param startDelimiter - The delimiter to start the command
   * @param endDelimiter - The delimiter to end the command
   * @throws {Error} If the command, startDelimiter, or endDelimiter is not provided
   * @returns The formatted command
   */
  formatCommandWithDelimiters(command: string, startDelimiter: string, endDelimiter: string): string {
    if (!command || !startDelimiter || !endDelimiter) {
      throw new Error(`${INVALID_ARGUMENTS_ERROR}: command, startDelimiter, and endDelimiter are required`);
    }
    return `Write-Output "${startDelimiter}"; ${command}; Write-Output "${endDelimiter}:$LASTEXITCODE"`;
  }
  
  /**
   * Gets the keep-alive command
   * @returns The keep-alive command
   */
  getKeepAliveCommand(): string {
    return 'Write-Output ""\n';
  }

  /**
   * Parses the exit code from the output
   * @param output - The output to parse
   * @param endDelimiter - The delimiter to end the command
   * @throws {Error} If the output or endDelimiter is not provided
   * @returns The exit code
   */
  parseExitCode(output: string, endDelimiter: string): number | null {
    if (!output || !endDelimiter) {
      throw new Error(`${INVALID_ARGUMENTS_ERROR}: output and endDelimiter are required`);
    }
    const pattern = `${endDelimiter}:(\\d+)`;
    const match = output.match(new RegExp(pattern));
    
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    
    return null;
  }

  getShellName(): string {
    return ShellNames.PowerShell;
  }
}

/**
 * Formatter for Windows Command Prompt (cmd.exe)
 */
export class CmdShellFormatter implements ShellFormatter {

  /**
   * Formats a command with delimiters
   * @param command - The command to format
   * @param startDelimiter - The delimiter to start the command
   * @param endDelimiter - The delimiter to end the command
   * @throws {Error} If the command, startDelimiter, or endDelimiter is not provided
   * @returns The formatted command
   */
  formatCommandWithDelimiters(command: string, startDelimiter: string, endDelimiter: string): string {
    if (!command || !startDelimiter || !endDelimiter) {
      throw new Error(`${INVALID_ARGUMENTS_ERROR}: command, startDelimiter, and endDelimiter are required`);
    }

    // %ERRORLEVEL% contains the exit code
    // The echo %ERRORLEVEL% > NUL is to force evaluation of ERRORLEVEL before the final echo
    return `echo ${startDelimiter} & ${command} & echo %ERRORLEVEL% > NUL & echo ${endDelimiter}:%ERRORLEVEL%`;
  }
  
  /**
   * Gets the keep-alive command
   * @returns The keep-alive command
   */
  getKeepAliveCommand(): string {
    return 'echo.\n';
  }

  /**
   * Parses the exit code from the output
   * @param output - The output to parse
   * @param endDelimiter - The delimiter to end the command
   * @throws {Error} If the output or endDelimiter is not provided
   * @returns The exit code
   */
  parseExitCode(output: string, endDelimiter: string): number | null {
    if (!output || !endDelimiter) {
      throw new Error(`${INVALID_ARGUMENTS_ERROR}: output and endDelimiter are required`);
    }
    const pattern = `${endDelimiter}:(\\d+)`;
    const match = output.match(new RegExp(pattern));
    
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    
    return null;
  }

  /**
   * Gets the shell name
   * @returns The shell name
   */
  getShellName(): string {
    return ShellNames.Cmd;
  }
}

/**
 * Factory function to create the appropriate shell formatter
 * @param shellType - The type of shell to create
 * @returns The shell formatter
 */
export function createShellFormatter(shellType: ShellType = ShellNames.Bash): ShellFormatter {
  switch (shellType) {
    case ShellNames.PowerShell:
      return new PowerShellFormatter();
    case ShellNames.Cmd:
      return new CmdShellFormatter();
    case ShellNames.Sh:
      return new BashShellFormatter(ShellNames.Sh);
    case ShellNames.Bash:
    default:
      return new BashShellFormatter(ShellNames.Bash);
  }
}

