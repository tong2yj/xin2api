# CatieCli 架构重大变更说明

## 变更日期
2026-01-08

## 变更概述

**CatieCli 已移除自带的 GeminiCLI 凭证池功能**，简化为纯代理层架构。

## 变更原因

1. **避免功能重复**：CatieCli 和 gcli2api 都实现了 GeminiCLI 凭证池管理，导致维护成本高
2. **统一凭证管理**：将所有凭证管理集中到 gcli2api，CatieCli 专注于用户管理和配额控制
3. **简化架构**：CatieCli 作为纯代理层，更易于维护和扩展
4. **利用 gcli2api 优势**：gcli2api 提供更强大的轮询、负载均衡、错误重试等功能

## 架构对比

### 变更前（旧架构）

```
用户请求 → CatieCli
           ├─ 普通模型 → 本地 GeminiCLI 凭证池 或 OpenAI 端点
           └─ ag- 模型 → 本地 Antigravity 凭证池 或 gcli2api 桥接
```

**问题**：
- 需要在两个地方维护 GeminiCLI 凭证
- 凭证管理逻辑重复
- 代码复杂度高

### 变更后（新架构）

```
用户请求 → CatieCli (用户管理 + 配额控制)
           ├─ 启用桥接 → gcli2api
           │              ├─ 普通模型 → GeminiCLI 凭证池
           │              └─ ag- 模型 → Antigravity 凭证池
           └─ 未启用桥接 → OpenAI 端点反代（可选）
```

**优势**：
- 凭证管理统一在 gcli2api
- CatieCli 专注于用户管理和配额控制
- 代码简洁，易于维护

## 功能支持矩阵

| 功能 | 启用 gcli2api 桥接 | 未启用桥接 |
|------|-------------------|-----------|
| **Gemini 模型** (gemini-*) | ✅ 通过 gcli2api | ❌ 需配置 OpenAI 端点 |
| **Antigravity 模型** (ag-*) | ✅ 通过 gcli2api | ❌ 需配置 OpenAI 端点或本地凭证 |
| **OpenAI 端点反代** | ✅ 支持 | ✅ 支持 |
| **Gemini 原生接口** (/v1beta) | ✅ 通过 gcli2api | ❌ 不支持 |
| **用户管理** | ✅ | ✅ |
| **配额控制** | ✅ | ✅ |

## 详细变更内容

### 1. 删除的功能

#### 1.1 `/v1/chat/completions` 端点
- ❌ **删除**：自带的 GeminiCLI 凭证池处理逻辑（约270行代码）
- ✅ **保留**：gcli2api 桥接逻辑
- ✅ **保留**：OpenAI 端点反代逻辑
- ✅ **新增**：ag- 前缀模型自动路由到 gcli2api 的 Antigravity 端点

#### 1.2 `/v1beta/models/{model}:generateContent` 端点
- ❌ **删除**：自带的 GeminiCLI 凭证池处理逻辑（约130行代码）
- ✅ **保留**：gcli2api 桥接逻辑
- ✅ **新增**：未启用桥接时返回明确错误提示

#### 1.3 `/v1beta/models/{model}:streamGenerateContent` 端点
- ❌ **删除**：自带的 GeminiCLI 凭证池处理逻辑（约180行代码）
- ✅ **保留**：gcli2api 桥接逻辑
- ✅ **新增**：未启用桥接时返回明确错误提示

### 2. 保留的功能

#### 2.1 OpenAI 端点反代
- ✅ 完全保留，无任何变更
- 支持配置多个 OpenAI 兼容端点
- 支持优先级和故障转移

#### 2.2 Antigravity 本地凭证支持
- ✅ 保留本地 Antigravity 凭证处理（未启用桥接时）
- 通过 `/antigravity/v1/chat/completions` 端点访问

#### 2.3 用户管理和配额控制
- ✅ 完全保留
- 用户注册、登录、权限管理
- 每日配额、速率限制
- 使用日志记录

### 3. 新增的功能

#### 3.1 智能模型路由
```python
# 启用 gcli2api 桥接时
if model.startswith("ag-"):
    # ag- 前缀 → gcli2api /antigravity/v1/chat/completions
    bridge_path = "/antigravity/v1/chat/completions"
else:
    # 普通模型 → gcli2api /v1/chat/completions
    bridge_path = "/v1/chat/completions"
```

#### 3.2 明确的错误提示
```python
# 未启用桥接时
raise HTTPException(
    status_code=503,
    detail="模型 {model} 需要配置 OpenAI 端点或启用 gcli2api 桥接。\n"
           "请在后台添加 OpenAI 兼容的 API 端点，或在 .env 中设置 ENABLE_GCLI2API_BRIDGE=true"
)
```

## 迁移指南

### 方案A：启用 gcli2api 桥接（推荐）

1. **安装并配置 gcli2api**
   ```bash
   # 克隆 gcli2api 项目
   git clone https://github.com/your-repo/gcli2api.git
   cd gcli2api

   # 配置环境变量
   cp .env.example .env
   # 编辑 .env，设置 API_PASSWORD 和 PANEL_PASSWORD

   # 启动 gcli2api
   python web.py
   ```

2. **配置 CatieCli**
   ```env
   # backend/.env
   ENABLE_GCLI2API_BRIDGE=true
   GCLI2API_BASE_URL=http://localhost:7861
   GCLI2API_API_PASSWORD=your_api_password
   GCLI2API_PANEL_PASSWORD=your_panel_password
   ```

3. **迁移凭证**
   - 将 CatieCli 中的 GeminiCLI 凭证迁移到 gcli2api
   - 在 gcli2api 控制面板中添加凭证

4. **测试**
   ```bash
   # 测试普通模型
   curl -X POST http://localhost:10601/v1/chat/completions \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -d '{"model": "gemini-2.5-flash", "messages": [{"role": "user", "content": "Hello"}]}'

   # 测试 ag- 模型
   curl -X POST http://localhost:10601/v1/chat/completions \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -d '{"model": "ag-claude-sonnet-4-5", "messages": [{"role": "user", "content": "Hello"}]}'
   ```

### 方案B：仅使用 OpenAI 端点反代

1. **配置 CatieCli**
   ```env
   # backend/.env
   ENABLE_GCLI2API_BRIDGE=false
   ```

2. **在后台添加 OpenAI 端点**
   - 登录 CatieCli 管理后台
   - 进入"OpenAI 端点管理"
   - 添加 OpenAI 兼容的 API 端点（如 OpenAI、Azure OpenAI、其他反代等）

3. **限制**
   - ❌ 无法使用 Gemini 原生接口 (`/v1beta`)
   - ❌ 无法使用 GeminiCLI 凭证池
   - ✅ 可以使用 OpenAI 端点反代所有模型

## 配置说明

### 环境变量

```env
# ================================================================
# gcli2api 桥接配置（必需）
# ================================================================
# 重要：CatieCli 已移除自带的 GeminiCLI 凭证池功能
# 必须启用 gcli2api 桥接才能使用 Gemini 模型和 Antigravity 模型
# ================================================================

# 是否启用 gcli2api 桥接模式
# true: 将 GeminiCLI、Antigravity 功能桥接到 gcli2api 项目（推荐）
# false: 仅支持 OpenAI 端点反代（需在后台配置 OpenAI 端点）
ENABLE_GCLI2API_BRIDGE=true

# gcli2api 服务地址
GCLI2API_BASE_URL=http://localhost:7861

# gcli2api API 密码 (用于调用聊天接口)
GCLI2API_API_PASSWORD=your_password

# gcli2api 面板密码 (用于调用管理接口)
GCLI2API_PANEL_PASSWORD=your_panel_password
```

## 代码变更统计

| 文件 | 删除行数 | 新增行数 | 净变化 |
|------|---------|---------|--------|
| `backend/app/routers/proxy.py` | ~580 | ~30 | -550 |
| `backend/.env.example` | 5 | 10 | +5 |
| **总计** | **585** | **40** | **-545** |

## 影响范围

### 对用户的影响

1. **需要配置 gcli2api**
   - 如果要使用 Gemini 模型，必须部署并配置 gcli2api
   - 或者配置 OpenAI 端点作为替代

2. **凭证迁移**
   - 需要将现有的 GeminiCLI 凭证从 CatieCli 迁移到 gcli2api

3. **API 兼容性**
   - ✅ 所有 API 端点保持不变
   - ✅ 请求格式完全兼容
   - ✅ 响应格式完全兼容

### 对开发者的影响

1. **代码简化**
   - 删除了约550行凭证池管理代码
   - 降低了维护成本

2. **架构清晰**
   - CatieCli：用户管理 + 配额控制
   - gcli2api：凭证管理 + 模型调用

3. **扩展性提升**
   - 更容易添加新的模型支持
   - 更容易集成其他服务

## 常见问题 (FAQ)

### Q1: 为什么要删除自带的 GeminiCLI 凭证池？
**A**: 避免功能重复，统一凭证管理，简化架构，降低维护成本。

### Q2: 如果不想使用 gcli2api，还能用 CatieCli 吗？
**A**: 可以，但只能使用 OpenAI 端点反代功能，无法使用 Gemini 原生接口。

### Q3: 现有的凭证会丢失吗？
**A**: 不会。凭证数据仍保存在数据库中，需要手动迁移到 gcli2api。

### Q4: API 接口会变化吗？
**A**: 不会。所有 API 端点和请求/响应格式保持完全兼容。

### Q5: 性能会受影响吗？
**A**: 启用桥接会增加一层网络请求，但 gcli2api 提供了更好的轮询和负载均衡，整体性能可能更好。

### Q6: 可以同时使用桥接和 OpenAI 端点吗？
**A**: 可以。启用桥接后，仍然可以配置 OpenAI 端点作为备用。

## 回滚方案

如果需要回滚到旧版本：

```bash
# 恢复备份文件
cd backend/app/routers
mv proxy.py.backup proxy.py

# 或者使用 git 回滚
git checkout HEAD~1 backend/app/routers/proxy.py
git checkout HEAD~1 backend/.env.example
```

## 相关文档

- [gcli2api 项目](https://github.com/your-repo/gcli2api)
- [桥接功能修复说明](./BRIDGE_FIX_SUMMARY.md)
- [配置文件示例](./backend/.env.example)

## 技术支持

如有问题，请：
1. 查看本文档的 FAQ 部分
2. 查看 [BRIDGE_FIX_SUMMARY.md](./BRIDGE_FIX_SUMMARY.md)
3. 提交 Issue 到项目仓库

---

**变更完成日期**: 2026-01-08
**文档版本**: 1.0
**维护者**: CatieCli 开发团队
