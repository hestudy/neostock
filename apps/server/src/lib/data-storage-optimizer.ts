import { db } from '../db/index';
import { sql } from 'drizzle-orm';
import { stock_daily } from '../db/schema/stocks';
import { lt, count } from 'drizzle-orm';

type SqliteRow = Record<string, string | number>;
type DatabaseRunResult = { changes: number; lastInsertRowid?: number };

interface DataCleanupConfig {
	daily_data_retention_days: number;
	temp_data_retention_hours: number;
	backup_retention_days: number;
	log_retention_days: number;
	vacuum_threshold_mb: number;
}

interface StorageStats {
	database_size_mb: number;
	table_sizes: Record<string, number>;
	index_sizes: Record<string, number>;
	fragmentation_ratio: number;
	vacuum_recommended: boolean;
}

interface PartitionInfo {
	partition_name: string;
	date_range: { start: string; end: string };
	record_count: number;
	size_estimate_mb: number;
}

export class DataStorageOptimizer {
	private readonly config: DataCleanupConfig = {
		daily_data_retention_days: 365 * 3, // 保留3年历史数据
		temp_data_retention_hours: 24, // 临时数据保留24小时
		backup_retention_days: 30, // 备份保留30天
		log_retention_days: 90, // 日志保留90天
		vacuum_threshold_mb: 100 // 100MB以上建议VACUUM
	};

	// 历史数据管理机制
	async manageHistoricalData(): Promise<{
		cleaned: number;
		archived: number;
		compressed: number;
		errors: string[];
	}> {
		console.log('🗂️  开始历史数据管理...');
		
		const result = {
			cleaned: 0,
			archived: 0,
			compressed: 0,
			errors: [] as string[]
		};

		try {
			// 1. 清理过期的日线数据
			const cleanupResult = await this.cleanupOldDailyData();
			result.cleaned = cleanupResult.deleted_count;

			// 2. 归档旧数据（可选实现）
			const archiveResult = await this.archiveOldData();
			result.archived = archiveResult.archived_count;

			// 3. 压缩数据库（如果需要）
			const compressionResult = await this.compressDatabaseIfNeeded();
			result.compressed = compressionResult.compressed ? 1 : 0;

			console.log(`✅ 历史数据管理完成: 清理${result.cleaned}条, 归档${result.archived}条`);

		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			result.errors.push(`历史数据管理失败: ${errorMsg}`);
			console.error('❌ 历史数据管理失败:', error);
		}

		return result;
	}

	private async cleanupOldDailyData(): Promise<{ deleted_count: number }> {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - this.config.daily_data_retention_days);
		const cutoffDateStr = cutoffDate.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD格式

		try {
			// 计算要删除的记录数
			const countResult = await db
				.select({ count: count() })
				.from(stock_daily)
				.where(lt(stock_daily.trade_date, cutoffDateStr));

			const toDelete = countResult[0]?.count || 0;

			if (toDelete > 0) {
				console.log(`🗑️  准备删除 ${toDelete} 条过期日线数据 (早于 ${cutoffDate.toLocaleDateString()})`);

				// 分批删除，避免长事务
				const batchSize = 1000;
				let totalDeleted = 0;

				while (totalDeleted < toDelete) {
					const deleted = await db.run(sql`
						DELETE FROM stock_daily 
						WHERE trade_date < ${cutoffDateStr}
						LIMIT ${batchSize}
					`);

					const deletedCount = (deleted as any).changes || 0;
					totalDeleted += deletedCount;

					if (deletedCount === 0) break; // 没有更多记录可删除

					// 短暂休息，避免阻塞其他操作
					await new Promise(resolve => setTimeout(resolve, 10));
				}

				console.log(`✅ 已删除 ${totalDeleted} 条过期日线数据`);
				return { deleted_count: totalDeleted };
			} else {
				console.log('📋 没有需要清理的过期日线数据');
				return { deleted_count: 0 };
			}

		} catch (error) {
			console.error('❌ 清理过期日线数据失败:', error);
			throw error;
		}
	}

	private async archiveOldData(): Promise<{ archived_count: number }> {
		// 这里可以实现数据归档逻辑
		// 例如：将旧数据移到归档表或外部存储
		// 当前返回模拟结果
		return { archived_count: 0 };
	}

	private async compressDatabaseIfNeeded(): Promise<{ compressed: boolean; size_before?: number; size_after?: number }> {
		try {
			const stats = await this.getStorageStats();
			
			if (stats.database_size_mb > this.config.vacuum_threshold_mb || stats.fragmentation_ratio > 0.3) {
				console.log(`🔄 数据库大小 ${stats.database_size_mb}MB，碎片率 ${(stats.fragmentation_ratio * 100).toFixed(1)}%，开始VACUUM...`);

				const sizeBefore = stats.database_size_mb;
				
				// 执行VACUUM
				await db.run(sql`VACUUM`);
				
				const newStats = await this.getStorageStats();
				const sizeAfter = newStats.database_size_mb;
				
				console.log(`✅ VACUUM完成: ${sizeBefore}MB -> ${sizeAfter}MB (节省${(sizeBefore - sizeAfter).toFixed(1)}MB)`);
				
				return {
					compressed: true,
					size_before: sizeBefore,
					size_after: sizeAfter
				};
			} else {
				console.log('📊 数据库暂不需要压缩');
				return { compressed: false };
			}

		} catch (error) {
			console.error('❌ 数据库压缩失败:', error);
			throw error;
		}
	}

	// 获取存储统计信息
	async getStorageStats(): Promise<StorageStats> {
		try {
			// 获取数据库大小
			const dbSize = await db.all(sql`PRAGMA page_count`);
			const pageSize = await db.all(sql`PRAGMA page_size`);
			
			const pageCount = (dbSize[0] as SqliteRow)['page_count'] as number;
			const pageSizeBytes = (pageSize[0] as SqliteRow)['page_size'] as number;
			const databaseSizeMB = (pageCount * pageSizeBytes) / (1024 * 1024);

			// 获取表大小信息
			const tableSizes: Record<string, number> = {};
			const indexSizes: Record<string, number> = {};

			// 查询各表的统计信息
			const tables = ['user', 'session', 'account', 'verification', 'stocks', 'stock_daily', 'user_stock_favorites'];
			
			for (const table of tables) {
				try {
					const tableInfo = await db.all(sql.raw(`SELECT COUNT(*) as count FROM ${table}`));
					tableSizes[table] = (tableInfo[0] as SqliteRow)['count'] as number;
				} catch {
					tableSizes[table] = 0; // 表不存在或无权限
				}
			}

			// 获取空闲页面数（用于计算碎片率）
			const freePages = await db.all(sql`PRAGMA freelist_count`);
			const freePageCount = (freePages[0] as SqliteRow)['freelist_count'] as number;
			const fragmentationRatio = pageCount > 0 ? freePageCount / pageCount : 0;

			return {
				database_size_mb: Math.round(databaseSizeMB * 100) / 100,
				table_sizes: tableSizes,
				index_sizes: indexSizes,
				fragmentation_ratio: Math.round(fragmentationRatio * 1000) / 1000,
				vacuum_recommended: fragmentationRatio > 0.1 || databaseSizeMB > this.config.vacuum_threshold_mb
			};

		} catch (error) {
			console.error('❌ 获取存储统计失败:', error);
			throw error;
		}
	}

	// 数据清理策略实现
	async executeDataCleanupStrategy(): Promise<{
		temp_data_cleaned: number;
		log_entries_cleaned: number;
		backups_cleaned: number;
		storage_reclaimed_mb: number;
		errors: string[];
	}> {
		console.log('🧹 开始执行数据清理策略...');

		const result = {
			temp_data_cleaned: 0,
			log_entries_cleaned: 0,
			backups_cleaned: 0,
			storage_reclaimed_mb: 0,
			errors: [] as string[]
		};

		const sizeBefore = await this.getStorageStats();

		try {
			// 1. 清理临时数据
			result.temp_data_cleaned = await this.cleanupTempData();

			// 2. 清理旧日志
			result.log_entries_cleaned = await this.cleanupOldLogs();

			// 3. 清理旧备份
			result.backups_cleaned = await this.cleanupOldBackups();

			// 4. 计算回收的存储空间
			const sizeAfter = await this.getStorageStats();
			result.storage_reclaimed_mb = Math.round((sizeBefore.database_size_mb - sizeAfter.database_size_mb) * 100) / 100;

			console.log('✅ 数据清理策略执行完成');
			console.log(`📊 清理统计: 临时数据${result.temp_data_cleaned}条, 日志${result.log_entries_cleaned}条, 备份${result.backups_cleaned}个`);
			console.log(`💾 回收存储空间: ${result.storage_reclaimed_mb}MB`);

		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			result.errors.push(`数据清理失败: ${errorMsg}`);
			console.error('❌ 数据清理策略执行失败:', error);
		}

		return result;
	}

	private async cleanupTempData(): Promise<number> {
		// 清理临时数据：过期的验证码、临时会话等
		const cutoffTime = Date.now() - (this.config.temp_data_retention_hours * 60 * 60 * 1000);

		try {
			// 清理过期验证码
			const expiredVerifications = await db.run(sql`
				DELETE FROM verification 
				WHERE expiresAt < ${cutoffTime}
			`);

			const deletedCount = (expiredVerifications as any).changes || 0;
			console.log(`🗑️  已清理 ${deletedCount} 个过期验证码`);

			return deletedCount;

		} catch (error) {
			console.error('❌ 清理临时数据失败:', error);
			return 0;
		}
	}

	private async cleanupOldLogs(): Promise<number> {
		// 清理迁移日志和其他系统日志
		const cutoffTime = Date.now() - (this.config.log_retention_days * 24 * 60 * 60 * 1000);

		try {
			let totalCleaned = 0;

			// 清理迁移日志
			const migrationLogs = await db.run(sql`
				DELETE FROM __migration_logs 
				WHERE created_at < ${cutoffTime} AND status IN ('completed', 'failed', 'rolled_back')
			`);

			totalCleaned += (migrationLogs as any).changes || 0;

			console.log(`🗑️  已清理 ${totalCleaned} 条旧日志记录`);
			return totalCleaned;

		} catch (error) {
			console.error('❌ 清理旧日志失败:', error);
			return 0;
		}
	}

	private async cleanupOldBackups(): Promise<number> {
		// 清理旧备份记录
		const cutoffTime = Date.now() - (this.config.backup_retention_days * 24 * 60 * 60 * 1000);

		try {
			const oldBackups = await db.run(sql`
				DELETE FROM __migration_backups 
				WHERE created_at < ${cutoffTime}
			`);

			const deletedCount = (oldBackups as any).changes || 0;
			console.log(`🗑️  已清理 ${deletedCount} 个旧备份记录`);

			return deletedCount;

		} catch (error) {
			console.error('❌ 清理旧备份失败:', error);
			return 0;
		}
	}

	// 数据分区逻辑实现（基于时间范围的查询优化）
	async implementTimeBasedPartitioning(): Promise<{
		partitions_created: number;
		optimization_applied: boolean;
		partition_info: PartitionInfo[];
		errors: string[];
	}> {
		console.log('📊 实现基于时间的数据分区优化...');

		const result = {
			partitions_created: 0,
			optimization_applied: false,
			partition_info: [] as PartitionInfo[],
			errors: [] as string[]
		};

		try {
			// 分析现有数据的时间分布
			const dateRangeAnalysis = await this.analyzeDateRanges();
			
			// 创建基于年度的逻辑分区视图
			const partitionViews = await this.createPartitionViews(dateRangeAnalysis);
			result.partitions_created = partitionViews.length;
			result.partition_info = partitionViews;

			// 优化分区查询的索引
			await this.optimizePartitionIndexes();
			result.optimization_applied = true;

			console.log(`✅ 时间分区优化完成: 创建了 ${result.partitions_created} 个分区`);

		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			result.errors.push(`时间分区实现失败: ${errorMsg}`);
			console.error('❌ 时间分区实现失败:', error);
		}

		return result;
	}

	private async analyzeDateRanges(): Promise<{
		earliest_date: string;
		latest_date: string;
		total_records: number;
		year_distribution: Record<string, number>;
	}> {
		try {
			// 获取日线数据的时间范围
			const dateRange = await db.all(sql`
				SELECT 
					MIN(trade_date) as earliest_date,
					MAX(trade_date) as latest_date,
					COUNT(*) as total_records
				FROM stock_daily
			`);

			const result = dateRange[0] as SqliteRow;
			
			// 分析年度分布
			const yearDistribution = await db.all(sql`
				SELECT 
					SUBSTR(trade_date, 1, 4) as year,
					COUNT(*) as count
				FROM stock_daily
				GROUP BY SUBSTR(trade_date, 1, 4)
				ORDER BY year
			`);

			const yearDist: Record<string, number> = {};
			for (const row of yearDistribution) {
				const rowData = row as any;
				yearDist[rowData.year as string] = rowData.count as number;
			}

			console.log(`📊 数据分析: ${result.earliest_date} ~ ${result.latest_date}, 共${result.total_records}条记录`);
			
			return {
				earliest_date: result.earliest_date as string || '',
				latest_date: result.latest_date as string || '',
				total_records: result.total_records as number || 0,
				year_distribution: yearDist
			};

		} catch (error) {
			console.error('❌ 日期范围分析失败:', error);
			throw error;
		}
	}

	private async createPartitionViews(dateAnalysis: {
		earliest_date: string;
		latest_date: string;
		year_distribution: Record<string, number>;
	}): Promise<PartitionInfo[]> {
		const partitions: PartitionInfo[] = [];

		try {
			// 为每年创建一个视图（逻辑分区）
			for (const [year, recordCount] of Object.entries(dateAnalysis.year_distribution)) {
				const viewName = `stock_daily_${year}`;
				const startDate = `${year}0101`;
				const endDate = `${year}1231`;

				// 创建年度分区视图
				await db.run(sql.raw(`
					CREATE VIEW IF NOT EXISTS ${viewName} AS
					SELECT * FROM stock_daily 
					WHERE trade_date >= '${startDate}' AND trade_date <= '${endDate}'
				`));

				// 估算分区大小 (假设每条记录约100字节)
				const sizeEstimate = Math.round((recordCount * 100) / (1024 * 1024) * 100) / 100;

				partitions.push({
					partition_name: viewName,
					date_range: { start: startDate, end: endDate },
					record_count: recordCount,
					size_estimate_mb: sizeEstimate
				});

				console.log(`📋 创建分区视图: ${viewName} (${recordCount}条记录, ~${sizeEstimate}MB)`);
			}

			// 创建最近数据的快速访问视图
			const recentViewName = 'stock_daily_recent';
			const recentCutoff = new Date();
			recentCutoff.setDate(recentCutoff.getDate() - 30); // 最近30天
			const recentCutoffStr = recentCutoff.toISOString().split('T')[0].replace(/-/g, '');

			await db.run(sql.raw(`
				CREATE VIEW IF NOT EXISTS ${recentViewName} AS
				SELECT * FROM stock_daily 
				WHERE trade_date >= '${recentCutoffStr}'
				ORDER BY trade_date DESC, ts_code ASC
			`));

			partitions.push({
				partition_name: recentViewName,
				date_range: { start: recentCutoffStr, end: dateAnalysis.latest_date },
				record_count: -1, // 动态计算
				size_estimate_mb: -1 // 动态计算
			});

			console.log(`📋 创建最近数据视图: ${recentViewName} (最近30天)`);

		} catch (error) {
			console.error('❌ 创建分区视图失败:', error);
			throw error;
		}

		return partitions;
	}

	private async optimizePartitionIndexes(): Promise<void> {
		try {
			// 确保时间范围查询的复合索引存在
			await db.run(sql`
				CREATE INDEX IF NOT EXISTS idx_stock_daily_time_range 
				ON stock_daily (trade_date, ts_code, close)
			`);

			// 为最新数据创建优化索引
			await db.run(sql`
				CREATE INDEX IF NOT EXISTS idx_stock_daily_recent 
				ON stock_daily (trade_date DESC, ts_code ASC) 
				WHERE trade_date >= date('now', '-30 days', 'localtime', 'start of day')
			`);

			console.log('✅ 分区索引优化完成');

		} catch (error) {
			console.error('❌ 分区索引优化失败:', error);
			throw error;
		}
	}

	// 查询优化建议
	async getQueryOptimizationSuggestions(): Promise<{
		suggestions: string[];
		performance_tips: string[];
		index_recommendations: string[];
	}> {
		const stats = await this.getStorageStats();
		
		const suggestions: string[] = [];
		const performanceTips: string[] = [];
		const indexRecommendations: string[] = [];

		// 基于存储统计提供建议
		if (stats.fragmentation_ratio > 0.2) {
			suggestions.push('数据库碎片率较高，建议执行VACUUM操作');
		}

		if (stats.database_size_mb > 500) {
			suggestions.push('数据库较大，考虑定期归档历史数据');
			performanceTips.push('使用时间范围查询时，优先查询分区视图');
		}

		// 检查股票日线数据量
		const dailyDataCount = stats.table_sizes['stock_daily'] || 0;
		if (dailyDataCount > 100000) {
			indexRecommendations.push('日线数据量较大，确保时间+股票代码的复合索引');
			performanceTips.push('查询历史数据时，使用年度分区视图提高性能');
		}

		// 用户收藏数据优化建议
		const favoritesCount = stats.table_sizes['user_stock_favorites'] || 0;
		if (favoritesCount > 10000) {
			indexRecommendations.push('用户收藏数量较多，优化用户ID索引');
		}

		return {
			suggestions,
			performance_tips: performanceTips,
			index_recommendations: indexRecommendations
		};
	}

	// 定时清理任务配置
	scheduleCleanupTasks(intervalHours: number = 24): void {
		console.log(`⏰ 配置定时清理任务，间隔 ${intervalHours} 小时`);

		setInterval(async () => {
			try {
				console.log('🔄 开始定时数据清理...');
				
				// 执行日常清理
				await this.executeDataCleanupStrategy();
				
				// 管理历史数据
				await this.manageHistoricalData();

				console.log('✅ 定时数据清理完成');

			} catch (error) {
				console.error('❌ 定时数据清理失败:', error);
			}
		}, intervalHours * 60 * 60 * 1000);
	}

	// 更新配置
	updateConfig(newConfig: Partial<DataCleanupConfig>): void {
		Object.assign(this.config, newConfig);
		console.log('⚙️  数据存储优化配置已更新', this.config);
	}
}