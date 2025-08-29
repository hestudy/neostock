// Mock test client for performance testing

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