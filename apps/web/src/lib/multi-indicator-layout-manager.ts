import type { ChartInstance, TechnicalIndicatorConfig, TechnicalIndicatorData, HistogramData } from '../types/charts';

/**
 * 多指标布局配置
 */
export interface MultiIndicatorLayoutConfig {
  /** 布局模式 */
  layoutMode: 'overlay' | 'stacked' | 'split';
  /** 指标高度分配 */
  heightDistribution: {
    mainChart: number; // 主图占比 (0-1)
    indicators: number; // 指标区域占比 (0-1)
  };
  /** 指标间距 */
  indicatorSpacing: number;
  /** 是否显示指标分隔线 */
  showSeparators: boolean;
  /** 自定义指标顺序 */
  indicatorOrder: ('ma' | 'macd' | 'rsi')[];
  /** 最大同时显示指标数量 */
  maxVisibleIndicators: number;
}

/**
 * 指标布局信息
 */
export interface IndicatorLayoutInfo {
  type: 'ma' | 'macd' | 'rsi';
  visible: boolean;
  position: {
    top: number;
    height: number;
  };
  seriesIds: string[];
}

/**
 * 多指标布局管理器
 */
export class MultiIndicatorLayoutManager {
  private config: MultiIndicatorLayoutConfig;
  private layouts: Map<string, IndicatorLayoutInfo> = new Map();
  private containerElement: HTMLElement | null = null;

  constructor(config: Partial<MultiIndicatorLayoutConfig> = {}) {
    this.config = {
      layoutMode: 'overlay',
      heightDistribution: {
        mainChart: 0.7,
        indicators: 0.3,
      },
      indicatorSpacing: 2,
      showSeparators: true,
      indicatorOrder: ['ma', 'macd', 'rsi'],
      maxVisibleIndicators: 3,
      ...config,
    };
  }

  /**
   * 初始化布局管理器
   */
  init(container: HTMLElement): void {
    this.containerElement = container;
    this.setupLayout();
  }

  /**
   * 设置布局
   */
  private setupLayout(): void {
    if (!this.containerElement) return;

    // 根据布局模式设置容器样式
    switch (this.config.layoutMode) {
      case 'overlay':
        this.setupOverlayLayout();
        break;
      case 'stacked':
        this.setupStackedLayout();
        break;
      case 'split':
        this.setupSplitLayout();
        break;
    }
  }

  /**
   * 设置叠加布局
   */
  private setupOverlayLayout(): void {
    if (!this.containerElement) return;

    this.containerElement.style.display = 'flex';
    this.containerElement.style.flexDirection = 'column';
    this.containerElement.style.height = '100%';
  }

  /**
   * 设置堆叠布局
   */
  private setupStackedLayout(): void {
    if (!this.containerElement) return;

    this.containerElement.style.display = 'flex';
    this.containerElement.style.flexDirection = 'column';
    this.containerElement.style.height = '100%';
    this.containerElement.style.gap = `${this.config.indicatorSpacing}px`;
  }

  /**
   * 设置分割布局
   */
  private setupSplitLayout(): void {
    if (!this.containerElement) return;

    this.containerElement.style.display = 'grid';
    this.containerElement.style.gridTemplateRows = `${this.config.heightDistribution.mainChart * 100}% ${this.config.heightDistribution.indicators * 100}%`;
    this.containerElement.style.gap = `${this.config.indicatorSpacing}px`;
    this.containerElement.style.height = '100%';
  }

  /**
   * 计算指标布局
   */
  calculateIndicatorLayout(
    indicators: ('ma' | 'macd' | 'rsi')[],
    containerHeight: number
  ): IndicatorLayoutInfo[] {
    const visibleIndicators = indicators.slice(0, this.config.maxVisibleIndicators);
    const layouts: IndicatorLayoutInfo[] = [];

    switch (this.config.layoutMode) {
      case 'overlay':
        // 所有指标叠加在主图上
        visibleIndicators.forEach((type) => {
          layouts.push({
            type,
            visible: true,
            position: {
              top: 0,
              height: containerHeight * this.config.heightDistribution.mainChart,
            },
            seriesIds: [],
          });
        });
        break;

      case 'stacked': {
        // 指标堆叠在主图下方
        const indicatorHeight = (containerHeight * this.config.heightDistribution.indicators) / visibleIndicators.length;
        const mainChartHeight = containerHeight * this.config.heightDistribution.mainChart;

        visibleIndicators.forEach((type, index) => {
          layouts.push({
            type,
            visible: true,
            position: {
              top: mainChartHeight + (index * indicatorHeight) + (index * this.config.indicatorSpacing),
              height: indicatorHeight,
            },
            seriesIds: [],
          });
        });
        break;
      }

      case 'split': {
        // 指标在独立区域显示
        const splitIndicatorHeight = (containerHeight * this.config.heightDistribution.indicators) / visibleIndicators.length;
        const splitMainChartHeight = containerHeight * this.config.heightDistribution.mainChart;

        visibleIndicators.forEach((type, index) => {
          layouts.push({
            type,
            visible: true,
            position: {
              top: splitMainChartHeight + (index * splitIndicatorHeight) + (index * this.config.indicatorSpacing),
              height: splitIndicatorHeight,
            },
            seriesIds: [],
          });
        });
        break;
      }
    }

    return layouts;
  }

  /**
   * 获取指标容器
   */
  getIndicatorContainer(type: 'ma' | 'macd' | 'rsi'): HTMLElement | null {
    if (!this.containerElement) return null;

    const layout = this.layouts.get(type);
    if (!layout) return null;

    // 根据布局模式返回对应的容器
    switch (this.config.layoutMode) {
      case 'overlay':
        return this.containerElement;
      case 'stacked':
      case 'split': {
        // 创建或返回指标专用容器
        let container = this.containerElement.querySelector(`[data-indicator="${type}"]`) as HTMLElement;
        if (!container) {
          container = document.createElement('div');
          container.setAttribute('data-indicator', type);
          container.style.position = 'absolute';
          container.style.top = `${layout.position.top}px`;
          container.style.height = `${layout.position.height}px`;
          container.style.left = '0';
          container.style.right = '0';
          this.containerElement.appendChild(container);
        }
        return container;
      }
    }
  }

  /**
   * 更新指标布局
   */
  updateLayout(indicators: ('ma' | 'macd' | 'rsi')[], containerHeight: number): void {
    const layouts = this.calculateIndicatorLayout(indicators, containerHeight);
    
    // 清理旧布局
    this.layouts.clear();
    
    // 清理旧的指标容器
    if (this.containerElement) {
      const oldContainers = this.containerElement.querySelectorAll('[data-indicator]');
      oldContainers.forEach(container => container.remove());
    }

    // 设置新布局
    layouts.forEach(layout => {
      this.layouts.set(layout.type, layout);
    });

    // 重新设置布局
    this.setupLayout();
  }

  /**
   * 添加技术指标到布局
   */
  addIndicatorToLayout(
    instance: ChartInstance,
    type: 'ma' | 'macd' | 'rsi',
    data: TechnicalIndicatorData[],
    config: TechnicalIndicatorConfig
  ): void {
    const layout = this.layouts.get(type);
    if (!layout || !layout.visible) return;

    // 根据布局模式调整图表配置
    this.adjustChartForLayout(instance);

    // 添加技术指标
    this.addTechnicalIndicatorWithLayout(instance, type, data, config, layout);
  }

  /**
   * 根据布局调整图表配置
   */
  private adjustChartForLayout(
    instance: ChartInstance,
    // _type: 'ma' | 'macd' | 'rsi',
    // _layout: IndicatorLayoutInfo
  ): void {
    if (!instance.chart) return;

    switch (this.config.layoutMode) {
      case 'overlay':
        // 叠加模式：指标使用主图的价格刻度
        instance.chart.applyOptions({
          layout: {
            background: 'transparent',
          },
        });
        break;

      case 'stacked':
      case 'split':
        // 堆叠/分割模式：指标使用独立的价格刻度
        instance.chart.applyOptions({
          layout: {
            background: 'transparent',
          },
        });
        break;
    }
  }

  /**
   * 根据布局添加技术指标
   */
  private addTechnicalIndicatorWithLayout(
    instance: ChartInstance,
    type: 'ma' | 'macd' | 'rsi',
    data: TechnicalIndicatorData[],
    config: TechnicalIndicatorConfig,
    layout: IndicatorLayoutInfo
  ): void {
    if (!instance.chart) return;

    switch (type) {
      case 'ma':
        if (config.ma?.periods && config.ma?.colors) {
          config.ma.periods.forEach((period, index) => {
            const maData = data
              .filter(item => item[`ma${period}` as keyof TechnicalIndicatorData] !== undefined)
              .map(item => ({
                time: new Date(item.time).getTime() / 1000,
                value: item[`ma${period}` as keyof TechnicalIndicatorData] as number,
              }));
            
            const maSeries = instance.chart.addSeries('line', {
              color: config.ma?.colors?.[index] || '#ff9800',
              lineWidth: 2,
              title: `MA${period}`,
            });
            maSeries.setData(maData);
            instance.maSeries.set(period, maSeries);
            layout.seriesIds.push(maSeries.toString());
          });
        }
        break;

      case 'macd':
        if (config.macd) {
          const macdData = data
            .filter(item => item.macd_dif !== undefined)
            .map(item => ({
              time: new Date(item.time).getTime() / 1000,
              value: item.macd_dif!,
            }));
          
          const signalData = data
            .filter(item => item.macd_dea !== undefined)
            .map(item => ({
              time: new Date(item.time).getTime() / 1000,
              value: item.macd_dea!,
            }));
          
          const histData = data
            .filter(item => item.macd_hist !== undefined)
            .map(item => ({
              time: new Date(item.time).getTime() / 1000,
              value: item.macd_hist!,
              color: item.macd_hist! >= 0 ? '#4caf50' : '#f44336',
            }));

          // MACD线
          const macdSeries = instance.chart.addSeries('line', {
            color: config.macd.colors.macd,
            lineWidth: 2,
            title: 'MACD',
          });
          macdSeries.setData(macdData);
          instance.macdSeries.macd = macdSeries;
          layout.seriesIds.push(macdSeries.toString());

          // 信号线
          const signalSeries = instance.chart.addSeries('line', {
            color: config.macd.colors.signal,
            lineWidth: 2,
            title: 'Signal',
          });
          signalSeries.setData(signalData);
          instance.macdSeries.signal = signalSeries;
          layout.seriesIds.push(signalSeries.toString());

          // 柱状图
          const histSeries = instance.chart.addSeries('histogram', {
            color: config.macd.colors.histogram,
            lineWidth: 1,
            title: 'Histogram',
          });
          histSeries.setData(histData as HistogramData[]);
          instance.macdSeries.histogram = histSeries;
          layout.seriesIds.push(histSeries.toString());
        }
        break;

      case 'rsi':
        if (config.rsi?.periods && config.rsi?.colors) {
          config.rsi.periods.forEach((period, index) => {
            const rsiData = data
              .filter(item => item[`rsi_${period}` as keyof TechnicalIndicatorData] !== undefined)
              .map(item => ({
                time: new Date(item.time).getTime() / 1000,
                value: item[`rsi_${period}` as keyof TechnicalIndicatorData] as number,
              }));
            
            const rsiSeries = instance.chart.addSeries('line', {
              color: config.rsi?.colors?.[index] || '#2196f3',
              lineWidth: 2,
              title: `RSI${period}`,
            });
            rsiSeries.setData(rsiData);
            instance.rsiSeries.set(period, rsiSeries);
            layout.seriesIds.push(rsiSeries.toString());
          });
        }
        break;
    }
  }

  /**
   * 移除指标从布局
   */
  removeIndicatorFromLayout(instance: ChartInstance, type: 'ma' | 'macd' | 'rsi'): void {
    const layout = this.layouts.get(type);
    if (!layout) return;

    // 移除相关的系列
    layout.seriesIds.forEach(() => {
      // 这里需要根据实际情况实现系列移除逻辑
      // 由于lightweight-charts的限制，可能需要重建图表
    });

    // 从布局中移除
    this.layouts.delete(type);
  }

  /**
   * 获取当前布局信息
   */
  getLayoutInfo(): IndicatorLayoutInfo[] {
    return Array.from(this.layouts.values());
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<MultiIndicatorLayoutConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.setupLayout();
  }

  /**
   * 销毁布局管理器
   */
  destroy(): void {
    this.layouts.clear();
    this.containerElement = null;
  }
}

// 导出默认配置
export const defaultMultiIndicatorLayoutConfig: MultiIndicatorLayoutConfig = {
  layoutMode: 'overlay',
  heightDistribution: {
    mainChart: 0.7,
    indicators: 0.3,
  },
  indicatorSpacing: 2,
  showSeparators: true,
  indicatorOrder: ['ma', 'macd', 'rsi'],
  maxVisibleIndicators: 3,
};