export const COMMAND_TIMEOUT_ERROR = 'Command timeout';
export const CONNECTION_FAILED_ERROR = 'Connection failed';
export const CONNECTION_TIMEOUT_ERROR = 'Connection timeout';
export const FAILED_TO_START_MCP_SERVER_ERROR = 'Failed to start MCP server';
export const INVALID_ARGUMENTS_ERROR = 'Invalid arguments';
export const NULL_OR_UNDEFINED_ARGUMENTS_ERROR = 'Null or undefined arguments';
export const SESSION_ALREADY_EXISTS_ERROR = 'Session already exists';
export const SESSION_ID_REQUIRED_ERROR = 'Session ID is required';
export const SESSION_NOT_FOUND_ERROR = 'Session not found';
export const ShellNames = {
  PowerShell: 'powershell',
  Cmd: 'cmd',
  Bash: 'bash',
  Sh: 'sh'
} as const;
export const STREAM_ERROR = 'Stream error';
export const UNKNOWN_ERROR = 'Unknown error';