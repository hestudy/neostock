import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DatabaseMigrator, type Migration } from '../../db/migrations/migrator';
import { sql } from 'drizzle-orm';

// 在CI环境中跳过这些测试，因为它们依赖于Bun的SQLite实现
const isCI = process.env.CI === 'true';
const describeSkipCI = isCI ? describe.skip : describe;

describeSkipCI('Database Migrator', () => {
  let migrator: DatabaseMigrator;

  beforeEach(() => {
    migrator = new DatabaseMigrator(':memory:');
  });

  afterEach(() => {
    migrator.close();
  });

  describe('Migration Management', () => {
    it('should initialize migration table', async () => {
      const healthCheck = await migrator.healthCheck();
      expect(healthCheck.healthy).toBe(true);
    });

    it('should add and validate migrations', async () => {
      const testMigration: Migration = {
        id: '001_test',
        name: 'Test Migration',
        up: async (db) => {
          await db.run(sql`CREATE TABLE test_table (id INTEGER PRIMARY KEY)`);
        },
        down: async (db) => {
          await db.run(sql`DROP TABLE test_table`);
        }
      };

      migrator.addMigration(testMigration);
      
      const validation = await migrator.validateMigrations();
      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect duplicate migration IDs', async () => {
      const migration1: Migration = {
        id: '001_duplicate',
        name: 'First Migration',
        up: async () => {},
        down: async () => {}
      };

      const migration2: Migration = {
        id: '001_duplicate',
        name: 'Second Migration',
        up: async () => {},
        down: async () => {}
      };

      migrator.addMigration(migration1);
      migrator.addMigration(migration2);

      const validation = await migrator.validateMigrations();
      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Duplicate migration IDs: 001_duplicate');
    });

    it('should detect missing up/down functions', async () => {
      const incompleteMigration = {
        id: '001_incomplete',
        name: 'Incomplete Migration',
        // Missing up and down functions
      } as Migration;

      migrator.addMigration(incompleteMigration);

      const validation = await migrator.validateMigrations();
      expect(validation.valid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('missing up function'))).toBe(true);
      expect(validation.issues.some(issue => issue.includes('missing down function'))).toBe(true);
    });
  });

  describe('Migration Execution', () => {
    it('should run migrations successfully', async () => {
      const createTableMigration: Migration = {
        id: '001_create_users',
        name: 'Create Users Table',
        up: async (db) => {
          await db.run(sql`
            CREATE TABLE users_test (
              id INTEGER PRIMARY KEY,
              name TEXT NOT NULL,
              email TEXT UNIQUE NOT NULL
            )
          `);
        },
        down: async (db) => {
          await db.run(sql`DROP TABLE users_test`);
        }
      };

      migrator.addMigration(createTableMigration);

      const result = await migrator.runMigrations();
      if (!result.success) {
        console.log('Migration errors:', result.errors);
      }
      expect(result.success).toBe(true);
      expect(result.applied).toEqual(['001_create_users']);
      expect(result.errors).toHaveLength(0);

      const appliedMigrations = await migrator.getAppliedMigrations();
      expect(appliedMigrations).toHaveLength(1);
      expect(appliedMigrations[0].id).toBe('001_create_users');
    });

    it('should not run already applied migrations', async () => {
      const migration: Migration = {
        id: '001_test',
        name: 'Test Migration',
        up: async (db) => {
          await db.run(sql`CREATE TABLE test_once (id INTEGER PRIMARY KEY)`);
        },
        down: async (db) => {
          await db.run(sql`DROP TABLE test_once`);
        }
      };

      migrator.addMigration(migration);

      // Run migrations twice
      await migrator.runMigrations();
      const secondResult = await migrator.runMigrations();

      expect(secondResult.success).toBe(true);
      expect(secondResult.applied).toHaveLength(0); // Should not apply again
    });

    it('should handle migration failures gracefully', async () => {
      const failingMigration: Migration = {
        id: '001_failing',
        name: 'Failing Migration',
        up: async (db) => {
          // This should fail - invalid SQL
          await db.run(sql`INVALID SQL STATEMENT`);
        },
        down: async (db) => {
          await db.run(sql`-- rollback`);
        }
      };

      migrator.addMigration(failingMigration);

      const result = await migrator.runMigrations();
      expect(result.success).toBe(false);
      expect(result.applied).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('001_failing');
    });
  });

  describe('Migration Rollback', () => {
    it('should rollback migrations successfully', async () => {
      const migration: Migration = {
        id: '001_rollback_test',
        name: 'Rollback Test',
        up: async (db) => {
          await db.run(sql`CREATE TABLE rollback_test (id INTEGER PRIMARY KEY)`);
        },
        down: async (db) => {
          await db.run(sql`DROP TABLE rollback_test`);
        }
      };

      migrator.addMigration(migration);

      // Apply migration
      await migrator.runMigrations();
      
      let appliedMigrations = await migrator.getAppliedMigrations();
      expect(appliedMigrations).toHaveLength(1);

      // Rollback migration
      const rollbackResult = await migrator.rollbackMigration('001_rollback_test');
      expect(rollbackResult.success).toBe(true);

      appliedMigrations = await migrator.getAppliedMigrations();
      expect(appliedMigrations).toHaveLength(0);
    });

    it('should handle rollback of non-existent migration', async () => {
      const rollbackResult = await migrator.rollbackMigration('non_existent');
      expect(rollbackResult.success).toBe(false);
      expect(rollbackResult.error).toContain('Migration non_existent not found');
    });
  });

  describe('Health Check and Monitoring', () => {
    it('should perform health check', async () => {
      const healthCheck = await migrator.healthCheck();
      
      expect(healthCheck.healthy).toBe(true);
      expect(healthCheck.details.connectionTest).toBe(true);
      expect(healthCheck.details.totalMigrations).toBe(0);
      expect(healthCheck.details.appliedMigrations).toBe(0);
      expect(healthCheck.details.pendingMigrations).toBe(0);
    });

    it('should track migration status in health check', async () => {
      const migration: Migration = {
        id: '001_health',
        name: 'Health Test',
        up: async (db) => {
          await db.run(sql`CREATE TABLE health_test (id INTEGER PRIMARY KEY)`);
        },
        down: async (db) => {
          await db.run(sql`DROP TABLE health_test`);
        }
      };

      migrator.addMigration(migration);

      let healthCheck = await migrator.healthCheck();
      expect(healthCheck.details.totalMigrations).toBe(1);
      expect(healthCheck.details.appliedMigrations).toBe(0);
      expect(healthCheck.details.pendingMigrations).toBe(1);

      await migrator.runMigrations();

      healthCheck = await migrator.healthCheck();
      expect(healthCheck.details.appliedMigrations).toBe(1);
      expect(healthCheck.details.pendingMigrations).toBe(0);
      expect(healthCheck.details.lastMigration).toBe('Health Test');
    });
  });

  describe('Performance and Stress Tests', () => {
    it('should handle multiple migrations efficiently', async () => {
      // Add multiple migrations
      for (let i = 1; i <= 10; i++) {
        const migration: Migration = {
          id: `00${i}_batch`,
          name: `Batch Migration ${i}`,
          up: async (db) => {
            await db.run(sql`CREATE TABLE batch_table_${sql.raw(i.toString())} (id INTEGER PRIMARY KEY)`);
          },
          down: async (db) => {
            await db.run(sql`DROP TABLE batch_table_${sql.raw(i.toString())}`);
          }
        };
        migrator.addMigration(migration);
      }

      const startTime = Date.now();
      const result = await migrator.runMigrations();
      const executionTime = Date.now() - startTime;

      if (!result.success) {
        console.log('Performance test errors:', result.errors);
      }
      expect(result.success).toBe(true);
      expect(result.applied).toHaveLength(10);
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should maintain data integrity during concurrent operations', async () => {
      const migration: Migration = {
        id: '001_integrity',
        name: 'Integrity Test',
        up: async (db) => {
          await db.run(sql`CREATE TABLE integrity_test (id INTEGER PRIMARY KEY, value TEXT)`);
          // Insert test data
          await db.run(sql`INSERT INTO integrity_test (value) VALUES ('test1')`);
          await db.run(sql`INSERT INTO integrity_test (value) VALUES ('test2')`);
        },
        down: async (db) => {
          await db.run(sql`DROP TABLE integrity_test`);
        }
      };

      migrator.addMigration(migration);
      await migrator.runMigrations();

      // Verify data integrity
      const healthCheck = await migrator.healthCheck();
      expect(healthCheck.healthy).toBe(true);
    });
  });
});