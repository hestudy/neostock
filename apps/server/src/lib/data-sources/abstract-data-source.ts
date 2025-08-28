import type {
  StockBasicInfo,
  StockDailyData,
  DataSourceConfig,
  DataSourceHealth,
  DataFetchRequest,
  DataFetchResponse,
  DataQualityResult,
  DataQualityIssue,
} from "../../types/data-sources";
import {
  DataSourceStatus,
  DataSourceErrorType,
  DataSourceError,
  DataQualityIssueType,
} from "../../types/data-sources";
import { dataCacheManager } from "../cache/data-cache-manager";

// 数据源抽象基类
export abstract class AbstractDataSource {
  protected config: DataSourceConfig;
  protected status: DataSourceStatus = DataSourceStatus.INACTIVE;
  protected lastHealthCheck: Date | null = null;
  protected consecutiveFailures = 0;
  private rateLimitTracker: Map<string, number[]> = new Map();

  constructor(config: DataSourceConfig) {
    this.config = config;
  }

  // 抽象方法 - 子类必须实现
  abstract getName(): string;
  abstract performHealthCheck(): Promise<boolean>;
  
  // 需要子类实现的具体数据获取方法 (不带缓存)
  abstract fetchStockBasicInfoRaw(request?: DataFetchRequest): Promise<DataFetchResponse<StockBasicInfo>>;
  abstract fetchStockDailyDataRaw(request?: DataFetchRequest): Promise<DataFetchResponse<StockDailyData>>;

  // 带缓存的公共接口方法
  async getStockBasicInfo(request?: DataFetchRequest): Promise<DataFetchResponse<StockBasicInfo>> {
    const cacheKey = this.buildCacheKey('basic', request);
    
    // 尝试从缓存获取
    const cached = dataCacheManager.getStockBasicInfo(cacheKey);
    if (cached) {
      // 标记为来自缓存并返回
      return {
        ...cached,
        sourceInfo: {
          name: cached.sourceInfo?.name || this.config.name,
          requestId: cached.sourceInfo?.requestId || "",
          timestamp: cached.sourceInfo?.timestamp || new Date(),
          cached: true,
        },
      };
    }

    // 从数据源获取新数据
    const response = await this.fetchStockBasicInfoRaw(request);
    
    // 标记为非缓存数据
    if (response.sourceInfo) {
      response.sourceInfo.cached = false;
    }
    
    // 存入缓存
    dataCacheManager.setStockBasicInfo(cacheKey, response);
    
    return response;
  }

  async getStockDailyData(request?: DataFetchRequest): Promise<DataFetchResponse<StockDailyData>> {
    const cacheKey = this.buildCacheKey('daily', request);
    
    // 尝试从缓存获取
    const cached = dataCacheManager.getStockDailyData(cacheKey);
    if (cached) {
      // 标记为来自缓存并返回
      return {
        ...cached,
        sourceInfo: {
          name: cached.sourceInfo?.name || this.config.name,
          requestId: cached.sourceInfo?.requestId || "",
          timestamp: cached.sourceInfo?.timestamp || new Date(),
          cached: true,
        },
      };
    }

    // 从数据源获取新数据
    const response = await this.fetchStockDailyDataRaw(request);
    
    // 标记为非缓存数据
    if (response.sourceInfo) {
      response.sourceInfo.cached = false;
    }
    
    // 存入缓存
    dataCacheManager.setStockDailyData(cacheKey, response);
    
    return response;
  }

  // 通用方法实现

  // 获取数据源配置
  getConfig(): DataSourceConfig {
    return { ...this.config };
  }

  // 获取当前状态
  getStatus(): DataSourceStatus {
    return this.status;
  }

  // 设置状态
  protected setStatus(status: DataSourceStatus): void {
    this.status = status;
  }

  // 获取优先级
  getPriority(): number {
    return this.config.priority;
  }

  // 健康检查
  async healthCheck(): Promise<DataSourceHealth> {
    const startTime = Date.now();
    this.lastHealthCheck = new Date();

    try {
      const isHealthy = await this.performHealthCheck();
      const responseTime = Date.now() - startTime;

      if (isHealthy) {
        this.consecutiveFailures = 0;
        this.setStatus(DataSourceStatus.ACTIVE);
      } else {
        this.consecutiveFailures++;
        this.setStatus(DataSourceStatus.FAILED);
      }

      return {
        name: this.getName(),
        isHealthy,
        lastChecked: this.lastHealthCheck,
        responseTime,
        consecutiveFailures: this.consecutiveFailures,
      };
    } catch (error) {
      this.consecutiveFailures++;
      this.setStatus(DataSourceStatus.FAILED);
      
      return {
        name: this.getName(),
        isHealthy: false,
        lastChecked: this.lastHealthCheck,
        errorMessage: error instanceof Error ? error.message : String(error),
        consecutiveFailures: this.consecutiveFailures,
      };
    }
  }

  // 速率限制检查
  protected checkRateLimit(): boolean {
    const now = Date.now();
    const minute = Math.floor(now / 60000); // 分钟级别
    const second = Math.floor(now / 1000); // 秒级别
    const day = Math.floor(now / 86400000); // 天级别

    // 检查秒级限制
    const secondKey = `second:${second}`;
    const secondRequests = this.rateLimitTracker.get(secondKey) || [];
    if (secondRequests.length >= (this.config.rateLimit?.requestsPerSecond || 10)) {
      return false;
    }

    // 检查分钟级限制
    const minuteKey = `minute:${minute}`;
    const minuteRequests = this.rateLimitTracker.get(minuteKey) || [];
    if (minuteRequests.length >= (this.config.rateLimit?.requestsPerMinute || 100)) {
      return false;
    }

    // 检查日级限制
    const dayKey = `day:${day}`;
    const dayRequests = this.rateLimitTracker.get(dayKey) || [];
    if (dayRequests.length >= (this.config.rateLimit?.requestsPerDay || 1000)) {
      return false;
    }

    return true;
  }

  // 记录API调用
  protected recordApiCall(): void {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const second = Math.floor(now / 1000);
    const day = Math.floor(now / 86400000);

    // 记录各级别调用
    ['second', 'minute', 'day'].forEach((level) => {
      const key = level === 'second' ? `second:${second}` : 
                  level === 'minute' ? `minute:${minute}` : `day:${day}`;
      
      const requests = this.rateLimitTracker.get(key) || [];
      requests.push(now);
      this.rateLimitTracker.set(key, requests);
    });

    // 清理过期记录 (保留最近5分钟的记录)
    const fiveMinutesAgo = now - 300000;
    for (const [key, requests] of this.rateLimitTracker.entries()) {
      const filteredRequests = requests.filter(timestamp => timestamp > fiveMinutesAgo);
      if (filteredRequests.length === 0) {
        this.rateLimitTracker.delete(key);
      } else {
        this.rateLimitTracker.set(key, filteredRequests);
      }
    }
  }

  // 智能重试机制
  protected async retryOperation<T>(
    operation: () => Promise<T>,
    context: string = "operation"
  ): Promise<T> {
    const retryConfig = this.config.retryConfig;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // 计算延迟时间 (指数退避 + 随机抖动)
          const delay = retryConfig.baseDelay * 
            Math.pow(retryConfig.exponentialFactor, attempt - 1);
          const jitter = delay * retryConfig.jitter * Math.random();
          const totalDelay = delay + jitter;

          console.log(`⚠️  ${this.getName()}: ${context} 重试 ${attempt}/${retryConfig.maxRetries}，延迟 ${totalDelay.toFixed(0)}ms`);
          await this.sleep(totalDelay);
        }

        const result = await operation();
        if (attempt > 0) {
          console.log(`✅ ${this.getName()}: ${context} 重试成功 (尝试 ${attempt + 1}/${retryConfig.maxRetries + 1})`);
        }
        return result;

      } catch (error) {
        lastError = error as Error;
        
        // 判断是否应该重试
        if (attempt === retryConfig.maxRetries) {
          break; // 已达到最大重试次数
        }

        const errorType = this.classifyError(error as Error);
        
        if (retryConfig.nonRetryableErrors.includes(errorType)) {
          console.log(`❌ ${this.getName()}: ${context} 遇到不可重试错误: ${errorType}`);
          break; // 不可重试的错误
        }

        if (!retryConfig.retryableErrors.includes(errorType)) {
          console.log(`❌ ${this.getName()}: ${context} 遇到未分类错误: ${errorType}，不进行重试`);
          break; // 未分类的错误也不重试
        }

        console.log(`⚠️  ${this.getName()}: ${context} 遇到可重试错误: ${errorType}`);
      }
    }

    // 所有重试都失败，抛出最后一个错误
    this.consecutiveFailures++;
    throw new DataSourceError(
      this.classifyError(lastError!),
      `${context} 在 ${retryConfig.maxRetries + 1} 次尝试后失败: ${lastError?.message}`,
      undefined,
      lastError!
    );
  }

  // 错误分类
  protected classifyError(error: Error): DataSourceErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('etimedout')) {
      return DataSourceErrorType.TIMEOUT_ERROR;
    }
    
    if (message.includes('network') || message.includes('enotfound') || 
        message.includes('econnreset') || message.includes('econnrefused')) {
      return DataSourceErrorType.NETWORK_ERROR;
    }
    
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return DataSourceErrorType.RATE_LIMIT_ERROR;
    }
    
    if (message.includes('unauthorized') || message.includes('forbidden') || 
        message.includes('auth')) {
      return DataSourceErrorType.AUTH_ERROR;
    }
    
    if (message.includes('bad request') || message.includes('invalid param')) {
      return DataSourceErrorType.INVALID_PARAMS;
    }

    if (message.includes('quota') || message.includes('exceeded')) {
      return DataSourceErrorType.API_QUOTA_EXCEEDED;
    }

    // 检查HTTP状态码 (如果错误对象包含)
    if ('status' in error || 'statusCode' in error) {
      const status = (error as { status?: number; statusCode?: number }).status || 
                     (error as { status?: number; statusCode?: number }).statusCode;
      if (status && status >= 500) {
        return DataSourceErrorType.SERVER_ERROR_5XX;
      }
      if (status && status >= 400 && status < 500) {
        return DataSourceErrorType.CLIENT_ERROR_4XX;
      }
    }
    
    return DataSourceErrorType.NETWORK_ERROR; // 默认分类
  }

  // 数据质量验证
  protected validateStockBasicInfo(stocks: StockBasicInfo[]): DataQualityResult {
    const issues: DataQualityIssue[] = [];
    let validCount = 0;

    for (const stock of stocks) {
      const stockIssues: string[] = [];

      // 必填字段检查
      if (!stock.ts_code || !stock.symbol || !stock.name) {
        stockIssues.push("缺少必填字段");
      }

      // 股票代码格式检查
      if (stock.ts_code && !/^\d{6}\.(SH|SZ)$/.test(stock.ts_code)) {
        stockIssues.push("股票代码格式无效");
      }

      // 符号格式检查
      if (stock.symbol && !/^\d{6}$/.test(stock.symbol)) {
        stockIssues.push("股票符号格式无效");
      }

      // 上市日期格式检查
      if (stock.list_date && !/^\d{8}$/.test(stock.list_date)) {
        stockIssues.push("上市日期格式无效");
      }

      if (stockIssues.length === 0) {
        validCount++;
      } else {
        issues.push({
          type: DataQualityIssueType.INVALID_FORMAT,
          severity: "medium",
          message: `股票 ${stock.ts_code} 数据问题: ${stockIssues.join(", ")}`,
          affectedRecords: 1,
        });
      }
    }

    const score = stocks.length > 0 ? Math.round((validCount / stocks.length) * 100) : 0;

    return {
      valid: issues.length === 0,
      issues,
      score,
      checkedAt: new Date(),
    };
  }

  // 验证日线数据
  protected validateStockDailyData(dailyData: StockDailyData[]): DataQualityResult {
    const issues: DataQualityIssue[] = [];
    let validCount = 0;

    for (const data of dailyData) {
      const dataIssues: string[] = [];

      // 必填字段检查
      if (!data.ts_code || !data.trade_date || 
          data.open == null || data.high == null || 
          data.low == null || data.close == null) {
        dataIssues.push("缺少必填字段");
      }

      // 股票代码格式检查
      if (data.ts_code && !/^\d{6}\.(SH|SZ)$/.test(data.ts_code)) {
        dataIssues.push("股票代码格式无效");
      }

      // 交易日期格式检查
      if (data.trade_date && !/^\d{8}$/.test(data.trade_date)) {
        dataIssues.push("交易日期格式无效");
      }

      // 价格数据合理性检查
      if (data.open != null && (data.open <= 0 || data.open > 10000)) {
        dataIssues.push("开盘价超出合理范围");
      }

      if (data.high != null && (data.high <= 0 || data.high > 10000)) {
        dataIssues.push("最高价超出合理范围");
      }

      if (data.low != null && (data.low <= 0 || data.low > 10000)) {
        dataIssues.push("最低价超出合理范围");
      }

      if (data.close != null && (data.close <= 0 || data.close > 10000)) {
        dataIssues.push("收盘价超出合理范围");
      }

      // 逻辑一致性检查
      if (data.high != null && data.low != null && data.high < data.low) {
        dataIssues.push("最高价小于最低价");
      }

      if (data.high != null && data.open != null && data.high < data.open) {
        dataIssues.push("最高价小于开盘价");
      }

      if (data.high != null && data.close != null && data.high < data.close) {
        dataIssues.push("最高价小于收盘价");
      }

      if (data.low != null && data.open != null && data.low > data.open) {
        dataIssues.push("最低价大于开盘价");
      }

      if (data.low != null && data.close != null && data.low > data.close) {
        dataIssues.push("最低价大于收盘价");
      }

      // 成交量合理性检查
      if (data.vol != null && data.vol < 0) {
        dataIssues.push("成交量为负数");
      }

      if (data.amount != null && data.amount < 0) {
        dataIssues.push("成交额为负数");
      }

      if (dataIssues.length === 0) {
        validCount++;
      } else {
        issues.push({
          type: DataQualityIssueType.INVALID_FORMAT,
          severity: "medium",
          message: `${data.ts_code} ${data.trade_date} 数据问题: ${dataIssues.join(", ")}`,
          affectedRecords: 1,
        });
      }
    }

    const score = dailyData.length > 0 ? Math.round((validCount / dailyData.length) * 100) : 0;

    return {
      valid: issues.length === 0,
      issues,
      score,
      checkedAt: new Date(),
    };
  }

  // 工具方法：延迟执行
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 生成请求ID
  protected generateRequestId(): string {
    return `${this.getName()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 工具方法：HTTP请求
  protected async makeRequest(
    url: string, 
    options: RequestInit = {}
  ): Promise<Response> {
    // 检查速率限制
    if (!this.checkRateLimit()) {
      throw new DataSourceError(
        DataSourceErrorType.RATE_LIMIT_ERROR,
        `${this.getName()} API调用超出速率限制`
      );
    }

    // 记录API调用
    this.recordApiCall();

    // 设置超时控制器
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    // 设置默认选项
    const requestOptions: RequestInit = {
      signal: controller.signal,
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Neostock/1.0',
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      throw this.enhanceError(error as Error, url);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // 增强错误信息
  private enhanceError(error: Error, url: string): DataSourceError {
    const errorType = this.classifyError(error);
    return new DataSourceError(
      errorType,
      `${this.getName()} 请求失败: ${error.message} (URL: ${url})`,
      undefined,
      error
    );
  }

  // 构建缓存键
  protected buildCacheKey(type: 'basic' | 'daily', request?: DataFetchRequest): string {
    const parts = [this.getName(), type];
    
    if (request) {
      if (request.startDate) parts.push(`start_${request.startDate}`);
      if (request.endDate) parts.push(`end_${request.endDate}`);
      if (request.tsCodes?.length) {
        parts.push(`codes_${request.tsCodes.slice(0, 5).join(',')}`); // 限制键长度
      }
      if (request.limit) parts.push(`limit_${request.limit}`);
      if (request.offset) parts.push(`offset_${request.offset}`);
    }
    
    return parts.join('_');
  }
}