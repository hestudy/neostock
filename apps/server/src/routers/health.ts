import { router, publicProcedure } from "../lib/trpc";
import { z } from "zod";
import { db } from "../db";
import { sql } from "drizzle-orm";

// 健康检查状态枚举
enum HealthStatus {
  HEALTHY = "healthy",
  DEGRADED = "degraded", 
  UNHEALTHY = "unhealthy"
}

// 组件健康状态
interface ComponentHealth {
  status: HealthStatus;
  responseTime?: number;
  message?: string;
  lastChecked: string;
}

// 整体健康检查响应
interface HealthCheckResponse {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  version: string;
  components: {
    database: ComponentHealth;
    memory: ComponentHealth;
  };
}

// 检查数据库连接健康状态
async function checkDatabaseHealth(): Promise<ComponentHealth> {
  const startTime = Date.now();
  
  try {
    // 执行简单查询验证数据库连接
    await db.run(sql`SELECT 1 as health_check`);
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: responseTime < 100 ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
      responseTime,
      message: responseTime < 100 ? "Database connection is healthy" : "Database response is slow",
      lastChecked: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: HealthStatus.UNHEALTHY,
      responseTime: Date.now() - startTime,
      message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: new Date().toISOString()
    };
  }
}

// 检查内存使用情况
function checkMemoryHealth(): ComponentHealth {
  try {
    const memUsage = process.memoryUsage();
    const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const usagePercent = (usedMB / totalMB) * 100;
    
    let status = HealthStatus.HEALTHY;
    let message = `Memory usage: ${usedMB}MB / ${totalMB}MB (${usagePercent.toFixed(1)}%)`;
    
    if (usagePercent > 90) {
      status = HealthStatus.UNHEALTHY;
      message = `High memory usage: ${message}`;
    } else if (usagePercent > 75) {
      status = HealthStatus.DEGRADED;
      message = `Elevated memory usage: ${message}`;
    }
    
    return {
      status,
      message,
      lastChecked: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: HealthStatus.UNHEALTHY,
      message: `Memory check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: new Date().toISOString()
    };
  }
}

// 计算整体健康状态
function calculateOverallStatus(components: HealthCheckResponse['components']): HealthStatus {
  const statuses = Object.values(components).map(comp => comp.status);
  
  if (statuses.some(status => status === HealthStatus.UNHEALTHY)) {
    return HealthStatus.UNHEALTHY;
  }
  
  if (statuses.some(status => status === HealthStatus.DEGRADED)) {
    return HealthStatus.DEGRADED;
  }
  
  return HealthStatus.HEALTHY;
}

export const healthRouter = router({
  // 基本健康检查端点
  check: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/health',
        summary: 'Health check endpoint',
        description: 'Check the health status of the server and its dependencies',
        tags: ['Health'],
        protect: false
      }
    })
    .input(z.void())
    .output(z.object({
      status: z.enum(['healthy', 'degraded', 'unhealthy']),
      timestamp: z.string(),
      uptime: z.number(),
      version: z.string(),
      components: z.object({
        database: z.object({
          status: z.enum(['healthy', 'degraded', 'unhealthy']),
          responseTime: z.number().optional(),
          message: z.string().optional(),
          lastChecked: z.string()
        }),
        memory: z.object({
          status: z.enum(['healthy', 'degraded', 'unhealthy']),
          message: z.string().optional(),
          lastChecked: z.string()
        })
      })
    }))
    .query(async () => {
      const startTime = Date.now();
      
      // 并行检查各个组件
      const [databaseHealth, memoryHealth] = await Promise.all([
        checkDatabaseHealth(),
        Promise.resolve(checkMemoryHealth())
      ]);
      
      const components = {
        database: databaseHealth,
        memory: memoryHealth
      };
      
      const response: HealthCheckResponse = {
        status: calculateOverallStatus(components),
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.APP_VERSION || '1.0.0',
        components
      };
      
      console.log(`Health check completed in ${Date.now() - startTime}ms - Status: ${response.status}`);
      
      return response;
    }),

  // 数据库专用健康检查
  database: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/health/database',
        summary: 'Database health check',
        description: 'Check only the database connection health',
        tags: ['Health'],
        protect: false
      }
    })
    .input(z.void())
    .output(z.object({
      status: z.enum(['healthy', 'degraded', 'unhealthy']),
      responseTime: z.number().optional(),
      message: z.string().optional(),
      timestamp: z.string()
    }))
    .query(async () => {
      const health = await checkDatabaseHealth();
      return {
        ...health,
        timestamp: new Date().toISOString()
      };
    }),

  // 存活检查 - 最轻量级的检查
  alive: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/health/alive',
        summary: 'Liveness probe',
        description: 'Simple liveness check that returns immediately',
        tags: ['Health'], 
        protect: false
      }
    })
    .input(z.void())
    .output(z.object({
      alive: z.boolean(),
      timestamp: z.string(),
      uptime: z.number()
    }))
    .query(async () => {
      return {
        alive: true,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      };
    }),

  // 就绪检查 - 检查服务是否可以接受流量
  ready: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/health/ready',
        summary: 'Readiness probe', 
        description: 'Check if the service is ready to accept traffic',
        tags: ['Health'],
        protect: false
      }
    })
    .input(z.void())
    .output(z.object({
      ready: z.boolean(),
      timestamp: z.string(),
      checks: z.object({
        database: z.boolean()
      })
    }))
    .query(async () => {
      // 快速检查关键依赖
      const databaseReady = await checkDatabaseHealth()
        .then(health => health.status !== HealthStatus.UNHEALTHY)
        .catch(() => false);
      
      const ready = databaseReady;
      
      return {
        ready,
        timestamp: new Date().toISOString(),
        checks: {
          database: databaseReady
        }
      };
    })
});