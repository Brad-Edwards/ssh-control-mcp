import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as fs from 'fs';
import * as path from 'path';
import type { LoggingConfig } from '../config/schema.js';
import { sanitizeEventData } from './sanitize.js';
import { INVALID_ARGUMENTS_ERROR, NULL_OR_UNDEFINED_ARGUMENTS_ERROR } from '../constants.js';

/**
 * Audit event types for logging
 */
export enum AuditEvent {
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_CLOSED = 'SESSION_CLOSED',
  COMMAND_EXECUTED = 'COMMAND_EXECUTED',
  CONNECTION_ESTABLISHED = 'CONNECTION_ESTABLISHED',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
}

/**
 * Maps audit events to Winston log levels
 */
const EVENT_LOG_LEVELS: Record<AuditEvent, string> = {
  [AuditEvent.SESSION_CREATED]: 'info',
  [AuditEvent.SESSION_CLOSED]: 'info',
  [AuditEvent.COMMAND_EXECUTED]: 'info',
  [AuditEvent.CONNECTION_ESTABLISHED]: 'info',
  [AuditEvent.CONNECTION_FAILED]: 'warn',
  [AuditEvent.ERROR_OCCURRED]: 'error',
};

/**
 * Audit logger for comprehensive security logging
 * Implements OWASP A09 (Security Logging and Monitoring Failures)
 * Addresses OWASP A02 (no credentials in logs)
 * Addresses OWASP A08 (immutable audit trail)
 * Addresses OWASP LLM02 (sensitive information disclosure)
 */
export class AuditLogger {
  private logger: winston.Logger;
  private config: LoggingConfig;
  private customPatterns?: string[];

  /**
   * Creates a new audit logger instance
   * @param config - Optional logging configuration
   * @param logFilePath - Optional log file path (default: ./logs/audit.log)
   * @throws {Error} If logFilePath is invalid
   */
  constructor(config?: LoggingConfig, logFilePath?: string) {
    if (logFilePath === '') {
      throw new Error(`${INVALID_ARGUMENTS_ERROR}: logFilePath cannot be empty`);
    }

    this.config = config || {};

    this.customPatterns = undefined;

    const level = this.config.level || 'info';
    const filePath = logFilePath || './logs/audit.log';

    const logDir = path.dirname(filePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const transports: winston.transport[] = [];

    const fileTransport = new DailyRotateFile({
      filename: filePath.replace('.log', '-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    });

    transports.push(fileTransport);

    if (level === 'debug') {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.simple()
          ),
        })
      );
    }

    this.logger = winston.createLogger({
      level,
      transports,
      exitOnError: false,
    });
  }

  /**
   * Logs an audit event with sanitized data
   * @param event - The type of audit event
   * @param data - The event data to log
   * @throws {Error} If event or data are null or undefined
   */
  logEvent(event: AuditEvent, data: Record<string, any>): void {
    if (event == null) {
      throw new Error(NULL_OR_UNDEFINED_ARGUMENTS_ERROR);
    }
    if (data == null) {
      throw new Error(NULL_OR_UNDEFINED_ARGUMENTS_ERROR);
    }

    const sanitized = sanitizeEventData(
      data,
      this.config.includeCommands ?? true,
      this.config.includeResponses ?? false,
      this.config.maxResponseLength ?? 1000,
      this.customPatterns
    );

    const logEntry = {
      event,
      timestamp: new Date().toISOString(),
      ...sanitized,
    };

    const logLevel = EVENT_LOG_LEVELS[event];

    this.logger.log(logLevel, logEntry);
  }

  /**
   * Closes the logger and flushes any pending logs
   * @returns A promise that resolves when the logger is closed
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.close();
      resolve();
    });
  }
}
