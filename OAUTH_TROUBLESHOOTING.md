# OAuth 回调失败问题诊断与修复指南

## 错误信息

```
gcli2api OAuth 回调失败: 500: gcli2api bridge error: 400:
{"detail":"等待OAuth回调超时，请确保完成了浏览器中的认证并看到成功页面"}
```

## 问题分析

### 环境说明
- **CatieCli**: Docker 容器部署，通过 CF 隧道外网访问
- **gcli2api**: Docker 容器部署，通过配置文件地址访问
- **问题**: OAuth 回调超时

### 根本原因

OAuth 回调流程涉及多个网络层：

```
用户浏览器
   ↓ (1) 点击"登录 Google"
CatieCli (Docker + CF隧道)
   ↓ (2) 请求 OAuth URL
gcli2api (Docker)
   ↓ (3) 返回 Google OAuth URL + 启动本地回调服务器 (localhost:11451)
用户浏览器
   ↓ (4) 跳转到 Google 授权页面
   ↓ (5) 用户授权
Google
   ↓ (6) 重定向到 http://localhost:11451/?code=xxx
用户浏览器 (localhost:11451)
   ↓ (7) ❌ 无法访问 - gcli2api 的回调服务器在 Docker 容器内
   ↓ (8) 用户手动复制 URL
CatieCli
   ↓ (9) 转发回调 URL 到 gcli2api
gcli2api
   ↓ (10) ⏱️ 超时 - 回调服务器没有收到请求
```

**核心问题**：
1. gcli2api 的 OAuth 回调服务器监听在容器内的 `localhost:11451`
2. 用户浏览器无法访问容器内的 localhost
3. gcli2api 等待回调超时（默认可能是 60 秒）

---

## 解决方案

### 方案 1: 暴露 gcli2api 的 OAuth 回调端口（推荐）

#### 步骤 1: 修改 gcli2api 的 Docker 配置

如果 gcli2api 使用 docker-compose，修改其 `docker-compose.yml`：

```yaml
services:
  gcli2api:
    # ... 其他配置 ...
    ports:
      - "7861:7861"      # API 端口
      - "11451:11451"    # OAuth 回调端口 ⭐ 添加这行
    environment:
      - OAUTH_CALLBACK_HOST=0.0.0.0  # ⭐ 监听所有网卡
      - OAUTH_CALLBACK_PORT=11451
```

如果使用 `docker run`，添加端口映射：

```bash
docker run -d \
  -p 7861:7861 \
  -p 11451:11451 \  # ⭐ 添加这行
  -e OAUTH_CALLBACK_HOST=0.0.0.0 \
  gcli2api:latest
```

#### 步骤 2: 修改 gcli2api 的 .env 配置

```bash
# OAuth 回调配置
OAUTH_CALLBACK_HOST=0.0.0.0  # ⭐ 改为 0.0.0.0，监听所有网卡
OAUTH_CALLBACK_PORT=11451
```

#### 步骤 3: 重启 gcli2api

```bash
docker-compose down
docker-compose up -d
```

#### 步骤 4: 测试回调端口

在宿主机上测试：

```bash
# 应该能看到回调服务器的响应
curl http://localhost:11451/
```

#### 步骤 5: 在 CatieCli 前端使用正确的回调 URL

用户在浏览器中完成 Google 授权后，回调 URL 应该是：
- **本地测试**: `http://localhost:11451/?code=xxx&state=xxx`
- **外网访问**: 需要配置公网域名或使用内网穿透

---

### 方案 2: 修改 CatieCli 的 OAuth 流程（绕过回调服务器）

如果 gcli2api 支持直接提交回调 URL（不依赖回调服务器），可以修改流程：

#### 检查 gcli2api 是否支持 `/auth/callback` 接口

运行测试脚本：

```bash
cd D:\cc\CatieCli-main
python test_gcli2api_oauth.py
```

如果 `/auth/callback` 接口存在且接受 `callback_url` 参数，则可以使用此方案。

#### 修改 CatieCli 的回调 URL 提示

在前端提示用户：

```
1. 点击下方链接，在新窗口完成 Google 授权
2. 授权后，浏览器会跳转到 http://localhost:11451/...
3. ⚠️ 如果页面无法加载，这是正常的
4. 复制浏览器地址栏的完整 URL（包含 ?code=xxx）
5. 粘贴到下方输入框并提交
```

---

### 方案 3: 使用统一的 Docker Compose 编排（最佳实践）

将 CatieCli 和 gcli2api 放在同一个 Docker Compose 文件中：

#### 创建 `docker-compose.yml`

```yaml
version: '3.8'

services:
  # CatieCli 后端
  catiecli-backend:
    build: ./backend
    container_name: catiecli-backend
    ports:
      - '10601:10601'
    volumes:
      - ./data:/app/data
    environment:
      - PORT=10601
      - ENABLE_GCLI2API_BRIDGE=true
      - GCLI2API_BASE_URL=http://gcli2api:7861  # ⭐ 使用容器名
      - GCLI2API_API_PASSWORD=catie_gcli2api_secure_password_2026
      - GCLI2API_PANEL_PASSWORD=catie_gcli2api_panel_password_2026
    depends_on:
      - gcli2api
    networks:
      - catie-network
    restart: unless-stopped

  # gcli2api 服务
  gcli2api:
    image: gcli2api:latest  # 需要先构建镜像
    container_name: gcli2api
    ports:
      - '7861:7861'
      - '11451:11451'  # OAuth 回调端口
    volumes:
      - ./gcli2api-data/creds:/app/creds
      - ./gcli2api-data/logs:/app/logs
    environment:
      - HOST=0.0.0.0
      - PORT=7861
      - API_PASSWORD=catie_gcli2api_secure_password_2026
      - PANEL_PASSWORD=catie_gcli2api_panel_password_2026
      - OAUTH_CALLBACK_HOST=0.0.0.0  # ⭐ 重要
      - OAUTH_CALLBACK_PORT=11451
      - CREDENTIALS_DIR=/app/creds
      - LOG_FILE=/app/logs/log.txt
    networks:
      - catie-network
    restart: unless-stopped

networks:
  catie-network:
    driver: bridge
```

#### 启动服务

```bash
docker-compose down
docker-compose up -d
```

---

## 诊断步骤

### 1. 检查 gcli2api 是否可访问

```bash
# 从宿主机测试
curl http://localhost:7861/

# 从 CatieCli 容器内测试
docker exec catiecli-backend curl http://gcli2api:7861/
```

### 2. 检查 OAuth 回调端口

```bash
# 测试回调端口是否开放
curl http://localhost:11451/

# 或使用 telnet
telnet localhost 11451
```

### 3. 查看 gcli2api 日志

```bash
# 如果使用 docker-compose
docker-compose logs -f gcli2api

# 如果使用 docker run
docker logs -f gcli2api
```

查找关键信息：
- OAuth 回调服务器是否启动
- 监听的地址和端口
- 是否收到回调请求

### 4. 测试完整 OAuth 流程

运行测试脚本：

```bash
python test_gcli2api_oauth.py
```

预期输出：

```
1. 测试根路径...
   状态码: 200

2. 测试 /auth/start (GeminiCLI)...
   状态码: 200
   ✅ 成功: {
     "auth_url": "https://accounts.google.com/o/oauth2/auth?...",
     "callback_port": 11451
   }
```

### 5. 检查防火墙

确保端口 11451 没有被防火墙阻止：

**Windows:**
```powershell
# 添加防火墙规则
netsh advfirewall firewall add rule name="gcli2api OAuth" dir=in action=allow protocol=TCP localport=11451
```

**Linux:**
```bash
# 检查防火墙状态
sudo ufw status

# 开放端口
sudo ufw allow 11451/tcp
```

---

## 验证修复

### 完整测试流程

1. **启动服务**
   ```bash
   docker-compose up -d
   ```

2. **检查端口**
   ```bash
   netstat -ano | findstr "11451"
   # 应该看到 LISTENING 状态
   ```

3. **访问 CatieCli 前端**
   - 登录账号
   - 进入凭证管理页面
   - 点击"添加 GeminiCLI 凭证"

4. **获取 OAuth URL**
   - 点击"登录 Google 账号"
   - 检查浏览器控制台，确认请求成功

5. **完成 Google 授权**
   - 在新窗口完成授权
   - 浏览器跳转到 `http://localhost:11451/?code=xxx`
   - **关键**：页面应该显示成功消息（如"授权成功，请关闭此窗口"）

6. **查看日志**
   ```bash
   # gcli2api 日志应该显示收到回调
   docker-compose logs gcli2api | grep -i "callback"

   # CatieCli 日志应该显示凭证保存成功
   docker-compose logs catiecli-backend | grep -i "oauth"
   ```

---

## 常见错误

### 错误 1: 端口未暴露

**症状**: 浏览器访问 `http://localhost:11451` 显示"无法访问此网站"

**解决**:
- 检查 `docker-compose.yml` 是否包含 `11451:11451` 端口映射
- 重启容器

### 错误 2: 回调服务器监听在 127.0.0.1

**症状**: 容器内可以访问，宿主机无法访问

**解决**:
- 修改 gcli2api 配置：`OAUTH_CALLBACK_HOST=0.0.0.0`
- 重启服务

### 错误 3: 网络隔离

**症状**: CatieCli 无法连接到 gcli2api

**解决**:
- 使用 Docker 网络：`GCLI2API_BASE_URL=http://gcli2api:7861`
- 或使用宿主机地址：`GCLI2API_BASE_URL=http://host.docker.internal:7861`

### 错误 4: API 路径不匹配

**症状**: 404 Not Found

**解决**:
- 运行 `test_gcli2api_oauth.py` 查找正确的 API 路径
- 检查 gcli2api 的 API 文档（访问 `/docs` 或 `/redoc`）

---

## 配置检查清单

- [ ] gcli2api 的 `OAUTH_CALLBACK_HOST=0.0.0.0`
- [ ] gcli2api 的端口 11451 已暴露
- [ ] CatieCli 可以访问 gcli2api（测试 `/` 端点）
- [ ] 防火墙允许端口 11451
- [ ] 密码配置一致（`API_PASSWORD` 和 `PANEL_PASSWORD`）
- [ ] Docker 网络配置正确
- [ ] 查看日志确认服务正常启动

---

## 联系支持

如果以上方案都无法解决问题，请提供以下信息：

1. **gcli2api 日志**（启动时的输出）
2. **CatieCli 日志**（OAuth 请求时的输出）
3. **测试脚本输出**（`test_gcli2api_oauth.py`）
4. **网络配置**（`docker network ls` 和 `docker network inspect`）
5. **端口监听状态**（`netstat -ano | findstr "11451"`）

---

**最后更新**: 2026-01-08
**版本**: 1.0.0
