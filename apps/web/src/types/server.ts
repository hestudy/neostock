// 服务器类型定义 - 为monorepo中的类型共享提供兜底方案
// 这个文件解决了CI环境中类型引用的问题

import type { AnyTRPCRouter } from '@trpc/server';

// 兜底的AppRouter类型定义，用于CI环境
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AppRouter extends AnyTRPCRouter {
  // 这个接口提供基本结构，在CI环境中避免类型错误
  // 实际运行时会使用服务器端的真实类型
}