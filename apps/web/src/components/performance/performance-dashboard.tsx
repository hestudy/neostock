import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle, TrendingUp, Clock, Zap } from 'lucide-react';

interface PerformanceMetrics {
  timestamp: string;
  responseTime: {
    current: number;
    status: 'excellent' | 'good' | 'warning' | 'critical';
    benchmark: string;
    thresholds: {
      BASIC_OPERATIONS: number;
      COMPLEX_QUERIES: number;
      CRITICAL_THRESHOLD: number;
    };
  };
  requests: {
    total: number;
    errors: number;
    errorRate: number;
    successRate: number;
  };
  alerts: {
    active: boolean;
    reasons: string[];
    count: number;
  };
}

interface PerformanceHistory {
  responseTimes: number[];
  requestCount: number;
  errorCount: number;
  timestamp: string;
  statistics: {
    count: number;
    min: number;
    max: number;
    percentiles: {
      p50: number;
      p90: number;
      p95: number;
      p99: number;
    };
  };
}

const PerformanceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [history, setHistory] = useState<PerformanceHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      // In a real app, you'd use your tRPC client here
      const response = await fetch('/trpc/performance.metrics');
      const data = await response.json();
      setMetrics(data.result);
    } catch (err) {
      setError('Failed to fetch performance metrics');
      console.error(err);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch('/trpc/performance.history');
      const data = await response.json();
      setHistory(data.result);
    } catch (err) {
      setError('Failed to fetch performance history');
      console.error(err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchMetrics(), fetchHistory()]);
      setLoading(false);
    };

    fetchData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'good': return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'critical': return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getBenchmarkProgress = (current: number, thresholds: PerformanceMetrics['responseTime']['thresholds']) => {
    // Calculate progress based on thresholds (inverted - lower is better)
    const maxThreshold = thresholds.CRITICAL_THRESHOLD;
    const progress = Math.min((current / maxThreshold) * 100, 100);
    return progress;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="pt-6">
          <div className="flex items-center text-red-600">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">性能监控仪表板</h2>
          <p className="text-muted-foreground">
            实时API性能指标和系统状态监控
          </p>
        </div>
        <Badge variant={metrics.alerts.active ? "destructive" : "default"}>
          {metrics.alerts.active ? `${metrics.alerts.count} 个告警` : '系统正常'}
        </Badge>
      </div>

      {/* Alert Banner */}
      {metrics.alerts.active && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-yellow-800">性能告警</h3>
                <ul className="mt-1 text-sm text-yellow-700 space-y-1">
                  {metrics.alerts.reasons.map((reason, index) => (
                    <li key={index}>• {reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">响应时间</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className="text-2xl font-bold">{metrics.responseTime.current.toFixed(1)}ms</div>
              {getStatusIcon(metrics.responseTime.status)}
            </div>
            <div className="mt-2">
              <Progress 
                value={getBenchmarkProgress(metrics.responseTime.current, metrics.responseTime.thresholds)} 
                className="h-2"
              />
              <p className={`text-xs mt-1 ${getStatusColor(metrics.responseTime.status)}`}>
                {metrics.responseTime.status === 'excellent' && '优秀 - 基础操作水平'}
                {metrics.responseTime.status === 'good' && '良好 - 复杂查询水平'}
                {metrics.responseTime.status === 'warning' && '警告 - 接近临界阈值'}
                {metrics.responseTime.status === 'critical' && '严重 - 超过临界阈值'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">成功率</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.requests.successRate.toFixed(1)}%</div>
            <div className="mt-2">
              <Progress value={metrics.requests.successRate} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.requests.total} 个请求, {metrics.requests.errors} 个错误
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">请求总数</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.requests.total.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              错误率: {metrics.requests.errorRate.toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">系统状态</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className="text-2xl font-bold">
                {metrics.alerts.active ? '异常' : '正常'}
              </div>
              {metrics.alerts.active ? 
                <AlertCircle className="h-5 w-5 text-red-600" /> : 
                <CheckCircle className="h-5 w-5 text-green-600" />
              }
            </div>
            <p className="text-xs text-muted-foreground">
              最后更新: {new Date(metrics.timestamp).toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Benchmarks */}
      <Card>
        <CardHeader>
          <CardTitle>性能基准对比</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">基础操作</div>
                <div className="text-xl font-bold text-green-600">
                  &lt; {metrics.responseTime.thresholds.BASIC_OPERATIONS}ms
                </div>
                <div className="text-xs text-muted-foreground">登录、获取信息</div>
              </div>
              
              <div className="text-center p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">复杂查询</div>
                <div className="text-xl font-bold text-blue-600">
                  &lt; {metrics.responseTime.thresholds.COMPLEX_QUERIES}ms
                </div>
                <div className="text-xs text-muted-foreground">数据分析、报告</div>
              </div>
              
              <div className="text-center p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">临界阈值</div>
                <div className="text-xl font-bold text-red-600">
                  &lt; {metrics.responseTime.thresholds.CRITICAL_THRESHOLD}ms
                </div>
                <div className="text-xs text-muted-foreground">告警触发点</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Statistics */}
      {history && (
        <Card>
          <CardHeader>
            <CardTitle>性能统计 (最近100个请求)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">最小值</div>
                <div className="text-xl font-bold">{history.statistics.min.toFixed(1)}ms</div>
              </div>
              
              <div>
                <div className="text-sm text-muted-foreground">中位数 (P50)</div>
                <div className="text-xl font-bold">{history.statistics.percentiles.p50.toFixed(1)}ms</div>
              </div>
              
              <div>
                <div className="text-sm text-muted-foreground">P95</div>
                <div className="text-xl font-bold">{history.statistics.percentiles.p95.toFixed(1)}ms</div>
              </div>
              
              <div>
                <div className="text-sm text-muted-foreground">最大值</div>
                <div className="text-xl font-bold">{history.statistics.max.toFixed(1)}ms</div>
              </div>
            </div>
            
            <div className="mt-4 text-sm text-muted-foreground">
              统计基于 {history.statistics.count} 个请求样本
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PerformanceDashboard;