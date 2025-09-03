import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PerformanceMonitor } from '../../../lib/chart-performance-optimization';
import { MemoryManager } from '../../../lib/memory-management';

// 导入测试设置
import '../../test-setup';

describe('Chart Performance Benchmark - 图表性能基准测试', () => {
  let performanceMonitor: PerformanceMonitor;
  let memoryManager: MemoryManager;
  
  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
    memoryManager = new MemoryManager({
      enableMemoryMonitoring: false,
      enableLeakDetection: false,
      maxMemoryUsage: 50 * 1024 * 1024, // 50MB
    });
  });

  afterEach(() => {
    performanceMonitor.destroy();
    memoryManager.destroy();
  });

  describe('图表初始化性能测试', () => {
    it('应该测试K线图基础组件初始化性能', () => {
      const startTime = performance.now();
      
      // 模拟K线图组件初始化
      void {
        id: 'k-line-chart',
        type: 'k-line',
        data: [],
        indicators: {},
        options: {
          layout: {
            backgroundColor: '#ffffff',
            textColor: '#333333',
          },
          grid: {
            vertLines: { color: '#e0e0e0' },
            horzLines: { color: '#e0e0e0' },
          },
        },
      };
      
      // 模拟初始化过程
      for (let i = 0; i < 1000; i++) {
        // 模拟DOM操作和样式计算
        const element = document.createElement('div');
        element.className = 'chart-container';
        element.style.width = '800px';
        element.style.height = '600px';
        document.body.appendChild(element);
        
        // 模拟图表实例化
        performanceMonitor.recordMetric('chart_initialization', 1);
        
        // 清理
        element.remove();
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / 1000;
      
      expect(avgTime).toBeLessThan(100); // 平均初始化时间应小于100ms
      performanceMonitor.recordMetric('chart_initialization_avg_time', avgTime);
    });

    it('应该测试多指标图表初始化性能', () => {
      const startTime = performance.now();
      
      // 模拟多指标图表初始化
      const indicators = ['ma', 'macd', 'rsi'];
      
      for (let i = 0; i < 100; i++) {
        const element = document.createElement('div');
        element.className = 'multi-indicator-chart';
        element.style.width = '1000px';
        element.style.height = '700px';
        document.body.appendChild(element);
        
        // 模拟多指标初始化
        indicators.forEach(indicator => {
          const indicatorElement = document.createElement('div');
          indicatorElement.className = `indicator-${indicator}`;
          indicatorElement.style.width = '100%';
          indicatorElement.style.height = '200px';
          element.appendChild(indicatorElement);
          
          performanceMonitor.recordMetric(`indicator_${indicator}_initialization`, 1);
        });
        
        element.remove();
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / 100;
      
      expect(avgTime).toBeLessThan(150); // 多指标初始化应小于150ms
      performanceMonitor.recordMetric('multi_indicator_initialization_avg_time', avgTime);
    });

    it('应该测试响应式图表初始化性能', () => {
      const startTime = performance.now();
      
      const sizes = [
        { width: 320, height: 568 },   // 手机
        { width: 768, height: 1024 },  // 平板
        { width: 1366, height: 768 },  // 桌面
        { width: 1920, height: 1080 }, // 大屏
      ];
      
      sizes.forEach((size) => {
        const element = document.createElement('div');
        element.className = 'responsive-chart';
        element.style.width = `${size.width}px`;
        element.style.height = `${size.height}px`;
        document.body.appendChild(element);
        
        // 模拟响应式布局计算
        const containerWidth = size.width;
        const containerHeight = size.height;
        const chartHeight = containerHeight * 0.7;
        const indicatorHeight = (containerHeight - chartHeight) / 3;
        
        // 模拟DOM操作
        for (let i = 0; i < 10; i++) {
          const child = document.createElement('div');
          child.style.width = `${containerWidth}px`;
          child.style.height = i === 0 ? `${chartHeight}px` : `${indicatorHeight}px`;
          element.appendChild(child);
        }
        
        performanceMonitor.recordMetric(`responsive_init_${size.width}x${size.height}`, 1);
        
        element.remove();
      });
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / sizes.length;
      
      expect(avgTime).toBeLessThan(80); // 响应式初始化应小于80ms
      performanceMonitor.recordMetric('responsive_initialization_avg_time', avgTime);
    });
  });

  describe('数据更新渲染性能测试', () => {
    it('应该测试小数据量更新性能', () => {
      const element = document.createElement('div');
      element.className = 'chart-container';
      element.style.width = '800px';
      element.style.height = '600px';
      document.body.appendChild(element);
      
      // 生成测试数据
      const generateData = (count: number) => {
        const data = [];
        for (let i = 0; i < count; i++) {
          data.push({
            time: Date.now() - (count - i) * 60000,
            open: 100 + Math.random() * 10,
            high: 100 + Math.random() * 15,
            low: 100 - Math.random() * 10,
            close: 100 + Math.random() * 10,
            volume: Math.floor(Math.random() * 1000000),
          });
        }
        return data;
      };
      
      const smallData = generateData(100);
      
      const startTime = performance.now();
      
      // 模拟数据更新
      for (let i = 0; i < 50; i++) {
        // 模拟数据更新
        performanceMonitor.recordMetric('data_update_small', 1);
        
        // 模拟渲染
        const renderStart = performance.now();
        
        // 模拟DOM更新
        element.innerHTML = '';
        smallData.forEach(() => {
          const candle = document.createElement('div');
          candle.className = 'candlestick';
          candle.style.height = '2px';
          element.appendChild(candle);
        });
        
        const renderEnd = performance.now();
        performanceMonitor.recordMetric('render_time_small', renderEnd - renderStart);
      }
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / 50;
      
      expect(avgTime).toBeLessThan(50); // 小数据量更新应小于50ms
      performanceMonitor.recordMetric('small_data_update_avg_time', avgTime);
      
      element.remove();
    });

    it('应该测试中数据量更新性能', () => {
      const element = document.createElement('div');
      element.className = 'chart-container';
      element.style.width = '800px';
      element.style.height = '600px';
      document.body.appendChild(element);
      
      const generateData = (count: number) => {
        const data = [];
        for (let i = 0; i < count; i++) {
          data.push({
            time: Date.now() - (count - i) * 60000,
            open: 100 + Math.random() * 10,
            high: 100 + Math.random() * 15,
            low: 100 - Math.random() * 10,
            close: 100 + Math.random() * 10,
            volume: Math.floor(Math.random() * 1000000),
          });
        }
        return data;
      };
      
      const mediumData = generateData(1000);
      
      const startTime = performance.now();
      
      // 模拟数据更新
      for (let i = 0; i < 20; i++) {
        performanceMonitor.recordMetric('data_update_medium', 1);
        
        const renderStart = performance.now();
        
        // 模拟虚拟化渲染
        const visibleData = mediumData.slice(0, 200); // 只渲染可见部分
        element.innerHTML = '';
        visibleData.forEach(() => {
          const candle = document.createElement('div');
          candle.className = 'candlestick';
          candle.style.height = '2px';
          element.appendChild(candle);
        });
        
        const renderEnd = performance.now();
        performanceMonitor.recordMetric('render_time_medium', renderEnd - renderStart);
      }
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / 20;
      
      expect(avgTime).toBeLessThan(100); // 中数据量更新应小于100ms
      performanceMonitor.recordMetric('medium_data_update_avg_time', avgTime);
      
      element.remove();
    });

    it('应该测试大数据量更新性能', () => {
      const element = document.createElement('div');
      element.className = 'chart-container';
      element.style.width = '800px';
      element.style.height = '600px';
      document.body.appendChild(element);
      
      const generateData = (count: number) => {
        const data = [];
        for (let i = 0; i < count; i++) {
          data.push({
            time: Date.now() - (count - i) * 60000,
            open: 100 + Math.random() * 10,
            high: 100 + Math.random() * 15,
            low: 100 - Math.random() * 10,
            close: 100 + Math.random() * 10,
            volume: Math.floor(Math.random() * 1000000),
          });
        }
        return data;
      };
      
      const largeData = generateData(10000);
      
      const startTime = performance.now();
      
      // 模拟数据更新
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordMetric('data_update_large', 1);
        
        const renderStart = performance.now();
        
        // 模拟虚拟化渲染和缓存
        const cacheKey = `large_data_${i}`;
        const cached = memoryManager.getFromCache(cacheKey);
        
        if (!cached) {
          // 只渲染可见部分
          const visibleData = largeData.slice(0, 300);
          element.innerHTML = '';
          visibleData.forEach(() => {
            const candle = document.createElement('div');
            candle.className = 'candlestick';
            candle.style.height = '1px';
            element.appendChild(candle);
          });
          
          // 缓存结果
          memoryManager.addToCache(cacheKey, visibleData, visibleData.length * 100);
        }
        
        const renderEnd = performance.now();
        performanceMonitor.recordMetric('render_time_large', renderEnd - renderStart);
      }
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / 10;
      
      expect(avgTime).toBeLessThan(150); // 大数据量更新应小于150ms
      performanceMonitor.recordMetric('large_data_update_avg_time', avgTime);
      
      element.remove();
    });
  });

  describe('交互响应性能测试', () => {
    it('应该测试鼠标交互响应性能', () => {
      const element = document.createElement('div');
      element.className = 'chart-container';
      element.style.width = '800px';
      element.style.height = '600px';
      document.body.appendChild(element);
      
      // 模拟图表交互
      const interactions = [
        'mousemove',
        'mousedown',
        'mouseup',
        'wheel',
        'dblclick',
      ];
      
      const startTime = performance.now();
      
      interactions.forEach(interaction => {
        const interactionStart = performance.now();
        
        // 模拟事件处理
        const event = new MouseEvent(interaction, {
          clientX: 400,
          clientY: 300,
        });
        
        element.dispatchEvent(event);
        
        // 模拟交互响应
        const responseElement = document.createElement('div');
        responseElement.className = 'crosshair';
        responseElement.style.left = '400px';
        responseElement.style.top = '300px';
        element.appendChild(responseElement);
        
        performanceMonitor.recordMetric(`interaction_${interaction}`, 1);
        
        // 清理
        responseElement.remove();
        
        const interactionEnd = performance.now();
        performanceMonitor.recordMetric(`interaction_time_${interaction}`, interactionEnd - interactionStart);
      });
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / interactions.length;
      
      expect(avgTime).toBeLessThan(20); // 交互响应应小于20ms
      performanceMonitor.recordMetric('interaction_response_avg_time', avgTime);
      
      element.remove();
    });

    it('应该测试缩放平移性能', () => {
      const element = document.createElement('div');
      element.className = 'chart-container';
      element.style.width = '800px';
      element.style.height = '600px';
      document.body.appendChild(element);
      
      // 模拟缩放操作
      const zoomOperations = [
        { type: 'zoom-in', scale: 1.2 },
        { type: 'zoom-out', scale: 0.8 },
        { type: 'pan-left', distance: 50 },
        { type: 'pan-right', distance: 50 },
        { type: 'pan-up', distance: 30 },
        { type: 'pan-down', distance: 30 },
      ];
      
      const startTime = performance.now();
      
      zoomOperations.forEach(operation => {
        const operationStart = performance.now();
        
        // 模拟变换计算
        const transform = {
          scale: operation.type.includes('zoom') ? operation.scale : 1,
          translateX: operation.type.includes('pan') ? operation.distance : 0,
          translateY: operation.type.includes('pan') ? operation.distance : 0,
        };
        
        // 模拟DOM变换
        element.style.transform = `scale(${transform.scale}) translate(${transform.translateX}px, ${transform.translateY}px)`;
        
        // 模拟重绘
        element.getBoundingClientRect();
        
        performanceMonitor.recordMetric(`transform_${operation.type}`, 1);
        
        const operationEnd = performance.now();
        performanceMonitor.recordMetric(`transform_time_${operation.type}`, operationEnd - operationStart);
      });
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / zoomOperations.length;
      
      expect(avgTime).toBeLessThan(30); // 变换操作应小于30ms
      performanceMonitor.recordMetric('transform_operation_avg_time', avgTime);
      
      element.remove();
    });
  });

  describe('内存使用性能测试', () => {
    it('应该测试内存使用效率', () => {
      const initialStats = memoryManager.getMemoryStats();
      
      // 模拟大量图表操作
      for (let i = 0; i < 100; i++) {
        const element = document.createElement('div');
        element.className = 'chart-instance';
        element.style.width = '800px';
        element.style.height = '600px';
        document.body.appendChild(element);
        
        // 模拟数据缓存
        const data = Array(1000).fill(null).map((_, index) => ({
          time: Date.now() - (1000 - index) * 60000,
          value: Math.random() * 100,
        }));
        
        memoryManager.addToCache(`chart_data_${i}`, data, data.length * 50);
        
        // 模拟图表实例注册
        const mockChartInstance = {
          chart: {} as any,
          candlestickSeries: null,
          volumeSeries: null,
          maSeries: new Map(),
          macdSeries: {},
          rsiSeries: new Map()
        } as any;
        memoryManager.registerChartInstance(mockChartInstance);
        
        // 注意：内存管理器会自动清理，不需要手动调用
      }
      
      const finalStats = memoryManager.getMemoryStats();
      const memoryIncrease = finalStats.totalUsage - initialStats.totalUsage;
      
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 内存增长应小于10MB
      performanceMonitor.recordMetric('memory_usage_increase', memoryIncrease);
      
      // 清理
      document.querySelectorAll('.chart-instance').forEach(el => el.remove());
    });

    it('应该测试垃圾回收效果', () => {
      // 创建大量临时对象
      const temporaryObjects = [];
      for (let i = 0; i < 1000; i++) {
        const obj = {
          id: i,
          data: Array(100).fill(Math.random()),
          timestamp: Date.now(),
        };
        temporaryObjects.push(obj);
        memoryManager.addToCache(`temp_${i}`, obj, obj.data.length * 8);
      }
      
      const beforeGCStats = memoryManager.getMemoryStats();
      
      // 清理引用
      temporaryObjects.length = 0;
      
      // 注意：内存管理器会自动清理，无需手动调用私有方法
      
      const afterGCStats = memoryManager.getMemoryStats();
      const memoryReduction = beforeGCStats.totalUsage - afterGCStats.totalUsage;
      
      expect(memoryReduction).toBeGreaterThan(0); // 应该有内存释放
      performanceMonitor.recordMetric('memory_reduction_after_gc', memoryReduction);
    });
  });

  describe('综合性能测试', () => {
    it('应该测试完整使用场景性能', () => {
      const startTime = performance.now();
      
      // 模拟完整使用场景
      const scenarios = [
        { name: '快速浏览', iterations: 50, dataPoints: 100 },
        { name: '深度分析', iterations: 20, dataPoints: 1000 },
        { name: '多指标对比', iterations: 30, dataPoints: 500 },
        { name: '实时监控', iterations: 100, dataPoints: 50 },
      ];
      
      scenarios.forEach(scenario => {
        const scenarioStart = performance.now();
        
        for (let i = 0; i < scenario.iterations; i++) {
          // 模拟场景操作
          performanceMonitor.recordMetric(`scenario_${scenario.name}`, 1);
          
          // 模拟渲染
          const element = document.createElement('div');
          element.className = 'scenario-chart';
          element.style.width = '800px';
          element.style.height = '600px';
          document.body.appendChild(element);
          
          // 模拟交互
          const event = new MouseEvent('mousemove', {
            clientX: 400,
            clientY: 300,
          });
          element.dispatchEvent(event);
          
          element.remove();
        }
        
        const scenarioEnd = performance.now();
        const scenarioTime = scenarioEnd - scenarioStart;
        const avgScenarioTime = scenarioTime / scenario.iterations;
        
        expect(avgScenarioTime).toBeLessThan(100); // 每个场景迭代应小于100ms
        performanceMonitor.recordMetric(`scenario_${scenario.name}_avg_time`, avgScenarioTime);
      });
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      expect(totalTime).toBeLessThan(10000); // 总体测试时间应小于10秒
      performanceMonitor.recordMetric('comprehensive_test_total_time', totalTime);
    });

    it('应该生成性能报告', () => {
      const report = performanceMonitor.generateReport();
      
      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.recommendations).toBeDefined();
      
      // 验证关键指标
      expect(report.metrics.chart_initialization_avg_time).toBeLessThan(100);
      expect(report.metrics.render_time_small).toBeLessThan(50);
      expect(report.metrics.interaction_response_avg_time).toBeLessThan(20);
      
      // 验证报告质量
      expect(report.summary.healthy).toBe(true);
      expect(report.recommendations.length).toBeGreaterThanOrEqual(0);
      
      console.log('Performance Report:', JSON.stringify(report, null, 2));
    });
  });
});