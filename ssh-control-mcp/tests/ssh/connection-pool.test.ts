import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionPool } from '../../src/ssh/connection-pool.js';
import { SSHError } from '../../src/ssh/errors.js';
import { Client } from 'ssh2';

vi.mock('ssh2');
vi.mock('fs/promises');

describe('ConnectionPool', () => {
  let pool: ConnectionPool;
  let mockClient: any;

  beforeEach(() => {
    pool = new ConnectionPool();
    mockClient = {
      connect: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
    };
    vi.mocked(Client).mockImplementation(() => mockClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a new ConnectionPool with empty connections', () => {
      const newPool = new ConnectionPool();
      expect(newPool.getConnectionCount()).toBe(0);
    });
  });

  describe('getConnection', () => {
    it('should throw error for null host', async () => {
      await expect(pool.getConnection(null as any, 'user', '/key', 22))
        .rejects.toThrow('Null or undefined arguments');
    });

    it('should throw error for undefined host', async () => {
      await expect(pool.getConnection(undefined as any, 'user', '/key', 22))
        .rejects.toThrow('Null or undefined arguments');
    });

    it('should throw error for empty host', async () => {
      await expect(pool.getConnection('', 'user', '/key', 22))
        .rejects.toThrow('Invalid arguments');
    });

    it('should throw error for null username', async () => {
      await expect(pool.getConnection('host', null as any, '/key', 22))
        .rejects.toThrow('Null or undefined arguments');
    });

    it('should throw error for empty username', async () => {
      await expect(pool.getConnection('host', '', '/key', 22))
        .rejects.toThrow('Invalid arguments');
    });

    it('should throw error for null privateKeyPath', async () => {
      await expect(pool.getConnection('host', 'user', null as any, 22))
        .rejects.toThrow('Null or undefined arguments');
    });

    it('should throw error for empty privateKeyPath', async () => {
      await expect(pool.getConnection('host', 'user', '', 22))
        .rejects.toThrow('Invalid arguments');
    });

    it('should throw error for invalid port (zero)', async () => {
      await expect(pool.getConnection('host', 'user', '/key', 0))
        .rejects.toThrow('Invalid arguments');
    });

    it('should throw error for invalid port (negative)', async () => {
      await expect(pool.getConnection('host', 'user', '/key', -1))
        .rejects.toThrow('Invalid arguments');
    });

    it('should throw error for invalid port (> 65535)', async () => {
      await expect(pool.getConnection('host', 'user', '/key', 65536))
        .rejects.toThrow('Invalid arguments');
    });

    it('should create new connection when none exists', async () => {
      const { readFile } = await import('fs/promises');
      vi.mocked(readFile).mockResolvedValue(Buffer.from('fake-key'));

      // Simulate successful connection
      mockClient.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'ready') {
          setTimeout(() => handler(), 0);
        }
        return mockClient;
      });

      const client = await pool.getConnection('host1', 'user1', '/key1', 22);

      expect(client).toBe(mockClient);
      expect(pool.getConnectionCount()).toBe(1);
    });

    it('should reuse existing connected connection', async () => {
      const { readFile } = await import('fs/promises');
      vi.mocked(readFile).mockResolvedValue(Buffer.from('fake-key'));

      mockClient.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'ready') {
          setTimeout(() => handler(), 0);
        }
        return mockClient;
      });

      // Create first connection
      const client1 = await pool.getConnection('host1', 'user1', '/key1', 22);

      // Get connection again - should reuse
      const client2 = await pool.getConnection('host1', 'user1', '/key1', 22);

      expect(client1).toBe(client2);
      expect(pool.getConnectionCount()).toBe(1);
    });

    it('should remove and recreate dead connection', async () => {
      const { readFile } = await import('fs/promises');
      vi.mocked(readFile).mockResolvedValue(Buffer.from('fake-key'));

      let closeHandler: Function;
      mockClient.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'ready') {
          setTimeout(() => handler(), 0);
        } else if (event === 'close') {
          closeHandler = handler;
        }
        return mockClient;
      });

      // Create first connection
      const client1 = await pool.getConnection('host1', 'user1', '/key1', 22);

      // Simulate connection close
      closeHandler!();

      // Create new mock for new connection
      const mockClient2 = {
        connect: vi.fn(),
        end: vi.fn(),
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'ready') {
            setTimeout(() => handler(), 0);
          }
          return mockClient2;
        }),
        once: vi.fn(),
      };
      vi.mocked(Client).mockImplementation(() => mockClient2);

      // Get connection again - should create new one
      const client2 = await pool.getConnection('host1', 'user1', '/key1', 22);

      expect(client2).toBe(mockClient2);
      expect(client2).not.toBe(client1);
      expect(pool.getConnectionCount()).toBe(1);
    });

    it('should handle connection timeout', async () => {
      const { readFile } = await import('fs/promises');
      vi.mocked(readFile).mockResolvedValue(Buffer.from('fake-key'));

      // Don't trigger ready event - will timeout
      mockClient.on.mockReturnValue(mockClient);

      await expect(pool.getConnection('host1', 'user1', '/key1', 22))
        .rejects.toThrow('Connection timeout');
    }, 35000);

    it('should handle connection error', async () => {
      const { readFile } = await import('fs/promises');
      vi.mocked(readFile).mockResolvedValue(Buffer.from('fake-key'));

      mockClient.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'error') {
          process.nextTick(() => handler(new Error('Connection refused')));
        }
        return mockClient;
      });

      await expect(pool.getConnection('host1', 'user1', '/key1', 22))
        .rejects.toThrow('Connection failed: host1:22');
    }, 10000);

    it('should handle private key read failure', async () => {
      const { readFile } = await import('fs/promises');
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

      await expect(pool.getConnection('host1', 'user1', '/nonexistent', 22))
        .rejects.toThrow('Failed to read SSH private key');
    });

    it('should create separate connections for different hosts', async () => {
      const { readFile } = await import('fs/promises');
      vi.mocked(readFile).mockResolvedValue(Buffer.from('fake-key'));

      mockClient.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'ready') {
          process.nextTick(() => handler());
        }
        return mockClient;
      });

      const client1 = await pool.getConnection('host1', 'user1', '/key1', 22);

      // Create new mock for second connection
      const mockClient2 = {
        connect: vi.fn(),
        end: vi.fn(),
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'ready') {
            process.nextTick(() => handler());
          }
          return mockClient2;
        }),
        once: vi.fn(),
      };
      vi.mocked(Client).mockImplementation(() => mockClient2);

      const client2 = await pool.getConnection('host2', 'user1', '/key1', 22);

      expect(client1).not.toBe(client2);
      expect(pool.getConnectionCount()).toBe(2);
    });

    it('should create separate connections for different ports', async () => {
      const { readFile } = await import('fs/promises');
      vi.mocked(readFile).mockResolvedValue(Buffer.from('fake-key'));

      mockClient.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'ready') {
          process.nextTick(() => handler());
        }
        return mockClient;
      });

      const client1 = await pool.getConnection('host1', 'user1', '/key1', 22);

      const mockClient2 = {
        connect: vi.fn(),
        end: vi.fn(),
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'ready') {
            process.nextTick(() => handler());
          }
          return mockClient2;
        }),
        once: vi.fn(),
      };
      vi.mocked(Client).mockImplementation(() => mockClient2);

      const client2 = await pool.getConnection('host1', 'user1', '/key1', 2222);

      expect(client1).not.toBe(client2);
      expect(pool.getConnectionCount()).toBe(2);
    });
  });

  describe('disconnectAll', () => {
    it('should disconnect all connections', async () => {
      const { readFile } = await import('fs/promises');
      vi.mocked(readFile).mockResolvedValue(Buffer.from('fake-key'));

      mockClient.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'ready') {
          process.nextTick(() => handler());
        }
        return mockClient;
      });
      mockClient.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'close') {
          process.nextTick(() => handler());
        }
        return mockClient;
      });

      // Create a connection
      await pool.getConnection('host1', 'user1', '/key1', 22);
      expect(pool.getConnectionCount()).toBe(1);

      // Disconnect all
      await pool.disconnectAll();

      expect(mockClient.end).toHaveBeenCalled();
      expect(pool.getConnectionCount()).toBe(0);
    });

    it('should handle disconnection timeout', async () => {
      const { readFile } = await import('fs/promises');
      vi.mocked(readFile).mockResolvedValue(Buffer.from('fake-key'));

      mockClient.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'ready') {
          process.nextTick(() => handler());
        }
        return mockClient;
      });
      mockClient.once.mockReturnValue(mockClient); // Don't trigger close

      await pool.getConnection('host1', 'user1', '/key1', 22);

      await pool.disconnectAll();

      expect(pool.getConnectionCount()).toBe(0);
    }, 10000);

    it('should clear connections even if already disconnected', async () => {
      const { readFile } = await import('fs/promises');
      vi.mocked(readFile).mockResolvedValue(Buffer.from('fake-key'));

      let closeHandler: Function | undefined;
      mockClient.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'ready') {
          process.nextTick(() => handler());
        } else if (event === 'close') {
          closeHandler = handler;
        }
        return mockClient;
      });

      await pool.getConnection('host1', 'user1', '/key1', 22);

      // Simulate connection close
      if (closeHandler) {
        closeHandler();
      }

      // Disconnect all
      await pool.disconnectAll();

      expect(pool.getConnectionCount()).toBe(0);
    });
  });

  describe('getConnectionCount', () => {
    it('should return 0 for new pool', () => {
      expect(pool.getConnectionCount()).toBe(0);
    });

    it('should return correct count after adding connections', async () => {
      const { readFile } = await import('fs/promises');
      vi.mocked(readFile).mockResolvedValue(Buffer.from('fake-key'));

      mockClient.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'ready') {
          process.nextTick(() => handler());
        }
        return mockClient;
      });

      await pool.getConnection('host1', 'user1', '/key1', 22);
      expect(pool.getConnectionCount()).toBe(1);

      const mockClient2 = {
        connect: vi.fn(),
        end: vi.fn(),
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'ready') {
            process.nextTick(() => handler());
          }
          return mockClient2;
        }),
        once: vi.fn(),
      };
      vi.mocked(Client).mockImplementation(() => mockClient2);

      await pool.getConnection('host2', 'user1', '/key1', 22);
      expect(pool.getConnectionCount()).toBe(2);
    });
  });

  describe('Connection Limits', () => {
    it('should enforce max connections per host limit', async () => {
      const { readFile } = await import('fs/promises');
      vi.mocked(readFile).mockResolvedValue(Buffer.from('fake-key'));

      mockClient.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'ready') {
          process.nextTick(() => handler());
        }
        return mockClient;
      });

      // Create connections up to the limit (10)
      const promises = [];
      for (let i = 1; i <= 10; i++) {
        const client = {
          connect: vi.fn(),
          end: vi.fn(),
          on: vi.fn((event: string, handler: Function) => {
            if (event === 'ready') {
              process.nextTick(() => handler());
            }
            return client;
          }),
          once: vi.fn(),
        };
        vi.mocked(Client).mockImplementation(() => client as any);
        promises.push(pool.getConnection(`host${i}`, 'user1', '/key1', 22));
      }

      await Promise.all(promises);
      expect(pool.getConnectionCount()).toBe(10);

      // Attempt to create 11th connection should fail
      const client11 = {
        connect: vi.fn(),
        end: vi.fn(),
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'ready') {
            process.nextTick(() => handler());
          }
          return client11;
        }),
        once: vi.fn(),
      };
      vi.mocked(Client).mockImplementation(() => client11 as any);

      await expect(pool.getConnection('host11', 'user1', '/key1', 22))
        .rejects.toThrow('Maximum connection limit');
    });
  });
});
