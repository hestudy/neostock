export interface TushareResponse<T = any> {
  code: number;
  msg: string;
  data: {
    fields: string[];
    items: any[][];
  };
}

export interface StockBasicInfo {
  ts_code: string;
  symbol: string;
  name: string;
  area: string;
  industry: string;
  market: string;
  list_date: string;
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

export enum FailureScenario {
  NETWORK_ERROR = 'network_error',
  API_LIMIT_EXCEEDED = 'api_limit_exceeded',
  INVALID_TOKEN = 'invalid_token',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  TIMEOUT = 'timeout',
  INVALID_PARAMS = 'invalid_params'
}

export class TushareAPIMock {
  private failureMode: FailureScenario | null = null;
  private responseDelay = 0;
  private requestCount = 0;
  private dailyLimit = 10000;
  private rateLimitWindow = new Map<string, number[]>();

  // Sample stock data for testing
  private stockBasics: StockBasicInfo[] = [
    {
      ts_code: '000001.SZ',
      symbol: '000001',
      name: '平安银行',
      area: '深圳',
      industry: '银行',
      market: '主板',
      list_date: '19910403'
    },
    {
      ts_code: '000002.SZ',
      symbol: '000002',
      name: '万科A',
      area: '深圳',
      industry: '房地产开发',
      market: '主板',
      list_date: '19910129'
    },
    {
      ts_code: '600000.SH',
      symbol: '600000',
      name: '浦发银行',
      area: '上海',
      industry: '银行',
      market: '主板',
      list_date: '19991110'
    },
    {
      ts_code: '600036.SH',
      symbol: '600036',
      name: '招商银行',
      area: '深圳',
      industry: '银行',
      market: '主板',
      list_date: '20020409'
    }
  ];

  private dailyDataCache = new Map<string, DailyData[]>();

  constructor() {
    this.generateSampleDailyData();
  }

  // Configure mock behavior
  setFailureMode(mode: FailureScenario | null) {
    this.failureMode = mode;
  }

  setResponseDelay(ms: number) {
    this.responseDelay = ms;
  }

  setDailyLimit(limit: number) {
    this.dailyLimit = limit;
  }

  resetRequestCount() {
    this.requestCount = 0;
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  // Simulate different failure scenarios
  private async simulateFailures(): Promise<TushareResponse | never> {
    await this.delay(this.responseDelay);

    switch (this.failureMode) {
      case FailureScenario.NETWORK_ERROR:
        throw new Error('Network connection failed');

      case FailureScenario.API_LIMIT_EXCEEDED:
        return {
          code: -2001,
          msg: 'API daily limit exceeded',
          data: { fields: [], items: [] }
        };

      case FailureScenario.INVALID_TOKEN:
        return {
          code: -2002,
          msg: 'Invalid token',
          data: { fields: [], items: [] }
        };

      case FailureScenario.SERVICE_UNAVAILABLE:
        return {
          code: -2003,
          msg: 'Service temporarily unavailable',
          data: { fields: [], items: [] }
        };

      case FailureScenario.TIMEOUT:
        await this.delay(30000); // Simulate timeout
        throw new Error('Request timeout');

      case FailureScenario.INVALID_PARAMS:
        return {
          code: -2004,
          msg: 'Invalid parameters',
          data: { fields: [], items: [] }
        };

      default:
        return this.createSuccessResponse([], []);
    }
  }

  // Rate limiting simulation
  private checkRateLimit(endpoint: string): boolean {
    const now = Date.now();
    const window = 60000; // 1 minute window
    const limit = 100; // 100 requests per minute

    if (!this.rateLimitWindow.has(endpoint)) {
      this.rateLimitWindow.set(endpoint, []);
    }

    const requests = this.rateLimitWindow.get(endpoint)!;
    
    // Clean old requests outside the window
    const recentRequests = requests.filter(time => now - time < window);
    this.rateLimitWindow.set(endpoint, recentRequests);

    if (recentRequests.length >= limit) {
      return false; // Rate limit exceeded
    }

    recentRequests.push(now);
    return true;
  }

  // Mock API endpoints
  async stockBasic(params: {
    ts_code?: string;
    name?: string;
    market?: string;
    list_status?: string;
  } = {}): Promise<TushareResponse<StockBasicInfo>> {
    this.requestCount++;

    if (this.failureMode) {
      return await this.simulateFailures();
    }

    if (!this.checkRateLimit('stock_basic')) {
      return {
        code: -2005,
        msg: 'Rate limit exceeded',
        data: { fields: [], items: [] }
      };
    }

    if (this.requestCount > this.dailyLimit) {
      return {
        code: -2001,
        msg: 'Daily limit exceeded',
        data: { fields: [], items: [] }
      };
    }

    await this.delay(this.responseDelay);

    let filtered = [...this.stockBasics];

    // Apply filters
    if (params.ts_code) {
      filtered = filtered.filter(stock => stock.ts_code === params.ts_code);
    }
    if (params.name) {
      filtered = filtered.filter(stock => stock.name.includes(params.name));
    }
    if (params.market) {
      filtered = filtered.filter(stock => stock.market === params.market);
    }

    const fields = ['ts_code', 'symbol', 'name', 'area', 'industry', 'market', 'list_date'];
    const items = filtered.map(stock => [
      stock.ts_code,
      stock.symbol,
      stock.name,
      stock.area,
      stock.industry,
      stock.market,
      stock.list_date
    ]);

    return this.createSuccessResponse(fields, items);
  }

  async daily(params: {
    ts_code?: string;
    trade_date?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<TushareResponse<DailyData>> {
    this.requestCount++;

    if (this.failureMode) {
      return await this.simulateFailures();
    }

    if (!this.checkRateLimit('daily')) {
      return {
        code: -2005,
        msg: 'Rate limit exceeded',
        data: { fields: [], items: [] }
      };
    }

    await this.delay(this.responseDelay);

    if (!params.ts_code) {
      return {
        code: -2004,
        msg: 'ts_code is required',
        data: { fields: [], items: [] }
      };
    }

    const dailyData = this.dailyDataCache.get(params.ts_code) || [];
    let filtered = [...dailyData];

    // Apply date filters
    if (params.trade_date) {
      filtered = filtered.filter(item => item.trade_date === params.trade_date);
    }
    if (params.start_date && params.end_date) {
      filtered = filtered.filter(item => 
        item.trade_date >= params.start_date! && 
        item.trade_date <= params.end_date!
      );
    }

    const fields = ['ts_code', 'trade_date', 'open', 'high', 'low', 'close', 'vol', 'amount'];
    const items = filtered.map(item => [
      item.ts_code,
      item.trade_date,
      item.open,
      item.high,
      item.low,
      item.close,
      item.vol,
      item.amount
    ]);

    return this.createSuccessResponse(fields, items);
  }

  // Data quality validation
  validateDataQuality(data: any): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!data || typeof data !== 'object') {
      issues.push('Invalid data format');
      return { valid: false, issues };
    }

    if (data.code !== 0) {
      issues.push(`API error: ${data.msg}`);
    }

    if (!data.data || !Array.isArray(data.data.fields) || !Array.isArray(data.data.items)) {
      issues.push('Invalid data structure');
    }

    // Check for data consistency
    if (data.data) {
      const { fields, items } = data.data;
      
      for (const item of items) {
        if (!Array.isArray(item) || item.length !== fields.length) {
          issues.push('Data field mismatch');
          break;
        }
      }

      // Check for required fields in stock data
      if (fields.includes('ts_code') && fields.includes('name')) {
        for (const item of items) {
          const tsCodeIndex = fields.indexOf('ts_code');
          const nameIndex = fields.indexOf('name');
          
          if (!item[tsCodeIndex] || !item[nameIndex]) {
            issues.push('Missing required stock information');
            break;
          }
        }
      }
    }

    return { valid: issues.length === 0, issues };
  }

  // Data source switching simulation
  async switchToBackupSource(): Promise<boolean> {
    try {
      await this.delay(1000); // Simulate backup source connection time
      
      // Simulate 90% success rate for backup source
      const success = Math.random() > 0.1;
      
      if (success) {
        // Reset failure mode when switching to backup
        this.setFailureMode(null);
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  // Utility methods
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private createSuccessResponse(fields: string[], items: any[][]): TushareResponse {
    return {
      code: 0,
      msg: 'Success',
      data: { fields, items }
    };
  }

  private generateSampleDailyData() {
    for (const stock of this.stockBasics) {
      const dailyData: DailyData[] = [];
      let currentPrice = 10 + Math.random() * 40; // Random starting price

      // Generate 30 days of sample data
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const tradeDateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

        // Simulate price movement
        const change = (Math.random() - 0.5) * 0.1; // ±5% random change
        currentPrice = Math.max(0.01, currentPrice * (1 + change));

        const open = currentPrice;
        const close = open * (1 + (Math.random() - 0.5) * 0.05);
        const high = Math.max(open, close) * (1 + Math.random() * 0.03);
        const low = Math.min(open, close) * (1 - Math.random() * 0.03);
        const vol = Math.floor(Math.random() * 10000000); // Random volume
        const amount = vol * ((high + low) / 2); // Approximate amount

        dailyData.push({
          ts_code: stock.ts_code,
          trade_date: tradeDateStr,
          open: Math.round(open * 100) / 100,
          high: Math.round(high * 100) / 100,
          low: Math.round(low * 100) / 100,
          close: Math.round(close * 100) / 100,
          vol,
          amount: Math.round(amount)
        });

        currentPrice = close;
      }

      this.dailyDataCache.set(stock.ts_code, dailyData);
    }
  }

  // Get mock statistics for testing
  getMockStatistics() {
    return {
      requestCount: this.requestCount,
      dailyLimit: this.dailyLimit,
      failureMode: this.failureMode,
      responseDelay: this.responseDelay,
      stockCount: this.stockBasics.length,
      rateLimitStatus: Object.fromEntries(this.rateLimitWindow)
    };
  }
}