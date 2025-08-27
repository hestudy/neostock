import type {
  StockBasicInfo,
  StockDailyData,
  DataFetchRequest,
  DataFetchResponse,
} from "../../types/data-sources";
import {
  DataSourceError,
  DataSourceErrorType,
} from "../../types/data-sources";
import { AbstractDataSource } from "./abstract-data-source";
import { dataSourceConfigManager } from "./data-source-config";

// Tushare API 请求接口
interface TushareApiRequest {
  api_name: string;
  token: string;
  params?: Record<string, string | number | null>;
  fields?: string;
}

// Tushare API 响应接口
interface TushareApiResponse {
  request_id: string;
  code: number;
  msg: string;
  data: {
    fields: string[];
    items: Array<Array<string | number | null>>;
  };
}

export class TushareDataSource extends AbstractDataSource {
  private readonly apiToken: string;
  private readonly apiUrl: string;

  constructor() {
    const config = dataSourceConfigManager.getConfig("tushare");
    if (!config) {
      throw new Error("Tushare 数据源配置未找到");
    }

    if (!config.apiKey) {
      throw new Error("Tushare API Token 未配置，请设置环境变量 TUSHARE_API_TOKEN");
    }

    super(config);
    this.apiToken = config.apiKey;
    this.apiUrl = config.apiUrl;

    console.log("🔌 Tushare 数据源已初始化");
  }

  getName(): string {
    return "tushare";
  }

  // 健康检查实现
  async performHealthCheck(): Promise<boolean> {
    try {
      // 使用简单的股票基础信息查询来检查API是否正常
      const response = await this.callTushareApi({
        api_name: "stock_basic",
        token: this.apiToken,
        params: {
          list_status: "L",
          limit: 1, // 只查询1条记录用于测试
        },
        fields: "ts_code,symbol,name",
      });

      return response.code === 0 && response.data && response.data.items.length > 0;
    } catch (error) {
      console.warn(`Tushare 健康检查失败:`, error);
      return false;
    }
  }

  // 获取股票基础信息
  async getStockBasicInfo(request?: DataFetchRequest): Promise<DataFetchResponse<StockBasicInfo>> {
    const requestId = this.generateRequestId();
    
    return this.retryOperation(async () => {
      const params: Record<string, string | number | null> = {
        list_status: "L", // 只获取上市状态的股票
      };

      // 处理特定股票代码查询
      if (request?.tsCodes && request.tsCodes.length > 0) {
        params.ts_code = request.tsCodes.join(",");
      }

      // 处理分页
      if (request?.limit) {
        params.limit = Math.min(request.limit, 5000); // Tushare 单次最大5000条
      }

      if (request?.offset) {
        params.offset = request.offset;
      }

      const response = await this.callTushareApi({
        api_name: "stock_basic",
        token: this.apiToken,
        params,
        fields: "ts_code,symbol,name,area,industry,market,list_date,is_hs",
      });

      if (response.code !== 0) {
        throw new Error(`Tushare API 错误: ${response.msg} (code: ${response.code})`);
      }

      // 转换数据格式
      const stocks = this.transformStockBasicData(response.data);
      
      // 数据质量验证
      const qualityResult = this.validateStockBasicInfo(stocks);
      if (qualityResult.score < 90) {
        console.warn(`⚠️  Tushare 股票基础数据质量较低 (${qualityResult.score}%)，问题数: ${qualityResult.issues.length}`);
      }

      return {
        success: true,
        data: stocks,
        total: stocks.length,
        hasMore: request?.limit ? stocks.length === request.limit : false,
        nextOffset: request?.offset ? (request.offset + stocks.length) : undefined,
        sourceInfo: {
          name: this.getName(),
          requestId,
          timestamp: new Date(),
          cached: false,
        },
      };
    }, "获取股票基础信息");
  }

  // 获取股票日线数据
  async getStockDailyData(request?: DataFetchRequest): Promise<DataFetchResponse<StockDailyData>> {
    const requestId = this.generateRequestId();
    
    return this.retryOperation(async () => {
      const params: Record<string, string | number | null> = {};

      // 股票代码是必需的
      if (!request?.tsCodes || request.tsCodes.length === 0) {
        throw new Error("获取日线数据需要指定股票代码");
      }

      // Tushare 日线数据 API 一次只能查询一个股票
      if (request.tsCodes.length > 1) {
        throw new Error("Tushare 日线数据 API 一次只能查询一个股票代码");
      }

      params.ts_code = request.tsCodes[0];

      // 处理日期范围
      if (request.startDate) {
        params.start_date = request.startDate;
      }
      if (request.endDate) {
        params.end_date = request.endDate;
      }

      // 处理分页
      if (request.limit) {
        params.limit = Math.min(request.limit, 5000); // Tushare 单次最大5000条
      }

      if (request.offset) {
        params.offset = request.offset;
      }

      const response = await this.callTushareApi({
        api_name: "daily",
        token: this.apiToken,
        params,
        fields: "ts_code,trade_date,open,high,low,close,vol,amount",
      });

      if (response.code !== 0) {
        throw new Error(`Tushare API 错误: ${response.msg} (code: ${response.code})`);
      }

      // 转换数据格式
      const dailyData = this.transformDailyData(response.data);
      
      // 数据质量验证
      const qualityResult = this.validateStockDailyData(dailyData);
      if (qualityResult.score < 90) {
        console.warn(`⚠️  Tushare 日线数据质量较低 (${qualityResult.score}%)，问题数: ${qualityResult.issues.length}`);
      }

      return {
        success: true,
        data: dailyData,
        total: dailyData.length,
        hasMore: request?.limit ? dailyData.length === request.limit : false,
        nextOffset: request?.offset ? (request.offset + dailyData.length) : undefined,
        sourceInfo: {
          name: this.getName(),
          requestId,
          timestamp: new Date(),
          cached: false,
        },
      };
    }, "获取股票日线数据");
  }

  // 调用 Tushare API
  private async callTushareApi(requestData: TushareApiRequest): Promise<TushareApiResponse> {
    const url = this.apiUrl;
    
    const requestOptions: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Neostock/1.0",
      },
      body: JSON.stringify(requestData),
    };

    try {
      const response = await this.makeRequest(url, requestOptions);
      const data = await response.json() as TushareApiResponse;
      
      // Tushare 特殊错误处理
      if (data.code === -2001) {
        throw new Error("Tushare API Token 无效或已过期");
      } else if (data.code === -2002) {
        throw new Error("Tushare API 权限不足");
      } else if (data.code === -2003) {
        throw new Error("Tushare API 调用频率超限");
      } else if (data.code > 0) {
        throw new Error(`Tushare API 错误: ${data.msg} (code: ${data.code})`);
      }

      return data;
    } catch (error) {
      // 增强错误信息
      if (error instanceof Error) {
        const enhancedError = this.enhanceTushareError(error);
        throw enhancedError;
      }
      throw error;
    }
  }

  // 增强 Tushare 错误信息
  private enhanceTushareError(error: Error): DataSourceError {
    let errorType = DataSourceErrorType.NETWORK_ERROR;
    const message = error.message;

    if (message.includes("Token 无效") || message.includes("权限不足")) {
      errorType = DataSourceErrorType.AUTH_ERROR;
    } else if (message.includes("频率超限") || message.includes("调用次数")) {
      errorType = DataSourceErrorType.RATE_LIMIT_ERROR;
    } else if (message.includes("quota") || message.includes("积分")) {
      errorType = DataSourceErrorType.API_QUOTA_EXCEEDED;
    } else if (message.includes("参数") || message.includes("格式")) {
      errorType = DataSourceErrorType.INVALID_PARAMS;
    } else if (message.includes("timeout")) {
      errorType = DataSourceErrorType.TIMEOUT_ERROR;
    }

    return new (class extends Error {
      constructor(
        public type: DataSourceErrorType,
        message: string,
        public statusCode?: number,
        public originalError?: Error
      ) {
        super(message);
        this.name = 'DataSourceError';
      }
    })(errorType, `Tushare: ${message}`, undefined, error);
  }

  // 转换股票基础数据格式
  private transformStockBasicData(data: TushareApiResponse['data']): StockBasicInfo[] {
    if (!data || !data.fields || !data.items) {
      return [];
    }

    const fieldIndices = this.createFieldIndexMap(data.fields);
    const results: StockBasicInfo[] = [];

    for (const item of data.items) {
      try {
        const stock: StockBasicInfo = {
          ts_code: String(this.getFieldValue(item, fieldIndices, "ts_code") || ""),
          symbol: String(this.getFieldValue(item, fieldIndices, "symbol") || ""),
          name: String(this.getFieldValue(item, fieldIndices, "name") || ""),
          area: String(this.getFieldValue(item, fieldIndices, "area") || ""),
          industry: String(this.getFieldValue(item, fieldIndices, "industry") || ""),
          market: String(this.getFieldValue(item, fieldIndices, "market") || ""),
          list_date: String(this.getFieldValue(item, fieldIndices, "list_date") || ""),
          is_hs: String(this.getFieldValue(item, fieldIndices, "is_hs") || "0"),
        };

        // 基本数据验证
        if (stock.ts_code && stock.symbol && stock.name) {
          results.push(stock);
        }
      } catch (error) {
        console.warn("转换股票基础数据时出错:", error, item);
      }
    }

    return results;
  }

  // 转换日线数据格式
  private transformDailyData(data: TushareApiResponse['data']): StockDailyData[] {
    if (!data || !data.fields || !data.items) {
      return [];
    }

    const fieldIndices = this.createFieldIndexMap(data.fields);
    const results: StockDailyData[] = [];

    for (const item of data.items) {
      try {
        const dailyData: StockDailyData = {
          ts_code: String(this.getFieldValue(item, fieldIndices, "ts_code") || ""),
          trade_date: String(this.getFieldValue(item, fieldIndices, "trade_date") || ""),
          open: this.parseNumber(this.getFieldValue(item, fieldIndices, "open")) || 0,
          high: this.parseNumber(this.getFieldValue(item, fieldIndices, "high")) || 0,
          low: this.parseNumber(this.getFieldValue(item, fieldIndices, "low")) || 0,
          close: this.parseNumber(this.getFieldValue(item, fieldIndices, "close")) || 0,
          vol: this.parseNumber(this.getFieldValue(item, fieldIndices, "vol")) || 0,
          amount: this.parseNumber(this.getFieldValue(item, fieldIndices, "amount")) || 0,
        };

        // 基本数据验证
        if (dailyData.ts_code && dailyData.trade_date && 
            dailyData.open > 0 && dailyData.high > 0 && 
            dailyData.low > 0 && dailyData.close > 0) {
          results.push(dailyData);
        }
      } catch (error) {
        console.warn("转换日线数据时出错:", error, item);
      }
    }

    return results;
  }

  // 创建字段索引映射
  private createFieldIndexMap(fields: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    fields.forEach((field, index) => {
      map[field] = index;
    });
    return map;
  }

  // 获取字段值
  private getFieldValue(
    item: Array<string | number | null>, 
    fieldIndices: Record<string, number>, 
    fieldName: string
  ): string | number | null {
    const index = fieldIndices[fieldName];
    if (index === undefined || index >= item.length) {
      return null;
    }
    return item[index];
  }

  // 解析数字
  private parseNumber(value: string | number | null): number | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    
    if (typeof value === "number") {
      return isNaN(value) ? undefined : value;
    }

    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? undefined : parsed;
  }

  // 批量获取多只股票的日线数据
  async getBatchDailyData(
    tsCodes: string[],
    request?: Omit<DataFetchRequest, 'tsCodes'>
  ): Promise<DataFetchResponse<StockDailyData>> {
    const requestId = this.generateRequestId();
    const allData: StockDailyData[] = [];
    const errors: string[] = [];

    console.log(`📊 开始批量获取 ${tsCodes.length} 只股票的日线数据`);

    // 逐个获取每只股票的数据
    for (let i = 0; i < tsCodes.length; i++) {
      const tsCode = tsCodes[i];
      
      try {
        const response = await this.getStockDailyData({
          ...request,
          tsCodes: [tsCode],
        });

        allData.push(...response.data);
        
        // 进度提示
        if ((i + 1) % 10 === 0) {
          console.log(`📈 已获取 ${i + 1}/${tsCodes.length} 只股票数据`);
        }

        // API 调用间隔 (遵循 Tushare 限制)
        if (i < tsCodes.length - 1) {
          await this.sleep(200); // 200ms 间隔，每秒最多5次调用
        }

      } catch (error) {
        const errorMsg = `${tsCode}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        console.warn(`⚠️  获取 ${tsCode} 日线数据失败: ${errorMsg}`);
      }
    }

    console.log(`✅ 批量获取完成，成功: ${allData.length} 条，失败: ${errors.length} 个`);

    return {
      success: errors.length === 0,
      data: allData,
      total: allData.length,
      errorMessage: errors.length > 0 ? `部分数据获取失败: ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "..." : ""}` : undefined,
      sourceInfo: {
        name: this.getName(),
        requestId,
        timestamp: new Date(),
        cached: false,
      },
    };
  }

  // 获取指定日期的所有股票数据
  async getAllStocksDataByDate(
    tradeDate: string,
    limit?: number
  ): Promise<DataFetchResponse<StockDailyData>> {
    const requestId = this.generateRequestId();

    return this.retryOperation(async () => {
      const params: Record<string, string | number | null> = {
        trade_date: tradeDate,
      };

      if (limit) {
        params.limit = Math.min(limit, 5000);
      }

      const response = await this.callTushareApi({
        api_name: "daily",
        token: this.apiToken,
        params,
        fields: "ts_code,trade_date,open,high,low,close,vol,amount",
      });

      if (response.code !== 0) {
        throw new Error(`Tushare API 错误: ${response.msg} (code: ${response.code})`);
      }

      const dailyData = this.transformDailyData(response.data);

      return {
        success: true,
        data: dailyData,
        total: dailyData.length,
        sourceInfo: {
          name: this.getName(),
          requestId,
          timestamp: new Date(),
          cached: false,
        },
      };
    }, `获取 ${tradeDate} 所有股票数据`);
  }
}