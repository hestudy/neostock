import { vi } from 'vitest';
import type { IChartApi } from 'lightweight-charts';

// Mock chart API for testing
export interface MockChartApi extends Partial<IChartApi> {
  addSeries: ReturnType<typeof vi.fn>;
  removeSeries: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  applyOptions: ReturnType<typeof vi.fn>;
  subscribeCrosshairMove?: ReturnType<typeof vi.fn>;
  unsubscribeCrosshairMove?: ReturnType<typeof vi.fn>;
  subscribeClick?: ReturnType<typeof vi.fn>;
  unsubscribeClick?: ReturnType<typeof vi.fn>;
}

// Mock series API for testing
export interface MockSeriesApi<TType extends keyof import('lightweight-charts').SeriesOptionsMap = 'Line'> {
  setData: ReturnType<typeof vi.fn>;
  applyOptions: ReturnType<typeof vi.fn>;
  priceFormatter: ReturnType<typeof vi.fn>;
  priceToCoordinate: ReturnType<typeof vi.fn>;
  coordinateToPrice: ReturnType<typeof vi.fn>;
  barsInLogicalRange: ReturnType<typeof vi.fn>;
  options: () => import('lightweight-charts').SeriesOptionsMap[TType];
  priceScale: () => unknown;
}

// Create mock chart instance
export function createMockChart(): MockChartApi {
  return {
    addSeries: vi.fn(),
    removeSeries: vi.fn(),
    resize: vi.fn(),
    remove: vi.fn(),
    applyOptions: vi.fn(),
    subscribeCrosshairMove: vi.fn(),
    unsubscribeCrosshairMove: vi.fn(),
    subscribeClick: vi.fn(),
    unsubscribeClick: vi.fn(),
  };
}

// Create mock series instance
export function createMockSeries<TType extends keyof import('lightweight-charts').SeriesOptionsMap = 'Line'>(): MockSeriesApi<TType> {
  return {
    setData: vi.fn(),
    applyOptions: vi.fn(),
    priceFormatter: vi.fn(() => ({ format: (price: number) => price.toString() })),
    priceToCoordinate: vi.fn(),
    coordinateToPrice: vi.fn(),
    barsInLogicalRange: vi.fn(),
    options: () => ({} as import('lightweight-charts').SeriesOptionsMap[TType]),
    priceScale: vi.fn(() => ({ applyOptions: vi.fn() } as unknown)),
  };
}

// Mock touch event for testing
export function createMockTouch(params: {
  clientX: number;
  clientY: number;
  identifier?: number;
  target?: EventTarget;
}): Touch {
  return {
    clientX: params.clientX,
    clientY: params.clientY,
    identifier: params.identifier ?? 0,
    target: params.target ?? document.createElement('div'),
    force: 1,
    pageX: params.clientX,
    pageY: params.clientY,
    radiusX: 1,
    radiusY: 1,
    rotationAngle: 0,
    screenX: params.clientX,
    screenY: params.clientY,
  };
}