# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Graceful shutdown support via stopServer() function
- Signal handlers for SIGTERM and SIGINT (optional, via startServer options)
- StartServerOptions interface for configuration
- Comprehensive tests for shutdown lifecycle (26 MCP server tests total)
- Defensive parameter validation across SSH module (PersistentSession and SSHConnectionManager)
- ConnectionPool class for SSH connection reuse and lifecycle management (24 tests)
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

## [0.1.2] - 2025-10-01

### Added

- MCP server initialization with stdio transport
- Tool registration framework (ready for tool definitions)
- Integration with @modelcontextprotocol/sdk v1.18.x
- Comprehensive MCP server test suite (tests/mcp/server.test.ts)
- Error handling for transport connection failures
- JSDoc documentation for all MCP server functions

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
