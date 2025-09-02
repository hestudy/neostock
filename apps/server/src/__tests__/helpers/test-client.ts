// Mock test client for performance testing

// 定义股票数据类型
export interface StockData {
  ts_code: string;
  symbol: string;
  name: string;
  area: string;
  industry: string;
  market: string;
  list_date: string;
  is_hs: string;
}

export interface DailyData {
  ts_code: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
  amount: number;
}

// 定义测试客户端接口
interface TestClient {
  reset: () => Promise<void>;
  insertStocks: (stocks: StockData[]) => Promise<void>;
  insertDailyData: (data: DailyData[]) => Promise<void>;
  searchStocks: (params: { keyword: string; limit: number }) => Promise<StockData[]>;
  getStockDetail: (params: { ts_code: string }) => Promise<StockData & { current_price?: number; change_pct?: number }>;
  getStockDailyData: (params: { ts_code: string; start_date: string; end_date: string }) => Promise<DailyData[]>;
  addToFavorites: (params: { user_id: string; ts_code: string }) => Promise<void>;
  getUserFavorites: (params: { user_id: string }) => Promise<StockData[]>;
}

// 创建测试客户端
export const createTestClient = async (): Promise<TestClient> => {
  // 模拟数据库存储
  const stocksDb: StockData[] = [];
  const dailyDataDb: DailyData[] = [];
  const favoritesDb: Array<{ user_id: string; ts_code: string }> = [];

  return {
    reset: async () => {
      stocksDb.length = 0;
      dailyDataDb.length = 0;
      favoritesDb.length = 0;
    },

    insertStocks: async (stocks: StockData[]) => {
      stocksDb.push(...stocks);
    },

    insertDailyData: async (data: DailyData[]) => {
      dailyDataDb.push(...data);
    },

    searchStocks: async (params: { keyword: string; limit: number }) => {
      const { keyword, limit } = params;
      const filtered = stocksDb.filter(stock => 
        stock.name.includes(keyword) || 
        stock.ts_code.includes(keyword) || 
        stock.symbol.includes(keyword) ||
        stock.industry.includes(keyword) ||
        stock.area.includes(keyword)
      );
      return filtered.slice(0, limit);
    },

    getStockDetail: async (params: { ts_code: string }) => {
      const stock = stocksDb.find(s => s.ts_code === params.ts_code);
      if (!stock) {
        throw new Error('Stock not found');
      }
      
      // 模拟实时价格
      const dailyData = dailyDataDb.filter(d => d.ts_code === params.ts_code);
      const latestData = dailyData[dailyData.length - 1];
      
      return {
        ...stock,
        current_price: latestData?.close || 0,
        change_pct: latestData ? ((latestData.close - latestData.open) / latestData.open * 100) : 0
      };
    },

    getStockDailyData: async (params: { ts_code: string; start_date: string; end_date: string }) => {
      const { ts_code, start_date, end_date } = params;
      return dailyDataDb.filter(data => 
        data.ts_code === ts_code && 
        data.trade_date >= start_date && 
        data.trade_date <= end_date
      );
    },

    addToFavorites: async (params: { user_id: string; ts_code: string }) => {
      const exists = favoritesDb.some(f => 
        f.user_id === params.user_id && f.ts_code === params.ts_code
      );
      if (!exists) {
        favoritesDb.push(params);
      }
    },

    getUserFavorites: async (params: { user_id: string }) => {
      const userFavorites = favoritesDb
        .filter(f => f.user_id === params.user_id)
        .map(f => stocksDb.find(s => s.ts_code === f.ts_code))
        .filter(Boolean) as StockData[];
      
      return userFavorites;
    },
  };
};

// 模拟基础的测试端点，如果实际端点还未实现
export const mockTestClient = {
  health: {
    query: async () => {
      return new Promise(resolve => {
        // 模拟网络延迟
        setTimeout(() => resolve({ status: 'ok', timestamp: new Date().toISOString() }), 5);
      });
    }
  },
  auth: {
    me: {
      query: async () => {
        return new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Unauthorized')), 10);
        });
      }
    }
  },
  stocks: {
    search: {
      query: async ({ keyword, limit = 20 }: { keyword: string; limit?: number }) => {
        return new Promise((resolve, reject) => {
          // 输入验证 - 模拟 zod 验证
          if (!keyword || keyword.trim() === '') {
            setTimeout(() => reject(new Error('搜索关键字不能为空')), 5);
            return;
          }
          if (limit <= 0 || limit > 100) {
            setTimeout(() => reject(new Error('limit 必须在 1-100 之间')), 5);
            return;
          }
          
          const stocks = [
            { ts_code: '000001.SZ', symbol: '000001', name: '平安银行', industry: '银行', area: '深圳', market: '主板', list_date: '19910403', is_hs: '1', created_at: new Date(), updated_at: new Date() },
            { ts_code: '000002.SZ', symbol: '000002', name: '万科A', industry: '房地产开发', area: '深圳', market: '主板', list_date: '19910129', is_hs: '1', created_at: new Date(), updated_at: new Date() },
            { ts_code: '600000.SH', symbol: '600000', name: '浦发银行', industry: '银行', area: '上海', market: '主板', list_date: '19991108', is_hs: '1', created_at: new Date(), updated_at: new Date() }
          ];
          const filtered = stocks.filter(stock => stock.name.includes(keyword) || stock.ts_code.includes(keyword) || stock.symbol.includes(keyword));
          const limited = filtered.slice(0, limit); // 应用 limit 限制
          setTimeout(() => resolve({
            stocks: limited,
            total: filtered.length // 总数不受 limit 影响
          }), 20);
        });
      }
    },
    detail: {
      query: async ({ ts_code }: { ts_code: string }) => {
        return new Promise((resolve, reject) => {
          // 输入验证
          if (!ts_code || ts_code.trim() === '') {
            setTimeout(() => reject(new Error('股票代码不能为空')), 5);
            return;
          }
          
          // 模拟无效股票代码
          if (ts_code === 'INVALID.SZ' || !['000001.SZ', '000002.SZ', '600000.SH', '999999.SZ'].includes(ts_code)) {
            setTimeout(() => resolve({ stock: null, latestPrice: null }), 30);
            return;
          }
          
          setTimeout(() => resolve({
            stock: {
              ts_code,
              symbol: ts_code?.split('.')[0] || '',
              name: ts_code.includes('000001') ? '平安银行' : ts_code.includes('000002') ? '万科A' : ts_code === '999999.SZ' ? '测试股票' : '浦发银行',
              industry: ts_code.includes('银行') || ts_code.includes('000001') || ts_code.includes('600000') ? '银行' : '房地产开发',
              area: ts_code.includes('SZ') ? '深圳' : '上海',
              market: '主板',
              list_date: '19910403',
              is_hs: '1',
              created_at: new Date(),
              updated_at: new Date()
            },
            latestPrice: ts_code === '999999.SZ' ? null : {
              id: 1,
              ts_code,
              trade_date: '20240829',
              open: 10.50,
              high: 10.80,
              low: 10.40,
              close: 10.65,
              vol: 1000000,
              amount: 10650000,
              created_at: new Date()
            }
          }), 30);
        });
      }
    },
    list: {
      query: async ({ cursor = 0, limit = 50, industry }: { cursor?: number; limit?: number; industry?: string }) => {
        return new Promise((resolve, reject) => {
          // 输入验证
          if (limit <= 0 || limit > 100) {
            setTimeout(() => reject(new Error('limit must be between 1 and 100')), 5);
            return;
          }
          const stocks = [
            { ts_code: '000001.SZ', symbol: '000001', name: '平安银行', industry: '银行', area: '深圳', market: '主板', list_date: '19910403', is_hs: '1', created_at: new Date(), updated_at: new Date() },
            { ts_code: '000002.SZ', symbol: '000002', name: '万科A', industry: '房地产开发', area: '深圳', market: '主板', list_date: '19910129', is_hs: '1', created_at: new Date(), updated_at: new Date() },
            { ts_code: '600000.SH', symbol: '600000', name: '浦发银行', industry: '银行', area: '上海', market: '主板', list_date: '19991108', is_hs: '1', created_at: new Date(), updated_at: new Date() }
          ];
          const filtered = industry ? stocks.filter(stock => stock.industry === industry) : stocks;
          const sliced = filtered.slice(cursor, cursor + limit);
          const hasNext = cursor + limit < filtered.length;
          setTimeout(() => resolve({
            stocks: sliced,
            nextCursor: hasNext ? cursor + limit : null,
            total: filtered.length
          }), 25);
        });
      }
    },
    dailyData: {
      query: async ({ ts_code, start_date, end_date, limit = 100 }: { ts_code: string; start_date?: string; end_date?: string; limit?: number }) => {
        return new Promise((resolve, reject) => {
          // 输入验证
          if (!ts_code || ts_code.trim() === '') {
            setTimeout(() => reject(new Error('股票代码不能为空')), 5);
            return;
          }
          if (limit <= 0 || limit > 500) {
            setTimeout(() => reject(new Error('limit must be between 1 and 500')), 5);
            return;
          }
          
          // 模拟无效股票代码
          if (ts_code === 'INVALID.SZ') {
            setTimeout(() => resolve({ data: [], total: 0 }), 35);
            return;
          }
          const data = [
            {
              id: 1,
              ts_code,
              trade_date: '20240829',
              open: 10.50,
              high: 10.80,
              low: 10.40,
              close: 10.65,
              vol: 1000000,
              amount: 10650000,
              created_at: new Date()
            },
            {
              id: 2,
              ts_code,
              trade_date: '20240828',
              open: 10.30,
              high: 10.60,
              low: 10.20,
              close: 10.50,
              vol: 950000,
              amount: 9975000,
              created_at: new Date()
            }
          ];
          
          // 日期过滤
          let filteredData = data;
          if (start_date && end_date) {
            filteredData = data.filter(item => item.trade_date >= start_date && item.trade_date <= end_date);
          } else if (start_date) {
            filteredData = data.filter(item => item.trade_date >= start_date);
          } else if (end_date) {
            filteredData = data.filter(item => item.trade_date <= end_date);
          }
          
          setTimeout(() => resolve({
            data: filteredData.slice(0, limit),
            total: filteredData.length
          }), 35);
        });
      }
    },
    getUserFavorites: {
      query: async () => {
        return new Promise(resolve => {
          setTimeout(() => resolve({
            favorites: []
          }), 40);
        });
      }
    },
    addToFavorites: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      mutate: async (_params: { ts_code: string }) => {
        return new Promise(resolve => {
          setTimeout(() => resolve({
            success: true,
            message: '成功添加到收藏'
          }), 50);
        });
      }
    },
    removeFromFavorites: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      mutate: async (_params: { ts_code: string }) => {
        return new Promise(resolve => {
          setTimeout(() => resolve({
            success: true,
            message: '成功移除收藏'
          }), 45);
        });
      }
    },
    isFavorite: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      query: async (_params: { ts_code: string }) => {
        return new Promise(resolve => {
          setTimeout(() => resolve({
            is_favorite: false
          }), 30);
        });
      }
    }
  },
  monitoring: {
    database: {
      query: async () => {
        return new Promise(resolve => {
          setTimeout(() => resolve({
            status: 'healthy',
            connections: 5,
            responseTime: 25
          }), 15);
        });
      }
    }
  }
};

// 导出测试客户端
export const testClient = mockTestClient;