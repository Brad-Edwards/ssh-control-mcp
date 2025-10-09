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
- Comprehensive audit logging for security compliance
- Type-safe configuration with Zod validation

## Installation

```bash
npm install ssh-control-mcp
```

## Quick Start

### As MCP Server

Configure in Claude Desktop or other MCP client:

```json
{
  "mcpServers": {
    "ssh-control": {
      "command": "npx",
      "args": ["ssh-control-mcp"],
      "env": {}
    }
  }
}
```

Create `config/default.json`:

```json
{
  "target": {
    "host": "your-host.example.com",
    "port": 22,
    "username": "your-username",
    "privateKeyPath": "/path/to/ssh/key",
    "shell": "bash"
  }
}
```

See [config/default.json.example](config/default.json.example) for all configuration options.

### Programmatic Usage

```typescript
import { SSHConnectionManager } from 'ssh-control-mcp';
import { loadConfig } from 'ssh-control-mcp/config/loader';

// Load configuration
const config = await loadConfig();
const manager = new SSHConnectionManager(config);

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
console.log(result.stdout);

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

## MCP Tools

The server provides these MCP tools:

- `ssh_create_session`: Create persistent SSH session (interactive or background)
- `ssh_execute_command`: Execute command in existing session
- `ssh_list_sessions`: List all active sessions
- `ssh_close_session`: Close specific session
- `ssh_get_buffered_output`: Retrieve buffered output from background session

## Architecture

- SSHConnectionManager: Connection pooling and session lifecycle management
- PersistentSession: Individual shell sessions with command queueing
- ShellFormatter: Cross-platform shell compatibility layer
- Configuration System: Type-safe config with Zod validation
- Audit Logger: Security compliance logging with Winston

Sessions use delimiter-based parsing for reliable output capture and exit code extraction. Background sessions buffer output with limits to prevent memory exhaustion.

## Security

- Key-based SSH authentication only
- Command input validation and sanitization
- Session isolation and access control
- Comprehensive audit logging for all operations
- Configurable timeouts and resource limits
- OWASP Top 10 2021 compliance
- OWASP Top 10 for LLM Applications 2025 compliance

See [CLAUDE.md](CLAUDE.md) for detailed security model and implementation.

## License

MIT - see [LICENSE](LICENSE)
