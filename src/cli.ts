#!/usr/bin/env node

/**
 * Command-line interface for SSH Control MCP Server
 *
 * Provides CLI argument parsing, config file loading, and config override
 * functionality for starting the MCP server.
 */

import { loadConfig } from './config/loader.js';
import { createServer, startServer } from './mcp/server.js';
import type { ServerConfig } from './config/schema.js';
import { INVALID_ARGUMENTS_ERROR, NULL_OR_UNDEFINED_ARGUMENTS_ERROR } from './constants.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Parsed CLI arguments
 */
export interface CliArgs {
  configPath?: string;
  host?: string;
  port?: number;
  username?: string;
  privateKeyPath?: string;
  passphrase?: string;
  shell?: 'bash' | 'sh' | 'powershell' | 'cmd';
  help?: boolean;
  version?: boolean;
}

/**
 * Parse command-line arguments
 *
 * @param args - The command-line arguments to parse (typically process.argv.slice(2))
 * @returns Parsed CLI arguments
 * @throws {Error} If arguments are invalid, missing values, or out of range
 *
 * @example
 * ```typescript
 * const args = parseCliArgs(['--host', 'example.com', '--port', '2222']);
 * console.log(args.host); // 'example.com'
 * console.log(args.port); // 2222
 * ```
 */
export function parseCliArgs(args: string[]): CliArgs {
  if (!args) {
    throw new Error(`${NULL_OR_UNDEFINED_ARGUMENTS_ERROR}: args is required`);
  }

  const result: CliArgs = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
      i++;
      continue;
    }

    if (arg === '--version' || arg === '-v') {
      result.version = true;
      i++;
      continue;
    }

    // Check if this is a recognized argument that requires a value
    const knownArgs = ['--config', '-c', '--host', '--port', '--username', '--key', '--passphrase', '--shell'];
    if (!knownArgs.includes(arg)) {
      throw new Error(`${INVALID_ARGUMENTS_ERROR}: unknown argument: ${arg}`);
    }

    if (i + 1 >= args.length) {
      throw new Error(`${INVALID_ARGUMENTS_ERROR}: ${arg} requires a value`);
    }

    const value = args[i + 1];

    if (arg === '--config' || arg === '-c') {
      if (!value || value.trim() === '') {
        throw new Error(`${INVALID_ARGUMENTS_ERROR}: config path cannot be empty`);
      }
      result.configPath = value;
      i += 2;
    } else if (arg === '--host') {
      if (!value || value.trim() === '') {
        throw new Error(`${INVALID_ARGUMENTS_ERROR}: host cannot be empty`);
      }
      result.host = value;
      i += 2;
    } else if (arg === '--port') {
      const port = parseInt(value, 10);
      if (isNaN(port)) {
        throw new Error(`${INVALID_ARGUMENTS_ERROR}: port must be a number`);
      }
      if (port < 1 || port > 65535) {
        throw new Error(`${INVALID_ARGUMENTS_ERROR}: port must be between 1 and 65535`);
      }
      result.port = port;
      i += 2;
    } else if (arg === '--username') {
      if (!value || value.trim() === '') {
        throw new Error(`${INVALID_ARGUMENTS_ERROR}: username cannot be empty`);
      }
      result.username = value;
      i += 2;
    } else if (arg === '--key') {
      if (!value || value.trim() === '') {
        throw new Error(`${INVALID_ARGUMENTS_ERROR}: key path cannot be empty`);
      }
      result.privateKeyPath = value;
      i += 2;
    } else if (arg === '--passphrase') {
      result.passphrase = value;
      i += 2;
    } else if (arg === '--shell') {
      if (!['bash', 'sh', 'powershell', 'cmd'].includes(value)) {
        throw new Error(`${INVALID_ARGUMENTS_ERROR}: shell must be one of: bash, sh, powershell, cmd`);
      }
      result.shell = value as 'bash' | 'sh' | 'powershell' | 'cmd';
      i += 2;
    }
  }

  return result;
}

/**
 * Merge configuration with CLI arguments
 *
 * CLI arguments take precedence over configuration file values.
 *
 * @param config - The base configuration loaded from file
 * @param args - The parsed CLI arguments
 * @returns Configuration with CLI overrides applied
 * @throws {Error} If config or args are null or undefined
 *
 * @example
 * ```typescript
 * const config = await loadConfig();
 * const args = parseCliArgs(process.argv.slice(2));
 * const merged = mergeConfigWithArgs(config, args);
 * ```
 */
export function mergeConfigWithArgs(config: ServerConfig, args: CliArgs): ServerConfig {
  if (!config) {
    throw new Error(`${NULL_OR_UNDEFINED_ARGUMENTS_ERROR}: config is required`);
  }
  if (!args) {
    throw new Error(`${NULL_OR_UNDEFINED_ARGUMENTS_ERROR}: args is required`);
  }

  const merged = { ...config };

  if (args.host !== undefined) {
    merged.target = { ...merged.target, host: args.host };
  }
  if (args.port !== undefined) {
    merged.target = { ...merged.target, port: args.port };
  }
  if (args.username !== undefined) {
    merged.target = { ...merged.target, username: args.username };
  }
  if (args.privateKeyPath !== undefined) {
    merged.target = { ...merged.target, privateKeyPath: args.privateKeyPath };
  }
  if (args.passphrase !== undefined) {
    merged.target = { ...merged.target, passphrase: args.passphrase };
  }
  if (args.shell !== undefined) {
    merged.target = { ...merged.target, shell: args.shell };
  }

  return merged;
}

/**
 * Display help message
 */
function showHelp(): void {
  console.log(`
SSH Control MCP Server

Usage: ssh-control-mcp [options]

Options:
  -c, --config <path>       Path to configuration file (default: ./config/default.json)
  --host <host>             Override target host
  --port <port>             Override target port (1-65535)
  --username <username>     Override SSH username
  --key <path>              Override SSH private key path
  --passphrase <phrase>     Override SSH key passphrase
  --shell <type>            Override shell type (bash|sh|powershell|cmd)
  -h, --help                Show this help message
  -v, --version             Show version number

Examples:
  ssh-control-mcp
  ssh-control-mcp --config ./my-config.json
  ssh-control-mcp --host example.com --port 2222 --username admin
  ssh-control-mcp -c ./config.json --key /path/to/key
`);
}

/**
 * Display version information
 */
async function showVersion(): Promise<void> {
  const packageJsonPath = new URL('../package.json', import.meta.url);
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
  console.log(packageJson.version);
}

/**
 * Load configuration from file path
 *
 * @param configPath - Path to configuration file
 * @returns Loaded and validated configuration
 * @throws {Error} If config file cannot be read or is invalid
 */
async function loadConfigFromPath(configPath: string): Promise<ServerConfig> {
  if (!configPath || configPath.trim() === '') {
    throw new Error(`${INVALID_ARGUMENTS_ERROR}: config path cannot be empty`);
  }

  const absolutePath = path.resolve(configPath);
  let raw: string;

  try {
    raw = await fs.readFile(absolutePath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Configuration file not found: ${absolutePath}`);
    }
    throw new Error(`Failed to read configuration file: ${(error as Error).message}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in configuration file: ${(error as Error).message}`);
  }

  const { ServerConfigSchema } = await import('./config/schema.js');
  const { mergeWithDefaults } = await import('./config/defaults.js');

  const result = ServerConfigSchema.safeParse(json);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Configuration validation failed: ${errors}`);
  }

  return mergeWithDefaults(result.data);
}

/**
 * Start the CLI application
 *
 * Parses arguments, loads configuration, and starts the MCP server.
 *
 * @param argv - Command-line arguments (typically process.argv.slice(2))
 * @throws {Error} If startup fails
 *
 * @example
 * ```typescript
 * await startCli(process.argv.slice(2));
 * ```
 */
export async function startCli(argv: string[]): Promise<void> {
  if (!argv) {
    throw new Error(`${NULL_OR_UNDEFINED_ARGUMENTS_ERROR}: argv is required`);
  }

  try {
    const args = parseCliArgs(argv);

    if (args.help) {
      showHelp();
      return;
    }

    if (args.version) {
      await showVersion();
      return;
    }

    let config: ServerConfig;
    if (args.configPath) {
      config = await loadConfigFromPath(args.configPath);
    } else {
      config = await loadConfig();
    }

    const mergedConfig = mergeConfigWithArgs(config, args);

    const server = createServer(mergedConfig);
    await startServer(server, { registerSignalHandlers: true });

    console.error(`SSH Control MCP server started for ${mergedConfig.target.host}`);
  } catch (error) {
    console.error('Failed to start MCP server:', (error as Error).message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startCli(process.argv.slice(2));
}
