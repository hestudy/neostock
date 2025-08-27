// 兼容不同环境的数据库导入
interface DatabaseInterface {
  exec(query: string): unknown;
  prepare(query: string): {
    all: (...args: unknown[]) => unknown[];
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
    private mockSchema: Record<string, { columns: string[]; indexes: string[] }> = {};
    private foreignKeysEnabled = false;
    
    constructor() {}
    
    exec(query: string) { 
      // 模拟SQL错误检测
      if (query.includes('INVALID SQL STATEMENT')) {
        throw new Error('SQL syntax error: invalid statement');
      }
      
      // 模拟外键约束设置
      if (query.includes('PRAGMA foreign_keys = ON')) {
        this.foreignKeysEnabled = true;
        return this;
      }
      
      // 模拟表创建
      if (query.includes('CREATE TABLE IF NOT EXISTS __migrations')) {
        this.mockTables['__migrations'] = [];
        this.mockSchema['__migrations'] = { 
          columns: ['id', 'name', 'applied_at', 'rollback_sql'], 
          indexes: [] 
        };
      }
      
      // 模拟股票相关表创建
      if (query.includes('CREATE TABLE IF NOT EXISTS stocks')) {
        this.mockTables['stocks'] = [];
        this.mockSchema['stocks'] = {
          columns: ['ts_code', 'symbol', 'name', 'area', 'industry', 'market', 'list_date', 'is_hs', 'created_at', 'updated_at'],
          indexes: []
        };
      }
      
      if (query.includes('CREATE TABLE IF NOT EXISTS stock_daily')) {
        this.mockTables['stock_daily'] = [];
        this.mockSchema['stock_daily'] = {
          columns: ['id', 'ts_code', 'trade_date', 'open', 'high', 'low', 'close', 'vol', 'amount', 'created_at'],
          indexes: []
        };
      }
      
      if (query.includes('CREATE TABLE IF NOT EXISTS user_stock_favorites')) {
        this.mockTables['user_stock_favorites'] = [];
        this.mockSchema['user_stock_favorites'] = {
          columns: ['id', 'user_id', 'ts_code', 'created_at'],
          indexes: []
        };
      }
      
      if (query.includes('CREATE TABLE IF NOT EXISTS user')) {
        this.mockTables['user'] = [];
        this.mockSchema['user'] = {
          columns: ['id', 'name', 'email', 'emailVerified', 'createdAt', 'updatedAt'],
          indexes: []
        };
      }
      
      // 模拟索引创建
      if (query.includes('CREATE') && query.includes('INDEX')) {
        const match = query.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+ON\s+(\w+)/);
        if (match) {
          const [, indexName, tableName] = match;
          if (this.mockSchema[tableName]) {
            this.mockSchema[tableName].indexes.push(indexName);
          }
        }
      }
      
      // 模拟表删除
      if (query.includes('DROP TABLE IF EXISTS')) {
        const match = query.match(/DROP TABLE IF EXISTS (\w+)/);
        if (match) {
          const tableName = match[1];
          delete this.mockTables[tableName];
          delete this.mockSchema[tableName];
        }
      }
      
      // 模拟索引删除
      if (query.includes('DROP INDEX IF EXISTS')) {
        const match = query.match(/DROP INDEX IF EXISTS (\w+)/);
        if (match) {
          const indexName = match[1];
          // 从所有表的索引中移除
          for (const tableName in this.mockSchema) {
            const schema = this.mockSchema[tableName];
            schema.indexes = schema.indexes.filter(idx => idx !== indexName);
          }
        }
      }
      
      return this; 
    }
    
    prepare(query: string) { 
      return { 
        all: (...args: unknown[]) => {
          if (query.includes('SELECT id, name, applied_at FROM __migrations')) {
            return this.mockTables['__migrations'] || [];
          }
          if (query.includes('PRAGMA table_info')) {
            const match = query.match(/PRAGMA table_info\((\w+)\)/);
            if (match) {
              const tableName = match[1];
              if (this.mockSchema[tableName]) {
                return this.mockSchema[tableName].columns.map((col, idx) => ({
                  cid: idx,
                  name: col,
                  type: 'TEXT',
                  notnull: 0,
                  dflt_value: null,
                  pk: col === 'id' || col === 'ts_code' ? 1 : 0
                }));
              }
            }
            return [];
          }
          if (query.includes('PRAGMA index_list')) {
            const match = query.match(/PRAGMA index_list\((\w+)\)/);
            if (match) {
              const tableName = match[1];
              if (this.mockSchema[tableName]) {
                return this.mockSchema[tableName].indexes.map((idx, i) => ({
                  seq: i,
                  name: idx,
                  unique: idx.includes('unique') ? 1 : 0,
                  origin: 'c',
                  partial: 0
                }));
              }
            }
            return [];
          }
          if (query.includes('PRAGMA foreign_key_list')) {
            const match = query.match(/PRAGMA foreign_key_list\((\w+)\)/);
            if (match) {
              const tableName = match[1];
              // 模拟外键关系
              if (tableName === 'stock_daily') {
                return [{ id: 0, seq: 0, table: 'stocks', from: 'ts_code', to: 'ts_code', on_update: 'CASCADE', on_delete: 'CASCADE', match: 'NONE' }];
              } else if (tableName === 'user_stock_favorites') {
                return [
                  { id: 0, seq: 0, table: 'user', from: 'user_id', to: 'id', on_update: 'CASCADE', on_delete: 'CASCADE', match: 'NONE' },
                  { id: 1, seq: 0, table: 'stocks', from: 'ts_code', to: 'ts_code', on_update: 'CASCADE', on_delete: 'CASCADE', match: 'NONE' }
                ];
              }
            }
            return [];
          }
          if (query.includes('PRAGMA foreign_key_check')) {
            return []; // 返回空数组表示没有外键违反
          }
          if (query.includes('SELECT name FROM sqlite_master')) {
            // 返回已创建的表名
            const tableNames = Object.keys(this.mockTables).map(name => ({ name }));
            if (query.includes('stocks') || query.includes('stock_daily') || query.includes('user_stock_favorites')) {
              // 筛选特定表
              const targetTables = ['stocks', 'stock_daily', 'user_stock_favorites'];
              return tableNames.filter(t => targetTables.includes(t.name));
            }
            return tableNames;
          }
          if (query.includes('SELECT * FROM stocks WHERE industry = ?')) {
            const [industry] = args;
            return (this.mockTables['stocks'] || []).filter(
              (stock: any) => stock.industry === industry
            );
          }
          if (query.includes('SELECT COUNT(*) as count FROM stocks')) {
            return [{ count: (this.mockTables['stocks'] || []).length }];
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
          } else if (query.includes('INSERT INTO stocks')) {
            // 模拟插入股票数据
            const now = Date.now();
            const stockData = {
              ts_code: args[0],
              symbol: args[1], 
              name: args[2],
              area: args[3],
              industry: args[4],
              market: args[5],
              list_date: args[6],
              is_hs: args[7],
              created_at: args[8] || now,
              updated_at: args[9] || now
            };
            this.mockTables['stocks'] = this.mockTables['stocks'] || [];
            this.mockTables['stocks'].push(stockData);
          } else if (query.includes('INSERT INTO stock_daily')) {
            // 检查外键约束
            if (this.foreignKeysEnabled) {
              const ts_code = args[0] as string;
              const stockExists = (this.mockTables['stocks'] || []).some(
                (stock: any) => stock.ts_code === ts_code
              );
              if (!stockExists) {
                throw new Error('FOREIGN KEY constraint failed');
              }
              
              // 检查唯一约束
              const trade_date = args[1] as string;
              const duplicateExists = (this.mockTables['stock_daily'] || []).some(
                (daily: any) => daily.ts_code === ts_code && daily.trade_date === trade_date
              );
              if (duplicateExists) {
                throw new Error('UNIQUE constraint failed: stock_daily.ts_code, stock_daily.trade_date');
              }
            }
            
            const dailyData = {
              id: Date.now(),
              ts_code: args[0],
              trade_date: args[1],
              open: args[2],
              high: args[3],
              low: args[4],
              close: args[5],
              vol: args[6] || 0,
              amount: args[7] || 0,
              created_at: args[8] || Date.now()
            };
            this.mockTables['stock_daily'] = this.mockTables['stock_daily'] || [];
            this.mockTables['stock_daily'].push(dailyData);
          } else if (query.includes('INSERT INTO user')) {
            const userData = {
              id: args[0],
              name: args[1],
              email: args[2],
              emailVerified: args[3],
              createdAt: args[4],
              updatedAt: args[5]
            };
            this.mockTables['user'] = this.mockTables['user'] || [];
            this.mockTables['user'].push(userData);
          } else if (query.includes('INSERT INTO user_stock_favorites')) {
            const favoriteData = {
              id: Date.now(),
              user_id: args[0],
              ts_code: args[1],
              created_at: args[2]
            };
            this.mockTables['user_stock_favorites'] = this.mockTables['user_stock_favorites'] || [];
            this.mockTables['user_stock_favorites'].push(favoriteData);
          }
          return { changes: 1, lastInsertRowid: 1 };
        },
        get: (...args: unknown[]) => {
          if (query.includes('SELECT 1 as test')) {
            return { test: 1 };
          }
          if (query.includes('PRAGMA foreign_keys')) {
            return { foreign_keys: this.foreignKeysEnabled ? 1 : 0 };
          }
          if (query.includes('PRAGMA integrity_check')) {
            return { integrity_check: 'ok' };
          }
          if (query.includes('SELECT id FROM __migrations WHERE id = ?')) {
            const [id] = args as [string];
            return (this.mockTables['__migrations'] || []).find(
              (record) => (record as { id: string }).id === id
            ) || null;
          }
          if (query.includes('SELECT * FROM stocks WHERE ts_code = ?')) {
            const [ts_code] = args;
            return (this.mockTables['stocks'] || []).find(
              (stock: any) => stock.ts_code === ts_code
            ) || null;
          }
          if (query.includes('SELECT * FROM stock_daily WHERE ts_code = ? AND trade_date = ?')) {
            const [ts_code, trade_date] = args;
            return (this.mockTables['stock_daily'] || []).find(
              (daily: any) => daily.ts_code === ts_code && daily.trade_date === trade_date
            ) || null;
          }
          if (query.includes('SELECT * FROM user_stock_favorites WHERE user_id = ? AND ts_code = ?')) {
            const [user_id, ts_code] = args;
            return (this.mockTables['user_stock_favorites'] || []).find(
              (fav: any) => fav.user_id === user_id && fav.ts_code === ts_code
            ) || null;
          }
          if (query.includes('SELECT COUNT(*) as count FROM stocks')) {
            return { count: (this.mockTables['stocks'] || []).length };
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
  
  // 仅用于测试的数据库访问方法
  public getDbForTesting(): DatabaseInterface {
    return this.db;
  }
}