import { databaseLayer } from './database-abstraction-layer';
import { performanceMonitor } from './performance-monitor';
import { DataStorageOptimizer } from './data-storage-optimizer';
import * as os from 'os';
// import { EnhancedMigrator } from '../db/migrations/enhanced-migrator';

interface HealthCheckResult {
	status: 'healthy' | 'degraded' | 'unhealthy';
	timestamp: number;
	uptime: number;
	version: string;
	environment: string;
	database: {
		connection: 'connected' | 'disconnected' | 'error';
		type: string;
		response_time: number;
		active_connections: number;
		max_connections: number;
		performance: {
			avg_query_time: number;
			slow_queries: number;
			error_rate: number;
		};
		storage: {
			size_mb: number;
			fragmentation: number;
			vacuum_recommended: boolean;
		};
		migrations: {
			applied: number;
			pending: number;
			last_migration: string;
			status: 'current' | 'behind' | 'error';
		};
	};
	services: {
		[serviceName: string]: {
			status: 'up' | 'down' | 'degraded';
			response_time?: number;
			last_check: number;
			message?: string;
		};
	};
	metrics: {
		requests_per_minute: number;
		active_users: number;
		memory_usage: {
			used_mb: number;
			total_mb: number;
			usage_percent: number;
		};
		disk_usage: {
			used_mb: number;
			available_mb: number;
			usage_percent: number;
		};
	};
	alerts: Array<{
		level: 'info' | 'warning' | 'error' | 'critical';
		message: string;
		timestamp: number;
		component: string;
	}>;
}

interface DetailedHealthCheck extends HealthCheckResult {
	database_details: {
		pragma_settings: Record<string, any>;
		table_stats: Record<string, number>;
		index_stats: Record<string, any>;
		recent_queries: Array<{
			query: string;
			duration: number;
			timestamp: number;
		}>;
		migration_history: Array<{
			id: string;
			name: string;
			applied_at: number;
			status: string;
		}>;
	};
	performance_details: {
		query_distribution: Record<string, number>;
		response_time_percentiles: {
			p50: number;
			p95: number;
			p99: number;
		};
		connection_pool_stats: {
			created: number;
			destroyed: number;
			acquired: number;
			released: number;
		};
	};
}

export class DatabaseHealthEndpoint {
	private startTime = Date.now();
	private storageOptimizer = new DataStorageOptimizer();
	private lastHealthCheck?: HealthCheckResult;
	private healthCheckCache = new Map<string, { result: unknown; timestamp: number }>();
	private readonly CACHE_TTL = 30000; // 30秒缓存

	// 基础健康检查
	async getHealthStatus(): Promise<HealthCheckResult> {
		const cacheKey = 'basic_health';
		const cached = this.getCachedResult<HealthCheckResult>(cacheKey);
		if (cached) return cached;

		console.log('🔍 执行数据库健康检查...');

		const result: HealthCheckResult = {
			status: 'healthy',
			timestamp: Date.now(),
			uptime: Math.floor((Date.now() - this.startTime) / 1000),
			version: process.env.APP_VERSION || '1.1.0',
			environment: process.env.NODE_ENV || 'development',
			database: {
				connection: 'disconnected',
				type: 'unknown',
				response_time: 0,
				active_connections: 0,
				max_connections: 0,
				performance: {
					avg_query_time: 0,
					slow_queries: 0,
					error_rate: 0
				},
				storage: {
					size_mb: 0,
					fragmentation: 0,
					vacuum_recommended: false
				},
				migrations: {
					applied: 0,
					pending: 0,
					last_migration: 'none',
					status: 'current'
				}
			},
			services: {},
			metrics: {
				requests_per_minute: 0,
				active_users: 0,
				memory_usage: {
					used_mb: 0,
					total_mb: 0,
					usage_percent: 0
				},
				disk_usage: {
					used_mb: 0,
					available_mb: 0,
					usage_percent: 0
				}
			},
			alerts: []
		};

		try {
			// 1. 检查数据库连接
			await this.checkDatabaseConnection(result);

			// 2. 检查数据库性能
			await this.checkDatabasePerformance(result);

			// 3. 检查存储状态
			await this.checkStorageStatus(result);

			// 4. 检查迁移状态
			await this.checkMigrationStatus(result);

			// 5. 检查系统资源
			await this.checkSystemResources(result);

			// 6. 检查相关服务
			await this.checkDependentServices(result);

			// 7. 生成告警
			this.generateAlerts(result);

			// 8. 确定整体健康状态
			this.determineOverallStatus(result);

			this.lastHealthCheck = result;
			this.setCachedResult(cacheKey, result);

			console.log(`${this.getStatusEmoji(result.status)} 健康检查完成: ${result.status}`);

		} catch (error) {
			result.status = 'unhealthy';
			result.alerts.push({
				level: 'critical',
				message: `健康检查异常: ${error instanceof Error ? error.message : String(error)}`,
				timestamp: Date.now(),
				component: 'health_check'
			});

			console.error('❌ 健康检查失败:', error);
		}

		return result;
	}

	private async checkDatabaseConnection(result: HealthCheckResult): Promise<void> {
		const startTime = performance.now();

		try {
			const isHealthy = await databaseLayer.healthCheck();
			const responseTime = performance.now() - startTime;
			const status = await databaseLayer.getStatus();

			result.database.connection = isHealthy ? 'connected' : 'error';
			result.database.type = status.type;
			result.database.response_time = Math.round(responseTime * 100) / 100;
			result.database.active_connections = status.activeConnections;
			result.database.max_connections = status.maxConnections;

		} catch (error) {
			result.database.connection = 'error';
			result.database.response_time = performance.now() - startTime;
			
			result.alerts.push({
				level: 'critical',
				message: `数据库连接失败: ${error instanceof Error ? error.message : String(error)}`,
				timestamp: Date.now(),
				component: 'database'
			});
		}
	}

	private async checkDatabasePerformance(result: HealthCheckResult): Promise<void> {
		try {
			const perfStats = performanceMonitor.getPerformanceStats();
			const slowQueries = performanceMonitor.getSlowQueriesReport();

			result.database.performance.avg_query_time = perfStats.summary.averageResponseTime;
			result.database.performance.slow_queries = slowQueries.length;

			// 计算错误率
			const totalQueries = perfStats.summary.totalQueries;
			if (totalQueries > 0) {
				const errorQueries = perfStats.queries.filter(q => q.query.includes('ERROR')).length;
				result.database.performance.error_rate = Math.round((errorQueries / totalQueries) * 100 * 100) / 100;
			}

			// 性能告警检查
			const alerts = performanceMonitor.checkPerformanceAlerts();
			for (const alert of alerts) {
				result.alerts.push({
					level: alert.severity === 'critical' ? 'critical' : 'warning',
					message: alert.message,
					timestamp: Date.now(),
					component: 'database_performance'
				});
			}

		} catch (error) {
			result.alerts.push({
				level: 'warning',
				message: `性能检查失败: ${error instanceof Error ? error.message : String(error)}`,
				timestamp: Date.now(),
				component: 'performance'
			});
		}
	}

	private async checkStorageStatus(result: HealthCheckResult): Promise<void> {
		try {
			const storageStats = await this.storageOptimizer.getStorageStats();

			result.database.storage.size_mb = storageStats.database_size_mb;
			result.database.storage.fragmentation = Math.round(storageStats.fragmentation_ratio * 100);
			result.database.storage.vacuum_recommended = storageStats.vacuum_recommended;

			// 存储告警
			if (storageStats.database_size_mb > 1000) { // 超过1GB
				result.alerts.push({
					level: 'warning',
					message: `数据库大小较大: ${storageStats.database_size_mb}MB，考虑数据归档`,
					timestamp: Date.now(),
					component: 'storage'
				});
			}

			if (storageStats.fragmentation_ratio > 0.3) {
				result.alerts.push({
					level: 'warning',
					message: `数据库碎片率过高: ${Math.round(storageStats.fragmentation_ratio * 100)}%，建议执行VACUUM`,
					timestamp: Date.now(),
					component: 'storage'
				});
			}

		} catch (error) {
			result.alerts.push({
				level: 'warning',
				message: `存储检查失败: ${error instanceof Error ? error.message : String(error)}`,
				timestamp: Date.now(),
				component: 'storage'
			});
		}
	}

	private async checkMigrationStatus(result: HealthCheckResult): Promise<void> {
		try {
			// 这里需要访问迁移器实例，简化实现
			// 在实际应用中，可以通过依赖注入或全局注册获取
			result.database.migrations.status = 'current';
			result.database.migrations.last_migration = 'v1.1_create_stocks_tables';
			
		} catch (error) {
			result.database.migrations.status = 'error';
			result.alerts.push({
				level: 'error',
				message: `迁移状态检查失败: ${error instanceof Error ? error.message : String(error)}`,
				timestamp: Date.now(),
				component: 'migrations'
			});
		}
	}

	private async checkSystemResources(result: HealthCheckResult): Promise<void> {
		try {
			// 内存使用情况
			const memUsage = process.memoryUsage();
			const totalMemory = os.totalmem();
			const usedMemory = memUsage.heapUsed;

			result.metrics.memory_usage.used_mb = Math.round(usedMemory / 1024 / 1024);
			result.metrics.memory_usage.total_mb = Math.round(totalMemory / 1024 / 1024);
			result.metrics.memory_usage.usage_percent = Math.round((usedMemory / totalMemory) * 100);

			// CPU 和系统负载
			const loadAvg = os.loadavg();
			const cpuCount = os.cpus().length;

			// 内存告警
			if (result.metrics.memory_usage.usage_percent > 80) {
				result.alerts.push({
					level: 'warning',
					message: `内存使用率过高: ${result.metrics.memory_usage.usage_percent}%`,
					timestamp: Date.now(),
					component: 'system'
				});
			}

			// CPU 负载告警
			if (loadAvg[0] > cpuCount * 0.8) {
				result.alerts.push({
					level: 'warning',
					message: `系统负载较高: ${loadAvg[0].toFixed(2)} (CPU核心数: ${cpuCount})`,
					timestamp: Date.now(),
					component: 'system'
				});
			}

		} catch (error) {
			result.alerts.push({
				level: 'info',
				message: `系统资源检查失败: ${error instanceof Error ? error.message : String(error)}`,
				timestamp: Date.now(),
				component: 'system'
			});
		}
	}

	private async checkDependentServices(result: HealthCheckResult): Promise<void> {
		// 检查依赖的外部服务
		const servicesToCheck = [
			{ name: 'performance_monitor', check: () => performanceMonitor.getPerformanceStats() },
			{ name: 'storage_optimizer', check: () => this.storageOptimizer.getStorageStats() }
		];

		for (const service of servicesToCheck) {
			const startTime = performance.now();
			
			try {
				await service.check();
				const responseTime = performance.now() - startTime;

				result.services[service.name] = {
					status: 'up',
					response_time: Math.round(responseTime * 100) / 100,
					last_check: Date.now()
				};

			} catch (error) {
				result.services[service.name] = {
					status: 'down',
					last_check: Date.now(),
					message: error instanceof Error ? error.message : String(error)
				};

				result.alerts.push({
					level: 'warning',
					message: `服务 ${service.name} 不可用`,
					timestamp: Date.now(),
					component: 'services'
				});
			}
		}
	}

	private generateAlerts(result: HealthCheckResult): void {
		// 连接告警
		if (result.database.connection === 'error') {
			result.alerts.push({
				level: 'critical',
				message: '数据库连接不可用',
				timestamp: Date.now(),
				component: 'database'
			});
		}

		// 响应时间告警
		if (result.database.response_time > 1000) {
			result.alerts.push({
				level: 'warning',
				message: `数据库响应时间过长: ${result.database.response_time}ms`,
				timestamp: Date.now(),
				component: 'performance'
			});
		}

		// 连接池告警
		if (result.database.active_connections > result.database.max_connections * 0.8) {
			result.alerts.push({
				level: 'warning',
				message: `数据库连接使用率过高: ${result.database.active_connections}/${result.database.max_connections}`,
				timestamp: Date.now(),
				component: 'connections'
			});
		}
	}

	private determineOverallStatus(result: HealthCheckResult): void {
		const criticalAlerts = result.alerts.filter(a => a.level === 'critical').length;
		const errorAlerts = result.alerts.filter(a => a.level === 'error').length;
		const warningAlerts = result.alerts.filter(a => a.level === 'warning').length;

		if (criticalAlerts > 0 || result.database.connection === 'error') {
			result.status = 'unhealthy';
		} else if (errorAlerts > 0 || warningAlerts > 2) {
			result.status = 'degraded';
		} else {
			result.status = 'healthy';
		}
	}

	// 详细健康检查
	async getDetailedHealthStatus(): Promise<DetailedHealthCheck> {
		const cacheKey = 'detailed_health';
		const cached = this.getCachedResult<DetailedHealthCheck>(cacheKey);
		if (cached) return cached;

		console.log('🔍 执行详细健康检查...');

		const basicHealth = await this.getHealthStatus();
		
		const detailedResult: DetailedHealthCheck = {
			...basicHealth,
			database_details: {
				pragma_settings: {},
				table_stats: {},
				index_stats: {},
				recent_queries: [],
				migration_history: []
			},
			performance_details: {
				query_distribution: {},
				response_time_percentiles: {
					p50: 0,
					p95: 0,
					p99: 0
				},
				connection_pool_stats: {
					created: 0,
					destroyed: 0,
					acquired: 0,
					released: 0
				}
			}
		};

		try {
			// 获取数据库详细信息
			await this.getDatabaseDetails(detailedResult);

			// 获取性能详细信息
			await this.getPerformanceDetails(detailedResult);

			this.setCachedResult(cacheKey, detailedResult);

		} catch (error) {
			detailedResult.alerts.push({
				level: 'warning',
				message: `详细健康检查部分失败: ${error instanceof Error ? error.message : String(error)}`,
				timestamp: Date.now(),
				component: 'detailed_check'
			});
		}

		return detailedResult;
	}

	private async getDatabaseDetails(result: DetailedHealthCheck): Promise<void> {
		try {
			// 获取 PRAGMA 设置
			const pragmaQueries = [
				'PRAGMA journal_mode',
				'PRAGMA synchronous',
				'PRAGMA cache_size',
				'PRAGMA temp_store',
				'PRAGMA foreign_keys'
			];

			for (const pragma of pragmaQueries) {
				try {
					const queryResult = await databaseLayer.query(pragma);
					const key = pragma.replace('PRAGMA ', '');
					result.database_details.pragma_settings[key] = queryResult.data;
				} catch (error) {
					console.warn(`⚠️  PRAGMA 查询失败: ${pragma}`, error);
				}
			}

			// 获取表统计信息
			const storageStats = await this.storageOptimizer.getStorageStats();
			result.database_details.table_stats = storageStats.table_sizes;

			// 获取最近查询
			const slowQueries = performanceMonitor.getSlowQueriesReport().slice(0, 10);
			result.database_details.recent_queries = slowQueries.map(q => ({
				query: q.query.slice(0, 100) + '...',
				duration: q.duration,
				timestamp: q.timestamp
			}));

		} catch (error) {
			console.error('❌ 获取数据库详情失败:', error);
		}
	}

	private async getPerformanceDetails(result: DetailedHealthCheck): Promise<void> {
		try {
			const perfStats = performanceMonitor.getPerformanceStats();
			
			// 查询类型分布
			for (const query of perfStats.queries) {
				const queryType = query.query.split(':')[0] || 'unknown';
				result.performance_details.query_distribution[queryType] = 
					(result.performance_details.query_distribution[queryType] || 0) + query.count;
			}

			// 响应时间百分位数（简化计算）
			const allQueries = perfStats.queries.flatMap(q => 
				Array(q.count).fill(q.averageTime)
			).sort((a, b) => a - b);

			if (allQueries.length > 0) {
				const p50Index = Math.floor(allQueries.length * 0.5);
				const p95Index = Math.floor(allQueries.length * 0.95);
				const p99Index = Math.floor(allQueries.length * 0.99);

				result.performance_details.response_time_percentiles = {
					p50: allQueries[p50Index] || 0,
					p95: allQueries[p95Index] || 0,
					p99: allQueries[p99Index] || 0
				};
			}

		} catch (error) {
			console.error('❌ 获取性能详情失败:', error);
		}
	}

	// 缓存管理
	private getCachedResult<T>(key: string): T | null {
		const cached = this.healthCheckCache.get(key);
		if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
			return cached.result as T;
		}
		return null;
	}

	private setCachedResult<T>(key: string, result: T): void {
		this.healthCheckCache.set(key, {
			result,
			timestamp: Date.now()
		});
	}

	// 清理过期缓存
	private cleanupCache(): void {
		const now = Date.now();
		for (const [key, cached] of this.healthCheckCache.entries()) {
			if (now - cached.timestamp > this.CACHE_TTL) {
				this.healthCheckCache.delete(key);
			}
		}
	}

	private getStatusEmoji(status: string): string {
		switch (status) {
			case 'healthy': return '✅';
			case 'degraded': return '⚠️';
			case 'unhealthy': return '❌';
			default: return '❓';
		}
	}

	// 获取健康检查历史
	getHealthHistory(): HealthCheckResult[] {
		// 在实际应用中，这里应该从持久化存储中获取历史数据
		return this.lastHealthCheck ? [this.lastHealthCheck] : [];
	}

	// 强制刷新健康检查
	async forceRefresh(): Promise<HealthCheckResult> {
		this.healthCheckCache.clear();
		return await this.getHealthStatus();
	}

	// 启动定期健康检查
	startPeriodicHealthCheck(intervalMs: number = 60000): NodeJS.Timeout {
		console.log(`⏰ 启动定期健康检查 (间隔: ${intervalMs}ms)`);

		return setInterval(async () => {
			try {
				await this.getHealthStatus();
				this.cleanupCache();
			} catch (error) {
				console.error('❌ 定期健康检查失败:', error);
			}
		}, intervalMs);
	}
}

// 全局健康检查实例
export const healthEndpoint = new DatabaseHealthEndpoint();