import type {
  StockBasicInfo,
  StockDailyData,
  DataFetchRequest,
  DataFetchResponse,
} from "../../types/data-sources";
import { AbstractDataSource } from "./abstract-data-source";
import { dataSourceConfigManager } from "./data-source-config";

// 新浪财经实时数据格式
interface SinaRealTimeData {
  name: string;
  open: number;
  close_yesterday: number;
  current: number;
  high: number;
  low: number;
  vol: number;
  amount: number;
  date: string;
  time: string;
}

export class SinaDataSource extends AbstractDataSource {
  private readonly apiUrl: string;
  
  // A股市场股票代码前缀映射
  private readonly marketPrefixMap = {
    'SZ': 'sz', // 深圳
    'SH': 'sh', // 上海
  };

  constructor() {
    const config = dataSourceConfigManager.getConfig("sina");
    if (!config) {
      throw new Error("新浪财经数据源配置未找到");
    }

    super(config);
    this.apiUrl = config.apiUrl || "https://hq.sinajs.cn";

    console.log("🔌 新浪财经数据源已初始化");
  }

  getName(): string {
    return "sina";
  }

  // 重写makeRequest方法，添加新浪财经需要的请求头
  protected async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    // 新浪财经需要特殊的请求头来模拟浏览器行为
    const sinaHeaders = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://finance.sina.com.cn/',
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      ...options.headers,
    };

    return super.makeRequest(url, {
      ...options,
      headers: sinaHeaders,
    });
  }

  // 健康检查实现
  async performHealthCheck(): Promise<boolean> {
    try {
      // 使用上证指数进行健康检查
      const response = await this.makeRequest(`${this.apiUrl}/list=sh000001`);
      const text = await response.text();
      
      // 新浪财经返回的是JavaScript变量赋值语句
      return text.includes('var hq_str_sh000001=') && text.length > 50;
    } catch (error) {
      console.warn(`新浪财经健康检查失败:`, error);
      return false;
    }
  }

  // 获取股票基础信息 (新浪财经主要提供实时数据，基础信息有限)
  async fetchStockBasicInfoRaw(request?: DataFetchRequest): Promise<DataFetchResponse<StockBasicInfo>> {
    const requestId = this.generateRequestId();
    
    return this.retryOperation(async () => {
      // 新浪财经不直接提供股票列表API，这里提供一个基础实现
      // 实际使用中可能需要从其他来源获取股票列表，然后查询新浪获取当前状态
      
      if (!request?.tsCodes || request.tsCodes.length === 0) {
        throw new Error("新浪财经数据源需要指定具体的股票代码");
      }

      const stocks: StockBasicInfo[] = [];
      
      // 批量查询股票信息
      const sinaSymbols = request.tsCodes.map(code => this.convertTsCodeToSinaSymbol(code));
      const symbolsStr = sinaSymbols.join(',');
      
      const response = await this.makeRequest(`${this.apiUrl}/list=${symbolsStr}`);
      const text = await response.text();
      
      // 解析响应数据
      const dataMap = this.parseRealTimeResponse(text);
      
      for (const tsCode of request.tsCodes) {
        const sinaSymbol = this.convertTsCodeToSinaSymbol(tsCode);
        const data = dataMap.get(sinaSymbol);
        
        if (data && data.name) {
          const stock: StockBasicInfo = {
            ts_code: tsCode,
            symbol: tsCode.split('.')[0],
            name: data.name,
            area: "", // 新浪财经不提供
            industry: "", // 新浪财经不提供
            market: tsCode.includes('.SH') ? "主板" : "深市", // 简单推断
            list_date: "", // 新浪财经不提供
            is_hs: "0", // 新浪财经不提供
          };
          stocks.push(stock);
        }
      }

      return {
        success: true,
        data: stocks,
        source: this.getName(),
        timestamp: new Date(),
        count: stocks.length,
        total: stocks.length,
        sourceInfo: {
          name: this.getName(),
          requestId,
          timestamp: new Date(),
          cached: false,
        },
      };
    }, "获取股票基础信息");
  }

  // 获取股票日线数据 (新浪财经主要提供当前交易日数据)
  async fetchStockDailyDataRaw(request?: DataFetchRequest): Promise<DataFetchResponse<StockDailyData>> {
    const requestId = this.generateRequestId();
    
    return this.retryOperation(async () => {
      if (!request?.tsCodes || request.tsCodes.length === 0) {
        throw new Error("获取日线数据需要指定股票代码");
      }

      const dailyData: StockDailyData[] = [];
      
      // 批量查询股票数据
      const sinaSymbols = request.tsCodes.map(code => this.convertTsCodeToSinaSymbol(code));
      const symbolsStr = sinaSymbols.join(',');
      
      const response = await this.makeRequest(`${this.apiUrl}/list=${symbolsStr}`);
      const text = await response.text();
      
      // 解析响应数据
      const dataMap = this.parseRealTimeResponse(text);
      
      for (const tsCode of request.tsCodes) {
        const sinaSymbol = this.convertTsCodeToSinaSymbol(tsCode);
        const data = dataMap.get(sinaSymbol);
        
        if (data && this.isValidPriceData(data)) {
          const stockDaily: StockDailyData = {
            ts_code: tsCode,
            trade_date: data.date.replace(/-/g, ''), // 转换为YYYYMMDD格式
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.current, // 新浪财经的current是当前价格
            vol: Math.round(data.vol / 100), // 新浪财经的成交量单位是股，转换为手
            amount: Math.round(data.amount / 1000), // 新浪财经的成交额单位是元，转换为千元
          };
          dailyData.push(stockDaily);
        }
      }

      // 数据质量验证
      const qualityResult = this.validateStockDailyData(dailyData);
      if (qualityResult.score < 80) {
        console.warn(`⚠️  新浪财经日线数据质量较低 (${qualityResult.score}%)，问题数: ${qualityResult.issues.length}`);
      }

      return {
        success: true,
        data: dailyData,
        source: this.getName(),
        timestamp: new Date(),
        count: dailyData.length,
        total: dailyData.length,
        sourceInfo: {
          name: this.getName(),
          requestId,
          timestamp: new Date(),
          cached: false,
        },
      };
    }, "获取股票日线数据");
  }

  // 将 tushare 格式的股票代码转换为新浪格式
  private convertTsCodeToSinaSymbol(tsCode: string): string {
    const [symbol, market] = tsCode.split('.');
    const prefix = this.marketPrefixMap[market as keyof typeof this.marketPrefixMap];
    
    if (!prefix) {
      throw new Error(`不支持的市场代码: ${market}`);
    }
    
    return `${prefix}${symbol}`;
  }

  // 解析新浪财经实时数据响应
  private parseRealTimeResponse(responseText: string): Map<string, SinaRealTimeData> {
    const dataMap = new Map<string, SinaRealTimeData>();
    
    // 新浪财经返回格式: var hq_str_sh000001="上证指数,3200.123,3195.456,..."
    const regex = /var hq_str_([^=]+)="([^"]+)"/g;
    let match;
    
    while ((match = regex.exec(responseText)) !== null) {
      const symbol = match[1];
      const dataStr = match[2];
      
      if (!dataStr || dataStr === 'N/A') {
        continue;
      }
      
      try {
        const fields = dataStr.split(',');
        
        if (fields.length >= 32) { // 新浪财经标准格式有32个字段
          const data: SinaRealTimeData = {
            name: fields[0],
            open: parseFloat(fields[1]) || 0,
            close_yesterday: parseFloat(fields[2]) || 0,
            current: parseFloat(fields[3]) || 0,
            high: parseFloat(fields[4]) || 0,
            low: parseFloat(fields[5]) || 0,
            vol: parseFloat(fields[8]) || 0, // 成交量(股)
            amount: parseFloat(fields[9]) || 0, // 成交额(元)
            date: fields[30] || '', // 交易日期
            time: fields[31] || '', // 交易时间
          };
          
          dataMap.set(symbol, data);
        }
      } catch (error) {
        console.warn(`解析新浪财经数据失败 ${symbol}:`, error);
      }
    }
    
    return dataMap;
  }

  // 验证价格数据有效性
  private isValidPriceData(data: SinaRealTimeData): boolean {
    return data.open > 0 && data.high > 0 && data.low > 0 && 
           data.current > 0 && data.date.length > 0;
  }

  // 批量获取多只股票的实时数据
  async getBatchRealTimeData(
    tsCodes: string[]
  ): Promise<DataFetchResponse<StockDailyData>> {
    const requestId = this.generateRequestId();
    
    return this.retryOperation(async () => {
      const batchSize = 100; // 新浪财经单次查询限制
      const allData: StockDailyData[] = [];
      
      console.log(`📊 开始批量获取 ${tsCodes.length} 只股票的实时数据`);
      
      for (let i = 0; i < tsCodes.length; i += batchSize) {
        const batch = tsCodes.slice(i, i + batchSize);
        
        try {
          const response = await this.fetchStockDailyDataRaw({ tsCodes: batch });
          allData.push(...response.data);
          
          // 进度提示
          const processed = Math.min(i + batchSize, tsCodes.length);
          console.log(`📈 已获取 ${processed}/${tsCodes.length} 只股票数据`);
          
          // API 调用间隔
          if (i + batchSize < tsCodes.length) {
            await this.sleep(100); // 100ms 间隔
          }
          
        } catch (error) {
          console.warn(`⚠️  批次 ${i}-${i + batchSize} 获取失败:`, error);
        }
      }
      
      console.log(`✅ 批量获取完成，成功: ${allData.length} 条`);
      
      return {
        success: true,
        data: allData,
        source: this.getName(),
        timestamp: new Date(),
        count: allData.length,
        total: allData.length,
        sourceInfo: {
          name: this.getName(),
          requestId,
          timestamp: new Date(),
          cached: false,
        },
      };
    }, "批量获取实时数据");
  }

  // 获取股票详细信息 (包含更多实时指标)
  async getStockDetailInfo(tsCodes: string[]): Promise<{
    success: boolean;
    data: Array<{
      ts_code: string;
      name: string;
      current: number;
      change: number;
      change_percent: number;
      open: number;
      high: number;
      low: number;
      close_yesterday: number;
      vol: number;
      amount: number;
      turnover_rate?: number;
      pe_ratio?: number;
      pb_ratio?: number;
    }>;
    sourceInfo: {
      name: string;
      requestId: string;
      timestamp: Date;
      cached: boolean;
    };
  }> {
    const requestId = this.generateRequestId();
    
    return this.retryOperation(async () => {
      const sinaSymbols = tsCodes.map(code => this.convertTsCodeToSinaSymbol(code));
      const symbolsStr = sinaSymbols.join(',');
      
      const response = await this.makeRequest(`${this.apiUrl}/list=${symbolsStr}`);
      const text = await response.text();
      
      const dataMap = this.parseRealTimeResponse(text);
      const results: Array<{
        ts_code: string;
        name: string;
        current: number;
        change: number;
        change_percent: number;
        open: number;
        high: number;
        low: number;
        close_yesterday: number;
        vol: number;
        amount: number;
        turnover_rate?: number;
        pe_ratio?: number;
        pb_ratio?: number;
      }> = [];
      
      for (const tsCode of tsCodes) {
        const sinaSymbol = this.convertTsCodeToSinaSymbol(tsCode);
        const data = dataMap.get(sinaSymbol);
        
        if (data && data.name) {
          const change = data.current - data.close_yesterday;
          const change_percent = data.close_yesterday > 0 ? 
            (change / data.close_yesterday) * 100 : 0;
          
          results.push({
            ts_code: tsCode,
            name: data.name,
            current: data.current,
            change: change,
            change_percent: Math.round(change_percent * 100) / 100, // 保留2位小数
            open: data.open,
            high: data.high,
            low: data.low,
            close_yesterday: data.close_yesterday,
            vol: Math.round(data.vol / 100), // 转换为手
            amount: Math.round(data.amount / 1000), // 转换为千元
          });
        }
      }
      
      return {
        success: true,
        data: results,
        source: this.getName(),
        timestamp: new Date(),
        count: results.length,
        sourceInfo: {
          name: this.getName(),
          requestId,
          timestamp: new Date(),
          cached: false,
        },
      };
    }, "获取股票详细信息");
  }

  // 检查市场开盘状态
  async getMarketStatus(): Promise<{
    isOpen: boolean;
    marketTime: string;
    nextOpenTime?: string;
  }> {
    try {
      const response = await this.makeRequest(`${this.apiUrl}/list=sh000001`);
      const text = await response.text();
      const dataMap = this.parseRealTimeResponse(text);
      const indexData = dataMap.get('sh000001');
      
      if (indexData && indexData.time) {
        const marketTime = indexData.time;
        
        // 简单判断：如果时间在 09:30-11:30 或 13:00-15:00 之间认为开盘
        const time = marketTime.replace(':', '');
        const timeNum = parseInt(time);
        
        const isOpen = (timeNum >= 930 && timeNum <= 1130) || 
                       (timeNum >= 1300 && timeNum <= 1500);
        
        return {
          isOpen,
          marketTime,
          nextOpenTime: isOpen ? undefined : "09:30",
        };
      }
      
      return {
        isOpen: false,
        marketTime: "未知",
      };
    } catch (error) {
      console.warn("检查市场状态失败:", error);
      return {
        isOpen: false,
        marketTime: "检查失败",
      };
    }
  }

  // 获取热门股票
  async getHotStocks(limit: number = 20): Promise<DataFetchResponse<{
    ts_code: string;
    name: string;
    current: number;
    change_percent: number;
    vol: number;
    amount: number;
  }>> {
    const requestId = this.generateRequestId();
    
    // 新浪财经不直接提供热门股票列表
    // 这里返回一些常见的指数和热门股票作为示例
    const hotStockCodes = [
      '000001.SZ', '000002.SZ', '000858.SZ', // 深圳热门股
      '600036.SH', '600519.SH', '600000.SH', // 上海热门股
    ].slice(0, limit);
    
    try {
      const response = await this.getStockDetailInfo(hotStockCodes);
      
      const transformedData = response.data.map(stock => ({
        ts_code: stock.ts_code,
        name: stock.name,
        current: stock.current,
        change_percent: stock.change_percent,
        vol: stock.vol,
        amount: stock.amount,
      }));
      
      return {
        success: true,
        data: transformedData,
        source: this.getName(),
        timestamp: new Date(),
        count: transformedData.length,
        total: transformedData.length,
        sourceInfo: {
          name: this.getName(),
          requestId,
          timestamp: new Date(),
          cached: false,
        },
      };
    } catch (error) {
      throw new Error(`获取热门股票失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}