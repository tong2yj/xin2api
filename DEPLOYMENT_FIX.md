# 🔧 Zeabur 部署失败修复指南

## 已发现并修复的问题

### ❌ 问题 1: zbpack.json 文件冲突

**问题描述**:
- 项目根目录有 `zbpack.json`（指向 backend 目录）
- backend 目录也有 `zbpack.json`（没有 root_directory 配置）
- Zeabur 从 GitHub 部署时会混淆，不知道使用哪个配置

**修复方案**:
```bash
# 删除 backend 目录下的重复文件
rm backend/zbpack.json
```

**✅ 已修复**: backend/zbpack.json 已删除

---

### ❌ 问题 2: PORT 环境变量未正确读取

**问题描述**:
- Zeabur 通过 `PORT` 环境变量动态分配端口（通常是 8080）
- 代码中 `port: int = 5001` 是硬编码，不会读取环境变量
- 导致应用监听错误的端口，Zeabur 无法访问

**原代码** (backend/app/config.py:29):
```python
port: int = 5001  # 默认端口，Zeabur 会自动设置为 8080
```

**修复后**:
```python
port: int = int(os.getenv("PORT", "5001"))  # Zeabur 会通过 PORT 环境变量设置端口
```

**✅ 已修复**: 现在会正确读取 PORT 环境变量

---

## 验证修复

### 1. 检查文件结构

```bash
# 应该只有根目录有 zbpack.json
ls -la zbpack.json          # ✅ 存在
ls -la backend/zbpack.json  # ❌ 不应该存在（已删除）
```

### 2. 检查端口配置

```bash
# 查看 config.py 中的端口配置
grep "port.*PORT" backend/app/config.py
```

应该看到:
```python
port: int = int(os.getenv("PORT", "5001"))
```

---

## 推送修复到 GitHub

### 方法 1: 使用 Git 命令（推荐）

```bash
cd D:\cc\CatieCli-main

# 查看修改
git status

# 添加修改的文件
git add backend/app/config.py
git add backend/zbpack.json  # 删除操作也需要 add

# 提交修改
git commit -m "修复 Zeabur 部署问题

- 删除 backend/zbpack.json 避免配置冲突
- 修复 PORT 环境变量读取问题
- 确保 Zeabur 能正确分配端口"

# 推送到 GitHub
git push
```

### 方法 2: 使用 GitHub Desktop

1. 打开 GitHub Desktop
2. 选择 CatieCli 仓库
3. 查看更改：
   - `backend/app/config.py` - 修改
   - `backend/zbpack.json` - 删除
4. 填写提交信息：`修复 Zeabur 部署问题`
5. 点击 "Commit to main"
6. 点击 "Push origin"

---

## Zeabur 重新部署

### 自动部署（如果已连接 GitHub）

1. 推送代码后，Zeabur 会自动检测更新
2. 等待 2-3 分钟自动重新部署
3. 观察部署日志

### 手动触发部署

1. 登录 Zeabur: https://zeabur.com
2. 进入 CatieCli 项目
3. 点击服务卡片
4. 点击 Settings → Redeploy
5. 等待部署完成

---

## 部署成功标志

### 1. 查看部署日志

在 Zeabur 控制台应该看到：

```
✅ Building...
✅ Installing dependencies from requirements.txt
✅ Starting application
✅ Uvicorn running on http://0.0.0.0:8080
✅ Application startup complete
```

### 2. 测试健康检查

```bash
curl https://你的域名.zeabur.app/api/health
```

**预期输出**:
```json
{
  "status": "ok",
  "service": "Catiecli"
}
```

### 3. 测试管理后台

访问: `https://你的域名.zeabur.app`

应该能看到登录页面

### 4. 测试 Antigravity 接口

```bash
curl https://你的域名.zeabur.app/antigravity/v1/models \
  -H "Authorization: Bearer cat-your-api-key"
```

---

## 如果还是部署失败

### 查看详细日志

1. Zeabur 控制台 → 服务卡片 → Logs
2. 查找错误信息

### 常见错误和解决方案

#### 错误 1: `ModuleNotFoundError: No module named 'xxx'`

**原因**: 依赖未安装

**解决**:
```bash
# 检查 requirements.txt 是否包含所有依赖
cat backend/requirements.txt

# 确保包含:
# fastapi>=0.104.0
# uvicorn[standard]>=0.24.0
# httpx>=0.25.0
# ... 其他依赖
```

---

#### 错误 2: `Address already in use`

**原因**: 端口被占用（不应该发生，已修复）

**验证修复**:
```bash
grep "PORT" backend/app/config.py
# 应该看到: port: int = int(os.getenv("PORT", "5001"))
```

---

#### 错误 3: `Database connection failed`

**原因**: 数据库环境变量未配置

**解决**:
1. Zeabur 控制台 → 服务设置 → Variables
2. 添加 `DATABASE_URL`:
   ```
   postgresql://user:password@host:port/dbname
   ```
3. 重新部署

---

#### 错误 4: `ImportError: cannot import name 'antigravity'`

**原因**: 文件未正确上传

**解决**:
```bash
# 确认文件存在
ls backend/app/routers/antigravity.py
ls backend/app/services/antigravity_client.py

# 重新推送
git add backend/app/routers/antigravity.py
git add backend/app/services/antigravity_client.py
git commit -m "确保 Antigravity 文件完整"
git push
```

---

## 完整的文件清单

### 必需的配置文件

```
CatieCli-main/
├── zbpack.json                          ✅ 根目录配置
├── backend/
│   ├── requirements.txt                 ✅ Python 依赖
│   ├── run.py                           ✅ 启动脚本
│   ├── runtime.txt                      ✅ Python 版本
│   └── app/
│       ├── main.py                      ✅ FastAPI 应用
│       ├── config.py                    ✅ 配置（已修复）
│       ├── routers/
│       │   ├── antigravity.py          ✅ Antigravity 路由
│       │   └── ...
│       └── services/
│           ├── antigravity_client.py   ✅ Antigravity 客户端
│           └── ...
```

### 不应该存在的文件

```
❌ backend/zbpack.json  # 已删除，避免冲突
❌ backend/.env         # 不要上传到 GitHub（包含密钥）
```

---

## 环境变量配置清单

在 Zeabur 控制台配置以下环境变量：

### 必需的环境变量

```bash
# 数据库（Zeabur 自动设置，如果连接了数据库服务）
DATABASE_URL=postgresql://...

# JWT 密钥（必须设置！）
SECRET_KEY=your-super-secret-key-change-this-to-random-string

# 管理员账号（可选，有默认值）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

### 可选的环境变量

```bash
# 用户配额
DEFAULT_DAILY_QUOTA=100

# Google OAuth（使用默认值即可）
GOOGLE_CLIENT_ID=681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

---

## 测试部署成功

### 完整测试流程

```bash
# 1. 健康检查
curl https://你的域名.zeabur.app/api/health

# 2. 公共统计
curl https://你的域名.zeabur.app/api/public/stats

# 3. 登录管理后台
# 浏览器访问: https://你的域名.zeabur.app
# 使用管理员账号登录

# 4. 测试原有 Gemini 接口
curl https://你的域名.zeabur.app/v1/chat/completions \
  -H "Authorization: Bearer cat-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"model": "gemini-2.5-flash", "messages": [{"role": "user", "content": "Hello"}]}'

# 5. 测试新增 Antigravity 接口
curl https://你的域名.zeabur.app/antigravity/v1/chat/completions \
  -H "Authorization: Bearer cat-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"model": "gemini-2.5-flash", "messages": [{"role": "user", "content": "Hello"}]}'
```

---

## 🎉 部署成功后

### 1. 验证功能

- [ ] 能访问管理后台
- [ ] 能登录管理员账号
- [ ] 原有 Gemini 接口正常
- [ ] 新增 Antigravity 接口正常
- [ ] 使用日志正常记录

### 2. 监控服务

- 在 Zeabur 控制台查看：
  - CPU 使用率
  - 内存使用率
  - 请求日志

### 3. 备份当前版本

```bash
# 创建 Git 标签
git tag -a v1.1.0 -m "添加 Antigravity 功能，修复部署问题"
git push origin v1.1.0
```

---

## 📞 需要帮助？

如果遇到问题，请提供：

1. **部署日志截图**
   - Zeabur 控制台 → Logs

2. **错误信息**
   - 完整的错误堆栈

3. **环境变量配置**
   - 脱敏后的配置列表

4. **Git 状态**
   ```bash
   git status
   git log -1
   ```

我会帮你解决！

---

## 📚 相关文档

- **功能说明**: `ANTIGRAVITY_README.md`
- **测试指南**: `ANTIGRAVITY_TEST.md`
- **备份恢复**: `BACKUP_AND_RECOVERY.md`
- **手动部署**: `ZEABUR_ZIP_UPLOAD.md`
