# ============================================
# 第一阶段：构建前端
# ============================================
FROM node:18-alpine AS frontend-builder

WORKDIR /build

# 复制前端依赖文件
COPY frontend/package*.json ./frontend/

# 安装依赖（使用 npm ci 确保可重现构建）
RUN cd frontend && npm ci --prefer-offline --no-audit

# 复制前端源码
COPY frontend/ ./frontend/

# 创建 backend/static 目录（vite 构建输出目标）
RUN mkdir -p backend/static

# 构建前端（输出到 ../backend/static）
RUN cd frontend && npm run build

# ============================================
# 第二阶段：构建后端
# ============================================
FROM python:3.11-slim AS backend

WORKDIR /app

# 安装系统依赖（如果需要）
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制并安装后端依赖
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend/ .

# 从前端构建阶段复制静态文件
COPY --from=frontend-builder /build/backend/static ./static

# 清理 Python 字节码缓存文件
RUN find . -type f -name '*.pyc' -delete && \
    find . -type d -name '__pycache__' -delete && \
    find . -type f -name '*.pyo' -delete

# 创建数据目录（以 root 用户运行）
RUN mkdir -p /app/data

# 设置环境变量
ENV PYTHONIOENCODING=utf-8 \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=10601

EXPOSE 10601

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# 启动命令
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
