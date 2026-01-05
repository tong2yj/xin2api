# 🧪 CatieCli 本地测试指南

## 快速开始

我已经为你创建了两个测试脚本：

### 方法 1: Docker 测试（推荐）✅

**最接近 Zeabur 生产环境**

```bash
# 双击运行
test-local.bat
```

**需要安装 Docker Desktop:**
- 下载地址: https://www.docker.com/products/docker-desktop
- 安装后重启电脑

**优点:**
- ✅ 环境完全一致
- ✅ 不影响本地 Python 环境
- ✅ 可以测试完整部署流程

---

### 方法 2: Python 直接运行

**需要本地 Python 环境**

```bash
# 双击运行
test-python.bat
```

**需要安装 Python 3.9+:**
- 下载地址: https://www.python.org/downloads/
- 安装时勾选 "Add Python to PATH"

---

## 测试步骤

### 1. 选择测试方法

- 如果有 Docker → 使用 `test-local.bat`
- 如果只有 Python → 使用 `test-python.bat`

### 2. 运行测试脚本

双击对应的 `.bat` 文件，脚本会自动：
1. 检查环境
2. 安装依赖
3. 启动服务
4. 打开浏览器

### 3. 测试功能

访问 http://localhost:5001

**登录信息:**
- 用户名: `admin`
- 密码: `admin123`

**测试清单:**
- [ ] 能否正常登录
- [ ] 点击"个人统计"是否正常
- [ ] 查看个人统计页面是否显示
- [ ] 检查浏览器控制台是否有错误

### 4. 查看日志

**Docker 方式:**
```bash
docker logs -f catiecli-test
```

**Python 方式:**
直接在命令行窗口查看输出

---

## 常见问题

### Q1: Docker 构建失败

**错误:** `docker: command not found`

**解决:**
1. 安装 Docker Desktop
2. 重启电脑
3. 重新运行 `test-local.bat`

---

### Q2: Python 依赖安装失败

**错误:** `pip: command not found`

**解决:**
```bash
# 重新安装 Python，勾选 "Add Python to PATH"
# 或者手动安装 pip
python -m ensurepip --upgrade
```

---

### Q3: 端口被占用

**错误:** `Address already in use`

**解决:**
```bash
# 查找占用端口的进程
netstat -ano | findstr :5001

# 结束进程（替换 PID）
taskkill /F /PID <进程ID>
```

---

### Q4: 数据库错误

**错误:** `no such column: users.bonus_quota`

**解决:**
```bash
# 删除旧数据库
del backend\data\catiecli.db

# 重新启动服务
```

---

## 手动测试 API

### 1. 健康检查

```bash
curl http://localhost:5001/api/health
```

**预期输出:**
```json
{
  "status": "ok",
  "service": "Catiecli"
}
```

### 2. 登录获取 Token

```bash
curl -X POST http://localhost:5001/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
```

**预期输出:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": {...}
}
```

### 3. 测试个人统计 API

```bash
# 替换 YOUR_TOKEN 为上一步获取的 token
curl http://localhost:5001/api/auth/my-stats ^
  -H "Authorization: Bearer YOUR_TOKEN"
```

**预期输出:**
```json
{
  "today_usage": 0,
  "total_quota": 100,
  "quota_breakdown": {
    "flash": 100,
    "pro_25": 50,
    "tier_3": 0,
    "daily": 0,
    "bonus": 0
  },
  "credentials_count": 0,
  "cred_30_count": 0,
  "today_logs": []
}
```

---

## 如果本地测试成功

说明代码没问题，Zeabur 部署失败可能是：

1. **环境变量问题**
   - 检查 Zeabur 的 `SECRET_KEY` 是否设置
   - 检查 `ADMIN_PASSWORD` 是否设置

2. **资源限制**
   - Zeabur 免费版可能内存不足
   - 尝试升级到付费版

3. **数据库问题**
   - 删除 Zeabur 的持久化存储
   - 让系统重新创建数据库

---

## 如果本地测试失败

**请提供以下信息:**

1. **错误日志**（完整的错误信息）
2. **使用的测试方法**（Docker 还是 Python）
3. **Python 版本**（如果使用 Python 方式）
4. **操作系统版本**

我会帮你解决！

---

## 停止测试服务

**Docker 方式:**
```bash
docker stop catiecli-test
docker rm catiecli-test
```

**Python 方式:**
- 在命令行窗口按 `Ctrl + C`

---

## 下一步

1. 运行本地测试
2. 如果成功 → 说明代码没问题，检查 Zeabur 配置
3. 如果失败 → 把错误日志发给我

现在就试试吧！🚀
