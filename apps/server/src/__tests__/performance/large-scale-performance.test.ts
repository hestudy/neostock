/**
 * 大规模数据性能基准测试
 * 测试4000只A股搜索性能和系统稳定性
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../db';
import { stocks, stock_daily } from '../../db/schema/stocks';
import { testClient } from '../helpers/test-client';

// 性能阈值定义
const PERFORMANCE_THRESHOLDS = {
  SEARCH_RESPONSE_TIME: 200, // <200ms for 4000 stocks
  DETAIL_RESPONSE_TIME: 100, // <100ms for single stock
  INITIAL_LOAD_TIME: 2000,   // <2s for first page load
  CONCURRENT_REQUESTS: 50,   // 50 concurrent users
} as const;

// 大规模测试数据生成器
class LargeScaleDataGenerator {
  private stockCounter = 0;
  
  generateStockCode(): string {
    const exchanges = ['SZ', 'SH'];
    const exchange = exchanges[this.stockCounter % 2];
    const code = String(this.stockCounter + 1).padStart(6, '0');
    return `${code}.${exchange}`;
  }

  generateStockData(count: number) {
    const industries = [
      '银行', '房地产开发', '保险', '证券', '软件开发', 
      '电子制造', '医药制造', '汽车制造', '钢铁', '化工',
      '建筑装饰', '公用事业', '交通运输', '商业贸易', '食品饮料',
      '纺织服装', '家用电器', '建筑材料', '机械设备', '电气设备'
    ];
    
    const areas = [
      '北京', '上海', '深圳', '广州', '杭州', '苏州', 
      '南京', '武汉', '成都', '重庆', '西安', '天津'
    ];
    
    const companies = [
      '工商银行', '建设银行', '农业银行', '中国银行', '招商银行',
      '平安银行', '民生银行', '中信银行', '光大银行', '华夏银行',
      '万科A', '保利发展', '中国平安', '贵州茅台', '腾讯控股',
      '阿里巴巴', '美团', '字节跳动', '百度', '京东',
      '比亚迪', '宁德时代', '隆基绿能', '药明康德', '恒瑞医药'
    ];

    return Array.from({ length: count }, (_, i) => {
      this.stockCounter = i;
      const ts_code = this.generateStockCode();
      const industry = industries[i % industries.length];
      const area = areas[i % areas.length];
      const baseName = companies[i % companies.length];
      const name = i < companies.length ? baseName : `${baseName}${Math.floor(i / companies.length) + 1}`;
      
      return {
        ts_code,
        symbol: ts_code.split('.')[0],
        name,
        area,
        industry,
        market: i % 3 === 0 ? '创业板' : i % 3 === 1 ? '科创板' : '主板',
        list_date: `20${(i % 20) + 2000}${String((i % 12) + 1).padStart(2, '0')}${String((i % 28) + 1).padStart(2, '0')}`,
        is_hs: i % 4 === 0 ? '1' : '0',
        created_at: new Date(),
        updated_at: new Date(),
      };
    });
  }

  generateDailyData(stockCodes: string[], daysBack: number = 30) {
    const dailyData = [];
    const today = new Date();
    
    for (const ts_code of stockCodes.slice(0, 100)) { // 只为前100只股票生成日线数据
      for (let i = 0; i < daysBack; i++) {
        const tradeDate = new Date(today);
        tradeDate.setDate(today.getDate() - i);
        
        // 只生成工作日数据
        if (tradeDate.getDay() === 0 || tradeDate.getDay() === 6) continue;
        
        const basePrice = 10 + (stockCodes.indexOf(ts_code) % 50);
        const volatility = 0.05; // 5% 波动
        const change = (Math.random() - 0.5) * volatility;
        
        const close = basePrice * (1 + change);
        const open = close * (0.98 + Math.random() * 0.04);
        const high = Math.max(open, close) * (1 + Math.random() * 0.03);
        const low = Math.min(open, close) * (0.97 + Math.random() * 0.03);
        
        dailyData.push({
          ts_code,
          trade_date: tradeDate.toISOString().slice(0, 10).replace(/-/g, ''),
          open: Number(open.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          close: Number(close.toFixed(2)),
          vol: Math.floor(Math.random() * 10000000),
          amount: Math.floor(Math.random() * 100000000),
          created_at: new Date(),
        });
      }
    }
    
    return dailyData;
  }
}

describe('Large Scale Performance Tests', () => {
  const generator = new LargeScaleDataGenerator();
  let testStocks: ReturnType<typeof generator.generateStockData>;
  let stockCodes: string[];

  beforeAll(async () => {
    console.log('开始生成4000只股票测试数据...');
    const startTime = Date.now();
    
    // 清理现有数据
    await db.delete(stock_daily);
    await db.delete(stocks);
    
    // 生成4000只股票数据
    testStocks = generator.generateStockData(4000);
    stockCodes = testStocks.map(s => s.ts_code);
    
    // 批量插入股票基础数据
    const batchSize = 100;
    for (let i = 0; i < testStocks.length; i += batchSize) {
      const batch = testStocks.slice(i, i + batchSize);
      await db.insert(stocks).values(batch);
      
      if (i % 1000 === 0) {
        console.log(`已插入 ${i + batch.length} 只股票...`);
      }
    }
    
    console.log('开始生成历史交易数据...');
    // 为前100只股票生成历史数据
    const dailyData = generator.generateDailyData(stockCodes, 30);
    
    // 批量插入日线数据
    for (let i = 0; i < dailyData.length; i += batchSize) {
      const batch = dailyData.slice(i, i + batchSize);
      await db.insert(stock_daily).values(batch);
    }
    
    const endTime = Date.now();
    console.log(`测试数据生成完成，耗时: ${endTime - startTime}ms`);
    console.log(`生成了 ${testStocks.length} 只股票和 ${dailyData.length} 条日线数据`);
  }, 60000); // 60秒超时

  afterAll(async () => {
    console.log('清理测试数据...');
    await db.delete(stock_daily);
    await db.delete(stocks);
  });

  describe('4000股票搜索性能', () => {
    it('名称模糊搜索应在200ms内完成', async () => {
      const searchTerms = ['银行', '科技', '平安', '建设', '工商'];
      
      for (const term of searchTerms) {
        const startTime = Date.now();
        
        const response = await testClient.stocks.search.query({
          keyword: term,
          limit: 50,
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        console.log(`搜索 "${term}" 耗时: ${responseTime}ms, 结果: ${response.stocks.length}条`);
        
        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_RESPONSE_TIME);
        expect(response.total).toBeGreaterThanOrEqual(response.stocks.length);
      }
    });

    it('股票代码搜索应在200ms内完成', async () => {
      const codesToSearch = ['000001', '000100', '600000', '600100', '300001'];
      
      for (const code of codesToSearch) {
        const startTime = Date.now();
        
        const response = await testClient.stocks.search.query({
          keyword: code,
          limit: 20,
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        console.log(`搜索代码 "${code}" 耗时: ${responseTime}ms, 结果: ${response.stocks.length}条`);
        
        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_RESPONSE_TIME);
      }
    });

    it('精确匹配搜索应在100ms内完成', async () => {
      // 使用实际存在的股票进行精确搜索
      const exactMatches = testStocks.slice(0, 10).map(s => s.name);
      
      for (const name of exactMatches) {
        const startTime = Date.now();
        
        const response = await testClient.stocks.search.query({
          keyword: name,
          limit: 10,
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.DETAIL_RESPONSE_TIME);
        expect(response.stocks.some(s => s.name === name)).toBe(true);
      }
    });

    it('空搜索结果应快速返回', async () => {
      const nonExistentTerms = ['不存在的公司', 'XYZNONSENSE', '🚀🚀🚀'];
      
      for (const term of nonExistentTerms) {
        const startTime = Date.now();
        
        const response = await testClient.stocks.search.query({
          keyword: term,
          limit: 50,
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.DETAIL_RESPONSE_TIME);
        expect(response.stocks).toHaveLength(0);
        expect(response.total).toBe(0);
      }
    });
  });

  describe('并发性能测试', () => {
    it('应支持50个并发搜索请求', async () => {
      const searchTerms = [
        '银行', '科技', '医药', '地产', '汽车', '电子', '化工', '钢铁', '建材', '食品',
        '000001', '000002', '600000', '600001', '300001', '002001', '000100', '600100',
        '平安', '工商', '建设', '招商', '中信', '光大', '民生', '华夏', '浦发', '兴业'
      ];
      
      const concurrentRequests = Array.from({ length: PERFORMANCE_THRESHOLDS.CONCURRENT_REQUESTS }, (_, i) => {
        const term = searchTerms[i % searchTerms.length];
        return Promise.resolve().then(async () => {
          const startTime = Date.now();
          
          const response = await testClient.stocks.search.query({
            keyword: term,
            limit: 20,
          });
          
          const endTime = Date.now();
          
          return {
            term,
            responseTime: endTime - startTime,
            resultCount: response.stocks.length,
            success: true,
          };
        }).catch(() => ({
          term,
          responseTime: Infinity,
          resultCount: 0,
          success: false,
        }));
      });

      console.log(`开始执行 ${PERFORMANCE_THRESHOLDS.CONCURRENT_REQUESTS} 个并发搜索请求...`);
      const startTime = Date.now();
      
      const results = await Promise.all(concurrentRequests);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      console.log(`并发测试完成，总耗时: ${totalTime}ms`);
      
      // 统计结果
      const successCount = results.filter(r => r.success).length;
      const avgResponseTime = results
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.responseTime, 0) / successCount;
      const maxResponseTime = Math.max(...results.map(r => r.responseTime));
      
      console.log(`成功率: ${(successCount / results.length * 100).toFixed(1)}%`);
      console.log(`平均响应时间: ${avgResponseTime.toFixed(1)}ms`);
      console.log(`最大响应时间: ${maxResponseTime}ms`);
      
      // 验证性能要求
      expect(successCount).toBe(PERFORMANCE_THRESHOLDS.CONCURRENT_REQUESTS);
      expect(avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_RESPONSE_TIME);
      expect(maxResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_RESPONSE_TIME * 2); // 允许2倍阈值的峰值
    });

    it('应支持混合API并发调用', async () => {
      const mixedRequests = [
        // 搜索请求
        ...Array.from({ length: 20 }, (_, i) => 
          testClient.stocks.search.query({
            keyword: `测试${i}`,
            limit: 20,
          })
        ),
        // 详情请求
        ...stockCodes.slice(0, 15).map(code => 
          testClient.stocks.detail.query({ ts_code: code })
        ),
        // 列表请求
        ...Array.from({ length: 10 }, (_, i) => 
          testClient.stocks.list.query({
            cursor: i * 50,
            limit: 50,
          })
        ),
        // 日线数据请求
        ...stockCodes.slice(0, 5).map(code => 
          testClient.stocks.dailyData.query({
            ts_code: code,
            limit: 30,
          })
        ),
      ];

      console.log(`开始执行 ${mixedRequests.length} 个混合API并发请求...`);
      const startTime = Date.now();
      
      const results = await Promise.allSettled(mixedRequests);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      
      console.log(`混合API并发测试完成，总耗时: ${totalTime}ms`);
      console.log(`成功率: ${(successCount / results.length * 100).toFixed(1)}%`);
      
      // 至少90%的请求应该成功
      expect(successCount / results.length).toBeGreaterThan(0.9);
    });
  });

  describe('数据分页性能', () => {
    it('大数据量分页应保持高性能', async () => {
      const pageSize = 100;
      const totalPages = 10;
      
      console.log(`测试分页性能，每页 ${pageSize} 条，共 ${totalPages} 页...`);
      
      for (let page = 0; page < totalPages; page++) {
        const startTime = Date.now();
        
        const response = await testClient.stocks.list.query({
          cursor: page * pageSize,
          limit: pageSize,
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        console.log(`第 ${page + 1} 页耗时: ${responseTime}ms, 返回: ${response.stocks.length}条`);
        
        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.DETAIL_RESPONSE_TIME);
        expect(response.stocks.length).toBeGreaterThan(0);
        
        if (page < totalPages - 1) {
          expect(response.stocks).toHaveLength(pageSize);
        }
      }
    });

    it('跳页访问应保持稳定性能', async () => {
      const pagesToTest = [0, 10, 20, 30, 39]; // 测试不同位置的页面
      const pageSize = 100;
      
      for (const pageIndex of pagesToTest) {
        const startTime = Date.now();
        
        await testClient.stocks.list.query({
          cursor: pageIndex * pageSize,
          limit: pageSize,
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        console.log(`访问第 ${pageIndex + 1} 页耗时: ${responseTime}ms`);
        
        // 不管是前面的页还是后面的页，性能应该保持一致
        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_RESPONSE_TIME);
      }
    });
  });

  describe('内存和资源使用', () => {
    it('大量搜索不应导致内存泄漏', async () => {
      const initialMemory = process.memoryUsage();
      
      console.log(`初始内存使用: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      
      // 执行1000次各种搜索操作
      for (let i = 0; i < 1000; i++) {
        const searchTerm = i % 100 === 0 ? '银行' : `测试${i % 50}`;
        
        await testClient.stocks.search.query({
          keyword: searchTerm,
          limit: 20,
        });
        
        // 偶尔检查内存使用情况
        if (i % 200 === 0 && i > 0) {
          const currentMemory = process.memoryUsage();
          console.log(`执行 ${i} 次搜索后内存: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        }
      }
      
      // 强制垃圾收集
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`最终内存使用: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`内存增长: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      
      // 内存增长不应超过100MB
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    it('数据库连接应保持稳定', async () => {
      const connectionTests = Array.from({ length: 100 }, async (_, i) => {
        const startTime = Date.now();
        
        try {
          const response = await testClient.stocks.search.query({
            keyword: `test${i % 10}`,
            limit: 10,
          });
          
          const endTime = Date.now();
          
          return {
            success: true,
            responseTime: endTime - startTime,
            resultCount: response.stocks.length,
          };
        } catch (error) {
          return {
            success: false,
            responseTime: Infinity,
            resultCount: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      const results = await Promise.all(connectionTests);
      const successCount = results.filter(r => r.success).length;
      const failedResults = results.filter(r => !r.success);
      
      console.log(`数据库连接测试完成，成功率: ${(successCount / results.length * 100).toFixed(1)}%`);
      
      if (failedResults.length > 0) {
        console.log('失败的请求:', failedResults.slice(0, 5));
      }
      
      // 所有连接都应该成功
      expect(successCount).toBe(results.length);
    });
  });

  describe('搜索结果质量验证', () => {
    it('搜索结果应该相关且准确', async () => {
      const qualityTests = [
        {
          keyword: '银行',
          expectedIndustry: '银行',
          minResults: 5,
        },
        {
          keyword: '平安',
          expectedName: '平安',
          minResults: 1,
        },
        {
          keyword: '000001',
          expectedCode: '000001',
          minResults: 1,
        },
      ];

      for (const test of qualityTests) {
        const response = await testClient.stocks.search.query({
          keyword: test.keyword,
          limit: 50,
        });

        expect(response.stocks.length).toBeGreaterThanOrEqual(test.minResults);

        if (test.expectedIndustry) {
          const relevantResults = response.stocks.filter(s => 
            s.industry?.includes(test.expectedIndustry)
          );
          expect(relevantResults.length).toBeGreaterThan(0);
        }

        if (test.expectedName) {
          const relevantResults = response.stocks.filter(s => 
            s.name.includes(test.expectedName)
          );
          expect(relevantResults.length).toBeGreaterThan(0);
        }

        if (test.expectedCode) {
          const relevantResults = response.stocks.filter(s => 
            s.ts_code.includes(test.expectedCode) || s.symbol.includes(test.expectedCode)
          );
          expect(relevantResults.length).toBeGreaterThan(0);
        }
      }
    });

    it('搜索结果应按相关度排序', async () => {
      const response = await testClient.stocks.search.query({
        keyword: '银行',
        limit: 20,
      });

      expect(response.stocks.length).toBeGreaterThan(5);

      // 检查前几个结果是否都与银行相关
      const top5Results = response.stocks.slice(0, 5);
      const bankRelatedCount = top5Results.filter(s => 
        s.industry?.includes('银行') || s.name.includes('银行')
      ).length;

      expect(bankRelatedCount).toBeGreaterThan(2); // 前5个结果中至少有3个与银行相关
    });
  });
});