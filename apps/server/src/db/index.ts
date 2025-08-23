import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

// 在测试和CI环境中使用内存数据库，在生产环境中使用实际数据库URL
const isTestOrCI = process.env.NODE_ENV === 'test' || process.env.CI === 'true';
const databaseUrl = isTestOrCI ? ':memory:' : (process.env.DATABASE_URL || 'file:local.db');

const client = createClient({
	url: databaseUrl,
});

export const db = drizzle({ client });
