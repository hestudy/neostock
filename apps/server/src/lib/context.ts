import type { Context as HonoContext } from "hono";
import { auth } from "./auth";

export type CreateContextOptions = {
	context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});
	
	// 获取客户端 IP 地址
	const clientIP = context.env?.CF_CONNECTING_IP ||
		context.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
		context.env?.REMOTE_ADDR ||
		'unknown';
	
	return {
		session,
		clientIP,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
