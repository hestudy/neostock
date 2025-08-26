import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import * as schema from '../db/schema';
import { performanceMonitor } from './performance-monitor';

type SqliteRow = Record<string, string | number>;

// 数据库类型枚举
export enum DatabaseType {
	SQLITE = 'sqlite',
	TURSO = 'turso',
	MYSQL = 'mysql',
	POSTGRESQL = 'postgresql'
}

// 连接配置接口
export interface DatabaseConfig {
	type: DatabaseType;
	url: string;
	authToken?: string;
	maxConnections?: number;
	idleTimeout?: number;
	acquireTimeout?: number;
	ssl?: boolean;
	readReplicas?: string[];
	options?: Record<string, unknown>;
}

// 连接状态
export interface ConnectionStatus {
	connected: boolean;
	type: DatabaseType;
	uptime: number;
	activeConnections: number;
	maxConnections: number;
	performance: {
		avgQueryTime: number;
		slowQueries: number;
		errorRate: number;
	};
}

// 查询结果接口
export interface QueryResult<T = any> {
	data: T;
	executionTime: number;
	affectedRows?: number;
	metadata?: Record<string, unknown>;
}

// 事务选项
export interface TransactionOptions {
	isolationLevel?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
	timeout?: number;
	readOnly?: boolean;
}

// 抽象数据库接口
export interface DatabaseAdapter {
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
	transaction<T>(callback: (tx: DatabaseAdapter) => Promise<T>, options?: TransactionOptions): Promise<T>;
	getStatus(): Promise<ConnectionStatus>;
	healthCheck(): Promise<boolean>;
	optimize(): Promise<void>;
}

// SQLite/Turso 适配器实现
export class LibSQLAdapter implements DatabaseAdapter {
	private client: unknown;
	private db: unknown;
	private config: DatabaseConfig;
	private connectionStartTime: number;
	private queryCount = 0;
	private errorCount = 0;
	private totalQueryTime = 0;

	constructor(config: DatabaseConfig) {
		this.config = config;
		this.connectionStartTime = Date.now();
	}

	async connect(): Promise<void> {
		try {
			this.client = createClient({
				url: this.config.url,
				authToken: this.config.authToken,
				...this.config.options
			});

			this.db = drizzle(this.client as any, { schema });

			// 应用 SQLite 优化配置
			if (this.config.type === DatabaseType.SQLITE) {
				await this.applySQLiteOptimizations();
			}

			console.log(`✅ ${this.config.type.toUpperCase()} 数据库连接已建立`);
		} catch (error) {
			console.error(`❌ ${this.config.type.toUpperCase()} 数据库连接失败:`, error);
			throw error;
		}
	}

	private async applySQLiteOptimizations(): Promise<void> {
		const optimizations = [
			'PRAGMA journal_mode = WAL',
			'PRAGMA synchronous = NORMAL',
			'PRAGMA cache_size = -64000',
			'PRAGMA temp_store = MEMORY',
			'PRAGMA mmap_size = 268435456',
			'PRAGMA busy_timeout = 30000',
			'PRAGMA foreign_keys = ON'
		];

		for (const optimization of optimizations) {
			try {
				await (this.db as any).run(sql.raw(optimization));
			} catch (error) {
				console.warn(`⚠️  SQLite 优化配置失败: ${optimization}`, error);
			}
		}
	}

	async disconnect(): Promise<void> {
		try {
			if (this.client) {
				await (this.client as any).close();
			}
			console.log(`✅ ${this.config.type.toUpperCase()} 数据库连接已关闭`);
		} catch (error) {
			console.error(`❌ ${this.config.type.toUpperCase()} 数据库关闭失败:`, error);
		}
	}

	async query<T>(queryString: string, params: unknown[] = []): Promise<QueryResult<T>> {
		const startTime = performance.now();
		
		try {
			this.queryCount++;
			
			let result: unknown;
			if (params.length > 0) {
				// 参数化查询
				result = await (this.db as any).all(sql.raw(queryString));
			} else {
				// 简单查询
				result = await (this.db as any).all(sql.raw(queryString));
			}

			const executionTime = performance.now() - startTime;
			this.totalQueryTime += executionTime;

			// 记录性能监控
			performanceMonitor.recordQuery(
				'db_query', 
				executionTime,
				queryString.slice(0, 100) // 截取前100个字符作为查询标识
			);

			return {
				data: result as T,
				executionTime: Math.round(executionTime * 100) / 100,
				affectedRows: (result as { changes?: number }).changes || 0,
				metadata: {
					insertId: (result as { lastInsertRowid?: number }).lastInsertRowid
				}
			};

		} catch (error) {
			this.errorCount++;
			const executionTime = performance.now() - startTime;

			performanceMonitor.recordQuery(
				'db_query_error',
				executionTime,
				`ERROR: ${queryString.slice(0, 100)}`
			);

			console.error(`❌ 查询执行失败:`, {
				query: queryString.slice(0, 200),
				params,
				error: error instanceof Error ? error.message : String(error)
			});

			throw error;
		}
	}

	async transaction<T>(
		callback: (tx: DatabaseAdapter) => Promise<T>, 
		options: TransactionOptions = {}
	): Promise<T> {
		const startTime = performance.now();
		
		try {
			// 开启事务
			await (this.db as any).run(sql`BEGIN TRANSACTION`);

			// 设置事务隔离级别（如果支持）
			if (options.isolationLevel) {
				// SQLite 的隔离级别相对简单
				console.log(`📊 事务隔离级别: ${options.isolationLevel}`);
			}

			// 执行事务回调
			const result = await callback(this);

			// 提交事务
			await (this.db as any).run(sql`COMMIT`);

			const executionTime = performance.now() - startTime;
			performanceMonitor.recordQuery('db_transaction', executionTime, 'TRANSACTION_COMMIT');

			console.log(`✅ 事务提交成功 (${Math.round(executionTime)}ms)`);
			return result;

		} catch (error) {
			// 回滚事务
			try {
				await (this.db as any).run(sql`ROLLBACK`);
			} catch (rollbackError) {
				console.error('❌ 事务回滚失败:', rollbackError);
			}

			const executionTime = performance.now() - startTime;
			performanceMonitor.recordQuery('db_transaction_error', executionTime, 'TRANSACTION_ROLLBACK');

			console.error(`❌ 事务执行失败，已回滚:`, error);
			throw error;
		}
	}

	async getStatus(): Promise<ConnectionStatus> {
		try {
			const uptime = Date.now() - this.connectionStartTime;
			const avgQueryTime = this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0;
			const errorRate = this.queryCount > 0 ? (this.errorCount / this.queryCount) * 100 : 0;

			// 获取慢查询数量
			const slowQueries = performanceMonitor.getSlowQueriesReport().length;

			return {
				connected: Boolean(this.client),
				type: this.config.type,
				uptime: Math.round(uptime / 1000), // 转换为秒
				activeConnections: 1, // LibSQL 客户端通常管理单个连接
				maxConnections: this.config.maxConnections || 10,
				performance: {
					avgQueryTime: Math.round(avgQueryTime * 100) / 100,
					slowQueries,
					errorRate: Math.round(errorRate * 100) / 100
				}
			};
		} catch (error) {
			console.error('❌ 获取数据库状态失败:', error);
			throw error;
		}
	}

	async healthCheck(): Promise<boolean> {
		try {
			const result = await this.query('SELECT 1 as health_check');
			const isHealthy = Boolean(result.data && (result.data as SqliteRow[]).length > 0 && (result.data as SqliteRow[])[0]?.health_check === 1);
			
			if (isHealthy) {
				console.log('✅ 数据库健康检查通过');
			} else {
				console.warn('⚠️  数据库健康检查异常');
			}

			return isHealthy;
		} catch (error) {
			console.error('❌ 数据库健康检查失败:', error);
			return false;
		}
	}

	async optimize(): Promise<void> {
		try {
			console.log('🔄 开始数据库优化...');

			if (this.config.type === DatabaseType.SQLITE) {
				// SQLite 特定优化
				await (this.db as any).run(sql`ANALYZE`);
				await (this.db as any).run(sql`VACUUM`);
				console.log('✅ SQLite 数据库优化完成 (ANALYZE & VACUUM)');
			}

		} catch (error) {
			console.error('❌ 数据库优化失败:', error);
			throw error;
		}
	}

	// 获取原始数据库连接（用于复杂操作）
	getRawConnection() {
		return this.db;
	}
}

// 数据库抽象层管理器
export class DatabaseAbstractionLayer {
	private adapter: DatabaseAdapter;
	private config: DatabaseConfig;
	private isConnected = false;
	private reconnectionAttempts = 0;
	private readonly maxReconnectionAttempts = 3;
	private healthCheckInterval?: NodeJS.Timeout;

	constructor(config: DatabaseConfig) {
		this.config = config;
		this.adapter = this.createAdapter(config);
	}

	private createAdapter(config: DatabaseConfig): DatabaseAdapter {
		switch (config.type) {
			case DatabaseType.SQLITE:
			case DatabaseType.TURSO:
				return new LibSQLAdapter(config);
			
			case DatabaseType.MYSQL:
				// 未来可扩展 MySQL 适配器
				throw new Error('MySQL 适配器尚未实现');
				
			case DatabaseType.POSTGRESQL:
				// 未来可扩展 PostgreSQL 适配器
				throw new Error('PostgreSQL 适配器尚未实现');
				
			default:
				throw new Error(`不支持的数据库类型: ${config.type}`);
		}
	}

	async connect(): Promise<void> {
		try {
			await this.adapter.connect();
			this.isConnected = true;
			this.reconnectionAttempts = 0;
			
			// 启动定期健康检查
			this.startHealthCheck();
			
			console.log(`✅ 数据库抽象层连接成功 (${this.config.type})`);
		} catch (error) {
			this.isConnected = false;
			console.error(`❌ 数据库抽象层连接失败:`, error);
			throw error;
		}
	}

	async disconnect(): Promise<void> {
		try {
			this.stopHealthCheck();
			await this.adapter.disconnect();
			this.isConnected = false;
			
			console.log('✅ 数据库抽象层连接已关闭');
		} catch (error) {
			console.error('❌ 数据库抽象层断开连接失败:', error);
		}
	}

	async query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
		if (!this.isConnected) {
			throw new Error('数据库未连接');
		}

		try {
			return await this.adapter.query<T>(sql, params);
		} catch (error) {
			// 检查是否需要重连
			if (this.shouldReconnect(error as Error)) {
				await this.attemptReconnection();
				// 重试查询
				return await this.adapter.query<T>(sql, params);
			}
			throw error;
		}
	}

	async transaction<T>(
		callback: (tx: DatabaseAdapter) => Promise<T>,
		options?: TransactionOptions
	): Promise<T> {
		if (!this.isConnected) {
			throw new Error('数据库未连接');
		}

		return await this.adapter.transaction(callback, options);
	}

	private shouldReconnect(error: Error): boolean {
		// 判断是否为连接相关的错误
		const connectionErrors = [
			'connection closed',
			'connection lost',
			'network error',
			'timeout',
			'ECONNRESET',
			'ECONNREFUSED'
		];

		const errorMessage = (error instanceof Error ? error.message : String(error)).toLowerCase();
		return connectionErrors.some(err => errorMessage.includes(err));
	}

	private async attemptReconnection(): Promise<void> {
		if (this.reconnectionAttempts >= this.maxReconnectionAttempts) {
			throw new Error(`达到最大重连次数限制 (${this.maxReconnectionAttempts})`);
		}

		this.reconnectionAttempts++;
		console.log(`🔄 尝试重连数据库 (${this.reconnectionAttempts}/${this.maxReconnectionAttempts})`);

		try {
			await this.adapter.disconnect();
			await new Promise(resolve => setTimeout(resolve, 1000 * this.reconnectionAttempts)); // 指数退避
			await this.adapter.connect();
			
			this.isConnected = true;
			console.log('✅ 数据库重连成功');
		} catch (error) {
			console.error(`❌ 数据库重连失败 (尝试 ${this.reconnectionAttempts}):`, error);
			
			if (this.reconnectionAttempts >= this.maxReconnectionAttempts) {
				this.isConnected = false;
				throw error;
			}
		}
	}

	private startHealthCheck(): void {
		// 每30秒进行一次健康检查
		this.healthCheckInterval = setInterval(async () => {
			try {
				const isHealthy = await this.adapter.healthCheck();
				if (!isHealthy && this.isConnected) {
					console.warn('⚠️  数据库健康检查失败，尝试重连...');
					await this.attemptReconnection();
				}
			} catch (error) {
				console.error('❌ 健康检查异常:', error);
			}
		}, 30000);
	}

	private stopHealthCheck(): void {
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval);
			this.healthCheckInterval = undefined;
		}
	}

	async getStatus(): Promise<ConnectionStatus> {
		return await this.adapter.getStatus();
	}

	async healthCheck(): Promise<boolean> {
		return await this.adapter.healthCheck();
	}

	async optimize(): Promise<void> {
		return await this.adapter.optimize();
	}

	// 切换数据库适配器（用于迁移）
	async switchAdapter(newConfig: DatabaseConfig): Promise<void> {
		console.log(`🔄 切换数据库适配器: ${this.config.type} -> ${newConfig.type}`);

		// 断开当前连接
		await this.disconnect();

		// 创建新适配器
		this.config = newConfig;
		this.adapter = this.createAdapter(newConfig);

		// 连接新数据库
		await this.connect();

		console.log(`✅ 数据库适配器切换完成`);
	}

	// 获取原始适配器（用于特定数据库操作）
	getRawAdapter(): DatabaseAdapter {
		return this.adapter;
	}

	// 获取连接状态
	isReady(): boolean {
		return this.isConnected;
	}

	// 更新配置
	updateConfig(updates: Partial<DatabaseConfig>): void {
		Object.assign(this.config, updates);
		console.log('⚙️  数据库配置已更新');
	}
}

// 工厂函数，用于创建数据库抽象层实例
export function createDatabaseAbstractionLayer(config?: Partial<DatabaseConfig>): DatabaseAbstractionLayer {
	const defaultConfig: DatabaseConfig = {
		type: process.env.DATABASE_TYPE as DatabaseType || DatabaseType.SQLITE,
		url: process.env.DATABASE_URL || 'file:local.db',
		authToken: process.env.DATABASE_AUTH_TOKEN,
		maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10'),
		idleTimeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000'),
		acquireTimeout: parseInt(process.env.DATABASE_ACQUIRE_TIMEOUT || '60000')
	};

	const finalConfig = { ...defaultConfig, ...config };
	return new DatabaseAbstractionLayer(finalConfig);
}

// 全局数据库抽象层实例
export const databaseLayer = createDatabaseAbstractionLayer();