// 数据源类型定义

// 股票基础信息接口
export interface StockBasicInfo {
  ts_code: string; // 股票代码 (如: "000001.SZ")
  symbol: string; // 股票符号 (6位数字)
  name: string; // 股票名称
  area: string; // 地域
  industry: string; // 所属行业
  market: string; // 市场类型 (主板/创业板/科创板/北交所)
  list_date: string; // 上市日期 (YYYYMMDD格式)
  is_hs: string; // 是否沪深港通标的 ("1"=是, "0"=否)
}

// 股票日线数据接口
export interface StockDailyData {
  ts_code: string; // 股票代码
  trade_date: string; // 交易日期 (YYYYMMDD格式)
  open: number; // 开盘价
  high: number; // 最高价
  low: number; // 最低价
  close: number; // 收盘价
  vol?: number; // 成交量 (手)
  amount?: number; // 成交额 (千元)
}

// 数据源配置接口
export interface DataSourceConfig {
  name: string; // 数据源名称
  priority: number; // 优先级 (数字越小优先级越高)
  apiUrl: string; // API 基础地址
  apiKey?: string; // API 密钥 (可选)
  rateLimit: {
    requestsPerSecond: number; // 每秒请求限制
    requestsPerMinute: number; // 每分钟请求限制
    requestsPerDay: number; // 每日请求限制
  };
  timeout: number; // 请求超时时间 (毫秒)
  retryConfig: RetryConfig;
  healthCheck: {
    endpoint: string; // 健康检查端点
    interval: number; // 检查间隔 (毫秒)
    timeout: number; // 检查超时时间 (毫秒)
  };
}

// 重试配置接口
export interface RetryConfig {
  maxRetries: number; // 最大重试次数
  baseDelay: number; // 基础延迟时间 (毫秒)
  exponentialFactor: number; // 指数退避因子
  jitter: number; // 随机抖动比例 (0-1)
  retryableErrors: string[]; // 可重试的错误类型
  nonRetryableErrors: string[]; // 不可重试的错误类型
}

// 数据源健康状态
export interface DataSourceHealth {
  name: string; // 数据源名称
  isHealthy: boolean; // 是否健康
  lastChecked: Date; // 最后检查时间
  responseTime?: number; // 响应时间 (毫秒)
  errorMessage?: string; // 错误信息
  consecutiveFailures: number; // 连续失败次数
}

// 数据源状态
export enum DataSourceStatus {
  ACTIVE = "active", // 活跃
  INACTIVE = "inactive", // 非活跃
  FAILED = "failed", // 失败
  MAINTENANCE = "maintenance", // 维护中
}

// 数据拉取请求参数
export interface DataFetchRequest {
  startDate?: string; // 开始日期 (YYYYMMDD)
  endDate?: string; // 结束日期 (YYYYMMDD)
  tsCodes?: string[]; // 特定股票代码列表
  limit?: number; // 限制返回数量
  offset?: number; // 偏移量 (分页)
}

// 数据拉取响应
export interface DataFetchResponse<T> {
  success: boolean; // 是否成功
  data: T[]; // 数据列表
  total?: number; // 总数 (分页时使用)
  hasMore?: boolean; // 是否还有更多数据
  nextOffset?: number; // 下一页偏移量
  errorMessage?: string; // 错误信息
  sourceInfo: {
    name: string; // 数据源名称
    requestId: string; // 请求ID
    timestamp: Date; // 响应时间戳
    cached: boolean; // 是否来自缓存
  };
}

// 数据质量检查结果
export interface DataQualityResult {
  valid: boolean; // 数据是否有效
  issues: DataQualityIssue[]; // 质量问题列表
  score: number; // 质量评分 (0-100)
  checkedAt: Date; // 检查时间
}

// 数据质量问题
export interface DataQualityIssue {
  type: DataQualityIssueType; // 问题类型
  severity: "low" | "medium" | "high" | "critical"; // 严重程度
  message: string; // 问题描述
  affectedFields?: string[]; // 受影响的字段
  affectedRecords?: number; // 受影响的记录数
}

// 数据质量问题类型
export enum DataQualityIssueType {
  MISSING_REQUIRED_FIELD = "missing_required_field", // 缺少必填字段
  INVALID_FORMAT = "invalid_format", // 格式无效
  OUT_OF_RANGE = "out_of_range", // 数值超出范围
  INCONSISTENT_DATA = "inconsistent_data", // 数据不一致
  DUPLICATE_RECORD = "duplicate_record", // 重复记录
  LOGICAL_ERROR = "logical_error", // 逻辑错误 (如 高价 < 低价)
}

// 数据源切换策略
export interface DataSourceSwitchStrategy {
  trigger: SwitchTrigger; // 触发条件
  fallbackOrder: string[]; // 备用数据源优先级顺序
  switchDelay: number; // 切换延迟时间 (毫秒)
  recoverDelay: number; // 恢复检查延迟时间 (毫秒)
}

// 切换触发条件
export enum SwitchTrigger {
  HEALTH_CHECK_FAILED = "health_check_failed", // 健康检查失败
  REQUEST_FAILED = "request_failed", // 请求失败
  RATE_LIMIT_EXCEEDED = "rate_limit_exceeded", // 超过限制
  MANUAL = "manual", // 手动切换
}

// 错误类型枚举
export enum DataSourceErrorType {
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR", 
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
  SERVER_ERROR_5XX = "SERVER_ERROR_5XX",
  AUTH_ERROR = "AUTH_ERROR",
  INVALID_PARAMS = "INVALID_PARAMS", 
  CLIENT_ERROR_4XX = "CLIENT_ERROR_4XX",
  DATA_FORMAT_ERROR = "DATA_FORMAT_ERROR",
  API_QUOTA_EXCEEDED = "API_QUOTA_EXCEEDED",
}

// 数据源错误类
export class DataSourceError extends Error {
  constructor(
    public type: DataSourceErrorType,
    public message: string,
    public statusCode?: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'DataSourceError';
  }
}