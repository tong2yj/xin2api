# 🚀 Antigravity 反代功能说明

## 📋 功能概述

Antigravity 是 Google 内部的 AI API 服务，支持 Gemini 和 Claude 模型。CatieCli 现已集成 Antigravity 反代功能，提供：

- ✅ **OpenAI 兼容接口**：无缝替换 OpenAI API
- ✅ **Gemini 原生接口**：支持 Gemini 官方格式
- ✅ **统一认证**：使用 CatieCli 的 API Key (`cat-xxx`)
- ✅ **权限管理**：管理员/普通用户权限区分
- ✅ **配额控制**：管理员无限制，普通用户受配额限制
- ✅ **使用日志**：所有请求记录到后台，可查看统计

---

## 🔑 认证方式

### 使用 CatieCli API Key

Antigravity 接口完全复用 CatieCli 的认证系统，使用相同的 API Key：

```bash
# 获取 API Key
1. 登录 CatieCli 后台：http://your-domain:5001
2. 进入"仪表盘"
3. 复制你的 API Key（格式：cat-xxxxxxxx）
```

### 支持的认证方式

```bash
# 方式1：Authorization Header（推荐）
curl -H "Authorization: Bearer cat-your-api-key" ...

# 方式2：x-api-key Header
curl -H "x-api-key: cat-your-api-key" ...

# 方式3：x-goog-api-key Header（Gemini 客户端兼容）
curl -H "x-goog-api-key: cat-your-api-key" ...

# 方式4：Query 参数
curl "http://localhost:5001/antigravity/v1/chat/completions?key=cat-your-api-key" ...
```

---

## 📡 API 接口

### OpenAI 兼容接口

#### 1. Chat Completions（聊天补全）

**端点**：`POST /antigravity/v1/chat/completions`

**请求示例**：

```bash
curl http://localhost:5001/antigravity/v1/chat/completions \
  -H "Authorization: Bearer cat-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {"role": "system", "content": "你是一个有帮助的助手"},
      {"role": "user", "content": "你好"}
    ],
    "temperature": 0.7,
    "max_tokens": 2048,
    "stream": false
  }'
```

**支持的参数**：
- `model`: 模型名称（必填）
- `messages`: 消息列表（必填）
- `temperature`: 温度参数（0-2，默认 1.0）
- `top_p`: 核采样参数（0-1，默认 0.95）
- `max_tokens`: 最大输出 token 数（默认 8192）
- `stream`: 是否流式输出（默认 false）

**流式请求示例**：

```bash
curl http://localhost:5001/antigravity/v1/chat/completions \
  -H "Authorization: Bearer cat-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [{"role": "user", "content": "写一首诗"}],
    "stream": true
  }'
```

#### 2. Models List（模型列表）

**端点**：`GET /antigravity/v1/models`

**请求示例**：

```bash
curl http://localhost:5001/antigravity/v1/models \
  -H "Authorization: Bearer cat-your-api-key"
```

---

### Gemini 原生接口

#### 1. Generate Content（生成内容）

**端点**：`POST /antigravity/v1/models/{model}:generateContent`

**请求示例**：

```bash
curl http://localhost:5001/antigravity/v1/models/gemini-2.5-flash:generateContent \
  -H "Authorization: Bearer cat-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{"text": "解释量子计算"}]
      }
    ],
    "generationConfig": {
      "temperature": 0.7,
      "topP": 0.95,
      "maxOutputTokens": 2048
    }
  }'
```

#### 2. Stream Generate Content（流式生成）

**端点**：`POST /antigravity/v1/models/{model}:streamGenerateContent`

**请求示例**：

```bash
curl http://localhost:5001/antigravity/v1/models/gemini-2.5-pro:streamGenerateContent \
  -H "Authorization: Bearer cat-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{"text": "写一个故事"}]
      }
    ]
  }'
```

#### 3. List Models（Gemini 格式）

**端点**：`GET /antigravity/v1/models` 或 `GET /antigravity/v1beta/models`

---

## 🤖 支持的模型

### Gemini 系列
- `gemini-2.5-flash` - 快速响应模型
- `gemini-2.5-pro` - 高级推理模型
- `gemini-3-pro-preview` - 最新预览版本

### Claude 系列
- `claude-sonnet-4-5` - Claude Sonnet 4.5
- `claude-opus-4-5` - Claude Opus 4.5

> 注：具体可用模型取决于你的凭证权限，可通过 `/v1/models` 接口查询

---

## 👥 权限与配额

### 管理员权限

- ✅ **无限配额**：不受每日配额限制
- ✅ **访问所有凭证**：可使用公共凭证池
- ✅ **查看所有日志**：后台可查看所有用户的使用记录

### 普通用户权限

- ⚠️ **配额限制**：受每日配额限制（默认 100 次/天）
- ⚠️ **使用自己的凭证**：优先使用自己上传的凭证
- ⚠️ **公共池访问**：根据系统配置决定是否可用公共池

### 配额重置时间

- 北京时间每天 **15:00** 重置配额
- UTC 时间每天 **07:00** 重置配额

### 获得更多配额

1. **上传凭证**：通过 OAuth 授权上传 Gemini 凭证，获得奖励配额
2. **联系管理员**：管理员可在后台调整用户配额
3. **捐赠凭证**：将凭证设为公开，获得额外奖励

---

## 📊 使用日志

所有 Antigravity 请求都会记录到系统日志，管理员可在后台查看：

### 查看方式

1. 登录管理后台
2. 进入"使用日志"页面
3. 筛选条件：endpoint 包含 `/antigravity/`

### 日志内容

- 用户信息
- 使用的模型
- 请求时间
- 响应状态
- 延迟时间
- Token 使用量
- 错误信息（如有）

---

## 🔧 客户端集成示例

### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    api_key="cat-your-api-key",
    base_url="http://localhost:5001/antigravity/v1"
)

response = client.chat.completions.create(
    model="gemini-2.5-flash",
    messages=[
        {"role": "user", "content": "你好"}
    ]
)

print(response.choices[0].message.content)
```

### Python (Requests)

```python
import requests

url = "http://localhost:5001/antigravity/v1/chat/completions"
headers = {
    "Authorization": "Bearer cat-your-api-key",
    "Content-Type": "application/json"
}
data = {
    "model": "gemini-2.5-flash",
    "messages": [{"role": "user", "content": "你好"}]
}

response = requests.post(url, headers=headers, json=data)
print(response.json())
```

### JavaScript (Fetch)

```javascript
const response = await fetch('http://localhost:5001/antigravity/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer cat-your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gemini-2.5-flash',
    messages: [{ role: 'user', content: '你好' }]
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

### Node.js (OpenAI SDK)

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'cat-your-api-key',
  baseURL: 'http://localhost:5001/antigravity/v1'
});

const response = await client.chat.completions.create({
  model: 'gemini-2.5-flash',
  messages: [{ role: 'user', content: '你好' }]
});

console.log(response.choices[0].message.content);
```

---

## ⚙️ 配置说明

### 凭证池模式

在 `.env` 文件中配置：

```env
# private - 只能用自己的凭证
# tier3_shared - 3.0凭证共享池
# full_shared - 大锅饭模式（所有凭证共享）
CREDENTIAL_POOL_MODE=full_shared
```

### 配额设置

```env
# 新用户默认配额
DEFAULT_DAILY_QUOTA=100

# 凭证奖励配额
QUOTA_FLASH=1000
QUOTA_25PRO=500
QUOTA_30PRO=300
```

---

## ❓ 常见问题

### Q: Antigravity 和原来的 CLI 接口有什么区别？

**A**:
- **原 CLI 接口** (`/v1/chat/completions`)：使用 Google 公开的 Gemini API
- **Antigravity 接口** (`/antigravity/v1/chat/completions`)：使用 Google 内部 Antigravity API，支持更多模型（如 Claude）

### Q: 可以同时使用两种接口吗？

**A**: 可以！两种接口使用相同的 API Key，互不影响。

### Q: Antigravity 需要特殊的凭证吗？

**A**: 使用相同的 Gemini OAuth 凭证即可，无需额外配置。

### Q: 为什么返回 403 "没有可用的凭证"？

**A**: 请确保：
1. 已上传至少一个有效的 Gemini 凭证
2. 凭证状态为"启用"
3. 如果是普通用户，检查凭证池模式配置

### Q: 如何查看我的配额使用情况？

**A**: 登录后台 → 仪表盘 → 查看"今日使用量"

---

## 🔒 安全建议

1. **保护 API Key**：不要在公开代码中硬编码 API Key
2. **使用 HTTPS**：生产环境务必启用 HTTPS
3. **定期轮换**：定期重新生成 API Key
4. **监控日志**：定期检查异常请求
5. **限制权限**：普通用户不要给予管理员权限

---

## 📞 技术支持

如有问题，请：
1. 查看测试文档：`ANTIGRAVITY_TEST.md`
2. 检查后台日志：管理后台 → 使用日志
3. 提交 Issue：https://github.com/mzrodyu/CatieCli/issues

---

## 🎉 更新日志

### v1.0.0 (2026-01-05)
- ✅ 首次发布 Antigravity 反代功能
- ✅ 支持 OpenAI 兼容接口
- ✅ 支持 Gemini 原生接口
- ✅ 完全集成 CatieCli 认证系统
- ✅ 支持管理员/用户权限区分
- ✅ 支持配额管理和使用日志
