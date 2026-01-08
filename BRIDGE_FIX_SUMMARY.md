# gcli2api 桥接功能修复说明

## 修复日期
2026-01-08

## 问题描述

在启用 `enable_gcli2api_bridge=true` 时，CatieCli 的桥接功能存在以下问题：

### 修复前的问题
- **所有模型**（包括普通模型和 ag- 前缀模型）都被转发到 gcli2api 的 `/v1/chat/completions` 端点
- 这导致 ag- 前缀模型无法使用 gcli2api 的 Antigravity 凭证池
- 因为 `/v1/chat/completions` 只能访问 GeminiCLI 凭证池，不能访问 Antigravity 凭证池

## 修复内容

### 修改文件
- `backend/app/routers/proxy.py` (第511-583行)

### 修复逻辑

在 `/v1/chat/completions` 端点的 gcli2api 桥接部分添加了模型前缀判断：

```python
# 根据模型前缀选择不同的转发端点
if model.startswith("ag-"):
    # ag- 前缀模型转发到 antigravity 端点（使用 Antigravity 凭证池）
    bridge_path = "/antigravity/v1/chat/completions"
    bridge_endpoint_name = "/antigravity/v1/chat/completions (gcli2api)"
    log_info("Bridge", f"[gcli2api] Antigravity 转发: {model}, stream={stream}")
else:
    # 普通模型转发到标准端点（使用 GeminiCLI 凭证池）
    bridge_path = "/v1/chat/completions"
    bridge_endpoint_name = "/v1/chat/completions (gcli2api)"
    log_info("Bridge", f"[gcli2api] GeminiCLI 转发: {model}, stream={stream}")
```

## 修复后的行为

### 1. 普通模型（gemini-*, gpt-*, 等）
- **路由**: CatieCli `/v1/chat/completions` → gcli2api `/v1/chat/completions`
- **凭证**: 使用 gcli2api 的 **GeminiCLI 凭证池**（轮询）
- **示例**: `gemini-2.5-flash`, `gemini-2.5-pro`, `gpt-4` 等

### 2. ag- 前缀模型（ag-gemini-*, ag-claude-*, 等）
- **路由**: CatieCli `/v1/chat/completions` → gcli2api `/antigravity/v1/chat/completions`
- **凭证**: 使用 gcli2api 的 **Antigravity 凭证池**
- **示例**: `ag-gemini-2.5-flash`, `ag-claude-sonnet-4-5`, `ag-gemini-3-pro-preview` 等

### 3. Gemini 原生接口
- **路由**: CatieCli `/v1beta/models/{model}:generateContent` → gcli2api `/v1beta/models/{model}:generateContent`
- **凭证**: 使用 gcli2api 的 **GeminiCLI 凭证池**
- **无需修改**: 此部分已经是正确的

### 4. Antigravity 直接调用（不通过 proxy.py）
- **路由**: CatieCli `/antigravity/v1/chat/completions` → gcli2api `/antigravity/v1/chat/completions`
- **凭证**: 使用 gcli2api 的 **Antigravity 凭证池**
- **无需修改**: 此部分已经是正确的

## gcli2api 端点说明

### gcli2api 提供的端点

1. **OpenAI 兼容端点** (使用 GeminiCLI 凭证)
   - `/v1/models`
   - `/v1/chat/completions`

2. **Gemini 原生端点** (使用 GeminiCLI 凭证)
   - `/v1beta/models`
   - `/v1beta/models/{model}:generateContent`
   - `/v1beta/models/{model}:streamGenerateContent`

3. **Antigravity 端点** (使用 Antigravity 凭证)
   - `/antigravity/v1/models`
   - `/antigravity/v1/chat/completions`
   - `/antigravity/v1beta/models/{model}:generateContent`
   - `/antigravity/v1beta/models/{model}:streamGenerateContent`

## 配置说明

### 启用 gcli2api 桥接

在 `backend/.env` 中配置：

```env
# 启用 gcli2api 桥接
ENABLE_GCLI2API_BRIDGE=true

# gcli2api 服务地址
GCLI2API_BASE_URL=http://localhost:7861

# gcli2api 的 API 密码（用于聊天接口）
GCLI2API_API_PASSWORD=your_api_password

# gcli2api 的面板密码（用于管理接口）
GCLI2API_PANEL_PASSWORD=your_panel_password
```

### 工作流程

1. 用户请求 CatieCli 的 `/v1/chat/completions` 端点
2. CatieCli 检查 `enable_gcli2api_bridge` 配置
3. 如果启用桥接：
   - 检查模型前缀
   - 选择对应的 gcli2api 端点
   - 转发请求到 gcli2api
   - gcli2api 使用对应的凭证池处理请求
4. 如果未启用桥接：
   - 使用 CatieCli 本地的凭证池或 OpenAI 端点

## 测试建议

### 测试普通模型
```bash
curl -X POST http://localhost:10601/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### 测试 ag- 前缀模型
```bash
curl -X POST http://localhost:10601/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ag-claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### 验证日志

检查 CatieCli 日志，应该看到：
- 普通模型: `[gcli2api] GeminiCLI 转发: gemini-2.5-flash`
- ag- 模型: `[gcli2api] Antigravity 转发: ag-claude-sonnet-4-5`

## 注意事项

1. **gcli2api 必须正确配置**：确保 gcli2api 服务正在运行，并且已经配置了对应的凭证池
2. **凭证池要求**：
   - 使用普通模型需要在 gcli2api 中配置 GeminiCLI 凭证
   - 使用 ag- 前缀模型需要在 gcli2api 中配置 Antigravity 凭证
3. **日志记录**：修复后的代码会在日志中记录正确的端点名称，便于追踪和调试

## 相关文件

- `backend/app/routers/proxy.py` - 主要修复文件
- `backend/app/routers/antigravity.py` - Antigravity 路由（已正确）
- `backend/app/services/gcli2api_bridge.py` - 桥接服务（无需修改）
- `backend/app/config.py` - 配置文件（无需修改）
