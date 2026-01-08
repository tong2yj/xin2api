# OAuth 回调"未知错误"问题诊断

## 🔍 问题分析

从日志来看：
```
2026-01-08 00:14:51 [INFO] [Bridge] [gcli2api] OAuth 处理回调URL, for_antigravity=True
2026-01-08 00:14:54 [ERROR] [Bridge] ❌ [gcli2api] 凭证获取失败: 未知错误
```

**可能的原因：**

1. **gcli2api 返回的数据格式不符合预期**
   - 缺少 `success` 字段
   - 或者 `success` 为 `false` 但没有详细的 `error` 信息

2. **OAuth code 已过期**
   - Google OAuth code 只能使用一次
   - 如果之前已经尝试过，code 可能已失效

3. **auth flow 已过期**
   - gcli2api 的 auth flow 有时间限制（通常 5 分钟）
   - 如果超时，需要重新获取认证链接

4. **网络或连接问题**
   - CatieCli 无法正确连接到 gcli2api
   - 或者 gcli2api 返回了非 JSON 格式的响应

---

## 🔧 修复步骤

### 步骤 1: 重启 CatieCli 容器（应用改进的日志）

我已经改进了错误处理，现在会显示完整的响应内容。

```bash
cd D:\cc\CatieCli-main

# 重启容器
docker-compose restart backend

# 查看日志
docker-compose logs -f backend
```

### 步骤 2: 重新测试 OAuth 流程

**重要：必须重新开始整个流程**

1. **点击"登录 Google 账号"** - 获取新的认证链接
2. **在新窗口完成授权** - 不要使用旧的 code
3. **复制新的回调 URL** - 确保是最新的
4. **立即提交**（5 分钟内）

### 步骤 3: 查看详细日志

重新测试后，日志应该会显示：

```
[INFO] [Bridge] [gcli2api] 返回结果: {完整的响应内容}
```

这样我们就能看到 gcli2api 到底返回了什么。

---

## 🧪 诊断脚本

我创建了一个诊断脚本：`debug_oauth_callback.py`

**使用方法：**

1. **确保 gcli2api 正在运行**
2. **修改脚本中的配置**：
   ```python
   GCLI2API_BASE_URL = "http://localhost:7861"  # 你的 gcli2api 地址
   PANEL_PASSWORD = "你的面板密码"
   ```
3. **运行脚本**：
   ```bash
   cd D:\cc\CatieCli-main
   python debug_oauth_callback.py
   ```

这个脚本会：
- 先调用 `/auth/start` 创建 auth flow
- 然后调用 `/auth/callback-url` 提交回调 URL
- 显示完整的响应内容和分析

---

## 📊 可能的响应格式

### 成功的响应

```json
{
  "success": true,
  "credentials": {
    "client_id": "...",
    "client_secret": "...",
    "token": "...",
    "refresh_token": "...",
    "project_id": "projects/xxx/locations/global"
  },
  "file_path": "ag_projects_xxx-1234567890.json",
  "auto_detected_project": true
}
```

### 失败的响应（缺少 auth flow）

```json
{
  "success": false,
  "error": "未找到对应的认证流程，请先启动认证 (state: xxx)"
}
```

### 失败的响应（code 过期）

```json
{
  "success": false,
  "error": "获取凭证失败: invalid_grant"
}
```

---

## 🔍 检查 gcli2api 日志

如果 gcli2api 在运行，查看它的日志：

```bash
# 如果使用 docker-compose
docker-compose -f D:\cc\gcli2api-master\docker-compose.yml logs -f

# 查找 OAuth 相关日志
docker-compose -f D:\cc\gcli2api-master\docker-compose.yml logs | grep -i "oauth\|callback\|auth"
```

**关键日志：**
- `开始从回调URL完成认证`
- `从URL解析到: state=xxx, code=xxx`
- `成功获取访问令牌`
- `从回调URL完成OAuth认证成功`

---

## 🎯 快速解决方案

### 方案 1: 完整重启（推荐）

```bash
# 1. 重启 CatieCli
cd D:\cc\CatieCli-main
docker-compose restart backend

# 2. 等待 10 秒
timeout /t 10

# 3. 重新测试 OAuth
# 访问前端 -> 获取新认证链接 -> 完成授权 -> 提交回调 URL
```

### 方案 2: 检查 gcli2api 状态

```bash
# 检查 gcli2api 是否运行
curl -H "Authorization: Bearer catie_gcli2api_panel_password_2026" http://localhost:7861/v1/models

# 如果失败，启动 gcli2api
cd D:\cc\gcli2api-master
docker-compose up -d
```

### 方案 3: 手动测试 gcli2api

使用 `test_gcli2api_oauth.py` 或 `debug_oauth_callback.py` 脚本直接测试 gcli2api 的 OAuth 接口。

---

## 📝 下一步

1. **重启 CatieCli 容器**（应用改进的日志）
2. **重新测试 OAuth 流程**（使用新的 code）
3. **查看详细日志**（现在会显示完整响应）
4. **把新的日志发给我**，包括：
   ```
   [INFO] [Bridge] [gcli2api] 返回结果: {...}
   ```

这样我就能看到 gcli2api 实际返回了什么，从而精确定位问题。

---

**最后更新**: 2026-01-08
