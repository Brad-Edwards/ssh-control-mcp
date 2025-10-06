# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [0.1.7] - 2025-10-05

### Added

- Comprehensive audit logging system with Winston
- Automatic credential sanitization (private keys, passphrases, tokens, API keys)
- Structured JSON logs with daily rotation (30-day retention, 20MB files)
- Six audit event types: SESSION_CREATED, SESSION_CLOSED, COMMAND_EXECUTED, CONNECTION_ESTABLISHED, CONNECTION_FAILED, ERROR_OCCURRED
- Configurable log levels with optional console output in debug mode
- Custom sanitization patterns via configuration

## [0.1.6] - 2025-10-05

### Added

- Command-line interface with argument parsing
- Config file path override via --config flag
- Runtime config overrides for host, port, username, key, passphrase, shell
- Help and version flags
- Executable binary via package.json bin field

## [0.1.5] - 2025-10-05

### Added

- Configuration schema with Zod validation
- Configuration file loading from ./config/default.json
- Default configuration values aligned with existing constants
- Server entry point with automatic config loading
- Configuration documentation and examples

### Changed

- SSHConnectionManager accepts optional ServerConfig parameter
- createServer accepts optional ServerConfig parameter

### Security

- Explicit configuration required (fails if config/default.json missing)
- Unrestricted command access by default (red/blue team security model)
- Optional command filtering via allowedCommands/blockedCommands regex
- Physical instance isolation enforces security boundary

## [0.1.4] - 2025-10-05

### Added

- MCP integration test suite
- End-to-end request/response flow tests for all 6 MCP tools
- MCP protocol compliance validation (response structure, JSON serialization)
- Error propagation tests across MCP and SSH layers
- Zod validation error handling tests
- Edge case tests (empty output, large output, special characters)

## [0.1.3] - 2025-10-04

### Added

- MCP tool definitions for all 6 SSH operations
- Tool request handlers with Zod schema validation
- ssh_execute: one-off command execution without persistent session
- ssh_session_create: create persistent SSH sessions (interactive/background)
- ssh_session_execute: execute commands in existing sessions
- ssh_session_list: list all active sessions with metadata
- ssh_session_close: close and cleanup sessions
- ssh_session_output: retrieve buffered output (max 50,000 lines per request)
- Comprehensive test coverage for tools and handlers

### Security

- Input validation via Zod schemas for all MCP tool parameters
- Output line limit (50,000) prevents memory exhaustion from accidental large requests
- Session metadata filtering excludes sensitive data (environmentVars, commandHistory, workingDirectory)
- Port range validation (1-65535) and timeout constraints

## [0.1.2] - 2025-10-01

### Added

- MCP server initialization with stdio transport
- Tool registration framework (ready for tool definitions)
- Integration with @modelcontextprotocol/sdk v1.18.x
- Comprehensive MCP server test suite
- Error handling for transport connection failures
- JSDoc documentation for all MCP server functions
- - Graceful shutdown support via stopServer() function
- Signal handlers for SIGTERM and SIGINT (optional, via startServer options)
- StartServerOptions interface for configuration
- Comprehensive tests for shutdown lifecycle (26 MCP server tests total)
- Defensive parameter validation across SSH module (PersistentSession and SSHConnectionManager)
- ConnectionPool class for SSH connection reuse and lifecycle management
- Comprehensive test suite for connection pooling with defensive coding tests
  
### Changed

- SSH module now uses centralized error constants for consistent error messaging
- Enhanced JSDoc documentation with @throws annotations for all validated methods
- Refactored SSH module into focused, single-responsibility modules:
  - src/ssh/types.ts - Type definitions (CommandResult, SessionType, SessionMode, SessionMetadata, etc.)
  - src/ssh/errors.ts - SSHError class
  - src/ssh/constants.ts - SSH-specific constants (TIMEOUTS, BUFFER_LIMITS, SSH_CONFIG)
  - src/ssh/session.ts - PersistentSession class
  - src/ssh/connection-pool.ts - ConnectionPool class (new abstraction)
  - src/ssh/manager.ts - SSHConnectionManager class
  - src/ssh/index.ts - Barrel export for clean API
- Reduced main ssh.ts file from 909 lines to focused modules (improved maintainability)
- SSHConnectionManager now uses ConnectionPool internally for connection management
- All existing tests continue to pass (110 total tests)
- Public API remains backward compatible

## [0.1.1] - 2025-10-01

### Added

- README with installation, usage, and architecture documentation

## [0.1.0] - 2025-10-01

### Added

- Initial repository setup
- Core SSH functionality extracted and tested

## [Unreleased]

### Added
- Core SSH session management (SSHConnectionManager, PersistentSession)
- Cross-platform shell support (bash, sh, PowerShell, cmd) via ShellFormatter system
- Interactive and background session types
- Normal and raw session modes for TUI applications
- Command queueing with timeout handling
- Connection pooling and reuse
- Session lifecycle management with keep-alive and automatic timeout
- Output buffering for background sessions with memory limits
- Unit test suite (ssh, shells, utils, integration tests)
- TypeScript configuration with strict mode
- Vitest testing framework with coverage support
- Build toolchain (TypeScript compiler)
- Project documentation (ARCHITECTURE.md, IMPLEMENTATION.md, CLAUDE.md)
- Development guidelines (TDD, OWASP security requirements, Clean Code principles)

### Security

- SSH key-based authentication only
- Command injection prevention via delimiter-based parsing
- Secure error handling (no credential leakage)
- Resource limits (buffer sizes, session timeouts, connection limits)
