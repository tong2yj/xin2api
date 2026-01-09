# CatieCli 桥接模式专用版本

## 重要变更说明

本版本已**删除独立 OAuth 模式**，仅保留 **gcli2api 桥接模式**和**凭证奖励功能**。

---

## 主要修改内容

### 1. 后端修改

#### `backend/app/routers/oauth.py`
- ✅ 删除了独立 OAuth 模式的所有代码（约 300+ 行）
- ✅ 删除了 Google OAuth 相关的常量和配置
- ✅ 简化了 `_get_auth_url_impl()` 函数，仅调用 gcli2api
- ✅ 简化了 `/callback` 接口，返回错误提示
- ✅ 简化了 `/from-callback-url` 接口，仅支持 gcli2api 桥接
- ✅ 保留了**凭证奖励功能**：新凭证 + 公共池 = +1000 配额

#### `backend/app/config.py`
- ✅ 注释掉了独立 OAuth 的配置项：
  - `google_client_id`
  - `google_client_secret`
  - `antigravity_client_id`
  - `antigravity_client_secret`
  - `antigravity_api_url`
- ✅ 强制启用 `enable_gcli2api_bridge = True`
- ✅ 保留了 `credential_reward_quota = 1000`

#### `backend/.env.example`
- ✅ 删除了 Google OAuth 配置示例
- ✅ 删除了 `ENABLE_GCLI2API_BRIDGE` 开关（强制启用）
- ✅ 添加了 `CREDENTIAL_REWARD_QUOTA` 配置说明
- ✅ 更新了注释，明确说明仅支持桥接模式

#### `backend/app/services/oauth_helpers.py`
- ✅ 已删除（不再需要独立的 OAuth 辅助函数）

---

### 2. 前端修改

#### `frontend/src/pages/OAuth.jsx`
- ✅ 在操作指引中添加了桥接模式提示
- ✅ 明确显示配额奖励数量：**+1000 次**
- ✅ 更新了公共池复选框的说明文字

---

## 功能保留清单

### ✅ 保留的功能

1. **gcli2api 桥接模式**
   - OAuth 授权流程完全由 gcli2api 处理
   - CatieCli 仅存储凭证元数据（project_id）
   - 实际凭证存储在 gcli2api 服务中

2. **凭证奖励机制**
   - 新凭证 + 上传到公共池 = **+1000 次配额**
   - 奖励逻辑：`oauth.py:223-228`
   - 配置项：`config.py:36`

3. **两种凭证类型**
   - Gemini CLI 凭证（`credential_type: "gemini_cli"`）
   - Antigravity 凭证（`credential_type: "oauth_antigravity"`）

4. **公共池机制**
   - 用户可选择将凭证捐赠到公共池
   - 标记为 `is_public=True`
   - 触发 WebSocket 通知

---

### ❌ 删除的功能

1. **独立 OAuth 模式**
   - 不再支持 CatieCli 自己处理 Google OAuth
   - 不再直接调用 Google Token API
   - 不再验证凭证有效性（由 gcli2api 负责）

2. **OAuth 配置接口**
   - `/api/oauth/config` 接口仅返回桥接模式信息
   - 不再支持动态修改 OAuth Client ID/Secret

3. **凭证验证功能**
   - 删除了调用 Gemini API 测试凭证的代码
   - 删除了检测模型等级（2.5/3.0）的逻辑
   - 删除了启用 Google API 服务的代码

---

## 配置要求

### 必需配置

在 `.env` 文件中配置以下项：

```bash
# gcli2api 服务地址
GCLI2API_BASE_URL=http://localhost:7861

# gcli2api API 密码（用于聊天接口）
GCLI2API_API_PASSWORD=your_api_password

# gcli2api 面板密码（用于 OAuth 管理接口）
GCLI2API_PANEL_PASSWORD=your_panel_password

# 凭证奖励配额（可选，默认 1000）
CREDENTIAL_REWARD_QUOTA=1000
```

### 不再需要的配置

以下配置已被删除或注释：

```bash
# ❌ 不再需要
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ANTIGRAVITY_CLIENT_ID=...
ANTIGRAVITY_CLIENT_SECRET=...
ENABLE_GCLI2API_BRIDGE=...  # 强制启用，无需配置
```

---

## 使用流程

### 用户上传凭证

1. 用户访问 `/oauth` 页面
2. 选择凭证类型（Gemini CLI / Antigravity）
3. 点击"登录 Google 账号"
   - CatieCli 调用 gcli2api 的 `/auth/start` 接口
   - gcli2api 返回 Google OAuth 授权链接
4. 用户完成 Google 授权，复制回调 URL
5. 用户粘贴回调 URL，提交
   - CatieCli 调用 gcli2api 的 `/auth/callback-url` 接口
   - gcli2api 处理 OAuth 流程，存储凭证
   - gcli2api 返回 `project_id`
6. CatieCli 在本地数据库创建凭证记录（仅元数据）
7. 如果选择"上传到公共池"，用户获得 **+1000 次配额**

### 凭证奖励触发条件

```python
# oauth.py:223-228
if is_new_credential and data.is_public:
    reward_quota = settings.credential_reward_quota  # 1000
    user.daily_quota += reward_quota
    log_info("Credential", f"用户 {user.username} 获得 {reward_quota} 次数奖励")
```

**条件**：
- ✅ 是新凭证（不是更新已有凭证）
- ✅ 选择了上传到公共池（`is_public=True`）

---

## 数据库变化

### `credentials` 表

桥接模式下的凭证记录：

```sql
-- 示例记录
id: 1
user_id: 123
name: "GeminiCli - project-abc123"
api_key: "encrypted(gcli2api_managed)"  -- 占位符
refresh_token: "encrypted(gcli2api_managed)"  -- 占位符
project_id: "project-abc123"  -- 实际的 Google Cloud Project ID
credential_type: "gemini_cli"  -- 或 "oauth_antigravity"
email: "gcli2api-user"  -- 默认值
is_public: true  -- 是否捐赠到公共池
is_active: true
```

**关键点**：
- `api_key` 和 `refresh_token` 仅存储占位符 `"gcli2api_managed"`
- 实际凭证存储在 gcli2api 服务的数据库中
- `project_id` 用于前端显示和日志记录

---

## 兼容性说明

### 向后兼容

- ✅ 已有的凭证记录不受影响
- ✅ 数据库结构无变化
- ✅ API 接口路径不变

### 不兼容的场景

- ❌ 如果之前使用独立 OAuth 模式，需要重新配置 gcli2api
- ❌ 旧的 `.env` 配置中的 `GOOGLE_CLIENT_ID` 等将被忽略

---

## 测试清单

### 功能测试

- [ ] OAuth 授权流程正常
- [ ] 凭证上传成功
- [ ] 凭证奖励正确触发（+1000 配额）
- [ ] 公共池标记正确
- [ ] WebSocket 通知正常
- [ ] 前端显示正确的提示信息

### 错误处理

- [ ] gcli2api 服务不可用时的错误提示
- [ ] 回调 URL 格式错误时的提示
- [ ] 重复上传凭证时的去重逻辑

---

## 回滚方案

如果需要恢复独立 OAuth 模式，请：

1. 从 Git 历史恢复以下文件：
   - `backend/app/routers/oauth.py`
   - `backend/app/config.py`
   - `backend/app/services/oauth_helpers.py`
   - `backend/.env.example`

2. 修改 `config.py`：
   ```python
   enable_gcli2api_bridge: bool = False
   ```

3. 配置 `.env` 中的 Google OAuth 参数

---

## 相关文件清单

### 修改的文件

- `backend/app/routers/oauth.py` - 删除独立模式，保留桥接模式
- `backend/app/config.py` - 强制启用桥接，注释独立配置
- `backend/.env.example` - 更新配置说明
- `frontend/src/pages/OAuth.jsx` - 更新提示文字

### 删除的文件

- `backend/app/services/oauth_helpers.py` - 独立 OAuth 辅助函数

### 新增的文件

- `BRIDGE_MODE_ONLY.md` - 本说明文档

---

## 常见问题

### Q: 为什么删除独立 OAuth 模式？

A: 独立模式需要维护大量 OAuth 逻辑代码，且与 gcli2api 功能重复。桥接模式更简洁，由专业的 gcli2api 服务处理凭证管理。

### Q: 凭证奖励还能用吗？

A: 可以！凭证奖励功能完全保留，新凭证上传到公共池仍然可以获得 +1000 次配额。

### Q: 如何修改奖励配额数量？

A: 修改 `.env` 文件中的 `CREDENTIAL_REWARD_QUOTA=1000`，或在代码中修改 `config.py:36`。

### Q: 旧的凭证数据会丢失吗？

A: 不会。数据库结构未变化，旧凭证记录仍然存在。但如果是独立模式创建的凭证，可能需要重新上传。

---

## 总结

本次修改简化了 CatieCli 的架构，专注于作为 gcli2api 的前端代理和用户管理系统。凭证管理的复杂逻辑交给专业的 gcli2api 服务处理，CatieCli 只负责：

1. ✅ 用户认证和配额管理
2. ✅ OAuth 流程的前端交互
3. ✅ 凭证元数据存储和展示
4. ✅ 凭证奖励机制
5. ✅ API 请求代理和日志记录

代码量减少约 **400+ 行**，维护成本大幅降低。
