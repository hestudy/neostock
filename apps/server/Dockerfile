# 使用官方Bun镜像
FROM oven/bun:1.2.18-alpine AS base

# 设置工作目录
WORKDIR /app

# 复制package.json和锁文件
COPY package.json bun.lock* ./

# 安装所有依赖（包括开发依赖用于构建）
RUN bun install --frozen-lockfile

# 复制源码和配置文件
COPY src ./src
COPY tsconfig.json ./

# 构建应用
RUN bun run build

# 运行时镜像
FROM oven/bun:1.2.18-alpine AS runtime

# 安装安全更新
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# 创建非root用户
RUN addgroup -g 1001 -S nodejs || true
RUN adduser -S appuser -u 1001 -G nodejs || true

# 设置工作目录
WORKDIR /app

# 复制构建产物
COPY --from=base --chown=appuser:nodejs /app/dist ./dist
COPY --from=base --chown=appuser:nodejs /app/package.json ./

# 切换到非root用户
USER appuser

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD bun -e "fetch('http://localhost:3000/').then(r => r.ok ? process.exit(0) : process.exit(1))"

# 使用dumb-init作为入口点
ENTRYPOINT ["dumb-init", "--"]

# 启动应用
CMD ["bun", "run", "dist/index.js"]