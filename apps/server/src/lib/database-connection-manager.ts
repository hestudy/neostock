import { DatabaseAbstractionLayer } from './database-abstraction-layer';
import type { DatabaseConfig } from './database-abstraction-layer';
import { performanceMonitor } from './performance-monitor';

interface ConnectionPoolConfig {
	minConnections: number;
	maxConnections: number;
	acquireTimeout: number;
	idleTimeout: number;
	reapInterval: number;
	createRetryInterval: number;
	createTimeout: number;
	validateQuery: string;
}

interface ReadReplicaConfig {
	url: string;
	weight: number; // 负载权重
	authToken?: string;
	maxConnections?: number;
}

interface ConnectionManagerConfig {
	primary: DatabaseConfig;
	readReplicas?: ReadReplicaConfig[];
	poolConfig: ConnectionPoolConfig;
	enableReadWriteSplit: boolean;
	failoverConfig: {
		enableFailover: boolean;
		healthCheckInterval: number;
		maxFailoverAttempts: number;
		failoverTimeout: number;
	};
	monitoring: {
		enableMetrics: boolean;
		slowQueryThreshold: number;
		connectionAlertThreshold: number;
	};
}

interface ConnectionStats {
	total_connections: number;
	active_connections: number;
	idle_connections: number;
	pending_requests: number;
	successful_queries: number;
	failed_queries: number;
	avg_response_time: number;
	slow_queries_count: number;
	read_replica_stats: Array<{
		url: string;
		active: boolean;
		connections: number;
		last_health_check: number;
	}>;
}

export class DatabaseConnectionManager {
	private primaryConnection: DatabaseAbstractionLayer;
	private readReplicas: Map<string, DatabaseAbstractionLayer> = new Map();
	private config: ConnectionManagerConfig;
	private connectionStats: ConnectionStats;
	private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
	private isFailoverActive = false;
	private currentPrimaryIndex = 0;

	constructor(config: ConnectionManagerConfig) {
		this.config = config;
		this.primaryConnection = new DatabaseAbstractionLayer(config.primary);
		this.connectionStats = this.initializeStats();
		this.setupReadReplicas();
	}

	private initializeStats(): ConnectionStats {
		return {
			total_connections: 0,
			active_connections: 0,
			idle_connections: 0,
			pending_requests: 0,
			successful_queries: 0,
			failed_queries: 0,
			avg_response_time: 0,
			slow_queries_count: 0,
			read_replica_stats: []
		};
	}

	private setupReadReplicas(): void {
		if (!this.config.readReplicas) return;

		for (const replicaConfig of this.config.readReplicas) {
			const replicaDbConfig: DatabaseConfig = {
				type: this.config.primary.type,
				url: replicaConfig.url,
				authToken: replicaConfig.authToken,
				maxConnections: replicaConfig.maxConnections || this.config.primary.maxConnections
			};

			const replica = new DatabaseAbstractionLayer(replicaDbConfig);
			this.readReplicas.set(replicaConfig.url, replica);

			// 初始化副本统计
			this.connectionStats.read_replica_stats.push({
				url: replicaConfig.url,
				active: false,
				connections: 0,
				last_health_check: 0
			});
		}

		console.log(`📊 配置了 ${this.readReplicas.size} 个读副本`);
	}

	async initialize(): Promise<void> {
		console.log('🚀 初始化数据库连接管理器...');

		try {
			// 连接主数据库
			await this.primaryConnection.connect();
			this.connectionStats.total_connections++;
			console.log('✅ 主数据库连接已建立');

			// 连接读副本
			if (this.config.readReplicas && this.config.enableReadWriteSplit) {
				await this.connectReadReplicas();
			}

			// 启动健康检查
			if (this.config.failoverConfig.enableFailover) {
				this.startHealthChecks();
			}

			// 启动监控
			if (this.config.monitoring.enableMetrics) {
				this.startMonitoring();
			}

			console.log('✅ 数据库连接管理器初始化完成');

		} catch (error) {
			console.error('❌ 数据库连接管理器初始化失败:', error);
			throw error;
		}
	}

	private async connectReadReplicas(): Promise<void> {
		console.log('🔗 连接读副本...');

		const connectionPromises = Array.from(this.readReplicas.entries()).map(
			async ([url, replica]) => {
				try {
					await replica.connect();
					this.connectionStats.total_connections++;
					
					// 更新副本状态
					const replicaStats = this.connectionStats.read_replica_stats.find(r => r.url === url);
					if (replicaStats) {
						replicaStats.active = true;
						replicaStats.last_health_check = Date.now();
					}

					console.log(`✅ 读副本连接成功: ${url}`);
				} catch (error) {
					console.error(`❌ 读副本连接失败: ${url}`, error);
					
					// 标记副本为不活跃
					const replicaStats = this.connectionStats.read_replica_stats.find(r => r.url === url);
					if (replicaStats) {
						replicaStats.active = false;
					}
				}
			}
		);

		await Promise.allSettled(connectionPromises);
		
		const activeReplicas = this.connectionStats.read_replica_stats.filter(r => r.active).length;
		console.log(`📊 读副本连接完成: ${activeReplicas}/${this.readReplicas.size} 个副本可用`);
	}

	private startHealthChecks(): void {
		const checkInterval = this.config.failoverConfig.healthCheckInterval;

		// 主数据库健康检查
		const primaryHealthCheck = setInterval(async () => {
			try {
				const isHealthy = await this.primaryConnection.healthCheck();
				if (!isHealthy && !this.isFailoverActive) {
					console.warn('⚠️  主数据库健康检查失败，考虑故障转移');
					await this.handlePrimaryFailure();
				}
			} catch (error) {
				console.error('❌ 主数据库健康检查异常:', error);
			}
		}, checkInterval);

		this.healthCheckIntervals.set('primary', primaryHealthCheck);

		// 读副本健康检查
		for (const [url, replica] of this.readReplicas) {
			const replicaHealthCheck = setInterval(async () => {
				try {
					const isHealthy = await replica.healthCheck();
					const replicaStats = this.connectionStats.read_replica_stats.find(r => r.url === url);
					
					if (replicaStats) {
						replicaStats.active = isHealthy;
						replicaStats.last_health_check = Date.now();
					}

					if (!isHealthy) {
						console.warn(`⚠️  读副本健康检查失败: ${url}`);
					}
				} catch (error) {
					console.error(`❌ 读副本健康检查异常: ${url}`, error);
					
					// 标记副本为不活跃
					const replicaStats = this.connectionStats.read_replica_stats.find(r => r.url === url);
					if (replicaStats) {
						replicaStats.active = false;
					}
				}
			}, checkInterval);

			this.healthCheckIntervals.set(url, replicaHealthCheck);
		}

		console.log(`⏰ 健康检查已启动 (间隔: ${checkInterval}ms)`);
	}

	private async handlePrimaryFailure(): Promise<void> {
		if (this.isFailoverActive) {
			console.log('📋 故障转移已在进行中，跳过');
			return;
		}

		this.isFailoverActive = true;
		console.log('🔄 开始故障转移流程...');

		try {
			// 查找可用的读副本作为新的主库
			const activeReplicas = Array.from(this.readReplicas.entries())
				.filter(([url]) => {
					const stats = this.connectionStats.read_replica_stats.find(r => r.url === url);
					return stats?.active;
				});

			if (activeReplicas.length === 0) {
				throw new Error('没有可用的副本进行故障转移');
			}

			// 选择第一个活跃的副本作为新主库
			const [newPrimaryUrl, newPrimaryConnection] = activeReplicas[0];
			console.log(`📊 选择新主库: ${newPrimaryUrl}`);

			// 更新主连接
			await this.primaryConnection.disconnect();
			this.primaryConnection = newPrimaryConnection;

			// 从副本列表中移除新主库
			this.readReplicas.delete(newPrimaryUrl);
			this.connectionStats.read_replica_stats = this.connectionStats.read_replica_stats
				.filter(r => r.url !== newPrimaryUrl);

			console.log('✅ 故障转移完成');

		} catch (error) {
			console.error('❌ 故障转移失败:', error);
		} finally {
			this.isFailoverActive = false;
		}
	}

	// 智能查询路由
	async executeQuery<T>(
		sql: string, 
		params?: unknown[], 
		options: { preferRead?: boolean; forceWrite?: boolean } = {}
	): Promise<T> {
		const startTime = performance.now();
		this.connectionStats.pending_requests++;

		try {
			let connection = this.primaryConnection;

			// 读写分离逻辑
			if (this.config.enableReadWriteSplit && options.preferRead && !options.forceWrite) {
				connection = this.selectReadReplica() || this.primaryConnection;
			}

			// 执行查询
			const result = await connection.query<T>(sql, params);
			
			// 更新统计
			const executionTime = performance.now() - startTime;
			this.updateQueryStats(executionTime, true);

			return result.data;

		} catch (error) {
			const executionTime = performance.now() - startTime;
			this.updateQueryStats(executionTime, false);
			
			console.error('❌ 查询执行失败:', error);
			throw error;
		} finally {
			this.connectionStats.pending_requests--;
		}
	}

	private selectReadReplica(): DatabaseAbstractionLayer | null {
		// 基于权重的负载均衡选择读副本
		const activeReplicas = Array.from(this.readReplicas.entries()).filter(([url]) => {
			const stats = this.connectionStats.read_replica_stats.find(r => r.url === url);
			return stats?.active;
		});

		if (activeReplicas.length === 0) {
			return null;
		}

		// 简单的轮询选择
		const selectedIndex = this.currentPrimaryIndex % activeReplicas.length;
		this.currentPrimaryIndex = (this.currentPrimaryIndex + 1) % activeReplicas.length;

		return activeReplicas[selectedIndex][1];
	}

	private updateQueryStats(executionTime: number, success: boolean): void {
		if (success) {
			this.connectionStats.successful_queries++;
		} else {
			this.connectionStats.failed_queries++;
		}

		// 更新平均响应时间
		const totalQueries = this.connectionStats.successful_queries + this.connectionStats.failed_queries;
		this.connectionStats.avg_response_time = 
			(this.connectionStats.avg_response_time * (totalQueries - 1) + executionTime) / totalQueries;

		// 检查慢查询
		if (executionTime > this.config.monitoring.slowQueryThreshold) {
			this.connectionStats.slow_queries_count++;
		}

		// 记录到性能监控器
		performanceMonitor.recordQuery(
			success ? 'connection_manager_query' : 'connection_manager_query_error',
			executionTime
		);
	}

	// 事务执行（始终在主库上执行）
	async executeTransaction<T>(
		callback: (connection: DatabaseAbstractionLayer) => Promise<T>
	): Promise<T> {
		console.log('🔄 在主库上执行事务...');
		
		const startTime = performance.now();
		this.connectionStats.pending_requests++;

		try {
			const result = await this.primaryConnection.transaction(
				async () => await callback(this.primaryConnection)
			);

			const executionTime = performance.now() - startTime;
			this.updateQueryStats(executionTime, true);

			console.log(`✅ 事务执行完成 (${Math.round(executionTime)}ms)`);
			return result;

		} catch (error) {
			const executionTime = performance.now() - startTime;
			this.updateQueryStats(executionTime, false);

			console.error('❌ 事务执行失败:', error);
			throw error;
		} finally {
			this.connectionStats.pending_requests--;
		}
	}

	// 获取连接统计
	getConnectionStats(): ConnectionStats {
		// 更新活跃连接数
		this.connectionStats.active_connections = this.connectionStats.pending_requests;
		this.connectionStats.idle_connections = 
			this.connectionStats.total_connections - this.connectionStats.active_connections;

		return { ...this.connectionStats };
	}

	// 启动监控
	private startMonitoring(): void {
		setInterval(() => {
			const stats = this.getConnectionStats();
			
			// 连接数告警
			if (stats.active_connections > this.config.monitoring.connectionAlertThreshold) {
				console.warn(`⚠️  活跃连接数过高: ${stats.active_connections}/${stats.total_connections}`);
			}

			// 慢查询告警
			const recentSlowQueries = performanceMonitor.getSlowQueriesReport().slice(0, 10);
			if (recentSlowQueries.length > 5) {
				console.warn(`⚠️  最近慢查询较多: ${recentSlowQueries.length} 条`);
			}

			// 错误率告警
			const totalQueries = stats.successful_queries + stats.failed_queries;
			if (totalQueries > 0) {
				const errorRate = (stats.failed_queries / totalQueries) * 100;
				if (errorRate > 5) { // 错误率超过5%
					console.warn(`⚠️  查询错误率过高: ${errorRate.toFixed(2)}%`);
				}
			}

		}, 60000); // 每分钟检查一次

		console.log('📊 连接监控已启动');
	}

	// 优化连接池
	async optimizeConnections(): Promise<{
		actions_taken: string[];
		performance_improvement: number;
		recommendations: string[];
	}> {
		console.log('🔧 开始连接池优化...');

		const result = {
			actions_taken: [] as string[],
			performance_improvement: 0,
			recommendations: [] as string[]
		};

		const beforeStats = this.getConnectionStats();
		const beforeAvgTime = beforeStats.avg_response_time;

		try {
			// 1. 优化主数据库
			await this.primaryConnection.optimize();
			result.actions_taken.push('主数据库已优化 (ANALYZE & VACUUM)');

			// 2. 优化活跃的读副本
			for (const [url, replica] of this.readReplicas) {
				const replicaStats = this.connectionStats.read_replica_stats.find(r => r.url === url);
				if (replicaStats?.active) {
					try {
						await replica.optimize();
						result.actions_taken.push(`读副本已优化: ${url}`);
					} catch (error) {
						console.warn(`⚠️  副本优化失败: ${url}`, error);
					}
				}
			}

			// 3. 清理性能监控数据
			performanceMonitor.resetStats();
			result.actions_taken.push('性能监控数据已重置');

			// 等待一段时间后测量性能提升
			await new Promise(resolve => setTimeout(resolve, 5000));
			
			const afterStats = this.getConnectionStats();
			const afterAvgTime = afterStats.avg_response_time;
			
			if (beforeAvgTime > 0 && afterAvgTime > 0) {
				result.performance_improvement = 
					((beforeAvgTime - afterAvgTime) / beforeAvgTime) * 100;
			}

			// 4. 生成优化建议
			if (beforeStats.slow_queries_count > 10) {
				result.recommendations.push('考虑添加更多数据库索引以减少慢查询');
			}

			if (beforeStats.active_connections > beforeStats.total_connections * 0.8) {
				result.recommendations.push('考虑增加最大连接数以提高并发处理能力');
			}

			const activeReplicas = this.connectionStats.read_replica_stats.filter(r => r.active).length;
			if (activeReplicas < this.readReplicas.size) {
				result.recommendations.push('部分读副本不可用，检查副本连接状态');
			}

			console.log(`✅ 连接池优化完成，性能提升: ${result.performance_improvement.toFixed(2)}%`);

		} catch (error) {
			console.error('❌ 连接池优化失败:', error);
		}

		return result;
	}

	// 关闭连接管理器
	async shutdown(): Promise<void> {
		console.log('🔄 关闭数据库连接管理器...');

		// 停止健康检查
		for (const [, interval] of this.healthCheckIntervals) {
			clearInterval(interval);
		}
		this.healthCheckIntervals.clear();

		// 关闭主连接
		await this.primaryConnection.disconnect();

		// 关闭读副本连接
		for (const [url, replica] of this.readReplicas) {
			try {
				await replica.disconnect();
			} catch (error) {
				console.error(`❌ 关闭读副本连接失败: ${url}`, error);
			}
		}

		this.readReplicas.clear();
		console.log('✅ 数据库连接管理器已关闭');
	}

	// 动态添加读副本
	async addReadReplica(config: ReadReplicaConfig): Promise<void> {
		console.log(`🔗 添加新读副本: ${config.url}`);

		const replicaDbConfig: DatabaseConfig = {
			type: this.config.primary.type,
			url: config.url,
			authToken: config.authToken,
			maxConnections: config.maxConnections || this.config.primary.maxConnections
		};

		const replica = new DatabaseAbstractionLayer(replicaDbConfig);

		try {
			await replica.connect();
			this.readReplicas.set(config.url, replica);
			this.connectionStats.total_connections++;

			// 添加统计
			this.connectionStats.read_replica_stats.push({
				url: config.url,
				active: true,
				connections: 0,
				last_health_check: Date.now()
			});

			// 启动健康检查
			if (this.config.failoverConfig.enableFailover) {
				const healthCheck = setInterval(async () => {
					const isHealthy = await replica.healthCheck();
					const stats = this.connectionStats.read_replica_stats.find(r => r.url === config.url);
					if (stats) {
						stats.active = isHealthy;
						stats.last_health_check = Date.now();
					}
				}, this.config.failoverConfig.healthCheckInterval);

				this.healthCheckIntervals.set(config.url, healthCheck);
			}

			console.log(`✅ 读副本添加成功: ${config.url}`);

		} catch (error) {
			console.error(`❌ 添加读副本失败: ${config.url}`, error);
			throw error;
		}
	}

	// 移除读副本
	async removeReadReplica(url: string): Promise<void> {
		console.log(`🗑️  移除读副本: ${url}`);

		const replica = this.readReplicas.get(url);
		if (!replica) {
			console.warn(`⚠️  读副本不存在: ${url}`);
			return;
		}

		try {
			// 停止健康检查
			const healthCheck = this.healthCheckIntervals.get(url);
			if (healthCheck) {
				clearInterval(healthCheck);
				this.healthCheckIntervals.delete(url);
			}

			// 关闭连接
			await replica.disconnect();
			this.readReplicas.delete(url);
			this.connectionStats.total_connections--;

			// 移除统计
			this.connectionStats.read_replica_stats = 
				this.connectionStats.read_replica_stats.filter(r => r.url !== url);

			console.log(`✅ 读副本移除成功: ${url}`);

		} catch (error) {
			console.error(`❌ 移除读副本失败: ${url}`, error);
		}
	}
}