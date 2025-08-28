import type {
  StockBasicInfo,
  StockDailyData,
  DataFetchRequest,
  DataFetchResponse,
  DataSourceConfig,
  DataSourceHealth,
} from "../../types/data-sources";
import { DataSourceError, DataSourceErrorType } from "../../types/data-sources";
import { AbstractDataSource } from "./abstract-data-source";

// 网易财经数据源实现
export class NeteaseDataSource extends AbstractDataSource {
  private baseUrl = "https://api.money.163.com";

  constructor() {
    const config: DataSourceConfig = {
      name: "netease",
      displayName: "网易财经",
      priority: 3,
      timeout: 30000,
      retryConfig: {
        maxRetries: 3,
        baseDelay: 1000,
        exponentialFactor: 1.5,
        jitter: 0.2,
        retryableErrors: [DataSourceErrorType.NETWORK_ERROR, DataSourceErrorType.TIMEOUT_ERROR],
        nonRetryableErrors: [DataSourceErrorType.AUTH_ERROR, DataSourceErrorType.DATA_FORMAT_ERROR],
      },
      rateLimit: {
        requestsPerSecond: 2,
        requestsPerMinute: 60,
        requestsPerDay: 1000,
      },
      features: {
        supportsStockBasic: true,
        supportsStockDaily: true,
        supportsRealtime: false,
      },
      endpoints: {
        stockBasic: "/data/feed/1000002",
        stockDaily: "/data/feed",
      },
    };
    super(config);
  }

  getName(): string {
    return this.config.name;
  }

  getConfig(): DataSourceConfig {
    return this.config;
  }

  // 健康检查
  async healthCheck(): Promise<DataSourceHealth> {
    try {
      // 使用简单的API调用进行健康检查
      const response = await fetch(`${this.baseUrl}/data/feed/1000002`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      const isHealthy = response.ok;
      const responseTime = Date.now() - performance.now();

      return {
        name: this.config.name,
        isHealthy,
        responseTime,
        lastChecked: new Date(),
        consecutiveFailures: 0,
        errorMessage: isHealthy ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        name: this.config.name,
        isHealthy: false,
        responseTime: -1,
        lastChecked: new Date(),
        consecutiveFailures: 1,
        errorMessage: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  // 获取股票基础信息
  async getStockBasicInfo(): Promise<DataFetchResponse<StockBasicInfo>> {
    return this.retryOperation(async () => {
      console.log("🌐 网易财经: 开始获取股票基础信息");

      try {
        // 网易财经API需要通过不同的方式获取股票列表
        // 这里提供一个基础实现
        const response = await fetch(`${this.baseUrl}/data/feed/1000002`, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (!response.ok) {
          throw new DataSourceError(
            DataSourceErrorType.NETWORK_ERROR,
            `网易财经API响应错误: ${response.status} ${response.statusText}`
          );
        }

        const responseText = await response.text();
        
        // 网易财经返回JSONP格式，需要解析
        const jsonMatch = responseText.match(/callback\((.*)\)/);
        if (!jsonMatch) {
          throw new DataSourceError(
            DataSourceErrorType.DATA_FORMAT_ERROR,
            "无法解析网易财经响应数据"
          );
        }

        const data = JSON.parse(jsonMatch[1]);

        // 转换为标准格式
        const stocks: StockBasicInfo[] = this.convertNeteaseStockData(data);

        console.log(`✅ 网易财经: 成功获取 ${stocks.length} 只股票基础信息`);

        return {
          success: true,
          data: stocks,
          source: this.config.name,
          timestamp: new Date(),
          count: stocks.length,
        };
      } catch (error) {
        console.error("❌ 网易财经获取股票基础信息失败:", error);
        
        if (error instanceof DataSourceError) {
          throw error;
        }

        throw new DataSourceError(
          DataSourceErrorType.NETWORK_ERROR,
          `网易财经数据获取失败: ${error instanceof Error ? error.message : '未知错误'}`
        );
      }
    });
  }

  // 获取股票日线数据
  async getStockDailyData(request?: DataFetchRequest): Promise<DataFetchResponse<StockDailyData>> {
    return this.retryOperation(async () => {
      console.log("📈 网易财经: 开始获取股票日线数据");

      const symbol = request?.symbol || "000001.SZ";
      const startDate = request?.startDate || this.getDefaultStartDate();
      const endDate = request?.endDate || this.getDefaultEndDate();

      try {
        // 转换股票代码格式 (000001.SZ -> 0000001)
        const neteaseSymbol = this.convertToNeteaseSymbol(symbol);
        
        const url = `${this.baseUrl}/data/feed/${neteaseSymbol}`;
        console.log(`🔍 请求网易财经日线数据: ${url}`);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (!response.ok) {
          throw new DataSourceError(
            DataSourceErrorType.NETWORK_ERROR,
            `网易财经日线数据API响应错误: ${response.status}`
          );
        }

        const responseText = await response.text();
        
        // 解析JSONP响应
        const jsonMatch = responseText.match(/callback\((.*)\)/);
        if (!jsonMatch) {
          throw new DataSourceError(
            DataSourceErrorType.DATA_FORMAT_ERROR,
            "无法解析网易财经日线数据响应"
          );
        }

        const data = JSON.parse(jsonMatch[1]);

        // 转换为标准格式
        const dailyData: StockDailyData[] = this.convertNeteaseDailyData(data, symbol);

        // 过滤日期范围
        const filteredData = dailyData.filter(item => {
          return item.trade_date >= startDate && item.trade_date <= endDate;
        });

        console.log(`✅ 网易财经: 成功获取 ${symbol} 的 ${filteredData.length} 条日线数据`);

        return {
          success: true,
          data: filteredData,
          source: this.config.name,
          timestamp: new Date(),
          count: filteredData.length,
          pagination: {
            page: 1,
            pageSize: filteredData.length,
            total: filteredData.length,
            hasMore: false,
          },
        };
      } catch (error) {
        console.error(`❌ 网易财经获取 ${symbol} 日线数据失败:`, error);
        
        if (error instanceof DataSourceError) {
          throw error;
        }

        throw new DataSourceError(
          DataSourceErrorType.NETWORK_ERROR,
          `网易财经日线数据获取失败: ${error instanceof Error ? error.message : '未知错误'}`
        );
      }
    });
  }

  // 转换网易财经股票数据格式
  private convertNeteaseStockData(data: Record<string, unknown>): StockBasicInfo[] {
    const stocks: StockBasicInfo[] = [];

    // 网易财经数据结构解析
    if (data && typeof data === 'object') {
      // 这里需要根据实际的网易财经API响应格式进行调整
      // 提供一个示例结构
      const stockList = data.list || data.data || [];
      
      for (const item of (stockList as Array<Record<string, unknown>>)) {
        if (item.code && item.name) {
          const code = String(item.code);
          stocks.push({
            ts_code: `${code}.${code.startsWith('6') ? 'SH' : 'SZ'}`,
            symbol: code,
            name: String(item.name),
            area: String(item.area || '未知'),
            industry: String(item.industry || '未知'),
            market: code.startsWith('6') ? '上交所' : '深交所',
            list_date: String(item.list_date || '19900101'),
            is_hs: String(item.is_hs || 'N'),
          });
        }
      }
    }

    return stocks;
  }

  // 转换网易财经日线数据格式
  private convertNeteaseDailyData(data: Record<string, unknown>, tsCode: string): StockDailyData[] {
    const dailyData: StockDailyData[] = [];

    if (data && data.data) {
      const priceData = data.data;
      
      // 网易财经通常返回数组格式的历史数据
      if (Array.isArray(priceData)) {
        priceData.forEach((item: unknown[], index: number) => {
          if (item && Array.isArray(item) && item.length >= 7) {
            // 网易财经格式通常是 [日期, 开盘, 最高, 最低, 收盘, 成交量, 成交额]
            const [dateStr, open, high, low, close, volume, amount] = item as [string, number, number, number, number, number, number];
            
            dailyData.push({
              id: index + 1,
              ts_code: tsCode,
              trade_date: this.formatDate(dateStr),
              open: parseFloat(String(open)) || 0,
              high: parseFloat(String(high)) || 0,
              low: parseFloat(String(low)) || 0,
              close: parseFloat(String(close)) || 0,
              vol: parseInt(String(volume)) || 0,
              amount: parseFloat(String(amount)) || 0,
            });
          }
        });
      }
    }

    return dailyData.sort((a, b) => b.trade_date.localeCompare(a.trade_date));
  }

  // 转换股票代码为网易财经格式
  private convertToNeteaseSymbol(symbol: string): string {
    if (symbol.includes('.')) {
      const [code] = symbol.split('.');
      return code.padStart(7, '0'); // 网易财经使用7位数字代码
    }
    return symbol.padStart(7, '0');
  }

  // 格式化日期为YYYYMMDD
  private formatDate(dateInput: string | Date): string {
    let date: Date;

    if (typeof dateInput === 'string') {
      // 尝试解析各种日期格式
      if (dateInput.match(/^\d{8}$/)) {
        return dateInput; // 已经是YYYYMMDD格式
      }
      date = new Date(dateInput);
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      date = new Date();
    }

    if (isNaN(date.getTime())) {
      return this.getDefaultEndDate();
    }

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${year}${month}${day}`;
  }

  // 获取默认开始日期 (30天前)
  private getDefaultStartDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return this.formatDate(date);
  }

  // 获取默认结束日期 (今天)
  private getDefaultEndDate(): string {
    return this.formatDate(new Date());
  }

  // 实现抽象方法
  async performHealthCheck(): Promise<boolean> {
    const health = await this.healthCheck();
    return health.isHealthy;
  }

  async fetchStockBasicInfoRaw(): Promise<DataFetchResponse<StockBasicInfo>> {
    return this.getStockBasicInfo();
  }

  async fetchStockDailyDataRaw(request?: DataFetchRequest): Promise<DataFetchResponse<StockDailyData>> {
    return this.getStockDailyData(request);
  }
}