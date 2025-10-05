# ssh-control-mcp

MCP server for persistent SSH session management. Enables interactive commands, background processes, and multiple concurrent sessions to a single target host.

## Features

- Persistent SSH sessions with working directory and environment persistence
- Interactive and background session types
- Support for TUI applications via raw mode
- Connection pooling and reuse
- Cross-platform shell support (bash, sh, PowerShell, cmd)
- Command queueing prevents race conditions
- Automatic session cleanup and timeout management

## Installation

```bash
npm install
npm run build
```

## Usage

```typescript
import { SSHConnectionManager } from 'ssh-control-mcp';

const manager = new SSHConnectionManager();

// Create persistent session
const session = await manager.createSession(
  'session-id',
  'hostname',
  'username',
  'interactive',
  '/path/to/key',
  22,
  'normal',
  600000,
  'bash'
);

// Execute commands
const result = await session.executeCommand('ls -la', 30000);

// Close session
await manager.closeSession('session-id');
```

## Development

```bash
npm run typecheck          # Type check
npm test                   # Run tests
npm run test:coverage      # Coverage report
npm run build              # Compile TypeScript
```

## Architecture

- SSHConnectionManager: Connection pooling and session lifecycle management
- PersistentSession: Individual shell sessions with command queueing
- ShellFormatter: Cross-platform shell compatibility layer

Sessions use delimiter-based parsing for reliable output capture and exit code extraction. Background sessions buffer output with limits to prevent memory exhaustion.

## Security

- Key-based SSH authentication only
- Command input validation and sanitization
- Session isolation and access control
- Audit logging for all operations
- Configurable timeouts and resource limits
