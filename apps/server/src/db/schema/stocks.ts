import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";

// 股票基础信息表
export const stocks = sqliteTable(
  "stocks",
  {
    ts_code: text("ts_code").primaryKey(), // 股票代码 (如: "000001.SZ")
    symbol: text("symbol").notNull(), // 股票符号 (6位数字)
    name: text("name").notNull(), // 股票名称
    area: text("area"), // 地域
    industry: text("industry"), // 所属行业
    market: text("market"), // 市场类型 (主板/创业板/科创板/北交所)
    list_date: text("list_date"), // 上市日期 (YYYYMMDD格式)
    is_hs: text("is_hs"), // 是否沪深港通标的 ("1"=是, "0"=否)
    created_at: integer("created_at", { mode: "timestamp" }).notNull(),
    updated_at: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    // 查询优化索引
    symbolIdx: index("stocks_symbol_idx").on(table.symbol),
    nameIdx: index("stocks_name_idx").on(table.name),
    industryIdx: index("stocks_industry_idx").on(table.industry),
    marketIdx: index("stocks_market_idx").on(table.market),
    // 复合索引用于复杂查询
    industryMarketIdx: index("stocks_industry_market_idx").on(
      table.industry,
      table.market
    ),
  })
);

// 日线数据表
export const stock_daily = sqliteTable(
  "stock_daily",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ts_code: text("ts_code")
      .references(() => stocks.ts_code, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    trade_date: text("trade_date").notNull(), // 交易日期 (YYYYMMDD格式)
    open: real("open").notNull(), // 开盘价
    high: real("high").notNull(), // 最高价
    low: real("low").notNull(), // 最低价
    close: real("close").notNull(), // 收盘价
    vol: real("vol").default(0), // 成交量 (手)
    amount: real("amount").default(0), // 成交额 (千元)
    created_at: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    // 股票代码 + 交易日期的唯一约束
    stockDateUnique: uniqueIndex("stock_daily_ts_code_trade_date_idx").on(
      table.ts_code,
      table.trade_date
    ),
    // 查询优化索引
    tradeDateIdx: index("stock_daily_trade_date_idx").on(table.trade_date),
    tsCodeIdx: index("stock_daily_ts_code_idx").on(table.ts_code),
    // 复合索引用于时间范围查询
    tsCodeDateIdx: index("stock_daily_ts_code_date_range_idx").on(
      table.ts_code,
      table.trade_date
    ),
  })
);

// 用户收藏股票关联表
export const user_stock_favorites = sqliteTable(
  "user_stock_favorites",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    user_id: text("user_id")
      .references(() => user.id, { 
        onDelete: "cascade", 
        onUpdate: "cascade" 
      })
      .notNull(),
    ts_code: text("ts_code")
      .references(() => stocks.ts_code, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    created_at: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    // 用户-股票的唯一组合约束
    userStockUnique: uniqueIndex("user_stock_favorites_user_ts_code_idx").on(
      table.user_id,
      table.ts_code
    ),
    // 查询优化索引
    userIdIdx: index("user_stock_favorites_user_id_idx").on(table.user_id),
    tsCodeIdx: index("user_stock_favorites_ts_code_idx").on(table.ts_code),
  })
);

// 关系定义（用于 Drizzle 查询优化）
export const stocksRelations = relations(stocks, ({ many }) => ({
  dailyData: many(stock_daily),
  favorites: many(user_stock_favorites),
}));

export const stockDailyRelations = relations(stock_daily, ({ one }) => ({
  stock: one(stocks, {
    fields: [stock_daily.ts_code],
    references: [stocks.ts_code],
  }),
}));

export const userStockFavoritesRelations = relations(
  user_stock_favorites,
  ({ one }) => ({
    user: one(user, {
      fields: [user_stock_favorites.user_id],
      references: [user.id],
    }),
    stock: one(stocks, {
      fields: [user_stock_favorites.ts_code],
      references: [stocks.ts_code],
    }),
  })
);