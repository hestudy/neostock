import { useState, useEffect } from 'react';

interface NetworkInformation {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

interface MemoryInfo {
  deviceMemory?: number;
  totalJSHeapSize?: number;
  usedJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

interface MemoryInfo {
  deviceMemory?: number;
  totalJSHeapSize?: number;
  usedJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

/**
 * 检测移动端设备的hook
 * @returns 移动端相关信息
 */
export function useMobileDetection() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [screenSize, setScreenSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    const checkMobile = () => {
      // 检测触摸设备
      const hasTouch = 'ontouchstart' in window || 
                      navigator.maxTouchPoints > 0 || 
                      ((navigator as { msMaxTouchPoints?: number }).msMaxTouchPoints || 0) > 0;
      
      // 检测移动设备
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
      
      // 检测平板设备
      const tabletRegex = /ipad|android(?!.*mobile)|tablet|kindle|silk/i;
      
      // 基于屏幕宽度的检测
      const width = window.innerWidth;
      const isMobileSize = width <= 768;
      const isTabletSize = width > 768 && width <= 1024;
      
      setIsTouchDevice(hasTouch);
      setIsMobile(mobileRegex.test(userAgent) || isMobileSize);
      setIsTablet(tabletRegex.test(userAgent) || isTabletSize);
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // 初始检测
    checkMobile();

    // 监听窗口大小变化
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  return {
    isMobile,
    isTablet,
    isTouchDevice,
    screenSize,
    isSmallScreen: screenSize.width <= 375,
    isMediumScreen: screenSize.width > 375 && screenSize.width <= 768,
    isLargeScreen: screenSize.width > 768,
  };
}

/**
 * 检测网络状态的hook
 * @returns 网络状态信息
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [connectionType] = useState<ConnectionType | null>(null);
  const [effectiveType, setEffectiveType] = useState<EffectiveConnectionType | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 检测网络连接信息
    const connection = (navigator as { connection?: NetworkInformation }).connection;
    if (connection) {
      const handleConnectionChange = () => {
        setEffectiveType(connection.effectiveType as EffectiveConnectionType || null);
      };

      connection.addEventListener?.('change', handleConnectionChange);
      handleConnectionChange(); // 初始设置

      return () => {
        connection.removeEventListener?.('change', handleConnectionChange);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    connectionType,
    effectiveType,
    isSlowConnection: effectiveType === 'slow-2g' || effectiveType === '2g',
    isFastConnection: effectiveType === '4g' || effectiveType === '3g',
  };
}

type ConnectionType = 'bluetooth' | 'cellular' | 'ethernet' | 'none' | 'wifi' | 'wimax' | 'other' | 'unknown';
type EffectiveConnectionType = 'slow-2g' | '2g' | '3g' | '4g';

/**
 * 检测设备性能的hook
 * @returns 设备性能信息
 */
export function useDevicePerformance() {
  const [isLowEndDevice, setIsLowEndDevice] = useState(false);
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | null>(null);

  useEffect(() => {
    // 检测低端设备
    const checkDevicePerformance = () => {
      // 基于硬件并发数检测
      const hardwareConcurrency = navigator.hardwareConcurrency || 4;
      const isLowEnd = hardwareConcurrency <= 2;
      
      setIsLowEndDevice(isLowEnd);

      // 获取内存信息（如果可用）
      const navigatorWithMemory = navigator as { memory?: MemoryInfo };
      if (navigatorWithMemory.memory) {
        const memory = navigatorWithMemory.memory;
        setMemoryInfo(memory);
      }
    };

    checkDevicePerformance();
  }, []);

  return {
    isLowEndDevice,
    memoryInfo,
    hardwareConcurrency: navigator.hardwareConcurrency || 4,
    shouldReduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    shouldPrefetch: !isLowEndDevice && (memoryInfo ? (memoryInfo.deviceMemory || 4) > 2 : true),
  };
}

