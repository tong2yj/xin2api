# 🚀 Docker 自动构建 - 快速参考

## 常用命令

### 首次部署
```bash
# 1. 构建镜像（自动构建前端）
docker-compose build

# 2. 启动服务
docker-compose up -d

# 3. 查看日志
docker-compose logs -f backend
```

### 更新前端代码后
```bash
# 1. 重新构建镜像
docker-compose build

# 2. 重启服务
docker-compose restart backend

# 或者一步完成
docker-compose up -d --build
```

### 强制完全重新构建
```bash
# 不使用任何缓存
docker-compose build --no-cache

# 重启服务
docker-compose up -d
```

### 调试构建过程
```bash
# 查看详细构建日志
docker-compose build --progress=plain

# 查看构建日志并保存
docker-compose build --progress=plain 2>&1 | tee build.log
```

### 验证静态文件
```bash
# 进入容器
docker exec -it catiecli-backend sh

# 查看静态文件
ls -la /app/static/
ls -la /app/static/assets/

# 查看文件修改时间
stat /app/static/index.html

# 退出容器
exit
```

### 清理和重置
```bash
# 停止并删除容器
docker-compose down

# 删除镜像
docker rmi catiecli-backend

# 清理所有未使用的镜像和缓存
docker system prune -a
```

## 文件说明

| 文件 | 说明 |
|------|------|
| `Dockerfile` | 多阶段构建配置 |
| `docker-compose.yml` | Docker Compose 配置 |
| `.dockerignore` | Docker 构建忽略文件 |
| `DOCKER_BUILD.md` | 详细文档 |
| `test-docker-build.sh` | 自动化测试脚本 |

## 构建流程

```
前端源码 → Node.js 构建 → 静态文件 → 复制到后端镜像 → 最终镜像
```

## 故障排查

### 问题：静态文件没有更新
```bash
# 解决方案：强制重新构建
docker-compose build --no-cache
docker-compose up -d
```

### 问题：构建失败
```bash
# 查看详细日志
docker-compose build --progress=plain

# 检查 package-lock.json
cd frontend && npm install
```

### 问题：容器启动失败
```bash
# 查看容器日志
docker-compose logs backend

# 检查端口占用
netstat -ano | findstr :10601  # Windows
lsof -i :10601                 # Linux/Mac
```

## 性能优化

### 使用 BuildKit
```bash
# 临时启用
DOCKER_BUILDKIT=1 docker-compose build

# 永久启用（添加到 ~/.bashrc 或 ~/.zshrc）
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
```

### 利用缓存
```bash
# 首次构建会慢（2-5分钟）
docker-compose build

# 后续构建会快（30-60秒）
docker-compose build
```

## 开发 vs 生产

### 开发环境（推荐）
```bash
# 前端热重载
cd frontend && npm run dev

# 后端热重载
cd backend && uvicorn app.main:app --reload
```

### 生产环境
```bash
# 使用 Docker
docker-compose build
docker-compose up -d
```

## 测试脚本

```bash
# 运行自动化测试
./test-docker-build.sh
```

## 访问地址

- 前端页面：http://localhost:10601
- API 文档：http://localhost:10601/docs
- 健康检查：http://localhost:10601/health

---

**提示**：详细文档请查看 `DOCKER_BUILD.md`
