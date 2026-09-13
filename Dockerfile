# ============================================
# React Chat Interface - Frontend User
# Multi-platform build (ARM64 + AMD64)
# ============================================

# Stage 1: Build
# 使用官方 node:20-alpine 镜像，支持多平台
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖（使用国内镜像加速）
RUN npm install --registry=https://registry.npmmirror.com

# 复制源代码
COPY . .

# 构建生产版本
RUN npm run build

# Stage 2: Production
# 使用官方 nginx:1.25-alpine 镜像，支持 ARM64 和 AMD64
FROM nginx:1.25-alpine AS production

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 从构建阶段复制产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]
