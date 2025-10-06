# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`ssh-control-mcp` is a standalone MCP (Model Context Protocol) server that provides SSH session management capabilities. It enables persistent SSH sessions with support for interactive commands, background processes, and multiple concurrent sessions to a single target host.

## Key Commands

### Build and Type Checking

```bash
npm run build              # Compile TypeScript to dist/
npm run typecheck          # Type check without emitting files
```

### Testing

```bash
npm test                   # Run all tests once
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage report
```

### Development Workflow

```bash
npm run typecheck && npm test   # Pre-publish checks
```

## Architecture

### Core Components

**SSHConnectionManager** (src/ssh/manager.ts)

- Manages connection pooling and reuse across sessions
- Creates and tracks persistent SSH sessions
- Provides both one-off command execution and session-based execution
- Connection key format: `ssh-${username}@${host}:${port}`

**PersistentSession** (src/ssh/session.ts)

- Manages individual SSH shell sessions with command queueing
- Two session types: `interactive` (waits for completion) and `background` (queues and buffers output)
- Two session modes: `normal` (uses delimiters to parse output/exit codes) and `raw` (direct terminal access for TUI apps)
- Command execution uses unique delimiters to reliably extract output and exit codes
- Implements keep-alive mechanism and automatic session timeout

**ShellFormatter System** (src/shells.ts)

- Cross-platform shell support: bash, sh, PowerShell, cmd
- Each formatter knows how to:
  - Wrap commands with delimiters and capture exit codes
  - Parse command output and extract exit codes
  - Generate appropriate keep-alive commands
- Critical for multi-platform compatibility

**Configuration System** (src/config/)

- Zod-based schema validation for type-safe configuration
- Default values aligned with current constants
- Modular configuration sections: target, timeouts, buffers, security, logging
- Runtime validation with helpful error messages
- Designed for future config file loading (Phase 3B)

### Session Management Pattern

Sessions maintain state across multiple commands:

- Working directory persistence
- Environment variables
- Command history tracking
- Output buffering (background sessions only)

Command execution flow:

1. Commands are queued (prevents race conditions)
2. For normal mode: wrapped with shell-specific delimiters
3. For raw mode: sent directly without wrapping
4. Output parsed to extract stdout, stderr, exit code
5. Next command processed from queue

### Key Design Decisions

**Connection Pooling**: Connections are reused across sessions to the same target. When a connection closes, it's marked as disconnected but not immediately removed, allowing graceful degradation.

**Delimiter-Based Parsing**: Normal mode uses unique delimiters (`___CMD_${timestamp}_${random}___`) to reliably parse command output and exit codes across different shells. Raw mode bypasses this for TUI applications.

**Background Session Buffering**: Background sessions buffer output with limits (max 10,000 entries, trimmed to 5,000) to prevent memory exhaustion while preserving recent history.

## Development Principles

### Test-Driven Development (TDD)

**All code must be developed test-first.** Write tests before implementation:

1. Write failing test that defines expected behavior
2. Implement minimal code to make test pass
3. Refactor while keeping tests green

### Testing Requirements

Test files are in `tests/`:

- `ssh/session.test.ts` - Core SSH session management
- `ssh/manager.test.ts` - Connection manager and pooling
- `ssh/connection-pool.test.ts` - Connection pool behavior
- `shells.test.ts` - Shell formatter implementations
- `config/schema.test.ts` - Configuration schema validation
- `config/defaults.test.ts` - Default values and merging
- `mcp/server.test.ts` - MCP server lifecycle
- `mcp/tools.test.ts` - MCP tool definitions
- `mcp/handlers.test.ts` - MCP tool handlers
- `integration.test.ts` - End-to-end workflows
- `mcp-integration.test.ts` - MCP protocol integration
- `utils.test.ts` - Utility functions
- `security/audit.test.ts` - Audit logging and sanitization

**Unit tests must cover:**

- Happy path scenarios
- Edge cases (empty inputs, boundary conditions, null/undefined)
- Error modes (network failures, timeouts, invalid inputs)
- Resource cleanup (connections, sessions, timeouts)
- Concurrent operations (race conditions, queue ordering)

### Security Requirements

Code must address applicable vulnerabilities from **OWASP Top 10 2021** and **OWASP Top 10 for LLM Applications 2025**.

#### Security Model

The primary security boundary is **target selection**, not command filtering. The intended use case is providing LLMs unrestricted CLI access to dedicated systems:

- Red team agents driving Kali Linux boxes
- Blue team agents using reverse engineering sandbox VMs
- Security researchers with isolated analysis environments

Command filtering is available but optional. Default configuration allows all commands.

#### OWASP Top 10 2021 (Relevant to SSH Control)

**A01 - Broken Access Control**:

- Validate session ownership before executing commands
- Enforce principle of least privilege through SSH key configuration
- Each MCP instance targets exactly one host with specific credentials

**A02 - Cryptographic Failures**:

- Private keys read securely from filesystem, never logged or exposed
- Use SSH2 protocol with strong cryptographic algorithms
- No credentials in code, configuration, error messages, or logs

**A03 - Injection**:

- Commands executed through SSH shell, not through eval or interpolation
- Delimiter-based output parsing prevents injection attacks
- User controls the target environment, not the MCP server

**A04 - Insecure Design**:

- Design session management to prevent race conditions
- Command queueing prevents concurrent execution conflicts
- Timeout mechanisms prevent resource holding attacks

**A05 - Security Misconfiguration**:

- Secure defaults (timeouts, buffer limits, connection limits)
- Configuration validation via Zod schemas
- No debug information in production error messages

**A07 - Identification and Authentication Failures**:

- Support only key-based SSH authentication (no passwords)
- Validate SSH key file permissions and ownership
- Implement session timeout and automatic cleanup

**A08 - Software and Data Integrity Failures**:

- Verify integrity of SSH keys before use
- Audit trail for all executed commands with timestamps
- Immutable session history tracking

**A09 - Security Logging and Monitoring Failures**:

- Log all session creation, command execution, and cleanup
- Include context: session ID, user, host, timestamp
- Sanitize logs to prevent credential leakage
- Configurable log levels and response truncation

**A10 - Server-Side Request Forgery (SSRF)**:

- Each instance connects to single configured target only
- No dynamic target selection from untrusted input
- Network isolation enforced at deployment level

#### OWASP Top 10 for LLM Applications 2025 (Relevant to SSH Control)

**LLM01 - Prompt Injection**:

- Sanitize SSH command outputs before returning to LLM
- Delimiter-based parsing prevents output manipulation
- Command outputs are data, not instructions

**LLM02 - Sensitive Information Disclosure**:

- Never include private keys, passwords, or credentials in responses
- Optional log sanitization patterns for sensitive data
- Configurable response truncation limits

**LLM03 - Supply Chain Vulnerabilities**:

- Keep ssh2 and dependencies updated
- Regular security audits of dependencies (npm audit)
- Pin dependency versions, review updates before upgrading

**LLM04 - Data and Model Poisoning**:

- Command history tracked but isolated per session
- No automatic model training on command outputs

**LLM06 - Excessive Agency**:

- Optional command filtering (allowlist/denylist) for specific use cases
- Default: unrestricted access (user controls target environment)
- Session limits prevent resource exhaustion

**LLM07 - System Prompt Leakage**:

- Don't expose SSH implementation details in error messages
- Sanitize session metadata before returning to callers
- No internal state information in user-facing outputs

**LLM10 - Unbounded Consumption**:

- Buffer size limits prevent memory exhaustion (10k entries max, configurable)
- Session limits prevent resource exhaustion (configurable)
- Command timeouts prevent runaway processes (configurable)
- Connection limits per target host (configurable)

### Code Quality Principles

**YAGNI (You Aren't Gonna Need It)**:

- Implement only what's specified in current use cases
- Do not add features "just in case" without explicit requirement
- Ask before adding abstractions or generalizations

**Defensive Coding and Input Validation**:

- ALL function parameters must be validated at the beginning of the function
- Throw descriptive errors for invalid inputs (null, undefined, empty strings, out of range, etc.)
- Use constants for error messages (e.g., INVALID_ARGUMENTS_ERROR from src/constants.ts)
- Never assume inputs are valid - validate explicitly
- Check boundary conditions (empty arrays, zero values, negative numbers)
- Validate types match expectations even in TypeScript (runtime validation)
- Test defensive code thoroughly - verify errors are thrown for all invalid input combinations

**JSDoc Documentation Style**:

- ALL exported functions, classes, and methods must have JSDoc comments
- Include description of what the function/class does
- Document all @param with name, type, and description
- Document @returns with type and description
- Document @throws for all error conditions the function can throw
- Include @example with realistic usage when helpful
- Keep JSDoc concise but complete
- Example from src/shells.ts:

```typescript
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
  // implementation
}
```

**Common LLM Failure Modes to Avoid**:

- DO NOT jump ahead of the user - wait for approval before implementing planned features
- Complete current task fully before suggesting next steps
- When errors occur or approach changes, CLEAN UP old code before trying new approach
- Remove failed experiments, dead code, and obsolete implementations immediately
- Do not leave the codebase in a worse state than you found it
- NEVER manually edit package.json to add dependencies - always use package manager (npm install)
- NEVER hard code package versions - let the package manager determine appropriate versions
- Use WebSearch tool for documentation and APIs when unsure - do not guess or hallucinate
- NEVER create timelines, roadmaps, or "next steps" unless part of an approved plan or explicitly requested
- NEVER create faux enterprise processes (review schedules, approval workflows, etc.) - this is an OSS project by a single developer
- Keep documentation factual and minimal - avoid process overhead

**Clean Code**:

- Functions do one thing and do it well
- Self-documenting variable and function names
- Keep functions small (prefer < 20 lines)
- Avoid deep nesting (prefer early returns)

**Design Patterns**:

- Be conscious of Gang of Four patterns when making design choices
- Use patterns to solve real problems, not for pattern's sake
- Prefer simple, direct solutions over complex abstractions

**Simplicity Over Enterprise Complexity**:

- Prefer composition over inheritance
- Avoid unnecessary abstractions
- No speculative generality
- Direct, straightforward implementations over "clever" solutions

### Markdown Style

- Headings must have a blank line after them
- Lists must have a blank line before and after them
- NEVER use bold/emphasis markup (asterisks, underscores) anywhere
- Plain text only for readability in raw markdown

### Documentation Requirements

When features are complete:

- Update CHANGELOG with clear description of changes
- Update CLAUDE.md if architecture or patterns have changed
- Document any new security considerations
- Update usage examples if API changed

Documentation style:

- Audience is developers and technical users
- Terse, information-dense writing - be as short as humanly possible
- NO marketing speak, buzzwords, or promotional language
- Focus on facts, specifications, and concrete examples
- Avoid superlatives and subjective claims

### Git Usage Policy

NEVER use git commands for modifications unless specifically directed:

- Git commands for reading/investigation are allowed (status, log, diff, blame)
- NO commits, pushes, rebases, or any modifying operations
- User will handle all git operations for code changes
- Ask if unsure whether a git operation is read-only

Commit message requirements:

- NEVER include Claude attribution, co-author tags, or AI generation notices
- Keep messages professional and focused on technical changes
- Follow standard commit message format: concise subject, optional detailed body

## Audit Logging

Comprehensive audit logging system for security compliance and forensics.

### Architecture

**AuditLogger** (src/security/audit.ts)

- Winston-based structured logging with daily rotation
- Sanitizes sensitive data (credentials, keys, passphrases)
- JSON format for machine processing
- Configurable log levels and retention

**Sanitization** (src/security/sanitize.ts)

- Redacts private key paths (shows basename only)
- Removes passphrases and passwords from logs
- Pattern-based credential detection (tokens, API keys)
- Configurable regex patterns for custom sanitization
- Truncates long outputs to prevent log bloat

### Event Types

- SESSION_CREATED: Session initialization with metadata
- SESSION_CLOSED: Session termination with reason
- COMMAND_EXECUTED: Command execution with exit code and duration
- CONNECTION_ESTABLISHED: SSH connection success
- CONNECTION_FAILED: SSH connection failure with error
- ERROR_OCCURRED: Error events with context

### Security Compliance

Addresses OWASP security requirements:

- A09 (Security Logging): All operations logged with context
- A02 (Cryptographic Failures): No credentials in logs
- A08 (Data Integrity): Immutable audit trail with timestamps
- LLM02 (Information Disclosure): Sanitized command outputs

### Log Format

```json
{
  "timestamp": "2025-10-05T18:00:00.000Z",
  "level": "info",
  "event": "COMMAND_EXECUTED",
  "sessionId": "session-123",
  "target": "kali.local:22",
  "username": "root",
  "command": "ls -la",
  "exitCode": 0,
  "duration": 150
}
```

### Configuration

Audit logging enabled by default, configured in logging.audit section:

```typescript
{
  logging: {
    audit: {
      enabled: true,
      filePath: './logs/audit.log',
      maxFiles: '30d',  // 30 day retention
      maxSize: '20m',   // Rotate at 20MB
      sanitizePatterns: [] // Custom regex patterns
    }
  }
}
```

### Usage

Audit logging is automatic when SSHConnectionManager is created with config:

```typescript
import { SSHConnectionManager } from './ssh/manager.js';
import { loadConfig } from './config/loader.js';

const config = await loadConfig();
const manager = new SSHConnectionManager(config);

// All operations are automatically logged to audit trail
await manager.createSession(/*...*/);  // Logged
await manager.executeCommand(/*...*/); // Logged
await manager.closeSession(/*...*/);   // Logged
```

## Configuration System

The configuration system provides type-safe, validated configuration for MCP server instances.

### Configuration Schema

Configuration is defined using Zod schemas in `src/config/schema.ts`:

```typescript
import { ServerConfigSchema, type ServerConfig } from './config/schema.js';

// Validate configuration
const result = ServerConfigSchema.safeParse(config);
if (!result.success) {
  // Handle validation errors
}
```

### Configuration Sections

**target** (required): SSH target connection parameters

- `host`: Target hostname or IP
- `port`: SSH port (1-65535)
- `username`: SSH username
- `privateKeyPath`: Path to SSH private key file
- `passphrase`: Optional key passphrase
- `shell`: Shell type (bash, sh, powershell, cmd) - defaults to bash

**timeouts** (optional): Timeout values in milliseconds

- `command`: Command execution timeout (default: 30000ms)
- `session`: Session inactivity timeout (default: 600000ms)
- `connection`: SSH connection timeout (default: 30000ms)
- `keepAlive`: Keep-alive interval (default: 30000ms)

**buffers** (optional): Output buffer limits for background sessions

- `maxSize`: Maximum buffer entries (default: 10000)
- `trimTo`: Size to trim to when max exceeded (default: 5000)

**security** (optional): Security and resource limits

- `allowedCommands`: Regex whitelist (default: undefined = allow all)
- `blockedCommands`: Regex blacklist (default: [] = block none)
- `maxSessions`: Max concurrent sessions (default: 10)
- `sessionTimeout`: Session timeout in ms (default: 600000ms)
- `maxConnectionsPerHost`: Max connections per host (default: 10)

**logging** (optional): Logging configuration

- `level`: Log level (debug, info, warn, error) - default: info
- `includeCommands`: Log executed commands (default: true)
- `includeResponses`: Log command responses (default: false)
- `maxResponseLength`: Truncate logged responses (default: 1000)
- `audit`: Audit logging configuration (default: enabled)
  - `enabled`: Enable audit trail (default: true)
  - `filePath`: Path to audit log file (default: ./logs/audit.log)
  - `maxFiles`: Retention period (default: 30d for 30 days)
  - `maxSize`: Max file size before rotation (default: 20m)
  - `sanitizePatterns`: Custom regex patterns for sanitization (default: [])

### Default Values

Default values are defined in `src/config/defaults.ts` and align with existing constants:

```typescript
import { createDefaultConfig, mergeWithDefaults } from './config/defaults.js';

// Create config with all defaults
const config = createDefaultConfig('my-instance', {
  host: 'kali.local',
  port: 22,
  username: 'root',
  privateKeyPath: '/keys/kali_rsa',
});

// Merge partial config with defaults
const merged = mergeWithDefaults(partialConfig);
```

### Validation Rules

- Ports: 1-65535
- Timeouts: 1-3600000ms (1ms to 1hr)
- Buffer sizes: 1-100000 entries
- Session limits: 1-100 sessions
- Regex patterns: Must compile without errors
- Buffer trimTo must be <= maxSize
- All required fields validated for non-empty strings

### Configuration Usage

Configuration is loaded automatically from `./config/default.json`:

```typescript
import { loadConfig } from './config/loader.js';

// Loads from ./config/default.json
const config = await loadConfig();
const manager = new SSHConnectionManager(config);
```

### Server Entry Point

The server loads configuration and starts automatically:

```typescript
// src/server.ts
const config = await loadConfig();
const server = createServer(config);
await startServer(server, { registerSignalHandlers: true });
```

### Configuration Files

Each MCP server instance has its own config directory:

```
my-mcp-instance/
  config/
    default.json          # Active configuration
    default.json.example  # Template
    README.md             # Configuration documentation
  node_modules/
  dist/
  package.json
```

Copy `default.json.example` to `default.json` and customize for your SSH target.

## Future Architecture (From notes/ARCHITECTURE.md)

The project is planned to expand into a full MCP server with:

- Multi-instance support (separate processes per target) - Phase 4
- Multiple transports (stdio, HTTP with TLS) - Phase 6
- Environment variable expansion for secrets - Future

Phase 1: Core SSH extraction - Complete
Phase 2: MCP protocol server - Complete
Phase 3A: Configuration schema - Complete
Phase 3B: Config file loading - Complete
Phase 4: Multi-instance management - Next

## Important Implementation Notes

**Shell-Specific Exit Code Handling**:

- Bash/sh: Uses `$?` for exit code
- PowerShell: Uses `$LASTEXITCODE`
- CMD: Uses `%ERRORLEVEL%` with careful handling to capture immediately after command

**Timeout Handling**:

- Commands have individual timeouts (default 30s)
- Sessions have inactivity timeouts (default 10m)
- Connection timeouts during establishment (30s)
- Keep-alive packets sent every 30s when idle

**Error Patterns**:

- All errors thrown as `SSHError` with optional cause chain
- Timeouts result in rejection with descriptive message
- Session cleanup happens on close, error, or timeout events

## Common Patterns

### Creating and Using a Session

```typescript
// Create manager
const manager = new SSHConnectionManager();

// Create session
const session = await manager.createSession(
  'session-id',
  'hostname',
  'username',
  'interactive',  // or 'background'
  '/path/to/key',
  22,            // port
  'normal',      // or 'raw'
  600000,        // timeout ms
  'bash'         // shell type
);

// Execute commands
const result = await session.executeCommand('ls -la', 30000);

// Close when done
await manager.closeSession('session-id');
```

### One-off Command Execution

```typescript
const result = await manager.executeCommand(
  'hostname',
  'username',
  '/path/to/key',
  'echo "hello"',
  22,      // port
  30000    // timeout
);
```

## TypeScript Configuration

- Target: ES2022
- Module: NodeNext (ESM)
- Strict mode enabled
- Source maps and declarations generated
- Output directory: `dist/`
