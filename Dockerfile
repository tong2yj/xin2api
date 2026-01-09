# ============================================
# 第一阶段：构建前端
# ============================================
FROM node:18-alpine AS frontend-builder

WORKDIR /build

# 复制前端依赖文件
COPY frontend/package*.json ./frontend/

# 安装依赖（包含 devDependencies，因为需要 vite 构建工具）
RUN cd frontend && npm ci

# 复制前端源码
COPY frontend/ ./frontend/

# 创建 backend/static 目录（vite 构建输出目标）
RUN mkdir -p backend/static

# 构建前端（输出到 ../backend/static）
RUN cd frontend && npm run build

# ============================================
# 第二阶段：构建后端
# ============================================
FROM python:3.11-slim

WORKDIR /app

# 安装后端依赖
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend/ .

# 从前端构建阶段复制静态文件
COPY --from=frontend-builder /build/backend/static ./static

# 清理 Python 字节码缓存文件
RUN find . -type f -name '*.pyc' -delete && \
    find . -type d -name '__pycache__' -delete

# 创建数据目录
RUN mkdir -p /app/data

# 设置环境变量
ENV PYTHONIOENCODING=utf-8 \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=5001

EXPOSE 5001

# 启动命令
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
