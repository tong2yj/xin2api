# Antigravity 反代功能

## 📋 概述

Antigravity是Google提供的另一个Gemini API服务端点，支持更多模型（包括Claude系列）。本项目已集成Antigravity反代功能。

## 🎯 支持的模型

### Gemini 系列（10个）
- `ag-gemini-2.5-pro` - Gemini 2.5 Pro
- `ag-gemini-2.5-flash` - Gemini 2.5 Flash
- `ag-gemini-2.5-flash-thinking` - Gemini 2.5 Flash Thinking
- `ag-gemini-3-pro-preview` - Gemini 3.0 Pro Preview ⭐
- `ag-gemini-3-flash-preview` - Gemini 3.0 Flash Preview ⭐
- `ag-gemini-3-pro-low` - Gemini 3.0 Pro Low
- `ag-gemini-3-pro-high` - Gemini 3.0 Pro High
- `ag-gemini-3-pro-image` - Gemini 3.0 Pro Image
- `ag-gemini-2.5-flash-lite` - Gemini 2.5 Flash Lite
- `ag-gemini-2.5-flash-image` - Gemini 2.5 Flash Image

### Claude 系列（3个）
- `ag-claude-sonnet-4-5` - Claude Sonnet 4.5
- `ag-claude-sonnet-4-5-thinking` - Claude Sonnet 4.5 Thinking ⭐
- `ag-claude-opus-4-5-thinking` - Claude Opus 4.5 Thinking ⭐

**注意**：所有Antigravity模型名称都以 `ag-` 前缀开头。

## 🔑 获取Antigravity凭证

### 方式一：网页OAuth（推荐）

1. 访问 `/oauth` 页面
2. 选择 **"Antigravity 反代"** 选项卡
3. 点击 **"获取 Antigravity 凭证"** 按钮
4. 在弹出的Google登录窗口中授权
5. 系统会自动保存凭证并验证

### 方式二：手动添加

暂不支持手动添加Antigravity凭证（需要OAuth流程）。

## 📊 OAuth配置

### Antigravity专用配置

```python
# backend/app/config.py
antigravity_client_id = "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com"
antigravity_client_secret = "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"
antigravity_api_url = "https://daily-cloudcode-pa.sandbox.googleapis.com"
```

### OAuth Scopes

Antigravity需要以下5个权限：
```python
ANTIGRAVITY_SCOPES = [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/generative-language.tuning",
    "https://www.googleapis.com/auth/generative-language.retriever",
    "https://www.googleapis.com/auth/cclog",
    "https://www.googleapis.com/auth/experimentsandconfigs",
]
```

## 🚀 API使用

### 统一端点

所有模型（Gemini CLI和Antigravity）使用相同的API端点：

```bash
POST http://your-domain/v1/chat/completions
```

### 请求示例

```bash
curl -X POST http://localhost:5002/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ag-gemini-3-pro-preview",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

### Claude模型示例

```bash
curl -X POST http://localhost:5002/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ag-claude-sonnet-4-5-thinking",
    "messages": [
      {"role": "user", "content": "解释量子计算"}
    ],
    "max_tokens": 4096
  }'
```

## 🔄 路由机制

系统会自动根据模型名称前缀路由请求：

- **无前缀** (如 `gemini-2.5-flash`) → Gemini CLI API
- **`ag-` 前缀** (如 `ag-gemini-3-pro-preview`) → Antigravity API

```python
# backend/app/routers/proxy.py
if model.startswith("ag-"):
    # 路由到Antigravity
    return await handle_chat_completions_antigravity(...)
else:
    # 路由到Gemini CLI
    return await handle_chat_completions_gemini(...)
```

## 📝 凭证管理

### 凭证类型标识

Antigravity凭证在数据库中标记为：
```python
credential_type = "oauth_antigravity"
```

### 凭证验证

系统会自动验证Antigravity凭证的有效性：
- 测试调用 `ag-gemini-2.5-flash` 模型
- 检查响应状态码
- 自动标记凭证为有效/无效

### 凭证刷新

Antigravity凭证支持自动刷新（使用refresh_token）。

## ⚙️ 技术实现

### 核心文件

1. **`backend/app/routers/antigravity.py`**
   - Antigravity API调用逻辑
   - 请求/响应转换
   - 错误处理

2. **`backend/app/routers/oauth.py`**
   - Antigravity OAuth流程
   - 凭证获取和保存
   - 动态配置选择

3. **`backend/app/routers/proxy.py`**
   - 统一API端点
   - 模型前缀路由
   - 模型列表返回

4. **`frontend/src/pages/OAuth.jsx`**
   - 双选项卡UI（Gemini CLI / Antigravity）
   - OAuth窗口管理
   - 凭证状态显示

### API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/oauth/auth-url-antigravity` | GET | 获取Antigravity OAuth授权URL |
| `/api/oauth/callback-antigravity` | POST | 处理Antigravity OAuth回调 |
| `/v1/chat/completions` | POST | 统一聊天完成端点 |
| `/v1/models` | GET | 获取可用模型列表 |

## 🧪 测试

### 测试Antigravity凭证

```bash
# 1. 获取凭证后，测试Gemini模型
curl -X POST http://localhost:5002/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ag-gemini-3-pro-preview",
    "messages": [{"role": "user", "content": "测试"}]
  }'

# 2. 测试Claude模型
curl -X POST http://localhost:5002/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ag-claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "测试"}]
  }'
```

### 查看可用模型

```bash
curl http://localhost:5002/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## ⚠️ 注意事项

1. **凭证要求**
   - 必须通过OAuth获取
   - 需要Google账号授权
   - 不支持手动添加API Key

2. **模型限制**
   - Claude模型需要特定权限
   - 某些模型可能需要付费账号
   - 请求频率受Google限制

3. **配额计算**
   - Antigravity凭证与Gemini CLI凭证配额分开计算
   - 上传Antigravity凭证可获得额外配额奖励

4. **错误处理**
   - 401/403错误：凭证无效或权限不足
   - 429错误：请求频率过高
   - 500错误：Antigravity服务异常

## 📚 相关文档

- [TEST_GUIDE.md](./TEST_GUIDE.md) - 完整测试指南
- [LOCAL_TEST_GUIDE.md](./LOCAL_TEST_GUIDE.md) - 本地测试指南
- [README.md](./README.md) - 项目主文档

---

**更新日期**: 2026-01-05
**版本**: 1.0
