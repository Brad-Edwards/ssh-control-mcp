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

**SSHConnectionManager** (src/ssh.ts:395-703)

- Manages connection pooling and reuse across sessions
- Creates and tracks persistent SSH sessions
- Provides both one-off command execution and session-based execution
- Connection key format: `ssh-${username}@${host}:${port}`

**PersistentSession** (src/ssh.ts:75-393)

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

- `ssh.test.ts` - Core SSH session management
- `shells.test.ts` - Shell formatter implementations
- `integration.test.ts` - End-to-end workflows
- `utils.test.ts` - Utility functions

**Unit tests must cover:**

- Happy path scenarios
- Edge cases (empty inputs, boundary conditions, null/undefined)
- Error modes (network failures, timeouts, invalid inputs)
- Resource cleanup (connections, sessions, timeouts)
- Concurrent operations (race conditions, queue ordering)

### Security Requirements

Code must address applicable vulnerabilities from **OWASP Top 10 2021** and **OWASP Top 10 for LLM Applications 2025**.

#### OWASP Top 10 2021 (Relevant to SSH Control)

**A01 - Broken Access Control**:

- Validate session ownership before executing commands
- Enforce principle of least privilege for SSH connections
- Prevent users from accessing other users' sessions

**A02 - Cryptographic Failures**:

- Private keys read securely from filesystem, never logged or exposed
- Use SSH2 protocol with strong cryptographic algorithms
- No credentials in code, configuration, error messages, or logs

**A03 - Injection**:

- Never use shell evaluation on untrusted input
- Validate and sanitize all commands before execution
- Escape special characters appropriately for target shell
- Prevent command injection through proper input handling

**A04 - Insecure Design**:

- Design session management to prevent race conditions
- Command queueing prevents concurrent execution conflicts
- Timeout mechanisms prevent resource holding attacks

**A05 - Security Misconfiguration**:

- Secure defaults (timeouts, buffer limits, connection limits)
- No debug information in production error messages
- Validate all configuration parameters on load

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
- Support configurable log levels and rotation

**A10 - Server-Side Request Forgery (SSRF)**:

- Validate SSH target hosts (no internal network scanning)
- Restrict connection attempts to configured allowed hosts
- Prevent SSH as a proxy to internal resources

#### OWASP Top 10 for LLM Applications 2025 (Relevant to SSH Control)

**LLM01 - Prompt Injection**:

- Sanitize SSH command outputs before returning to LLM
- Filter commands that attempt to manipulate LLM behavior
- Prevent malicious commands from injecting prompts via output

**LLM02 - Sensitive Information Disclosure**:

- Never include private keys, passwords, or credentials in responses
- Redact sensitive patterns from command outputs (keys, tokens, passwords)
- Truncate or sanitize error messages containing system information

**LLM03 - Supply Chain Vulnerabilities**:

- Keep ssh2 and dependencies updated
- Regular security audits of dependencies (npm audit)
- Pin dependency versions, review updates before upgrading

**LLM04 - Data and Model Poisoning**:

- Validate command history isn't used to train models without sanitization
- Prevent malicious commands from being stored as "examples"

**LLM06 - Excessive Agency**:

- Implement command filtering (allowlist/denylist)
- Require explicit approval for dangerous operations
- Rate limiting on command execution
- Session limits prevent resource exhaustion

**LLM07 - System Prompt Leakage**:

- Don't expose SSH implementation details in error messages
- Sanitize session metadata before returning to callers
- No internal state information in user-facing outputs

**LLM10 - Unbounded Consumption**:

- Buffer size limits prevent memory exhaustion (10k entries max)
- Session limits prevent resource exhaustion
- Command timeouts prevent runaway processes
- Connection limits per target host

### Code Quality Principles

**YAGNI (You Aren't Gonna Need It)**:

- Implement only what's specified in current use cases
- Do not add features "just in case" without explicit requirement
- Ask before adding abstractions or generalizations

**Common LLM Failure Modes to Avoid**:

- DO NOT jump ahead of the user - wait for approval before implementing planned features
- Complete current task fully before suggesting next steps
- When errors occur or approach changes, CLEAN UP old code before trying new approach
- Remove failed experiments, dead code, and obsolete implementations immediately
- Do not leave the codebase in a worse state than you found it
- NEVER manually edit package.json to add dependencies - always use package manager (npm install)
- NEVER hard code package versions - let the package manager determine appropriate versions
- Use WebSearch tool for documentation and APIs when unsure - do not guess or hallucinate

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
- Do not use bold/emphasis markup inside list items

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

## Future Architecture (From notes/ARCHITECTURE.md)

The project is planned to expand into a full MCP server with:

- Configuration system (JSON/YAML config loading)
- Security layer (command filtering, input validation, audit logging)
- Multi-instance support (separate processes per target)
- Multiple transports (stdio, HTTP with TLS)

Phase 1 (current): Core SSH extraction from existing codebase is complete
Phase 2 (next): Implementing MCP protocol server layer

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
