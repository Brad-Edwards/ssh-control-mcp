# Configuration Directory

This directory contains the configuration for this SSH Control MCP server instance.

## Setup

1. Copy `default.json.example` to `default.json`:
   ```bash
   cp default.json.example default.json
   ```

2. Edit `default.json` with your SSH target information:
   - Update `target.host` with your SSH server hostname or IP
   - Update `target.username` with your SSH username
   - Update `target.privateKeyPath` with the path to your SSH private key
   - Adjust other settings as needed

## Configuration Sections

### Required Fields

**name**: Unique identifier for this MCP instance
**target.host**: SSH server hostname or IP address
**target.port**: SSH port (typically 22)
**target.username**: SSH username
**target.privateKeyPath**: Absolute path to SSH private key file

### Optional Fields

All other fields have sensible defaults and can be omitted.

**target.passphrase**: SSH key passphrase (if encrypted)
**target.shell**: Shell type (bash, sh, powershell, cmd) - defaults to bash

**timeouts** (all in milliseconds):
- command: Command execution timeout (default: 30000)
- session: Session inactivity timeout (default: 600000)
- connection: SSH connection timeout (default: 30000)
- keepAlive: Keep-alive interval (default: 30000)

**buffers** (for background sessions):
- maxSize: Maximum buffer entries (default: 10000)
- trimTo: Size to trim to when max exceeded (default: 5000)

**security**:
- allowedCommands: Regex whitelist (default: null = allow all)
- blockedCommands: Regex blacklist (default: [] = block none)
- maxSessions: Max concurrent sessions (default: 10)
- sessionTimeout: Session timeout in ms (default: 600000)
- maxConnectionsPerHost: Max connections per host (default: 10)

**logging**:
- level: Log level (debug, info, warn, error) - default: info
- includeCommands: Log executed commands (default: true)
- includeResponses: Log command responses (default: false)
- maxResponseLength: Truncate logged responses (default: 1000)

## Security Model

Each MCP server instance is completely independent. The security boundary is which SSH target this instance can access, not which commands can be executed.

Default configuration allows unrestricted command access - suitable for:
- Red team agents on Kali Linux boxes
- Blue team agents on reverse engineering sandboxes
- Security research on isolated VMs

Command filtering (allowedCommands/blockedCommands) is available but optional for specialized use cases.

## Multiple Instances

To run multiple MCP servers for different targets, create separate installations:

```
/home/user/mcp-servers/
  kali-mcp/
    config/default.json    # Kali box config
  sandbox-mcp/
    config/default.json    # Sandbox VM config
  prod-mcp/
    config/default.json    # Production server config
```

Each instance loads its own `config/default.json` independently.
