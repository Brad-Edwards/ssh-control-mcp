#!/usr/bin/env node

/**
 * SSH Control MCP Server Entry Point
 *
 * This file is the main entry point for running the MCP server.
 * It loads configuration from ./config/default.json and starts the server.
 */

import { loadConfig } from './config/loader.js';
import { createServer, startServer } from './mcp/server.js';

async function main() {
  try {
    // Load configuration from ./config/default.json
    const config = await loadConfig();

    // Create and start MCP server
    const server = createServer(config);
    await startServer(server, { registerSignalHandlers: true });

    console.error(`SSH Control MCP server started for ${config.target.host}`);
  } catch (error) {
    console.error('Failed to start MCP server:', (error as Error).message);
    process.exit(1);
  }
}

main();
