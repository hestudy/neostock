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
      query: async ({ term }: { term: string }) => {
        return new Promise(resolve => {
          setTimeout(() => resolve([
            { code: '000001.SZ', name: '平安银行', industry: '银行' },
            { code: '000002.SZ', name: '万科A', industry: '房地产' }
          ].filter(stock => stock.name.includes(term) || stock.code.includes(term))), 20);
        });
      }
    },
    detail: {
      query: async ({ code }: { code: string }) => {
        return new Promise(resolve => {
          setTimeout(() => resolve({
            code,
            name: code.includes('000001') ? '平安银行' : '万科A',
            price: 10.50,
            change: 0.05,
            changePercent: 0.48
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