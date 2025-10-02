// Export the working SSH implementation
export {
  SSHConnectionManager,
  PersistentSession,
  SSHError,
  CommandResult,
  SessionType,
  SessionMode,
  SessionMetadata,
  CommandRequest
} from './ssh.js';

// Export shell support
export {
  ShellType,
  ShellFormatter,
  createShellFormatter
} from './shells.js';

// Export utilities
export { expandTilde } from './utils.js';

// Export MCP server
export { createServer, startServer } from './mcp/server.js';