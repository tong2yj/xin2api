# CatieCli ↔ gcli2api 桥接部署指南

## 📋 概述

本指南介绍如何将 CatieCli 项目的 GeminiCLI、Antigravity 反代和 OAuth 功能桥接到 gcli2api 项目，实现功能复用和统一管理。

### 架构说明

```
用户请求
   ↓
CatieCli (端口 10601)
   ├─ 用户认证/配额管理 (保留)
   ├─ OpenAI反代 (保留)
   └─ 桥接到 gcli2api
        ↓
gcli2api (端口 7861)
   ├─ GeminiCLI 反代
   ├─ Antigravity 反代
   └─ OAuth 凭证获取
```

### 优势

✅ **gcli2api 零代码修改** - 只需配置环境变量
✅ **CatieCli 保留核心功能** - 用户系统、配额管理、管理后台
✅ **复用成熟反代逻辑** - gcli2api 的凭证轮换、重试、流式处理
✅ **灵活切换** - 可以通过环境变量随时切换桥接模式
✅ **独立维护** - 两个项目可以独立更新和部署

---

## 🚀 快速开始

### 步骤 1: 配置 gcli2api

1. **创建配置文件**

在 `D:\code\gcli2api-master\.env` 创建配置：

```bash
# 服务配置
HOST=0.0.0.0
PORT=7861

# API密码（CatieCli调用时需要）
API_PASSWORD=catie_gcli2api_secure_password_2026
PANEL_PASSWORD=catie_gcli2api_panel_password_2026

# 凭证存储
CREDENTIALS_DIR=./creds

# 日志配置
LOG_LEVEL=info
LOG_FILE=log.txt

# OAuth回调端口
OAUTH_CALLBACK_PORT=11451
```

2. **安装依赖**

```bash
cd D:\code\gcli2api-master
pip install -r requirements.txt
```

3. **启动服务**

```bash
python web.py
```

服务将在 `http://localhost:7861` 运行。

---

### 步骤 2: 配置 CatieCli

1. **更新环境变量**

编辑 `D:\code\CatieCli-main\backend\.env`（如果不存在则从 `.env.example` 复制）：

```bash
# 启用 gcli2api 桥接模式
ENABLE_GCLI2API_BRIDGE=true

# gcli2api 服务地址
GCLI2API_BASE_URL=http://localhost:7861

# gcli2api API 密码（与 gcli2api 的 API_PASSWORD 保持一致）
GCLI2API_API_PASSWORD=catie_gcli2api_secure_password_2026

# gcli2api 面板密码（与 gcli2api 的 PANEL_PASSWORD 保持一致）
GCLI2API_PANEL_PASSWORD=catie_gcli2api_panel_password_2026
```

2. **启动 CatieCli**

```bash
cd D:\code\CatieCli-main\backend
python -m app.main
```

---

## 🔧 功能说明

### 1. GeminiCLI 反代桥接

**桥接接口：**
- `POST /v1/chat/completions` - OpenAI 兼容聊天接口
- `GET /v1/models` - 模型列表
- `POST /v1beta/models/{model}:generateContent` - Gemini 原生非流式
- `POST /v1beta/models/{model}:streamGenerateContent` - Gemini 原生流式

**工作流程：**
1. 用户通过 CatieCli 的 API Key 认证
2. CatieCli 验证用户身份和配额
3. 请求转发到 gcli2api 的对应接口
4. gcli2api 处理反代逻辑（凭证轮换、重试等）
5. 响应返回给用户
6. CatieCli 记录使用日志

---

### 2. Antigravity 反代桥接

**桥接接口：**
- `POST /antigravity/v1/chat/completions` - OpenAI 兼容接口
- `GET /antigravity/v1/models` - 模型列表

**特点：**
- 支持 `ag-` 前缀的模型（如 `ag-claude-sonnet-4-5`）
- 完全复用 CatieCli 的用户认证和配额系统
- 凭证管理由 gcli2api 统一处理

---

### 3. OAuth 凭证获取桥接

**桥接接口：**
- `GET /api/oauth/auth-url` - 获取 OAuth 认证链接
- `POST /api/oauth/from-callback-url` - 处理回调 URL 获取凭证

**OAuth 流程：**
1. 用户在 CatieCli 前端选择凭证类型（Gemini CLI 或 Antigravity）
2. 点击"登录 Google 账号"，CatieCli 调用 gcli2api 获取 OAuth URL
3. 用户在新窗口完成 Google 授权
4. 复制回调 URL 粘贴到 CatieCli
5. CatieCli 将回调 URL 转发给 gcli2api
6. gcli2api 自动提取 code、换取 token、获取 project_id
7. 凭证保存在 gcli2api 的数据库/文件系统
8. CatieCli 记录用户贡献（用于配额奖励）

**OAuth 配置：**
- **GeminiCLI**: 使用 gcli2api 内置的官方 OAuth 配置
- **Antigravity**: 使用 gcli2api 内置的 Antigravity OAuth 配置

---

## 📊 凭证管理策略

### 方案：完全托管给 gcli2api（当前实现）

**凭证存储：**
- 所有凭证保存在 gcli2api 的 `./creds` 目录或 MongoDB
- CatieCli 不存储凭证，只记录用户贡献状态

**优点：**
- 凭证管理逻辑完全由 gcli2api 处理
- CatieCli 代码最简洁
- 避免凭证重复存储
- 统一的凭证轮换和故障检测

**配额管理：**
- CatieCli 继续管理用户配额
- 用户上传凭证后，CatieCli 给予配额奖励
- 实际 API 调用由 gcli2api 处理

---

## 🔍 测试验证

### 1. 测试 gcli2api 服务

```bash
# 测试服务是否启动
curl http://localhost:7861/

# 测试模型列表（需要 API_PASSWORD）
curl -H "Authorization: Bearer catie_gcli2api_secure_password_2026" \
     http://localhost:7861/v1/models
```

### 2. 测试 CatieCli 桥接

1. 启动 CatieCli 前端：
```bash
cd D:\code\CatieCli-main\frontend
npm run dev
```

2. 访问 `http://localhost:5173`（或配置的端口）

3. 测试功能：
   - ✅ 用户登录/注册
   - ✅ 获取 OAuth 凭证
   - ✅ GeminiCLI 聊天
   - ✅ Antigravity 聊天

### 3. 查看日志

**gcli2api 日志：**
```bash
tail -f D:\code\gcli2api-master\log.txt
```

**CatieCli 日志：**
- 后端日志在控制台输出
- 前端日志在浏览器控制台

---

## 🛠️ 故障排查

### 问题 1: gcli2api 连接失败

**错误信息：**
```
Cannot connect to gcli2api service
```

**解决方案：**
1. 检查 gcli2api 是否启动：`curl http://localhost:7861/`
2. 检查端口是否正确：`GCLI2API_BASE_URL=http://localhost:7861`
3. 检查防火墙设置

---

### 问题 2: 认证失败

**错误信息：**
```
gcli2api bridge error: 401 Unauthorized
```

**解决方案：**
1. 检查密码是否一致：
   - gcli2api 的 `API_PASSWORD`
   - CatieCli 的 `GCLI2API_API_PASSWORD`
2. 检查是否使用了正确的密码类型：
   - 聊天接口使用 `API_PASSWORD`
   - 管理接口使用 `PANEL_PASSWORD`

---

### 问题 3: OAuth 回调失败

**错误信息：**
```
gcli2api OAuth 回调失败
```

**解决方案：**
1. 检查 gcli2api 的 OAuth 回调端口是否可用（默认 11451）
2. 确保回调 URL 格式正确：`http://localhost:11451/?code=...`
3. 检查 gcli2api 日志查看详细错误

---

## 🔄 切换桥接模式

### 启用桥接模式

编辑 `backend/.env`：
```bash
ENABLE_GCLI2API_BRIDGE=true
```

### 禁用桥接模式（使用本地实现）

编辑 `backend/.env`：
```bash
ENABLE_GCLI2API_BRIDGE=false
```

重启 CatieCli 后端即可生效。

---

## 📝 配置文件参考

### gcli2api 完整配置（.env）

```bash
# 服务配置
HOST=0.0.0.0
PORT=7861

# 密码配置
API_PASSWORD=catie_gcli2api_secure_password_2026
PANEL_PASSWORD=catie_gcli2api_panel_password_2026

# 存储配置
CREDENTIALS_DIR=./creds
# 可选：使用 MongoDB
# MONGODB_URI=mongodb://localhost:27017
# MONGODB_DATABASE=gcli2api

# 凭证轮换配置
CALLS_PER_ROTATION=100

# 错误处理和重试配置
RETRY_429_ENABLED=true
RETRY_429_MAX_RETRIES=5
RETRY_429_INTERVAL=1

# 日志配置
LOG_LEVEL=info
LOG_FILE=log.txt

# OAuth配置
OAUTH_CALLBACK_PORT=11451

# 高级功能配置
ANTI_TRUNCATION_MAX_ATTEMPTS=3
```

### CatieCli 桥接配置（backend/.env）

```bash
# gcli2api 桥接配置
ENABLE_GCLI2API_BRIDGE=true
GCLI2API_BASE_URL=http://localhost:7861
GCLI2API_API_PASSWORD=catie_gcli2api_secure_password_2026
GCLI2API_PANEL_PASSWORD=catie_gcli2api_panel_password_2026

# 其他 CatieCli 配置保持不变
DATABASE_URL=sqlite+aiosqlite:///./data/gemini_proxy.db
SECRET_KEY=your-super-secret-key-change-this
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
PORT=10601
```

---

## 🎯 最佳实践

### 1. 生产环境部署

**推荐配置：**
- 使用 MongoDB 存储凭证（支持分布式）
- 启用自动封禁和重试机制
- 配置合理的凭证轮换次数
- 使用强密码保护 API

**示例：**
```bash
# gcli2api .env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=gcli2api
AUTO_BAN=true
AUTO_BAN_ERROR_CODES=400,403
CALLS_PER_ROTATION=100
```

### 2. 安全建议

- ✅ 修改默认密码
- ✅ 使用 HTTPS（通过 Nginx 反向代理）
- ✅ 限制 gcli2api 只监听本地（`HOST=127.0.0.1`）
- ✅ 定期备份凭证数据
- ✅ 监控异常请求和错误日志

### 3. 性能优化

- 使用 MongoDB 替代文件存储（高并发场景）
- 调整凭证轮换次数（`CALLS_PER_ROTATION`）
- 启用 429 重试机制
- 配置合理的超时时间

---

## 📚 相关文档

- [gcli2api 项目文档](D:\code\gcli2api-master\README.md)
- [CatieCli 项目文档](D:\code\CatieCli-main\README.md)
- [FastAPI 官方文档](https://fastapi.tiangolo.com/)
- [Google OAuth 2.0 文档](https://developers.google.com/identity/protocols/oauth2)

---

## 🤝 贡献

如有问题或建议，欢迎提交 Issue 或 Pull Request。

---

## 📄 许可证

本项目遵循原项目的许可证。

---

**最后更新：** 2026-01-07
**版本：** 1.0.0
