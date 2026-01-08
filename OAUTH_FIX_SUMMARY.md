# OAuth 回调失败问题修复总结

## 🔍 问题根源

通过分析容器日志，发现了问题的根本原因：

### CatieCli 调用了错误的 API 接口

**错误的调用：**
```python
path="/auth/callback"  # ❌ 这个接口是等待回调服务器接收 Google 重定向
```

**正确的调用：**
```python
path="/auth/callback-url"  # ✅ 这个接口是直接从回调 URL 完成认证
```

### 两个接口的区别

#### `/auth/callback` - 等待模式
- 启动本地回调服务器监听端口（如 11452）
- 等待 Google **直接重定向**到 `http://localhost:11452/?code=xxx`
- 回调服务器自动接收并完成认证
- **问题**：用户浏览器无法访问容器内的 localhost

#### `/auth/callback-url` - 手动提交模式
- 用户在浏览器完成授权
- 用户**手动复制**回调 URL
- 通过 API 提交回调 URL
- gcli2api 解析 URL 中的 code 并完成认证
- **适合**：容器部署、远程访问等场景

---

## ✅ 已修复的内容

### 1. 修改了 CatieCli 的 OAuth 桥接代码

**文件：** `D:\cc\CatieCli-main\backend\app\routers\oauth.py`

**修改内容：**

```python
# 修改前
result = await gcli2api_bridge.forward_request(
    path="/auth/callback",  # ❌ 错误的接口
    method="POST",
    json_data={
        "callback_url": data.callback_url,
        "mode": "antigravity" if data.for_antigravity else "geminicli"  # ❌ 错误的参数名
    },
    use_panel_password=True
)

# 修改后
result = await gcli2api_bridge.forward_request(
    path="/auth/callback-url",  # ✅ 正确的接口
    method="POST",
    json_data={
        "callback_url": data.callback_url,
        "use_antigravity": data.for_antigravity  # ✅ 正确的参数名
    },
    use_panel_password=True
)
```

### 2. 修正了返回值处理

```python
# 修改前
log_success("OAuth", f"[gcli2api] 凭证获取成功: {result.get('email')}, project: {result.get('project_id')}")
return {
    "email": result.get("email"),
    "project_id": result.get("project_id"),
    ...
}

# 修改后
if not result.get("success"):
    error_msg = result.get("error", "未知错误")
    raise HTTPException(status_code=400, detail=error_msg)

credentials = result.get("credentials", {})
project_id = credentials.get("project_id", "")
log_success("OAuth", f"[gcli2api] 凭证获取成功: project={project_id}")
return {
    "email": "gcli2api-user",
    "project_id": project_id,
    ...
}
```

---

## 🚀 部署步骤

### 步骤 1: 重启 CatieCli 容器

```bash
cd D:\cc\CatieCli-main

# 停止容器
docker-compose down

# 重新构建（因为代码有修改）
docker-compose build

# 启动容器
docker-compose up -d

# 查看日志
docker-compose logs -f backend
```

### 步骤 2: 测试 OAuth 流程

1. **访问 CatieCli 前端**
2. **登录账号**
3. **进入凭证管理页面**
4. **点击"添加 Antigravity 凭证"**（或 GeminiCLI）
5. **点击"登录 Google 账号"**
6. **在新窗口完成 Google 授权**
7. **复制回调 URL**（如 `http://localhost:11452/?state=xxx&code=xxx`）
8. **粘贴到输入框并提交**
9. **等待成功提示**

### 步骤 3: 验证日志

**预期的 CatieCli 日志：**
```
[INFO] [Bridge] [gcli2api] OAuth 处理回调URL, for_antigravity=True
[INFO] [gcli2api Bridge] POST http://gcli2api:7861/auth/callback-url
[SUCCESS] [OAuth] [gcli2api] 凭证获取成功: project=projects/xxx
```

**预期的 gcli2api 日志：**
```
[INFO] 开始从回调URL完成认证: http://localhost:11452/...
[INFO] 从URL解析到: state=xxx, code=xxx...
[INFO] 成功获取访问令牌
[INFO] 从回调URL完成OAuth认证成功，凭证已保存
```

---

## 📊 API 接口对比

| 接口 | 用途 | 参数 | 返回值 |
|------|------|------|--------|
| `/auth/start` | 获取 OAuth 认证链接 | `{"mode": "geminicli\|antigravity"}` | `{"auth_url": "...", "callback_port": 11452}` |
| `/auth/callback` | 等待回调服务器接收 | `{"project_id": "...", "use_antigravity": false}` | 等待超时或成功 |
| `/auth/callback-url` | 从回调 URL 完成认证 | `{"callback_url": "...", "use_antigravity": false}` | `{"success": true, "credentials": {...}}` |

---

## 🔧 故障排查

### 问题 1: 仍然提示"等待OAuth回调超时"

**可能原因：**
- CatieCli 容器未重启，仍在使用旧代码

**解决：**
```bash
cd D:\cc\CatieCli-main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 问题 2: 提示"未找到对应的认证流程"

**可能原因：**
- 回调 URL 中的 state 参数与 gcli2api 中的不匹配
- 认证流程已过期（超过 5 分钟）

**解决：**
1. 重新点击"登录 Google 账号"获取新的认证链接
2. 在 5 分钟内完成授权并提交回调 URL

### 问题 3: 提示"回调URL缺少必要参数"

**可能原因：**
- 复制的 URL 不完整
- URL 中缺少 `code` 或 `state` 参数

**解决：**
- 确保复制完整的 URL，包括 `?` 后面的所有参数
- 示例：`http://localhost:11452/?state=xxx&code=xxx&scope=xxx`

---

## 📝 配置检查清单

部署前请确认：

- [x] CatieCli 的 `.env` 配置正确
  - `ENABLE_GCLI2API_BRIDGE=true`
  - `GCLI2API_BASE_URL=http://localhost:7861`（或容器名）
  - `GCLI2API_API_PASSWORD` 与 gcli2api 一致
  - `GCLI2API_PANEL_PASSWORD` 与 gcli2api 一致

- [x] gcli2api 的 `.env` 配置正确
  - `API_PASSWORD=catie_gcli2api_secure_password_2026`
  - `PANEL_PASSWORD=catie_gcli2api_panel_password_2026`
  - `OAUTH_CALLBACK_PORT=11451`

- [x] 两个容器都已重启并使用最新配置

- [x] gcli2api 可以正常访问
  ```bash
  curl -H "Authorization: Bearer catie_gcli2api_secure_password_2026" \
       http://localhost:7861/v1/models
  ```

---

## 🎯 测试清单

- [ ] 获取 OAuth 认证链接成功
- [ ] 浏览器能打开 Google 授权页面
- [ ] 完成授权后浏览器跳转到回调 URL
- [ ] 复制回调 URL 并提交成功
- [ ] CatieCli 显示"凭证已成功保存"
- [ ] gcli2api 日志显示凭证保存成功
- [ ] 可以使用新凭证进行 API 调用

---

## 📚 相关文档

- `D:\cc\CatieCli-main\GCLI2API_BRIDGE_GUIDE.md` - 桥接部署指南
- `D:\cc\CatieCli-main\OAUTH_TROUBLESHOOTING.md` - OAuth 故障排查
- `D:\cc\gcli2api-master\CATIECLI_BRIDGE_SETUP.md` - gcli2api 配置指南

---

**修复时间**: 2026-01-08
**版本**: 1.0.0
**状态**: ✅ 已修复，待测试
