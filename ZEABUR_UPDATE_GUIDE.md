# 🚀 Zeabur 无损更新指南 - Antigravity 功能

## ✅ 好消息

你的 Antigravity 集成**完全兼容 Zeabur 部署**，无需修改任何配置文件！

- ✅ 所有依赖已在 `requirements.txt` 中（httpx 已存在）
- ✅ 无需修改 `zbpack.json`
- ✅ 无需数据库迁移（使用现有表结构）
- ✅ 无需修改环境变量

---

## 📋 更新前检查清单

### 1. 确认当前部署状态

登录 Zeabur 控制台：
- 确认服务状态为 **Running**
- 记录当前域名（如 `xxx.zeabur.app`）
- 确认数据库连接正常

### 2. 备份重要数据（可选但推荐）

虽然更新不会影响数据库，但建议备份：

```bash
# 如果使用 PostgreSQL，可以导出数据
# 在 Zeabur 控制台 → 数据库服务 → 连接信息
# 使用 pg_dump 导出（可选）
```

---

## 🔄 更新步骤（三种方式）

### 方式一：通过 GitHub 自动部署（推荐）

如果你的项目连接了 GitHub 仓库：

#### 步骤1：提交代码到 GitHub

```bash
# 进入项目目录
cd D:\cc\CatieCli-main

# 初始化 Git（如果还没有）
git init

# 添加所有文件
git add .

# 提交更改
git commit -m "添加 Antigravity 反代功能

- 新增 antigravity_client.py 服务
- 新增 antigravity.py 路由
- 支持 OpenAI 和 Gemini 格式接口
- 完全复用现有认证和权限系统"

# 关联远程仓库（替换为你的仓库地址）
git remote add origin https://github.com/your-username/CatieCli.git

# 推送到 GitHub
git push -u origin main
```

#### 步骤2：Zeabur 自动部署

- Zeabur 会自动检测到代码更新
- 自动触发重新构建和部署
- 等待部署完成（约 2-3 分钟）

---

### 方式二：手动上传代码（如果没有 GitHub）

#### 步骤1：压缩项目文件

```bash
# 压缩整个项目（排除不必要的文件）
# Windows 用户可以手动压缩以下文件夹：
# - backend/
# - frontend/
# - zbpack.json
# - .env.example
```

#### 步骤2：在 Zeabur 重新部署

1. 登录 Zeabur 控制台
2. 进入你的项目
3. 点击服务卡片 → **Settings** → **Redeploy**
4. 或者删除旧服务，重新创建（会保留数据库）

---

### 方式三：使用 Zeabur CLI（最快）

#### 步骤1：安装 Zeabur CLI

```bash
# Windows
npm install -g @zeabur/cli

# 或使用 Scoop
scoop install zeabur
```

#### 步骤2：登录并部署

```bash
# 登录 Zeabur
zeabur auth login

# 进入项目目录
cd D:\cc\CatieCli-main

# 部署更新
zeabur deploy
```

---

## 🔍 更新后验证

### 1. 检查服务状态

登录 Zeabur 控制台：
- 确认服务状态为 **Running**
- 查看部署日志，确认无错误

### 2. 测试原有功能

```bash
# 测试原有的 CLI 接口
curl https://your-domain.zeabur.app/v1/chat/completions \
  -H "Authorization: Bearer cat-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [{"role": "user", "content": "测试原有功能"}]
  }'
```

### 3. 测试新增的 Antigravity 功能

```bash
# 测试 Antigravity 接口
curl https://your-domain.zeabur.app/antigravity/v1/chat/completions \
  -H "Authorization: Bearer cat-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [{"role": "user", "content": "测试 Antigravity 功能"}]
  }'
```

### 4. 检查后台日志

1. 登录后台：`https://your-domain.zeabur.app`
2. 进入"使用日志"
3. 确认新的 Antigravity 请求被正确记录

---

## 📊 数据库兼容性说明

### ✅ 无需数据库迁移

Antigravity 功能使用的是**现有的数据库表**：

- `users` - 用户表（已存在）
- `api_keys` - API Key 表（已存在）
- `credentials` - 凭证表（已存在）
- `usage_logs` - 使用日志表（已存在）

**所有现有数据完全保留，不会有任何影响！**

---

## ⚠️ 注意事项

### 1. 环境变量

Zeabur 上的环境变量**无需修改**，Antigravity 使用相同的配置：

- `ADMIN_USERNAME` - 管理员用户名
- `ADMIN_PASSWORD` - 管理员密码
- `SECRET_KEY` - JWT 密钥
- `DATABASE_URL` - 数据库连接（自动配置）
- `PORT` - 端口（Zeabur 自动设为 8080）

### 2. 端口说明

- Zeabur 固定使用 **8080** 端口
- 代码已自动适配（通过 `PORT` 环境变量）
- 无需手动修改

### 3. 依赖安装

所有新增功能使用的是**已有依赖**：
- `httpx` - 已在 requirements.txt 中
- 其他依赖都是现有的

### 4. 静态文件

前端静态文件（`backend/static/`）会自动部署，无需额外配置。

---

## 🔧 故障排查

### 问题1：部署失败

**检查步骤**：
1. 查看 Zeabur 部署日志
2. 确认 `requirements.txt` 完整
3. 确认 Python 版本兼容（3.10+）

**解决方法**：
```bash
# 在本地测试依赖安装
cd backend
pip install -r requirements.txt
python run.py
```

### 问题2：Antigravity 接口返回 404

**原因**：路由未正确注册

**检查**：
1. 确认 `main.py` 已导入 `antigravity`
2. 确认 `app.include_router(antigravity.router)` 已添加
3. 重启服务

### 问题3：返回 403 "没有可用的凭证"

**原因**：用户没有上传凭证

**解决**：
1. 登录后台
2. 通过 OAuth 授权上传凭证
3. 或联系管理员添加到公共池

### 问题4：原有功能受影响

**不会发生！** Antigravity 是**独立路由**：
- 原有接口：`/v1/chat/completions`
- 新增接口：`/antigravity/v1/chat/completions`

两者完全独立，互不影响。

---

## 📝 更新检查清单

部署完成后，逐项检查：

- [ ] Zeabur 服务状态为 **Running**
- [ ] 原有 CLI 接口正常工作
- [ ] Antigravity 接口可以访问
- [ ] 后台可以登录
- [ ] 使用日志正常记录
- [ ] 用户配额系统正常
- [ ] 凭证管理功能正常

---

## 🎉 更新完成后

### 1. 通知用户

如果你有其他用户，可以发布公告：

```
🎉 系统更新通知

新增功能：
- ✅ Antigravity 反代接口
- ✅ 支持 Claude 系列模型
- ✅ OpenAI 和 Gemini 双格式支持

新接口地址：
- OpenAI 格式：/antigravity/v1/chat/completions
- Gemini 格式：/antigravity/v1/models/{model}:generateContent

使用相同的 API Key，无需额外配置！

详细文档：https://your-domain.zeabur.app/docs
```

### 2. 更新文档

在你的 README.md 中添加 Antigravity 使用说明。

### 3. 监控日志

前几天密切关注使用日志，确保没有异常。

---

## 🚀 快速更新命令（推荐）

如果你使用 GitHub + Zeabur 自动部署：

```bash
# 一键更新脚本
cd D:\cc\CatieCli-main
git add .
git commit -m "添加 Antigravity 反代功能"
git push

# Zeabur 会自动部署，等待 2-3 分钟即可
```

---

## 📞 需要帮助？

如果更新过程中遇到问题：

1. **查看 Zeabur 日志**：控制台 → 服务 → Logs
2. **检查本地运行**：`python backend/run.py`
3. **回滚版本**：Zeabur 支持一键回滚到上一个版本

---

## ✅ 总结

**无损更新的关键**：
1. ✅ 无需修改配置文件
2. ✅ 无需数据库迁移
3. ✅ 无需修改环境变量
4. ✅ 所有现有数据完全保留
5. ✅ 原有功能完全不受影响

**只需要**：
1. 提交代码到 GitHub（或手动上传）
2. Zeabur 自动部署
3. 验证功能正常

就这么简单！🎉
