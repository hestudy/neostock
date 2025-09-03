// 移动端图表事件冲突解决工具
import React, { type RefObject } from 'react';

/**
 * 图表事件冲突解决器
 */
export class ChartEventConflictResolver {
  private isChartInteracting = false;
  private touchStartY = 0;
  private touchStartX = 0;
  private lastTouchTime = 0;
  private scrollContainer: HTMLElement | null = null;
  private chartContainer: HTMLElement | null = null;

  /**
   * 初始化冲突解决器
   */
  init(chartContainer: HTMLElement, scrollContainer?: HTMLElement): void {
    this.chartContainer = chartContainer;
    this.scrollContainer = scrollContainer || this.findScrollParent(chartContainer);
    
    this.setupEventListeners();
  }

  /**
   * 查找滚动父容器
   */
  private findScrollParent(element: HTMLElement): HTMLElement | null {
    let parent = element.parentElement;
    
    while (parent) {
      const { overflow, overflowY, overflowX } = window.getComputedStyle(parent);
      
      if (overflow === 'auto' || overflow === 'scroll' || 
          overflowY === 'auto' || overflowY === 'scroll' ||
          overflowX === 'auto' || overflowX === 'scroll') {
        return parent;
      }
      
      parent = parent.parentElement;
    }
    
    return document.body;
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.chartContainer) return;

    // 图表容器触摸事件
    this.chartContainer.addEventListener('touchstart', this.handleChartTouchStart.bind(this), { passive: false });
    this.chartContainer.addEventListener('touchmove', this.handleChartTouchMove.bind(this), { passive: false });
    this.chartContainer.addEventListener('touchend', this.handleChartTouchEnd.bind(this), { passive: false });

    // 阻止图表容器内的默认滚动行为
    this.chartContainer.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });

    // 监听滚动容器的滚动事件
    if (this.scrollContainer) {
      this.scrollContainer.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
    }

    // 监听页面滚动事件
    window.addEventListener('scroll', this.handlePageScroll.bind(this), { passive: true });
  }

  /**
   * 处理图表触摸开始事件
   */
  private handleChartTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
      this.lastTouchTime = Date.now();
      this.isChartInteracting = false;
    } else if (e.touches.length === 2) {
      // 双指触摸，认为是缩放操作
      this.isChartInteracting = true;
      e.preventDefault();
    }
  }

  /**
   * 处理图表触摸移动事件
   */
  private handleChartTouchMove(e: TouchEvent): void {
    if (e.touches.length === 1) {
      const deltaX = Math.abs(e.touches[0].clientX - this.touchStartX);
      const deltaY = Math.abs(e.touches[0].clientY - this.touchStartY);
      
      // 判断操作类型
      const isHorizontalSwipe = deltaX > deltaY && deltaX > 10;
      const isVerticalSwipe = deltaY > deltaX && deltaY > 10;
      
      // 如果是水平滑动，认为是图表操作
      if (isHorizontalSwipe) {
        this.isChartInteracting = true;
        e.preventDefault();
      }
      
      // 如果是垂直滑动，根据位置判断是否阻止页面滚动
      if (isVerticalSwipe) {
        const isNearChartEdge = this.isNearChartEdge(e.touches[0].clientY);
        if (isNearChartEdge) {
          this.isChartInteracting = true;
          e.preventDefault();
        }
      }
    } else if (e.touches.length >= 2) {
      // 多指触摸，认为是缩放操作
      this.isChartInteracting = true;
      e.preventDefault();
    }
  }

  /**
   * 处理图表触摸结束事件
   */
  private handleChartTouchEnd(): void {
    const now = Date.now();
    const touchDuration = now - this.lastTouchTime;
    
    // 短时间触摸认为是点击
    if (touchDuration < 300) {
      this.isChartInteracting = false;
    }
    
    // 重置状态
    setTimeout(() => {
      this.isChartInteracting = false;
    }, 100);
  }

  /**
   * 处理滚轮事件
   */
  private handleWheel(e: WheelEvent): void {
    // 如果正在图表交互，阻止页面滚动
    if (this.isChartInteracting) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // 检查是否在图表区域内
    if (this.isPointInChart(e.clientX, e.clientY)) {
      // 允许图表缩放，但阻止页面滚动
      if (e.ctrlKey || e.metaKey) {
        // 缩放操作
        e.preventDefault();
        e.stopPropagation();
      } else {
        // 根据滚轮方向判断
        const delta = e.deltaY;
        const isHorizontalScroll = Math.abs(e.deltaX) > Math.abs(delta);
        
        if (isHorizontalScroll) {
          // 水平滚动，认为是图表操作
          e.preventDefault();
          e.stopPropagation();
        }
      }
    }
  }

  /**
   * 处理滚动事件
   */
  private handleScroll(e: Event): void {
    // 如果正在图表交互，阻止滚动
    if (this.isChartInteracting) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  /**
   * 处理页面滚动事件
   */
  private handlePageScroll(): void {
    // 如果图表正在交互，尝试阻止页面滚动
    if (this.isChartInteracting) {
      window.scrollTo(window.scrollX, window.scrollY);
    }
  }

  /**
   * 检查点是否在图表区域内
   */
  private isPointInChart(x: number, y: number): boolean {
    if (!this.chartContainer) return false;
    
    const rect = this.chartContainer.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  /**
   * 检查是否接近图表边缘
   */
  private isNearChartEdge(y: number): boolean {
    if (!this.chartContainer) return false;
    
    const rect = this.chartContainer.getBoundingClientRect();
    const edgeThreshold = 50; // 50px边缘阈值
    
    return y < rect.top + edgeThreshold || y > rect.bottom - edgeThreshold;
  }

  /**
   * 锁定图表交互
   */
  lockChartInteraction(): void {
    this.isChartInteracting = true;
  }

  /**
   * 解锁图表交互
   */
  unlockChartInteraction(): void {
    setTimeout(() => {
      this.isChartInteracting = false;
    }, 100);
  }

  /**
   * 销毁事件监听器
   */
  destroy(): void {
    if (!this.chartContainer) return;

    this.chartContainer.removeEventListener('touchstart', this.handleChartTouchStart.bind(this));
    this.chartContainer.removeEventListener('touchmove', this.handleChartTouchMove.bind(this));
    this.chartContainer.removeEventListener('touchend', this.handleChartTouchEnd.bind(this));
    this.chartContainer.removeEventListener('wheel', this.handleWheel.bind(this));

    if (this.scrollContainer) {
      this.scrollContainer.removeEventListener('scroll', this.handleScroll.bind(this));
    }

    window.removeEventListener('scroll', this.handlePageScroll.bind(this));
    
    this.chartContainer = null;
    this.scrollContainer = null;
  }
}

/**
 * React Hook for 图表事件冲突解决
 */
export function useChartEventConflictResolver(
  chartContainerRef: RefObject<HTMLElement>,
  scrollContainerRef?: RefObject<HTMLElement>
) {
  const resolverRef = React.useRef<ChartEventConflictResolver | null>(null);

  React.useEffect(() => {
    if (chartContainerRef.current) {
      const resolver = new ChartEventConflictResolver();
      const scrollContainer = scrollContainerRef?.current || undefined;
      
      resolver.init(chartContainerRef.current, scrollContainer);
      resolverRef.current = resolver;
    }

    return () => {
      if (resolverRef.current) {
        resolverRef.current.destroy();
        resolverRef.current = null;
      }
    };
  }, [chartContainerRef, scrollContainerRef]);

  return {
    lockInteraction: () => resolverRef.current?.lockChartInteraction(),
    unlockInteraction: () => resolverRef.current?.unlockChartInteraction(),
    isInteracting: () => (resolverRef.current as any)?.isChartInteracting || false,
  };
}

/**
 * 手势识别器
 */
export class GestureRecognizer {
  private callbacks = new Map<string, ((data: unknown) => void)[]>();
  private gestureState = {
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startTime: 0,
    isDragging: false,
    isPinching: false,
    pinchDistance: 0,
  };

  /**
   * 注册手势回调
   */
  on(event: string, callback: (data: unknown) => void): void {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event)!.push(callback);
  }

  /**
   * 注销手势回调
   */
  off(event: string, callback: (data: unknown) => void): void {
    const callbacks = this.callbacks.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 处理触摸开始
   */
  handleTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      this.gestureState.startX = e.touches[0].clientX;
      this.gestureState.startY = e.touches[0].clientY;
      this.gestureState.lastX = e.touches[0].clientX;
      this.gestureState.lastY = e.touches[0].clientY;
      this.gestureState.startTime = Date.now();
      this.gestureState.isDragging = false;
    } else if (e.touches.length === 2) {
      this.gestureState.isPinching = true;
      this.gestureState.pinchDistance = this.getDistance(e.touches[0], e.touches[1]);
      this.emit('pinchStart', { distance: this.gestureState.pinchDistance });
    }
  }

  /**
   * 处理触摸移动
   */
  handleTouchMove(e: TouchEvent): void {
    if (e.touches.length === 1) {
      const deltaX = e.touches[0].clientX - this.gestureState.lastX;
      const deltaY = e.touches[0].clientY - this.gestureState.lastY;
      
      this.gestureState.lastX = e.touches[0].clientX;
      this.gestureState.lastY = e.touches[0].clientY;
      
      // 检测是否开始拖拽
      if (!this.gestureState.isDragging) {
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance > 10) {
          this.gestureState.isDragging = true;
          this.emit('dragStart', { x: this.gestureState.startX, y: this.gestureState.startY });
        }
      }
      
      if (this.gestureState.isDragging) {
        this.emit('dragMove', { deltaX, deltaY, x: e.touches[0].clientX, y: e.touches[0].clientY });
      }
    } else if (e.touches.length === 2 && this.gestureState.isPinching) {
      const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / this.gestureState.pinchDistance;
      
      this.emit('pinchMove', { 
        distance: currentDistance, 
        scale,
        centerX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        centerY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      });
    }
  }

  /**
   * 处理触摸结束
   */
  handleTouchEnd(e: TouchEvent): void {
    if (e.touches.length === 0) {
      const duration = Date.now() - this.gestureState.startTime;
      
      if (this.gestureState.isDragging) {
        this.emit('dragEnd', { 
          duration,
          velocity: this.calculateVelocity(),
        });
      } else if (duration < 300) {
        this.emit('tap', { 
          x: this.gestureState.lastX, 
          y: this.gestureState.lastY,
        });
      }
      
      if (this.gestureState.isPinching) {
        this.emit('pinchEnd', {});
      }
      
      this.resetGestureState();
    }
  }

  /**
   * 计算两点距离
   */
  private getDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 计算速度
   */
  private calculateVelocity(): number {
    const deltaTime = Date.now() - this.gestureState.startTime;
    const deltaX = this.gestureState.lastX - this.gestureState.startX;
    const deltaY = this.gestureState.lastY - this.gestureState.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    return distance / deltaTime * 1000; // pixels per second
  }

  /**
   * 触发事件
   */
  private emit(event: string, data: unknown): void {
    const callbacks = this.callbacks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  /**
   * 重置手势状态
   */
  private resetGestureState(): void {
    this.gestureState = {
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      startTime: 0,
      isDragging: false,
      isPinching: false,
      pinchDistance: 0,
    };
  }
}

// 导出单例实例
export const chartEventConflictResolver = new ChartEventConflictResolver();
export const gestureRecognizer = new GestureRecognizer();