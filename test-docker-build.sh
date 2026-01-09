#!/bin/bash

# Docker 自动构建测试脚本

set -e  # 遇到错误立即退出

echo "🔍 Docker 自动构建测试"
echo "================================"
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

echo "✅ Docker 和 Docker Compose 已安装"
echo ""

# 检查必要文件
echo "📁 检查必要文件..."
files=("Dockerfile" "docker-compose.yml" ".dockerignore" "frontend/package.json" "backend/requirements.txt")
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file 不存在"
        exit 1
    fi
done
echo ""

# 构建镜像
echo "🏗️  开始构建 Docker 镜像（包含前端自动构建）..."
echo "   这可能需要几分钟，请耐心等待..."
echo ""

# 使用 BuildKit 加速构建
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

docker-compose build --progress=plain 2>&1 | tee build.log

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Docker 镜像构建成功！"
else
    echo ""
    echo "❌ Docker 镜像构建失败，请查看 build.log"
    exit 1
fi

echo ""
echo "🔍 验证构建结果..."

# 创建临时容器检查静态文件
echo "   检查静态文件是否存在..."
docker run --rm catiecli-backend ls -la /app/static/ > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "   ✅ 静态文件目录存在"

    # 检查 index.html
    docker run --rm catiecli-backend test -f /app/static/index.html
    if [ $? -eq 0 ]; then
        echo "   ✅ index.html 存在"
    else
        echo "   ❌ index.html 不存在"
        exit 1
    fi

    # 检查 assets 目录
    docker run --rm catiecli-backend test -d /app/static/assets
    if [ $? -eq 0 ]; then
        echo "   ✅ assets 目录存在"
    else
        echo "   ❌ assets 目录不存在"
        exit 1
    fi
else
    echo "   ❌ 静态文件目录不存在"
    exit 1
fi

echo ""
echo "📊 镜像信息："
docker images catiecli-backend --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

echo ""
echo "================================"
echo "✅ 所有测试通过！"
echo ""
echo "📝 下一步："
echo "   1. 启动服务: docker-compose up -d"
echo "   2. 查看日志: docker-compose logs -f backend"
echo "   3. 访问前端: http://localhost:10601"
echo ""
echo "💡 提示："
echo "   - 修改前端代码后，运行: docker-compose build"
echo "   - 强制重新构建: docker-compose build --no-cache"
echo "   - 查看详细文档: cat DOCKER_BUILD.md"
echo ""
