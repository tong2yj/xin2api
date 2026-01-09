# Docker 自动构建前端配置说明

## 📋 概述

本项目已配置 Docker 多阶段构建，每次构建 Docker 镜像时会自动构建前端并打包到后端静态文件目录。

## 🏗️ 构建流程

```
┌─────────────────────────────────────────────────────────┐
│ 第一阶段：Frontend Builder (Node.js 18 Alpine)         │
│ 1. 安装前端依赖 (npm ci)                                │
│ 2. 构建前端项目 (npm run build)                         │
│ 3. 输出到 ../backend/static                             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 第二阶段：Backend (Python 3.11 Slim)                   │
│ 1. 安装 Python 依赖                                     │
│ 2. 复制后端代码                                         │
│ 3. 从第一阶段复制构建好的前端静态文件                   │
│ 4. 启动 FastAPI 服务                                    │
└─────────────────────────────────────────────────────────┘
```

## 🚀 使用方法

### 首次构建

```bash
# 构建镜像（会自动构建前端）
docker-compose build

# 启动服务
docker-compose up -d
```

### 更新前端代码后

```bash
# 重新构建镜像（会自动构建最新前端代码）
docker-compose build --no-cache

# 重启服务
docker-compose up -d
```

### 查看构建日志

```bash
# 查看完整构建过程
docker-compose build --progress=plain

# 查看运行日志
docker-compose logs -f backend
```

## 📁 文件结构

```
CatieCli/
├── Dockerfile                    # 多阶段构建配置（新增）
├── .dockerignore                 # Docker 忽略文件（新增）
├── docker-compose.yml            # Docker Compose 配置（已修改）
├── frontend/
│   ├── src/                      # 前端源码
│   ├── package.json
│   └── vite.config.js            # 构建输出到 ../backend/static
└── backend/
    ├── static/                   # 前端构建输出目录
    │   ├── index.html
    │   └── assets/
    ├── app/
    └── requirements.txt
```

## ⚙️ 配置说明

### Dockerfile

- **第一阶段**：使用 `node:18-alpine` 构建前端
  - 轻量级镜像，构建速度快
  - 使用 `npm ci` 安装依赖（比 `npm install` 更快更可靠）
  - 构建输出到 `../backend/static`

- **第二阶段**：使用 `python:3.11-slim` 运行后端
  - 从第一阶段复制构建好的静态文件
  - 最终镜像不包含 Node.js，体积更小

### docker-compose.yml

```yaml
services:
  backend:
    build:
      context: .              # 构建上下文改为项目根目录
      dockerfile: Dockerfile  # 使用根目录的 Dockerfile
```

### .dockerignore

优化构建速度，排除不必要的文件：
- `node_modules`（会在容器内重新安装）
- `frontend/dist`（会在容器内重新构建）
- `.git`、`.vscode` 等开发文件
- 日志、缓存等临时文件

## 🔍 验证构建结果

### 1. 检查静态文件是否存在

```bash
# 进入容器
docker exec -it catiecli-backend sh

# 查看静态文件
ls -la /app/static/
ls -la /app/static/assets/

# 退出容器
exit
```

### 2. 访问前端页面

```bash
# 访问管理后台
http://localhost:10601/

# 检查浏览器控制台，确认没有 404 错误
```

### 3. 验证前端代码更新

```bash
# 修改前端代码
vim frontend/src/pages/admin/SystemSettingsTab.jsx

# 重新构建
docker-compose build

# 重启服务
docker-compose up -d

# 清除浏览器缓存后访问，确认更新生效
```

## 🐛 常见问题

### Q1: 构建时提示 "npm ci" 失败

**原因**：`package-lock.json` 与 `package.json` 不一致

**解决**：
```bash
cd frontend
npm install
git add package-lock.json
git commit -m "chore: update package-lock.json"
```

### Q2: 静态文件没有更新

**原因**：Docker 使用了缓存

**解决**：
```bash
# 强制重新构建，不使用缓存
docker-compose build --no-cache
```

### Q3: 构建速度太慢

**优化方法**：
1. 使用 Docker BuildKit（更快的构建引擎）
   ```bash
   DOCKER_BUILDKIT=1 docker-compose build
   ```

2. 使用多阶段构建缓存
   ```bash
   # 第一次构建会慢，后续构建会利用缓存
   docker-compose build
   ```

### Q4: 容器内看不到静态文件

**检查步骤**：
```bash
# 1. 检查构建日志
docker-compose build --progress=plain 2>&1 | grep "static"

# 2. 检查 Dockerfile COPY 命令
cat Dockerfile | grep "COPY --from"

# 3. 进入容器检查
docker exec -it catiecli-backend ls -la /app/static/
```

## 📊 构建性能

### 首次构建
- 时间：约 2-5 分钟（取决于网络速度）
- 镜像大小：约 300-400 MB

### 增量构建（代码更新后）
- 时间：约 30-60 秒（利用 Docker 缓存）
- 只重新构建变化的层

## 🔄 开发环境建议

在开发环境中，建议使用以下方式以获得更快的反馈：

```bash
# 终端 1：前端开发服务器（热重载）
cd frontend
npm run dev

# 终端 2：后端开发服务器（热重载）
cd backend
uvicorn app.main:app --reload

# 访问 http://localhost:3000（前端开发服务器）
```

**生产部署时**才使用 Docker 构建：
```bash
docker-compose build
docker-compose up -d
```

## ✅ 优势

1. **自动化**：每次构建 Docker 镜像自动构建前端
2. **一致性**：确保部署的前端代码与源码一致
3. **简化部署**：一个命令完成前后端部署
4. **版本控制**：Docker 镜像包含完整的前后端代码
5. **体积优化**：最终镜像不包含 Node.js 和前端源码

## 📝 注意事项

1. **首次构建较慢**：需要下载 Node.js 镜像和安装依赖
2. **修改前端后必须重新构建镜像**：不会自动热重载
3. **开发环境建议使用 `npm run dev`**：获得更好的开发体验
4. **生产环境使用 Docker 构建**：确保代码一致性

---

**创建日期**：2026-01-09
**最后更新**：2026-01-09
**状态**：✅ 已实施并测试
