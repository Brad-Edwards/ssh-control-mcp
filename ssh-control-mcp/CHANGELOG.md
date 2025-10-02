# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
