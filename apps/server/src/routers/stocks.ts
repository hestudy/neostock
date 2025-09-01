import { protectedProcedure, publicProcedure, router, searchRateLimitedProcedure, favoriteRateLimitedProcedure, listRateLimitedProcedure } from "../lib/trpc";
import { z } from "zod";
import { TRPCError } from '@trpc/server';
import { db } from "../db";
import { stocks, stock_daily, user_stock_favorites } from "../db/schema/stocks";
import { eq, and, like, or, desc, asc, sql } from "drizzle-orm";
import { withDatabaseRetry } from "../lib/database-retry";

// 股票基础信息 schema
const StockBasicInfoSchema = z.object({
  ts_code: z.string(),
  symbol: z.string(), 
  name: z.string(),
  area: z.string().nullable(),
  industry: z.string().nullable(),
  market: z.string().nullable(),
  list_date: z.string().nullable(),
  is_hs: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

// 股票日线数据 schema
const StockDailyDataSchema = z.object({
  id: z.number(),
  ts_code: z.string(),
  trade_date: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  vol: z.number().nullable(),
  amount: z.number().nullable(),
  created_at: z.date(),
});

// 用户收藏股票 schema
const UserStockFavoriteSchema = z.object({
  id: z.number(),
  user_id: z.string(),
  ts_code: z.string(),
  created_at: z.date(),
});

export const stocksRouter = router({
  // 搜索股票 - 支持股票代码、名称模糊搜索
  search: searchRateLimitedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/stocks/search',
        summary: 'Search stocks by code or name',
        description: 'Search stocks using stock code or name with fuzzy matching support',
        tags: ['Stocks'],
        protect: false
      }
    })
    .input(z.object({
      keyword: z.string().min(1, "搜索关键字不能为空"),
      limit: z.number().min(1).max(100).optional().default(20),
    }))
    .output(z.object({
      stocks: z.array(StockBasicInfoSchema),
      total: z.number(),
    }))
    .query(async ({ input }) => {
      const { keyword, limit } = input;
      
      return await withDatabaseRetry(async () => {
        // 构建搜索条件：支持股票代码和名称模糊搜索
        const searchConditions = or(
          like(stocks.ts_code, `%${keyword}%`),
          like(stocks.symbol, `%${keyword}%`),
          like(stocks.name, `%${keyword}%`)
        );
        
        // 执行搜索查询，按股票代码排序
        const searchResults = await db
          .select()
          .from(stocks)
          .where(searchConditions)
          .orderBy(asc(stocks.ts_code))
          .limit(limit);
        
        // 获取总数量
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(stocks)  
          .where(searchConditions);
        
        return {
          stocks: searchResults,
          total: count,
        };
      });
    }),

  // 获取股票列表 - 支持分页
  list: listRateLimitedProcedure
    .meta({
      openapi: {
        method: 'GET', 
        path: '/stocks/list',
        summary: 'Get paginated stock list',
        description: 'Retrieve paginated list of all stocks with optional industry filtering',
        tags: ['Stocks'],
        protect: false
      }
    })
    .input(z.object({
      cursor: z.number().optional(),
      limit: z.number().min(1).max(100).optional().default(50),
      industry: z.string().optional(), // 行业筛选
    }))
    .output(z.object({
      stocks: z.array(StockBasicInfoSchema),
      nextCursor: z.number().nullable(),
      total: z.number(),
    }))
    .query(async ({ input }) => {
      const { cursor = 0, limit, industry } = input;
      
      return await withDatabaseRetry(async () => {
        // 构建查询条件
        let whereCondition = undefined as unknown as ReturnType<typeof and> | undefined;
        if (industry) {
          whereCondition = eq(stocks.industry, industry);
        }
        
        // 执行分页查询
        const stocksList = await db
          .select()
          .from(stocks)
          .where(whereCondition)
          .orderBy(asc(stocks.ts_code))
          .offset(cursor)
          .limit(limit + 1); // 多查询一条判断是否有下一页
        
        // 计算下一页cursor
        const hasNextPage = stocksList.length > limit;
        const nextCursor = hasNextPage ? cursor + limit : null;
        
        // 移除多查询的一条记录
        if (hasNextPage) {
          stocksList.pop();
        }
        
        // 获取总数量
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(stocks)
          .where(whereCondition);
        
        return {
          stocks: stocksList,
          nextCursor,
          total: count,
        };
      });
    }),

  // 获取股票详情
  detail: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/stocks/{ts_code}',
        summary: 'Get stock detail information', 
        description: 'Retrieve detailed information for a specific stock by its code',
        tags: ['Stocks'],
        protect: false
      }
    })
    .input(z.object({
      ts_code: z.string().min(1, "股票代码不能为空"),
    }))
    .output(z.object({
      stock: StockBasicInfoSchema.nullable(),
      latestPrice: StockDailyDataSchema.nullable(),
    }))
    .query(async ({ input }) => {
      const { ts_code } = input;
      
      return await withDatabaseRetry(async () => {
        // 获取股票基础信息
        const [stockInfo] = await db
          .select()
          .from(stocks)
          .where(eq(stocks.ts_code, ts_code))
          .limit(1);
        
        if (!stockInfo) {
          return { stock: null, latestPrice: null };
        }
        
        // 获取最新价格数据
        const [latestPrice] = await db
          .select()
          .from(stock_daily)
          .where(eq(stock_daily.ts_code, ts_code))
          .orderBy(desc(stock_daily.trade_date))
          .limit(1);
        
        return {
          stock: stockInfo,
          latestPrice: latestPrice || null,
        };
      });
    }),

  // 获取股票历史数据
  dailyData: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/stocks/{ts_code}/daily',
        summary: 'Get stock daily trading data',
        description: 'Retrieve historical daily trading data for a specific stock',
        tags: ['Stocks'],
        protect: false
      }
    })
    .input(z.object({
      ts_code: z.string().min(1, "股票代码不能为空"),
      start_date: z.string().optional(), // YYYYMMDD格式
      end_date: z.string().optional(),   // YYYYMMDD格式
      limit: z.number().min(1).max(500).optional().default(100),
    }))
    .output(z.object({
      data: z.array(StockDailyDataSchema),
      total: z.number(),
    }))
    .query(async ({ input }) => {
      const { ts_code, start_date, end_date, limit } = input;
      
      return await withDatabaseRetry(async () => {
        // 构建日期范围查询条件
        let conditions = eq(stock_daily.ts_code, ts_code);
        
        if (start_date && end_date) {
          conditions = and(
            conditions,
            sql`${stock_daily.trade_date} >= ${start_date}`,
            sql`${stock_daily.trade_date} <= ${end_date}`
          )!;
        } else if (start_date) {
          conditions = and(
            conditions,
            sql`${stock_daily.trade_date} >= ${start_date}`
          )!;
        } else if (end_date) {
          conditions = and(
            conditions,
            sql`${stock_daily.trade_date} <= ${end_date}`
          )!;
        }
        
        // 获取历史数据，按日期降序排列（最新的在前）
        const dailyData = await db
          .select()
          .from(stock_daily)
          .where(conditions)
          .orderBy(desc(stock_daily.trade_date))
          .limit(limit);
        
        // 获取总数量
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(stock_daily)
          .where(conditions);
        
        return {
          data: dailyData,
          total: count,
        };
      });
    }),

  // 用户收藏相关功能 - 需要认证
  
  // 获取用户收藏的股票列表
  getUserFavorites: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/stocks/favorites',
        summary: 'Get user favorite stocks',
        description: 'Retrieve the authenticated user\'s favorite stock list',
        tags: ['Stocks', 'User'],
        protect: true
      }
    })
    .input(z.void())
    .output(z.object({
      favorites: z.array(z.object({
        favorite_info: UserStockFavoriteSchema,
        stock: StockBasicInfoSchema,
        latest_price: StockDailyDataSchema.optional(),
      })),
    }))
    .query(async ({ ctx }) => {
      const userId = ctx.session?.user.id;
      
      return await withDatabaseRetry(async () => {
        // 联表查询用户收藏的股票及其基础信息
        const favoriteStocks = await db
          .select({
            favorite_info: user_stock_favorites,
            stock: stocks,
          })
          .from(user_stock_favorites)
          .innerJoin(stocks, eq(user_stock_favorites.ts_code, stocks.ts_code))
          .where(eq(user_stock_favorites.user_id, userId))
          .orderBy(desc(user_stock_favorites.created_at));
        
        // 为每只收藏股票获取最新价格
        const enrichedFavorites = await Promise.all(
          favoriteStocks.map(async ({ favorite_info, stock }) => {
            const [latestPrice] = await db
              .select()
              .from(stock_daily)
              .where(eq(stock_daily.ts_code, stock.ts_code))
              .orderBy(desc(stock_daily.trade_date))
              .limit(1);
            
            return {
              favorite_info,
              stock,
              latest_price: latestPrice,
            };
          })
        );
        
        return {
          favorites: enrichedFavorites,
        };
      });
    }),

  // 添加股票到收藏
  addToFavorites: favoriteRateLimitedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/stocks/favorites',
        summary: 'Add stock to favorites',
        description: 'Add a stock to the authenticated user\'s favorite list',
        tags: ['Stocks', 'User'],
        protect: true
      }
    })
    .input(z.object({
      ts_code: z.string().min(1, "股票代码不能为空"),
    }))
    .output(z.object({
      success: z.boolean(),
      message: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { ts_code } = input;
      const userId = ctx.session?.user.id;
      
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }
      
      try {
        // 检查股票是否存在
        const [stockExists] = await withDatabaseRetry(async () => {
          const rows = await db
            .select()
            .from(stocks)
            .where(eq(stocks.ts_code, ts_code))
            .limit(1);
          return rows;
        });
        
        if (!stockExists) {
          return {
            success: false,
            message: "股票代码不存在",
          };
        }
        
        // 检查是否已经收藏
        const [existingFavorite] = await withDatabaseRetry(async () => {
          const rows = await db
            .select()
            .from(user_stock_favorites)
            .where(
              and(
                eq(user_stock_favorites.user_id, userId),
                eq(user_stock_favorites.ts_code, ts_code)
              )
            )
            .limit(1);
          return rows;
        });
        
        if (existingFavorite) {
          return {
            success: false,
            message: "股票已在收藏列表中",
          };
        }
        
        // 添加到收藏
        await withDatabaseRetry(async () => {
          await db.insert(user_stock_favorites).values({
            user_id: userId,
            ts_code,
            created_at: new Date(),
          });
        });
        
        return {
          success: true,
          message: "成功添加到收藏",
        };
      } catch (error) {
        console.error("添加收藏失败:", error);
        return {
          success: false,
          message: "添加收藏失败，请重试",
        };
      }
    }),

  // 从收藏中移除股票
  removeFromFavorites: favoriteRateLimitedProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/stocks/favorites',
        summary: 'Remove stock from favorites',
        description: 'Remove a stock from the authenticated user\'s favorite list',
        tags: ['Stocks', 'User'],
        protect: true
      }
    })
    .input(z.object({
      ts_code: z.string().min(1, "股票代码不能为空"),
    }))
    .output(z.object({
      success: z.boolean(),
      message: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { ts_code } = input;
      const userId = ctx.session?.user.id;
      
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }
      
      try {
        // 删除收藏记录
        await withDatabaseRetry(async () => {
          await db
            .delete(user_stock_favorites)
            .where(
              and(
                eq(user_stock_favorites.user_id, userId),
                eq(user_stock_favorites.ts_code, ts_code)
              )
            );
        });
        
        return {
          success: true,
          message: "成功移除收藏",
        };
      } catch (error) {
        console.error("移除收藏失败:", error);
        return {
          success: false,
          message: "移除收藏失败，请重试",
        };
      }
    }),

  // 检查股票是否已被收藏
  isFavorite: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/stocks/{ts_code}/favorite',
        summary: 'Check if stock is favorited',
        description: 'Check if a stock is in the authenticated user\'s favorite list',
        tags: ['Stocks', 'User'],
        protect: true
      }
    })
    .input(z.object({
      ts_code: z.string().min(1, "股票代码不能为空"),
    }))
    .output(z.object({
      is_favorite: z.boolean(),
    }))
    .query(async ({ input, ctx }) => {
      const { ts_code } = input;
      const userId = ctx.session?.user.id;
      
      const [favorite] = await withDatabaseRetry(async () => {
        const rows = await db
          .select()
          .from(user_stock_favorites)
          .where(
            and(
              eq(user_stock_favorites.user_id, userId),
              eq(user_stock_favorites.ts_code, ts_code)
            )
          )
          .limit(1);
        return rows;
      });
      
      return {
        is_favorite: !!favorite,
      };
    }),
});
