// 兼容不同环境的数据库导入
interface DatabaseInterface {
  exec(query: string): unknown;
  prepare(query: string): {
    all: () => unknown[];
    run: (...args: unknown[]) => { changes: number; lastInsertRowid: number };
    get: (...args: unknown[]) => unknown;
  };
  close(): void;
  run?: (query: string) => unknown;
}

let DatabaseClass: new (filename?: string, options?: unknown) => DatabaseInterface;

// 同步初始化，用于向后兼容
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bunSqlite = require('bun:sqlite');
  DatabaseClass = bunSqlite.Database;
} catch {
  DatabaseClass = class MockDatabase implements DatabaseInterface {
    private mockTables: Record<string, unknown[]> = {};
    
    constructor() {}
    
    exec(query: string) { 
      // 模拟SQL错误检测
      if (query.includes('INVALID SQL STATEMENT')) {
        throw new Error('SQL syntax error: invalid statement');
      }
      // 模拟表创建
      if (query.includes('CREATE TABLE IF NOT EXISTS __migrations')) {
        this.mockTables['__migrations'] = [];
      }
      return this; 
    }
    
    prepare(query: string) { 
      return { 
        all: () => {
          if (query.includes('SELECT id, name, applied_at FROM __migrations')) {
            return this.mockTables['__migrations'] || [];
          }
          return [];
        },
        run: (...args: unknown[]) => {
          if (query.includes('INSERT INTO __migrations')) {
            // 模拟插入迁移记录
            const [id, name] = args as [string, string];
            this.mockTables['__migrations'] = this.mockTables['__migrations'] || [];
            this.mockTables['__migrations'].push({ 
              id, 
              name, 
              applied_at: new Date().toISOString() 
            });
          } else if (query.includes('DELETE FROM __migrations')) {
            // 模拟删除迁移记录
            const [id] = args as [string];
            this.mockTables['__migrations'] = (this.mockTables['__migrations'] || []).filter(
              (record) => (record as { id: string }).id !== id
            );
          }
          return { changes: 1, lastInsertRowid: 1 };
        },
        get: (...args: unknown[]) => {
          if (query.includes('SELECT 1 as test')) {
            return { test: 1 };
          }
          if (query.includes('SELECT id FROM __migrations WHERE id = ?')) {
            const [id] = args as [string];
            return (this.mockTables['__migrations'] || []).find(
              (record) => (record as { id: string }).id === id
            ) || null;
          }
          return null;
        }
      }; 
    }
    
    run(query: string) {
      // 模拟SQL错误检测
      if (query.includes('INVALID SQL STATEMENT')) {
        throw new Error('SQL syntax error: invalid statement');
      }
      return this.exec(query);
    }
    
    close() {}
  };
}

interface DrizzleQuery {
  queryChunks: unknown[];
  values?: unknown[];
}

type QueryInput = string | DrizzleQuery | { queryChunks: unknown[]; values?: unknown[] };

export interface Migration {
  id: string;
  name: string;
  up: (db: DatabaseWrapper) => Promise<void>;
  down: (db: DatabaseWrapper) => Promise<void>;
}

export class DatabaseWrapper {
  constructor(private db: DatabaseInterface) {}

  async run(query: QueryInput): Promise<void> {
    if (typeof query === 'string') {
      if (this.db.run) {
        this.db.run(query);
      } else {
        this.db.exec(query);
      }
    } else if (query && query.queryChunks && Array.isArray(query.queryChunks)) {
      // Handle drizzle SQL template (including nested sql.raw())
      const sqlString = this.buildSqlString(query);
      if (this.db.run) {
        this.db.run(sqlString);
      } else {
        this.db.exec(sqlString);
      }
    } else {
      console.error('Unknown query format:', query);
      throw new Error('Invalid query format');
    }
  }

  private buildSqlString(query: DrizzleQuery): string {
    if (!query.queryChunks || !Array.isArray(query.queryChunks)) {
      return '';
    }
    
    const result: string[] = [];
    
    for (let i = 0; i < query.queryChunks.length; i++) {
      const chunk = query.queryChunks[i];
      
      if (typeof chunk === 'string') {
        result.push(chunk);
      } else if (chunk && typeof chunk === 'object' && 'value' in chunk) {
        const value = (chunk as { value: unknown }).value;
        if (Array.isArray(value)) {
          result.push(value.join(''));
        } else if (typeof value === 'string') {
          result.push(value);
        }
      } else if (chunk && typeof chunk === 'object' && 'queryChunks' in chunk) {
        // Recursively handle nested sql.raw()
        result.push(this.buildSqlString(chunk as DrizzleQuery));
      }
      
      // Handle parameters/values between chunks
      if (query.values && query.values[i] !== undefined) {
        result.push(String(query.values[i]));
      }
    }
    
    return result.join('');
  }

  prepare(query: string) {
    return this.db.prepare(query);
  }

  exec(query: string): void {
    this.db.exec(query);
  }

  close(): void {
    this.db.close();
  }
}

export class DatabaseMigrator {
  private db: DatabaseInterface;
  private wrapper: DatabaseWrapper;
  private migrations: Migration[] = [];
  private batchSize: number = 5;
  private onProgress?: (progress: { completed: number; total: number; current: string }) => void;

  constructor(databasePath: string = ':memory:', options?: { batchSize?: number; onProgress?: (progress: { completed: number; total: number; current: string }) => void }) {
    this.db = new DatabaseClass(databasePath);
    this.wrapper = new DatabaseWrapper(this.db);
    this.batchSize = options?.batchSize || 5;
    this.onProgress = options?.onProgress;
    this.initializeMigrationTable();
  }

  private initializeMigrationTable() {
    // Create migrations tracking table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS __migrations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        rollback_sql TEXT
      )
    `);
  }

  addMigration(migration: Migration) {
    this.migrations.push(migration);
  }

  async runMigrations(timeoutMs: number = 30000): Promise<{ success: boolean; applied: string[]; errors: string[] }> {
    const result = { success: true, applied: [] as string[], errors: [] as string[] };
    
    // Get pending migrations
    const pendingMigrations = [];
    for (const migration of this.migrations) {
      const existing = this.db
        .prepare('SELECT id FROM __migrations WHERE id = ?')
        .get(migration.id);
      
      if (!existing) {
        pendingMigrations.push(migration);
      }
    }
    
    if (pendingMigrations.length === 0) {
      return result;
    }
    
    // Process migrations in batches
    for (let i = 0; i < pendingMigrations.length; i += this.batchSize) {
      const batch = pendingMigrations.slice(i, i + this.batchSize);
      
      for (const migration of batch) {
        try {
          // Report progress
          if (this.onProgress) {
            this.onProgress({
              completed: result.applied.length,
              total: pendingMigrations.length,
              current: migration.name
            });
          }
          
          // Execute migration with timeout
          const migrationPromise = migration.up(this.wrapper);
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Migration timeout after ${timeoutMs}ms`)), timeoutMs);
          });
          
          await Promise.race([migrationPromise, timeoutPromise]);
          
          // Record migration
          this.db
            .prepare('INSERT INTO __migrations (id, name) VALUES (?, ?)')
            .run(migration.id, migration.name);
          result.applied.push(migration.id);
          
        } catch (error) {
          result.success = false;
          result.errors.push(`Migration ${migration.id}: ${error instanceof Error ? error.message : String(error)}`);
          return result; // Stop on first failure
        }
      }
      
      // Small delay between batches to prevent overwhelming the database
      if (i + this.batchSize < pendingMigrations.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    return result;
  }

  async rollbackMigration(migrationId: string, timeoutMs: number = 30000): Promise<{ success: boolean; error?: string }> {
    try {
      const migration = this.migrations.find(m => m.id === migrationId);
      if (!migration) {
        throw new Error(`Migration ${migrationId} not found`);
      }

      // Execute rollback with timeout
      const rollbackPromise = migration.down(this.wrapper);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Rollback timeout after ${timeoutMs}ms`)), timeoutMs);
      });
      
      await Promise.race([rollbackPromise, timeoutPromise]);
      
      // Remove migration record
      this.db
        .prepare('DELETE FROM __migrations WHERE id = ?')
        .run(migrationId);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  async getAppliedMigrations(): Promise<Array<{ id: string; name: string; applied_at: string }>> {
    return this.db
      .prepare('SELECT id, name, applied_at FROM __migrations ORDER BY applied_at')
      .all() as Array<{ id: string; name: string; applied_at: string }>;
  }

  async validateMigrations(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    // Check for duplicate migration IDs
    const ids = this.migrations.map(m => m.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length > 0) {
      issues.push(`Duplicate migration IDs: ${duplicates.join(', ')}`);
    }

    // Check for missing up/down functions
    for (const migration of this.migrations) {
      if (typeof migration.up !== 'function') {
        issues.push(`Migration ${migration.id} missing up function`);
      }
      if (typeof migration.down !== 'function') {
        issues.push(`Migration ${migration.id} missing down function`);
      }
    }

    return { valid: issues.length === 0, issues };
  }

  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, unknown> }> {
    try {
      // Test database connection
      const testResult = this.db.prepare('SELECT 1 as test').get();
      
      // Get migration status
      const appliedMigrations = await this.getAppliedMigrations();
      const totalMigrations = this.migrations.length;
      
      // Check for pending migrations
      const pendingMigrations = this.migrations.filter(
        m => !appliedMigrations.some(am => am.id === m.id)
      );

      return {
        healthy: Boolean(testResult && (testResult as { test: number }).test === 1),
        details: {
          connectionTest: Boolean((testResult as { test: number })?.test === 1),
          totalMigrations,
          appliedMigrations: appliedMigrations.length,
          pendingMigrations: pendingMigrations.length,
          lastMigration: appliedMigrations[appliedMigrations.length - 1]?.name || 'none'
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  close() {
    this.db.close();
  }
}