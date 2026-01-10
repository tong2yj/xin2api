# Xin2API Docker 部署教程

## 📋 前置条件

### 1. 服务器环境
- Linux 服务器（Ubuntu 20.04+ / Debian 11+ / CentOS 8+ 推荐）
- Docker 20.10+ 已安装
- Docker Compose 2.0+ 已安装
- 至少 2GB 可用内存
- 至少 5GB 可用磁盘空间

### 2. gcli2api 服务
确保你的 Linux 服务器上已经有 gcli2api 的 Docker 容器在运行：

```bash
# 检查 gcli2api 容器状态
docker ps | grep gcli2api

# 应该看到类似输出：
# CONTAINER ID   IMAGE          COMMAND       CREATED       STATUS       PORTS                    NAMES
# abc123def456   gcli2api:xxx   "..."         2 days ago    Up 2 days    0.0.0.0:7861->7861/tcp   gcli2api-service
```

### 3. 网络连通性
确保 Xin2API 容器能够访问 gcli2api 容器：
- 如果两个容器在同一 Docker 网络：使用容器名访问（如 `http://gcli2api-service:7861`）
- 如果使用宿主机网络：使用 `http://localhost:7861` 或 `http://127.0.0.1:7861`
- 如果在不同主机：使用 gcli2api 服务器的 IP 地址

---

## 🚀 快速部署

### 步骤 1: 克隆项目

```bash
# 克隆项目到服务器
git clone https://github.com/your-repo/xin2api.git
cd xin2api

# 或者如果已经有项目文件，直接上传到服务器
# scp -r ./xin2api user@your-server:/path/to/xin2api
```

### 步骤 2: 配置环境变量

创建 `.env` 配置文件：

```bash
# 复制示例配置
cp .env.example .env

# 编辑配置文件
nano .env
```

**重要配置项：**

```bash
# ============================================
# 基础配置
# ============================================
# 数据库配置（使用 SQLite，数据存储在 ./data 目录）
DATABASE_URL=sqlite+aiosqlite:///./data/gemini_proxy.db

# JWT 密钥（请修改为随机字符串）
SECRET_KEY=your-super-secret-key-change-this-in-production

# 管理员账号（首次启动会自动创建）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# 服务端口（容器内部端口，不要修改）
PORT=10601

# ============================================
# gcli2api 桥接配置（必需）
# ============================================
# gcli2api 服务地址
# 根据你的实际情况选择：
# - 同一 Docker 网络：http://gcli2api-service:7861
# - 宿主机网络：http://localhost:7861
# - 不同主机：http://192.168.1.100:7861
GCLI2API_BASE_URL=http://gcli2api-service:7861

# gcli2api API 密码（需要与 gcli2api 的 API_PASSWORD 一致）
GCLI2API_API_PASSWORD=your_gcli2api_api_password

# gcli2api 面板密码（需要与 gcli2api 的 PANEL_PASSWORD 一致）
GCLI2API_PANEL_PASSWORD=your_gcli2api_panel_password

# ============================================
# 其他配置
# ============================================
# 用户默认配额（每日请求数）
DEFAULT_DAILY_QUOTA=100

# 注册开关
ALLOW_REGISTRATION=true

# 端点优先级顺序
ENDPOINT_PRIORITY=gcli2api,antigravity,openai
```

### 步骤 3: 准备数据目录

如果你已经有数据库文件（`gemini_proxy.db`），确保它在 `data` 目录下：

```bash
# 检查数据目录
ls -la data/

# 应该看到：
# -rw-r--r-- 1 user user 126976 Jan 10 15:03 gemini_proxy.db

# 如果没有 data 目录，创建它
mkdir -p data

# 如果需要从其他地方复制数据库
# cp /path/to/gemini_proxy.db ./data/
```

**重要：** 确保数据目录权限正确：

```bash
# 设置目录权限（Docker 容器使用 UID 1000）
sudo chown -R 1000:1000 data/
chmod 755 data/
```

### 步骤 4: 连接到 gcli2api 网络（可选）

如果你的 gcli2api 容器使用了自定义 Docker 网络，需要让 Xin2API 加入同一网络：

```bash
# 查看 gcli2api 使用的网络
docker inspect gcli2api-service | grep NetworkMode

# 如果使用了自定义网络（如 gcli-network），修改 docker-compose.yml
# 在 networks 部分添加：
# networks:
#   gcli-network:
#     external: true
```

**修改 `docker-compose.yml`：**

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: xin2api-backend
    ports:
      - '10601:10601'
    volumes:
      - ./data:/app/data
    env_file:
      - .env
    environment:
      - PORT=10601
    restart: unless-stopped
    networks:
      - gcli-network  # 加入 gcli2api 的网络
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:10601/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5s

networks:
  gcli-network:
    external: true  # 使用已存在的网络
```

### 步骤 5: 构建并启动服务

```bash
# 构建 Docker 镜像（首次部署或代码更新后需要）
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 等待服务启动完成（看到 "Application startup complete" 表示成功）
```

### 步骤 6: 验证部署

```bash
# 1. 检查容器状态
docker ps | grep xin2api

# 应该看到：
# CONTAINER ID   IMAGE              STATUS        PORTS                      NAMES
# xxx123xxx456   xin2api-backend    Up 2 minutes  0.0.0.0:10601->10601/tcp   xin2api-backend

# 2. 检查健康状态
curl http://localhost:10601/health

# 应该返回：
# {"status":"healthy"}

# 3. 测试 gcli2api 连接
docker-compose logs backend | grep gcli2api

# 应该看到成功连接的日志
```

### 步骤 7: 访问管理后台

打开浏览器访问：

```
http://your-server-ip:10601
```

使用你在 `.env` 中配置的管理员账号登录：
- 用户名：`admin`（或你配置的 ADMIN_USERNAME）
- 密码：`admin123`（或你配置的 ADMIN_PASSWORD）

---

## 🔧 高级配置

### 使用宿主机网络模式

如果 gcli2api 使用了宿主机网络，修改 `docker-compose.yml`：

```yaml
services:
  backend:
    network_mode: "host"
    # 移除 ports 配置（宿主机模式不需要端口映射）
    # ports:
    #   - '10601:10601'
```

然后在 `.env` 中设置：

```bash
GCLI2API_BASE_URL=http://localhost:7861
```

### 使用外部数据库（PostgreSQL）

如果需要更高性能，可以使用 PostgreSQL：

```bash
# 在 .env 中修改数据库配置
DATABASE_URL=postgresql+asyncpg://username:password@postgres-host:5432/xin2api
```

### 反向代理配置（Nginx）

如果需要通过域名访问，配置 Nginx：

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:10601;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持（如果需要）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 🔍 故障排查

### 1. 容器无法启动

**检查日志：**
```bash
docker-compose logs backend
```

**常见问题：**
- 端口 10601 被占用：修改 `.env` 中的 `PORT` 和 `docker-compose.yml` 中的端口映射
- 数据目录权限问题：执行 `sudo chown -R 1000:1000 data/`
- 环境变量配置错误：检查 `.env` 文件格式

### 2. 无法连接到 gcli2api

**测试连接：**
```bash
# 进入容器测试
docker exec -it xin2api-backend sh
curl http://gcli2api-service:7861/

# 或者从宿主机测试
curl http://localhost:7861/
```

**常见问题：**
- 网络不通：检查两个容器是否在同一网络
- gcli2api 地址错误：检查 `.env` 中的 `GCLI2API_BASE_URL`
- 密码不匹配：确保 `GCLI2API_API_PASSWORD` 和 `GCLI2API_PANEL_PASSWORD` 与 gcli2api 一致

### 3. 数据库文件丢失或损坏

**备份数据库：**
```bash
# 定期备份
cp data/gemini_proxy.db data/gemini_proxy.db.backup.$(date +%Y%m%d)

# 恢复备份
cp data/gemini_proxy.db.backup.20260110 data/gemini_proxy.db
docker-compose restart
```

### 4. 查看详细日志

```bash
# 实时查看日志
docker-compose logs -f backend

# 查看最近 100 行日志
docker-compose logs --tail=100 backend

# 导出日志到文件
docker-compose logs backend > xin2api.log
```

---

## 🔄 更新部署

当有新版本发布时：

```bash
# 1. 备份数据
cp -r data data.backup.$(date +%Y%m%d)

# 2. 拉取最新代码
git pull origin main

# 3. 重新构建镜像
docker-compose build --no-cache

# 4. 停止旧容器
docker-compose down

# 5. 启动新容器
docker-compose up -d

# 6. 查看日志确认启动成功
docker-compose logs -f
```

---

## 📊 监控和维护

### 查看容器资源使用

```bash
# 查看 CPU 和内存使用
docker stats xin2api-backend

# 查看磁盘使用
du -sh data/
```

### 定期清理

```bash
# 清理未使用的 Docker 镜像
docker image prune -a

# 清理未使用的容器
docker container prune

# 清理未使用的卷
docker volume prune
```

### 日志轮转

为避免日志文件过大，配置 Docker 日志轮转：

```yaml
# 在 docker-compose.yml 中添加
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## 🔐 安全建议

1. **修改默认密码**：首次登录后立即修改管理员密码
2. **使用强密钥**：修改 `.env` 中的 `SECRET_KEY` 为随机字符串
3. **限制访问**：使用防火墙限制 10601 端口的访问来源
4. **启用 HTTPS**：生产环境建议使用 Nginx + Let's Encrypt
5. **定期备份**：设置定时任务备份数据库文件
6. **更新依赖**：定期更新 Docker 镜像和依赖包

---

## 📞 获取帮助

如果遇到问题：
1. 查看日志：`docker-compose logs -f backend`
2. 检查配置：确认 `.env` 文件配置正确
3. 测试连接：验证 gcli2api 服务可访问
4. 提交 Issue：在 GitHub 仓库提交问题报告

---

## 📝 附录

### 完整的 docker-compose.yml 示例

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: xin2api-backend
    ports:
      - '10601:10601'
    volumes:
      - ./data:/app/data
    env_file:
      - .env
    environment:
      - PORT=10601
    restart: unless-stopped
    networks:
      - default
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:10601/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  default:
    driver: bridge
```

### 环境变量完整列表

| 变量名 | 说明 | 默认值 | 必需 |
|--------|------|--------|------|
| `DATABASE_URL` | 数据库连接字符串 | `sqlite+aiosqlite:///./data/gemini_proxy.db` | 是 |
| `SECRET_KEY` | JWT 密钥 | - | 是 |
| `ADMIN_USERNAME` | 管理员用户名 | `admin` | 是 |
| `ADMIN_PASSWORD` | 管理员密码 | `admin123` | 是 |
| `PORT` | 服务端口 | `10601` | 是 |
| `GCLI2API_BASE_URL` | gcli2api 服务地址 | - | 是 |
| `GCLI2API_API_PASSWORD` | gcli2api API 密码 | - | 是 |
| `GCLI2API_PANEL_PASSWORD` | gcli2api 面板密码 | - | 是 |
| `DEFAULT_DAILY_QUOTA` | 用户默认配额 | `100` | 否 |
| `ALLOW_REGISTRATION` | 是否允许注册 | `true` | 否 |
| `ENDPOINT_PRIORITY` | 端点优先级 | `gcli2api,antigravity,openai` | 否 |

---

**部署完成！** 🎉

现在你可以通过 `http://your-server-ip:10601` 访问 Xin2API 管理后台了。
