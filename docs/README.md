# ssh-control-mcp

MCP server for persistent SSH session management.

## Features

- Execute commands on remote hosts via SSH
- Maintain persistent shell sessions with working directory and environment persistence
- Support for interactive and background sessions
- Cross-platform shell support (bash, sh, PowerShell, cmd)
- Audit logging of all SSH operations
- Configurable command filtering and security controls

## Installation

```bash
npm install -g ssh-control-mcp
```

Or run directly:

```bash
npx ssh-control-mcp
```

## Configuration

Create a configuration file at `config/default.json`:

```json
{
  "name": "my-ssh-server",
  "target": {
    "host": "kali.local",
    "port": 22,
    "username": "root",
    "privateKeyPath": "/path/to/ssh/key",
    "shell": "bash"
  }
}
```

See [config/default.json.example](../config/default.json.example) for all available options.

### Required Configuration

- `name`: Instance name
- `target.host`: SSH host to connect to
- `target.port`: SSH port (typically 22)
- `target.username`: SSH username
- `target.privateKeyPath`: Path to SSH private key file
- `target.shell`: Shell type (bash, sh, powershell, cmd)

### Optional Configuration

- `timeouts`: Command, session, connection, and keep-alive timeouts
- `buffers`: Output buffer limits for background sessions
- `security`: Command filtering, session limits, connection limits
- `logging`: Log level, audit trail configuration

See [src/config/schema.ts](../src/config/schema.ts) for complete schema.

## Usage with MCP Clients

### Claude Desktop

Add to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ssh-control": {
      "command": "npx",
      "args": ["-y", "ssh-control-mcp"]
    }
  }
}
```

### Other MCP Clients

The server uses stdio transport. Start it with:

```bash
ssh-control-mcp
```

## Available Tools

The server provides six tools for SSH operations:

### ssh_execute

Execute a single command without creating a session.

### ssh_session_create

Create a persistent SSH session. Sessions maintain working directory and environment variables across commands.

Parameters:
- `sessionId`: Unique identifier for this session
- `type`: "interactive" or "background"
- `mode`: "normal" or "raw" (raw mode for TUI applications)

### ssh_session_execute

Execute a command in an existing session.

Parameters:
- `sessionId`: Session to execute in
- `command`: Command to run

### ssh_session_list

List all active sessions with metadata.

### ssh_session_close

Close a specific session and clean up resources.

Parameters:
- `sessionId`: Session to close

### ssh_session_output

Get buffered output from a background session.

Parameters:
- `sessionId`: Session to retrieve output from
- `lines`: Number of lines to retrieve (optional)

## Security Model

Each MCP server instance connects to a single configured SSH target. The security boundary is target selection, not command filtering.

Designed for LLM access to dedicated systems:
- Red team agents with Kali Linux boxes
- Blue team agents with analysis VMs
- Security researchers with isolated environments

Optional command filtering is available via configuration.

## Audit Logging

All SSH operations are logged to `./logs/audit.log` by default. Logs include:
- Session creation and closure
- Command execution with exit codes
- Connection events
- Errors

Credentials are automatically sanitized from logs.

## Development

See [../README.md](../README.md) for development information.

## License

ISC
