# gcli2api 桥接凭证池集成

## 功能概述

CatieCli 现已支持与 gcli2api 项目的凭证池桥接，实现统一的凭证管理界面。

### 核心特性

✅ **凭证统一显示**: 在管理后台凭证池中同时显示本地凭证和 gcli2api 桥接凭证
✅ **所有者区分**:
  - gcli2api 原有凭证 → 显示所有者为"管理员"
  - 本地上传凭证 → 显示实际上传用户
✅ **删除打通**: 删除桥接凭证时自动同步到 gcli2api 服务
✅ **实时同步**: 每次查询都从 gcli2api 获取最新凭证状态

---

## 配置说明

### 1. 环境变量配置

在 `backend/.env` 文件中配置以下参数：

```bash
# 启用桥接功能
ENABLE_GCLI2API_BRIDGE=true

# gcli2api 服务地址
GCLI2API_BASE_URL=http://gcli2api:7861

# gcli2api API 密码（用于聊天接口）
GCLI2API_API_PASSWORD=catie_gcli2api_secure_password_2026

# gcli2api 面板密码（用于管理接口）
GCLI2API_PANEL_PASSWORD=catie_gcli2api_panel_password_2026
```

### 2. Docker Compose 配置

使用 `docker-compose.bridge.yml` 启动完整的桥接环境：

```bash
docker-compose -f docker-compose.bridge.yml up -d
```

该配置会同时启动：
- `gcli2api` 服务 (端口 7861)
- `catiecli-backend` 服务 (端口 10601)
- `catiecli-frontend` 服务 (端口 3000)

---

## 使用方式

### 查看凭证池

1. 登录管理后台
2. 进入"凭证管理"标签页
3. 凭证列表会显示：
   - **本地凭证**: 直接上传到 CatieCli 的凭证
   - **GCLI桥接**: 来自 gcli2api 的 GeminiCLI 凭证（带蓝色标记）
   - **AG桥接**: 来自 gcli2api 的 Antigravity 凭证（带紫色标记）

### 删除凭证

- **本地凭证**: 直接从 CatieCli 数据库删除
- **桥接凭证**: 自动调用 gcli2api API 删除，并同步更新

### 凭证标识

桥接凭证的 ID 格式：
- GCLI 凭证: `gcli_{filename}`
- Antigravity 凭证: `ag_{filename}`

---

## API 端点

### 获取凭证列表

```http
GET /api/admin/credentials
Authorization: Bearer {admin_token}
```

响应示例：
```json
{
  "credentials": [
    {
      "id": "1",
      "source": "local",
      "owner_name": "user1",
      "email": "user1@example.com",
      "credential_type": "gemini_cli",
      ...
    },
    {
      "id": "gcli_credentials_001.json",
      "source": "gcli2api",
      "owner_name": "管理员",
      "email": "admin@example.com",
      "credential_type": "gemini_cli",
      "bridge_filename": "credentials_001.json",
      ...
    },
    {
      "id": "ag_antigravity_001.json",
      "source": "antigravity",
      "owner_name": "管理员",
      "email": "admin@example.com",
      "credential_type": "antigravity",
      "bridge_filename": "antigravity_001.json",
      ...
    }
  ],
  "total": 3
}
```

### 删除凭证

```http
DELETE /api/admin/credentials/{credential_id}
Authorization: Bearer {admin_token}
```

支持的 `credential_id`:
- 本地凭证: 数字 ID (如 `1`, `2`, `3`)
- GCLI 桥接: `gcli_{filename}`
- Antigravity 桥接: `ag_{filename}`

---

## 架构说明

```
┌─────────────────────────────────────────┐
│         CatieCli 管理后台                │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  凭证池（合并显示）                  │ │
│  │  - 本地凭证                         │ │
│  │  - GCLI 桥接凭证                    │ │
│  │  - Antigravity 桥接凭证             │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
              ↓ HTTP API
┌─────────────────────────────────────────┐
│      gcli2api 服务 (localhost:7861)      │
│                                          │
│  - /creds/status (GCLI 凭证)            │
│  - /antigravity/creds/status (AG 凭证)  │
│  - /creds/action (删除 GCLI)            │
│  - /antigravity/creds/action (删除 AG)  │
└─────────────────────────────────────────┘
```

---

## 故障排查

### 1. 桥接凭证不显示

**检查项**:
- ✅ `ENABLE_GCLI2API_BRIDGE=true` 是否设置
- ✅ gcli2api 服务是否运行 (`docker ps | grep gcli2api`)
- ✅ `GCLI2API_BASE_URL` 是否正确
- ✅ `GCLI2API_PANEL_PASSWORD` 是否与 gcli2api 一致

**测试连接**:
```bash
curl -H "Authorization: Bearer {PANEL_PASSWORD}" \
  http://localhost:7861/creds/status
```

### 2. 删除桥接凭证失败

**检查项**:
- ✅ 凭证 ID 格式是否正确 (`gcli_` 或 `ag_` 开头)
- ✅ gcli2api 服务是否可访问
- ✅ 面板密码是否正确

**查看日志**:
```bash
docker-compose logs -f backend
```

### 3. 桥接服务不可用

**健康检查**:
```bash
curl http://localhost:7861/
```

应返回 200 状态码。

---

## 技术细节

### 桥接服务模块

位置: `backend/app/services/gcli2api_bridge.py`

核心方法:
- `get_gcli_credentials()`: 获取 GCLI 凭证列表
- `get_antigravity_credentials()`: 获取 Antigravity 凭证列表
- `delete_gcli_credential(filename)`: 删除 GCLI 凭证
- `delete_antigravity_credential(filename)`: 删除 Antigravity 凭证
- `health_check()`: 健康检查

### 前端显示

位置: `frontend/src/pages/admin/CredentialsTab.jsx`

桥接凭证标记:
```jsx
{c.source === 'gcli2api' && (
  <span className="badge badge-blue">GCLI桥接</span>
)}
{c.source === 'antigravity' && (
  <span className="badge badge-purple">AG桥接</span>
)}
```

---

## 更新日志

### 2026-01-08
- ✅ 实现 gcli2api 桥接服务模块
- ✅ 更新管理员凭证列表 API，支持桥接凭证
- ✅ 实现桥接凭证删除功能
- ✅ 前端显示桥接凭证标记
- ✅ 添加配置文件和文档

---

## 未来扩展

### 用户关联功能（计划中）

支持通过 CatieCli 上传到 gcli2api 的凭证关联到实际上传用户：

**方案 1**: 元数据映射表
- 在 CatieCli 数据库新增 `bridge_credential_mapping` 表
- 记录 `bridge_filename` → `user_id` 映射关系

**方案 2**: gcli2api 元数据扩展
- 在 gcli2api 凭证状态中添加 `metadata` 字段
- 存储上传者信息

---

## 许可证

本功能遵循 CatieCli 项目许可证。
