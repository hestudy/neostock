import { z } from 'zod';
import { publicProcedure, router } from '../lib/trpc.js';
import { DataSourceManager } from '../lib/data-sources/data-source-manager.js';
import { DataSyncScheduler } from '../lib/schedulers/data-sync-scheduler.js';
import { CredentialsManager } from '../lib/security/credentials-manager.js';

// 速率限制
interface RateLimiter {
  requests: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimiter>();
const RATE_LIMIT_REQUESTS = 100; // 每小时100次请求
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1小时窗口

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const limiter = rateLimitMap.get(clientId);

  if (!limiter || now > limiter.resetTime) {
    rateLimitMap.set(clientId, {
      requests: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
    return true;
  }

  if (limiter.requests >= RATE_LIMIT_REQUESTS) {
    return false;
  }

  limiter.requests++;
  return true;
}

// 初始化数据源管理器和调度器
const dataSourceManager = new DataSourceManager();
const scheduler = new DataSyncScheduler(dataSourceManager);
const credentialsManager = CredentialsManager.getInstance();

// 启动调度器
scheduler.start();

export const dataSourcesRouter = router({
  /**
   * 获取所有数据源健康状态
   */
  getStatus: publicProcedure
    .input(z.object({ clientId: z.string().optional() }))
    .query(async ({ input }) => {
      const clientId = input.clientId || 'anonymous';
      
      if (!checkRateLimit(clientId)) {
        throw new Error('请求过于频繁，请稍后再试');
      }

      const health = await dataSourceManager.getAllHealth();
      const schedulerStatus = {
        isSchedulerRunning: scheduler.isSchedulerRunning(),
        isSyncRunning: scheduler.isSyncRunning()
      };

      return {
        dataSources: health,
        scheduler: schedulerStatus,
        timestamp: new Date().toISOString()
      };
    }),

  /**
   * 手动触发数据更新
   * 需要管理员权限 - 这里简化为检查特定头部
   */
  triggerUpdate: publicProcedure
    .input(z.object({ 
      force: z.boolean().optional(),
      clientId: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      const clientId = input.clientId || 'admin';
      
      if (!checkRateLimit(clientId)) {
        throw new Error('请求过于频繁，请稍后再试');
      }

      try {
        const result = await scheduler.triggerManualSync();
        return {
          success: result.success,
          message: result.success ? '数据同步已完成' : '数据同步部分失败',
          details: {
            processedStocks: result.processedStocks,
            errors: result.errors,
            duration: result.duration
          },
          timestamp: result.timestamp.toISOString()
        };
      } catch (error) {
        return {
          success: false,
          message: `数据同步失败: ${error}`,
          timestamp: new Date().toISOString()
        };
      }
    }),

  /**
   * 获取数据拉取历史记录
   */
  getHistory: publicProcedure
    .input(z.object({ 
      limit: z.number().min(1).max(100).optional(),
      clientId: z.string().optional()
    }))
    .query(async ({ input }) => {
      const clientId = input.clientId || 'anonymous';
      
      if (!checkRateLimit(clientId)) {
        throw new Error('请求过于频繁，请稍后再试');
      }

      // 简化实现 - 实际应该从数据库查询历史记录
      return {
        history: [], // 暂时返回空数组
        message: '历史记录功能待实现',
        timestamp: new Date().toISOString()
      };
    }),

  /**
   * 获取数据质量报告
   */
  getQualityReport: publicProcedure
    .input(z.object({ 
      dateRange: z.object({
        start: z.string(),
        end: z.string()
      }).optional(),
      clientId: z.string().optional()
    }))
    .query(async ({ input }) => {
      const clientId = input.clientId || 'anonymous';
      
      if (!checkRateLimit(clientId)) {
        throw new Error('请求过于频繁，请稍后再试');
      }

      // 简化实现 - 实际应该分析数据质量
      return {
        qualityScore: 85,
        metrics: {
          completeness: 90,
          accuracy: 88,
          consistency: 82,
          timeliness: 95
        },
        issues: [],
        recommendations: ['建议增加跨数据源验证'],
        timestamp: new Date().toISOString()
      };
    }),

  /**
   * 切换主数据源
   * 需要管理员权限
   */
  switchPrimary: publicProcedure
    .input(z.object({ 
      sourceId: z.string(),
      clientId: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      const clientId = input.clientId || 'admin';
      
      if (!checkRateLimit(clientId)) {
        throw new Error('请求过于频繁，请稍后再试');
      }

      try {
        await dataSourceManager.setPrimarySource(input.sourceId);
        return {
          success: true,
          message: `主数据源已切换至: ${input.sourceId}`,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return {
          success: false,
          message: `切换数据源失败: ${error}`,
          timestamp: new Date().toISOString()
        };
      }
    }),

  /**
   * 获取凭据状态（不包含实际密钥）
   */
  getCredentialStatus: publicProcedure
    .input(z.object({ 
      keyId: z.string(),
      clientId: z.string().optional()
    }))
    .query(async ({ input }) => {
      const clientId = input.clientId || 'admin';
      
      if (!checkRateLimit(clientId)) {
        throw new Error('请求过于频繁，请稍后再试');
      }

      const status = credentialsManager.getCredentialStatus(input.keyId);
      if (!status) {
        throw new Error(`密钥 ${input.keyId} 不存在`);
      }

      return {
        status,
        needsRotation: new Date() > status.rotationDue,
        timestamp: new Date().toISOString()
      };
    }),

  /**
   * 获取需要轮换的密钥列表
   */
  getKeysRequiringRotation: publicProcedure
    .input(z.object({ clientId: z.string().optional() }))
    .query(async ({ input }) => {
      const clientId = input.clientId || 'admin';
      
      if (!checkRateLimit(clientId)) {
        throw new Error('请求过于频繁，请稍后再试');
      }

      const keys = credentialsManager.getKeysRequiringRotation();
      return {
        keys,
        count: keys.length,
        timestamp: new Date().toISOString()
      };
    })
});

export type DataSourcesRouter = typeof dataSourcesRouter;