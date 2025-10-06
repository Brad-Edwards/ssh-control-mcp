import { INVALID_ARGUMENTS_ERROR, NULL_OR_UNDEFINED_ARGUMENTS_ERROR } from '../constants.js';
import * as path from 'path';

/**
 * Default regex patterns for detecting sensitive information
 */
const DEFAULT_SENSITIVE_PATTERNS = [
  // Password patterns
  /(-p|--password|password=|pwd=)\s*\S+/gi,
  // Token patterns
  /(Bearer|Token|Authorization:)\s+\S+/gi,
  // API key patterns
  /(api[_-]?key|apikey)[\s=:]+\S+/gi,
  // AWS keys
  /(aws[_-]?access[_-]?key[_-]?id|aws[_-]?secret[_-]?access[_-]?key)[\s=:]+\S+/gi,
  // Generic secret patterns
  /(secret|private[_-]?key|passphrase)[\s=:]+\S+/gi,
];

/**
 * Sanitizes a private key path to show only the basename
 * @param keyPath - The full path to the private key
 * @returns The basename of the key file
 * @throws {Error} If keyPath is null, undefined, or empty
 */
export function sanitizePrivateKeyPath(keyPath: string): string {
  if (keyPath == null) {
    throw new Error(NULL_OR_UNDEFINED_ARGUMENTS_ERROR);
  }
  if (keyPath === '') {
    throw new Error(`${INVALID_ARGUMENTS_ERROR}: keyPath cannot be empty`);
  }

  return path.basename(keyPath);
}

/**
 * Redacts a passphrase or password
 * @param passphrase - The passphrase to redact
 * @returns Redacted string
 * @throws {Error} If passphrase is null or undefined
 */
export function sanitizePassphrase(passphrase: string | undefined): string {
  if (passphrase == null) {
    return '';
  }
  if (passphrase === '') {
    return '';
  }

  return '[REDACTED]';
}

/**
 * Sanitizes a command string by detecting and redacting sensitive information
 * @param command - The command to sanitize
 * @param customPatterns - Optional array of custom regex patterns to match
 * @returns The sanitized command string
 * @throws {Error} If command is null, undefined, or empty
 */
export function sanitizeCommand(command: string, customPatterns?: string[]): string {
  if (command == null) {
    throw new Error(NULL_OR_UNDEFINED_ARGUMENTS_ERROR);
  }
  if (command === '') {
    throw new Error(`${INVALID_ARGUMENTS_ERROR}: command cannot be empty`);
  }

  let sanitized = command;

  for (const pattern of DEFAULT_SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      const parts = match.split(/[\s=:]+/);
      if (parts.length > 1) {
        return `${parts[0]}=[REDACTED]`;
      }
      return '[REDACTED]';
    });
  }

  if (customPatterns) {
    if (!Array.isArray(customPatterns)) {
      throw new Error(`${INVALID_ARGUMENTS_ERROR}: customPatterns must be an array`);
    }

    for (const patternStr of customPatterns) {
      if (typeof patternStr !== 'string' || patternStr === '') {
        continue;
      }

      try {
        const pattern = new RegExp(patternStr, 'gi');
        sanitized = sanitized.replace(pattern, '[REDACTED]');
      } catch (err) {
        // Skip invalid regex patterns
        continue;
      }
    }
  }

  return sanitized;
}

/**
 * Sanitizes command output by truncating to max length
 * @param output - The output to sanitize
 * @param maxLength - Maximum length of output (default: 1000)
 * @returns The sanitized output
 * @throws {Error} If output is null or undefined
 */
export function sanitizeOutput(output: string, maxLength: number = 1000): string {
  if (output == null) {
    throw new Error(NULL_OR_UNDEFINED_ARGUMENTS_ERROR);
  }
  if (maxLength <= 0) {
    throw new Error(`${INVALID_ARGUMENTS_ERROR}: maxLength must be positive`);
  }

  if (output.length <= maxLength) {
    return output;
  }

  return output.substring(0, maxLength) + '... [truncated]';
}

/**
 * Sanitizes an entire event data object by redacting sensitive fields
 * @param data - The event data to sanitize
 * @param includeCommands - Whether to include commands in the sanitized output
 * @param includeResponses - Whether to include responses in the sanitized output
 * @param maxResponseLength - Maximum length for response fields
 * @param customPatterns - Custom regex patterns for command sanitization
 * @returns The sanitized event data
 * @throws {Error} If data is null or undefined
 */
export function sanitizeEventData(
  data: Record<string, any>,
  includeCommands: boolean = true,
  includeResponses: boolean = false,
  maxResponseLength: number = 1000,
  customPatterns?: string[]
): Record<string, any> {
  if (data == null) {
    throw new Error(NULL_OR_UNDEFINED_ARGUMENTS_ERROR);
  }

  const sanitized: Record<string, any> = { ...data };

  if (sanitized.privateKeyPath) {
    sanitized.privateKeyPath = sanitizePrivateKeyPath(sanitized.privateKeyPath);
  }

  if (sanitized.passphrase) {
    sanitized.passphrase = sanitizePassphrase(sanitized.passphrase);
  }

  if (sanitized.command) {
    if (includeCommands) {
      sanitized.command = sanitizeCommand(sanitized.command, customPatterns);
    } else {
      delete sanitized.command;
    }
  }

  if (!includeResponses) {
    delete sanitized.stdout;
    delete sanitized.stderr;
    delete sanitized.output;
  } else {
    if (sanitized.stdout) {
      sanitized.stdout = sanitizeOutput(sanitized.stdout, maxResponseLength);
    }
    if (sanitized.stderr) {
      sanitized.stderr = sanitizeOutput(sanitized.stderr, maxResponseLength);
    }
    if (sanitized.output) {
      sanitized.output = sanitizeOutput(sanitized.output, maxResponseLength);
    }
  }

  return sanitized;
}
