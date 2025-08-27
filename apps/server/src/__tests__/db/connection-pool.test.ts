import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { db, getConnectionPoolStatus, validateOptimization } from '../../db/index';

describe('连接池管理验证', () => {
  beforeEach(async () => {
    // 确保测试环境干净
    await db.run(sql`PRAGMA foreign_keys = ON`);
  });

  afterEach(async () => {
    // 清理测试数据
  });

  describe('连接池基础功能', () => {
    it('应该正确初始化连接池状态', async () => {
      const poolStatus = await getConnectionPoolStatus();
      
      // 先检查基本结构
      expect(poolStatus).toHaveProperty('active_connections');
      expect(poolStatus).toHaveProperty('max_connections');
      expect(poolStatus).toHaveProperty('uptime');
      expect(poolStatus).toHaveProperty('queries_executed');
      
      // 验证具体值
      expect(poolStatus.max_connections).toBe(10);
      expect(poolStatus.active_connections).toBe(1); // 根据实现固定为1
      expect(typeof poolStatus.uptime).toBe('number');
      expect(typeof poolStatus.queries_executed).toBe('number');
      expect(poolStatus.uptime).toBeGreaterThanOrEqual(0);
    });

    it('应该能够执行基本数据库查询', async () => {
      const result = await db.all(sql`SELECT 1 as test`);
      expect(result).toEqual([{ test: 1 }]);
    });

    it('应该正确应用SQLite优化配置', async () => {
      const settings = await validateOptimization();
      
      // 验证基本结构
      expect(settings).toHaveProperty('journal_mode');
      expect(settings).toHaveProperty('synchronous');
      expect(settings).toHaveProperty('cache_size');
      expect(settings).toHaveProperty('temp_store');
      expect(settings).toHaveProperty('foreign_keys');
      
      // 在测试环境中，验证已知的配置值
      expect(settings.journal_mode).toBe('memory'); // 内存数据库使用memory模式
      expect(settings.synchronous).toBe(2); // 默认同步模式
      expect(typeof settings.cache_size).toBe('number');
      expect(typeof settings.temp_store).toBe('number');
      expect(settings.foreign_keys).toBe(1); // 外键约束必须启用
    });
  });

  describe('并发访问处理', () => {
    it('应该能处理多个并发查询', async () => {
      const concurrentQueries = Array.from({ length: 5 }, (_, i) => 
        db.all(sql`SELECT ${i} as query_id, datetime('now') as timestamp`)
      );
      
      const results = await Promise.all(concurrentQueries);
      
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result[0]).toMatchObject({
          query_id: index,
          timestamp: expect.any(String),
        });
      });
    });

    it('应该能处理并发写入操作', async () => {
      // 创建临时测试表
      await db.run(sql`CREATE TABLE IF NOT EXISTS test_concurrent (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      const concurrentInserts = Array.from({ length: 10 }, (_, i) => 
        db.run(sql`INSERT INTO test_concurrent (value) VALUES (${`test_${i}`})`)
      );
      
      await Promise.all(concurrentInserts);
      
      const count = await db.all(sql`SELECT COUNT(*) as count FROM test_concurrent`);
      expect((count[0] as { count: number }).count).toBe(10);
      
      // 清理测试表
      await db.run(sql`DROP TABLE IF EXISTS test_concurrent`);
    });
  });

  describe('连接状态监控', () => {
    it('应该能够监控连接池使用情况', async () => {
      const initialStatus = await getConnectionPoolStatus();
      
      // 执行一些查询操作
      await Promise.all([
        db.all(sql`SELECT 1`),
        db.all(sql`SELECT 2`),
        db.all(sql`SELECT 3`),
      ]);
      
      const finalStatus = await getConnectionPoolStatus();
      
      // 验证状态结构
      expect(finalStatus).toHaveProperty('active_connections');
      expect(finalStatus).toHaveProperty('max_connections');
      expect(finalStatus).toHaveProperty('uptime');
      expect(finalStatus).toHaveProperty('queries_executed');
      
      expect(finalStatus.max_connections).toBe(10);
      expect(finalStatus.active_connections).toBe(1);
      
      // 运行时间应该增加或相等（取决于系统计时精度）
      expect(typeof finalStatus.uptime).toBe('number');
      expect(typeof initialStatus.uptime).toBe('number');
      expect(finalStatus.uptime).toBeGreaterThanOrEqual(initialStatus.uptime);
    });

    it('应该提供有意义的连接统计信息', async () => {
      const status = await getConnectionPoolStatus();
      
      // 验证所有字段都有合理值
      expect(status.active_connections).toBeGreaterThanOrEqual(0);
      expect(status.active_connections).toBeLessThanOrEqual(status.max_connections);
      expect(status.max_connections).toBe(10);
      expect(status.uptime).toBeGreaterThanOrEqual(0); // 进程刚启动时可能为0
      expect(status.queries_executed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('错误处理和恢复', () => {
    it('应该能够处理无效查询而不影响连接池', async () => {
      // 尝试执行无效查询 - 需要等待promise完成才能判断是否抛出错误
      let errorThrown = false;
      try {
        await db.all(sql`SELECT * FROM invalid_table`);
      } catch {
        errorThrown = true;
      }
      expect(errorThrown).toBe(true);
      
      // 验证连接池仍然可用
      const result = await db.all(sql`SELECT 'still_working' as status`);
      expect((result[0] as { status: string }).status).toBe('still_working');
      
      // 验证连接池状态正常
      const status = await getConnectionPoolStatus();
      expect(status.max_connections).toBe(10);
    });

    it('应该能够处理连接超时情况', async () => {
      // 验证忙等待超时配置
      const busyTimeout = await db.all(sql`PRAGMA busy_timeout`);
      // 在不同的SQLite实现中，字段名可能不同
      const timeoutValue = (busyTimeout[0] as { busy_timeout?: number; timeout?: number }).busy_timeout || (busyTimeout[0] as { busy_timeout?: number; timeout?: number }).timeout;
      
      expect(timeoutValue).toBeDefined();
      expect(typeof timeoutValue).toBe('number');
      
      // 在测试环境中，超时值可能不同
      expect(timeoutValue).toBeGreaterThanOrEqual(0);
    });
  });

  describe('性能验证', () => {
    it('基本查询响应时间应该小于50ms', async () => {
      const iterations = 10;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await db.all(sql`SELECT 1 as test`);
        const end = performance.now();
        times.push(end - start);
      }
      
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      
      // 在测试环境中，内存数据库应该非常快
      expect(avgTime).toBeLessThan(50); // 50ms
      
      // 确保没有异常慢的查询
      const maxTime = Math.max(...times);
      expect(maxTime).toBeLessThan(100); // 100ms
    });

    it('并发查询性能应该可接受', async () => {
      const concurrency = 10;
      const queriesPerConnection = 5;
      
      const start = performance.now();
      
      const concurrentBatches = Array.from({ length: concurrency }, async () => {
        const queries = Array.from({ length: queriesPerConnection }, () => 
          db.all(sql`SELECT datetime('now') as timestamp`)
        );
        return Promise.all(queries);
      });
      
      const results = await Promise.all(concurrentBatches);
      const end = performance.now();
      
      const totalTime = end - start;
      const totalQueries = concurrency * queriesPerConnection;
      const avgTimePerQuery = totalTime / totalQueries;
      
      // 验证所有查询都成功完成
      expect(results).toHaveLength(concurrency);
      results.forEach(batch => {
        expect(batch).toHaveLength(queriesPerConnection);
      });
      
      // 平均每个查询时间应该合理
      expect(avgTimePerQuery).toBeLessThan(20); // 20ms per query in test env
    });
  });
});