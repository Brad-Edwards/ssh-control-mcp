import { Client } from 'ssh2';
import { readFile } from 'fs/promises';
import { ConnectionInfo } from './types.js';
import { SSHError } from './errors.js';
import { TIMEOUTS, SSH_CONFIG } from './constants.js';
import { 
  INVALID_ARGUMENTS_ERROR,
  NULL_OR_UNDEFINED_ARGUMENTS_ERROR,
  UNKNOWN_ERROR,
  CONNECTION_TIMEOUT_ERROR,
  CONNECTION_FAILED_ERROR
 } from '../constants.js';

/**
 * Manages a pool of SSH connections for reuse
 */
export class ConnectionPool {
  private connections: Map<string, ConnectionInfo> = new Map();

  /**
   * Get or create an SSH connection to a host
   * @param host - The host to get the connection for
   * @param username - The username to use for the connection
   * @param privateKeyPath - The path to the private key to use for the connection
   * @param port - The port to use for the connection
   * @returns A promise that resolves with the SSH client
   * @throws {SSHError} If the connection fails to create
   * @throws {Error} If arguments are null, undefined, empty, or invalid
   */
  async getConnection(
    host: string,
    username: string,
    privateKeyPath: string,
    port: number = 22
  ): Promise<Client> {
    if (host === null || host === undefined || username === null || username === undefined ||
        privateKeyPath === null || privateKeyPath === undefined) {
      throw new SSHError(NULL_OR_UNDEFINED_ARGUMENTS_ERROR);
    }
    if (!host || !username || !privateKeyPath) {
      throw new SSHError(`${INVALID_ARGUMENTS_ERROR}: host, username, and privateKeyPath are required`);
    }
    if (port <= 0 || port > 65535) {
      throw new SSHError(`${INVALID_ARGUMENTS_ERROR}: port must be between 1 and 65535`);
    }

    const connectionKey = `ssh-${username}@${host}:${port}`;
    console.error(`[SSH-CLIENT] getConnection called with key: ${connectionKey}`);

    if (this.connections.has(connectionKey)) {
      const connInfo = this.connections.get(connectionKey)!;
      if (connInfo.connected) {
        console.error(`[SSH-CLIENT] Reusing existing connection for: ${connectionKey}`);
        return connInfo.client;
      }
      // Connection is dead, remove it
      console.error(`[SSH-CLIENT] Removing dead connection for: ${connectionKey}`);
      this.connections.delete(connectionKey);
    }

    // Create new connection
    console.error(`[SSH-CLIENT] Creating new connection for: ${connectionKey}`);
    const client = await this.createConnection(host, username, privateKeyPath, port);
    this.connections.set(connectionKey, { client, connected: true });
    console.error(`[SSH-CLIENT] Connection cache now has ${this.connections.size} connections`);

    return client;
  }

  /**
   * Create a new SSH connection
   * @param host - The host to create the connection for
   * @param username - The username to use for the connection
   * @param privateKeyPath - The path to the private key to use for the connection
   * @param port - The port to use for the connection
   * @returns A promise that resolves with the SSH client
   * @throws {SSHError} If the connection fails to create
   */
  private async createConnection(
    host: string,
    username: string,
    privateKeyPath: string,
    port: number = 22
  ): Promise<Client> {
    let privateKey: Buffer;
    try {
      privateKey = await readFile(privateKeyPath);
    } catch (error) {
      throw new SSHError(
        `Failed to read SSH private key from ${privateKeyPath}: ${error instanceof Error ? error.message : UNKNOWN_ERROR}`
      );
    }

    const client = new Client();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new SSHError(CONNECTION_TIMEOUT_ERROR));
      }, TIMEOUTS.KEEP_ALIVE_INTERVAL);

      client.on('ready', () => {
        clearTimeout(timeout);
        resolve(client);
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        reject(new SSHError(`${CONNECTION_FAILED_ERROR}: ${host}:${port}: ${err.message}`, err));
      });

      client.on('close', () => {
        // Mark connection as disconnected
        const connectionKey = `ssh-${username}@${host}:${port}`;
        const connInfo = this.connections.get(connectionKey);
        if (connInfo) {
          connInfo.connected = false;
        }
      });

      client.connect({
        host,
        port,
        username,
        privateKey,
        timeout: SSH_CONFIG.READY_TIMEOUT,
        readyTimeout: SSH_CONFIG.READY_TIMEOUT,
        keepaliveInterval: SSH_CONFIG.KEEPALIVE_INTERVAL,
        keepaliveCountMax: SSH_CONFIG.KEEPALIVE_COUNT_MAX,
      });
    });
  }

  /**
   * Disconnect all connections in the pool
   * @returns A promise that resolves when all connections are closed
   */
  async disconnectAll(): Promise<void> {
    const connectionPromises = Array.from(this.connections.values()).map(connInfo => {
      return new Promise<void>((resolve) => {
        if (connInfo.connected) {
          const timeout = setTimeout(() => {
            resolve(); // Resolve even if 'close' event doesn't fire
          }, TIMEOUTS.FORCE_CLOSE);

          connInfo.client.once('close', () => {
            clearTimeout(timeout);
            resolve();
          });

          connInfo.client.end();
        } else {
          resolve();
        }
      });
    });

    await Promise.all(connectionPromises);
    this.connections.clear();
  }

  /**
   * Get the number of active connections
   * @returns The number of connections in the pool
   */
  getConnectionCount(): number {
    return this.connections.size;
  }
}
