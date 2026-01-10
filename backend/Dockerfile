FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制并安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY . .

# 清理所有 Python 字节码缓存文件
RUN find . -type f -name '*.pyc' -delete && \
    find . -type d -name '__pycache__' -delete && \
    find . -type f -name '*.pyo' -delete

# 创建数据目录并设置权限
RUN mkdir -p /app/data && \
    chmod 755 /app/data

# 创建非 root 用户
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

# 切换到非 root 用户
USER appuser

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
