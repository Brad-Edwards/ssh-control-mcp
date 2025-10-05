import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ServerConfigSchema, type ServerConfig } from './schema.js';
import { mergeWithDefaults } from './defaults.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load and validate configuration from ./config/default.json
 *
 * The configuration file is located relative to the package root directory.
 * Each MCP server instance should have its own config/default.json file.
 *
 * @returns A validated and complete server configuration with defaults applied
 * @throws {Error} If the config file is not found
 * @throws {Error} If the config file contains invalid JSON
 * @throws {Error} If the config fails schema validation
 *
 * @example
 * ```typescript
 * const config = await loadConfig();
 * const manager = new SSHConnectionManager(config);
 * ```
 */
export async function loadConfig(): Promise<ServerConfig> {
  const configPath = path.join(__dirname, '../../config/default.json');

  let raw: string;
  try {
    raw = await fs.readFile(configPath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    throw new Error(`Failed to read configuration file: ${(error as Error).message}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in configuration file: ${(error as Error).message}`);
  }

  const result = ServerConfigSchema.safeParse(json);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Configuration validation failed: ${errors}`);
  }

  return mergeWithDefaults(result.data);
}
