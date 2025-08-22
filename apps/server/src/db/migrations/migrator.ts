import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';

export interface Migration {
  id: string;
  name: string;
  up: (db: ReturnType<typeof drizzle>) => Promise<void>;
  down: (db: ReturnType<typeof drizzle>) => Promise<void>;
}

export class DatabaseMigrator {
  private db: ReturnType<typeof drizzle>;
  private sqlite: Database.Database;
  private migrations: Migration[] = [];

  constructor(databasePath: string = ':memory:') {
    this.sqlite = new Database(databasePath);
    this.db = drizzle(this.sqlite);
    this.initializeMigrationTable();
  }

  private initializeMigrationTable() {
    // Create migrations tracking table
    this.sqlite.exec(`
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

  async runMigrations(): Promise<{ success: boolean; applied: string[]; errors: string[] }> {
    const result = { success: true, applied: [] as string[], errors: [] as string[] };
    
    for (const migration of this.migrations) {
      try {
        // Check if migration already applied
        const existing = this.sqlite
          .prepare('SELECT id FROM __migrations WHERE id = ?')
          .get(migration.id);
        
        if (existing) {
          continue;
        }

        // Begin transaction
        const transaction = this.sqlite.transaction(async () => {
          await migration.up(this.db);
          
          // Record migration
          this.sqlite
            .prepare('INSERT INTO __migrations (id, name) VALUES (?, ?)')
            .run(migration.id, migration.name);
        });

        transaction();
        result.applied.push(migration.id);
      } catch (error) {
        result.success = false;
        result.errors.push(`Migration ${migration.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return result;
  }

  async rollbackMigration(migrationId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const migration = this.migrations.find(m => m.id === migrationId);
      if (!migration) {
        throw new Error(`Migration ${migrationId} not found`);
      }

      // Begin transaction
      const transaction = this.sqlite.transaction(async () => {
        await migration.down(this.db);
        
        // Remove migration record
        this.sqlite
          .prepare('DELETE FROM __migrations WHERE id = ?')
          .run(migrationId);
      });

      transaction();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  async getAppliedMigrations(): Promise<Array<{ id: string; name: string; applied_at: string }>> {
    return this.sqlite
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

  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, any> }> {
    try {
      // Test database connection
      const testResult = this.sqlite.prepare('SELECT 1 as test').get();
      
      // Get migration status
      const appliedMigrations = await this.getAppliedMigrations();
      const totalMigrations = this.migrations.length;
      
      // Check for pending migrations
      const pendingMigrations = this.migrations.filter(
        m => !appliedMigrations.some(am => am.id === m.id)
      );

      return {
        healthy: testResult && testResult.test === 1,
        details: {
          connectionTest: testResult?.test === 1,
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
    this.sqlite.close();
  }
}