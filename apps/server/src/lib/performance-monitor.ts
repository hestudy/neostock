// 查询性能监控系统
export class QueryPerformanceMonitor {
	private queryStats = new Map<string, {
		count: number;
		totalTime: number;
		averageTime: number;
		maxTime: number;
		minTime: number;
		slowQueries: Array<{ query: string; duration: number; timestamp: number }>;
	}>();
	
	private readonly SLOW_QUERY_THRESHOLD = 200; // 200ms 阈值
	private readonly MAX_SLOW_QUERIES = 100; // 最多保留100条慢查询记录

	// 记录查询执行时间
	recordQuery(queryName: string, duration: number, queryText?: string) {
		const stats = this.queryStats.get(queryName) || {
			count: 0,
			totalTime: 0,
			averageTime: 0,
			maxTime: 0,
			minTime: Infinity,
			slowQueries: []
		};

		stats.count++;
		stats.totalTime += duration;
		stats.averageTime = stats.totalTime / stats.count;
		stats.maxTime = Math.max(stats.maxTime, duration);
		stats.minTime = Math.min(stats.minTime, duration);

		// 记录慢查询
		if (duration > this.SLOW_QUERY_THRESHOLD) {
			stats.slowQueries.push({
				query: queryText || queryName,
				duration,
				timestamp: Date.now()
			});

			// 保留最近的慢查询记录
			if (stats.slowQueries.length > this.MAX_SLOW_QUERIES) {
				stats.slowQueries = stats.slowQueries.slice(-this.MAX_SLOW_QUERIES);
			}

			console.warn(`🐌 慢查询告警: ${queryName} 耗时 ${duration}ms (阈值: ${this.SLOW_QUERY_THRESHOLD}ms)`);
		}

		this.queryStats.set(queryName, stats);
	}

	// 获取性能统计
	getPerformanceStats() {
		const allStats = Array.from(this.queryStats.entries()).map(([query, stats]) => ({
			query,
			...stats,
			slowQueryCount: stats.slowQueries.length
		}));

		const totalQueries = allStats.reduce((sum, stat) => sum + stat.count, 0);
		const averageResponseTime = allStats.reduce((sum, stat) => sum + stat.averageTime * stat.count, 0) / totalQueries || 0;
		const slowQueryCount = allStats.reduce((sum, stat) => sum + stat.slowQueryCount, 0);

		return {
			summary: {
				totalQueries,
				averageResponseTime: Math.round(averageResponseTime * 100) / 100,
				slowQueryCount,
				slowQueryRate: totalQueries > 0 ? (slowQueryCount / totalQueries * 100).toFixed(2) + '%' : '0%'
			},
			queries: allStats.sort((a, b) => b.averageTime - a.averageTime) // 按平均耗时排序
		};
	}

	// 获取慢查询报告
	getSlowQueriesReport() {
		const allSlowQueries: Array<{ queryName: string; query: string; duration: number; timestamp: number }> = [];
		
		for (const [queryName, stats] of this.queryStats.entries()) {
			for (const slowQuery of stats.slowQueries) {
				allSlowQueries.push({
					queryName,
					...slowQuery
				});
			}
		}

		return allSlowQueries
			.sort((a, b) => b.duration - a.duration) // 按耗时降序排序
			.slice(0, 50); // 返回最慢的50条查询
	}

	// 重置统计数据
	resetStats() {
		this.queryStats.clear();
		console.log('📊 查询性能统计数据已重置');
	}

	// 性能告警检查
	checkPerformanceAlerts() {
		const stats = this.getPerformanceStats();
		const alerts = [];

		// 平均响应时间告警
		if (stats.summary.averageResponseTime > this.SLOW_QUERY_THRESHOLD) {
			alerts.push({
				type: 'high_average_response_time',
				message: `平均查询响应时间过高: ${stats.summary.averageResponseTime}ms`,
				severity: 'warning'
			});
		}

		// 慢查询比例告警
		const slowQueryRate = parseFloat(stats.summary.slowQueryRate);
		if (slowQueryRate > 10) { // 慢查询超过10%
			alerts.push({
				type: 'high_slow_query_rate',
				message: `慢查询比例过高: ${stats.summary.slowQueryRate}`,
				severity: slowQueryRate > 25 ? 'critical' : 'warning'
			});
		}

		return alerts;
	}
}

// 全局性能监控实例
export const performanceMonitor = new QueryPerformanceMonitor();

// 查询执行包装器
export async function monitoredQuery<T>(
	queryName: string,
	queryFn: () => Promise<T>,
	queryText?: string
): Promise<T> {
	const startTime = performance.now();
	
	try {
		const result = await queryFn();
		const duration = performance.now() - startTime;
		performanceMonitor.recordQuery(queryName, duration, queryText);
		return result;
	} catch (error) {
		const duration = performance.now() - startTime;
		performanceMonitor.recordQuery(`${queryName}_ERROR`, duration, queryText);
		throw error;
	}
}

// 性能监控中间件（用于 tRPC）
export function createPerformanceMiddleware() {
	return async function performanceMiddleware(opts: Record<string, unknown>) {
		const startTime = performance.now();
		const { path, type } = opts;
		
		try {
			const result = await (opts.next as any)();
			const duration = performance.now() - startTime;
			
			performanceMonitor.recordQuery(
				`${type}:${path}`,
				duration,
				`tRPC ${type} ${path}`
			);
			
			return result;
		} catch (error) {
			const duration = performance.now() - startTime;
			performanceMonitor.recordQuery(
				`${type}:${path}_ERROR`,
				duration,
				`tRPC ${type} ${path} (ERROR)`
			);
			throw error;
		}
	};
}