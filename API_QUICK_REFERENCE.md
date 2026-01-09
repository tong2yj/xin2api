# CatieCli API 调用限制逻辑 - 快速参考

## 一、用户限制逻辑（3 层验证）

```
┌─────────────────────────────────────────────────────────────┐
│                    用户发起 API 请求                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  第 1 层：API Key 验证                                        │
│  ✓ 提取 API Key（4 种方式）                                   │
│  ✓ 验证 Key 存在于数据库                                      │
│  ✓ 检查用户账户激活状态                                       │
│  ✗ 失败 → 401/403 错误                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  第 2 层：配额检查（仅 POST 请求）                             │
│  ✓ 计算今日已使用次数                                         │
│  ✓ 对比每日配额限制                                          │
│  ✓ GET 请求跳过此步骤                                        │
│  ✗ 超额 → 429 错误                                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  第 3 层：请求转发                                            │
│  ✓ 根据模型类型选择转发目标                                   │
│  ✓ 记录使用日志                                              │
│  ✓ 返回响应                                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、三种模式对比

### 1. GeminiCLI 模式（主要）

```
用户请求 (model="gemini-2.5-flash")
    ↓
验证 API Key + 检查配额
    ↓
转发到 gcli2api: /v1/chat/completions
    ↓
gcli2api 选择 GeminiCLI 凭证
    ↓
调用 Google Gemini API
    ↓
返回响应 + 记录日志
```

**特点**:
- ✅ 模型无前缀（如 `gemini-2.5-flash`）
- ✅ 使用 GeminiCLI 凭证池
- ✅ 支持 Gemini 2.5/3.0 全系列模型
- ✅ 支持 Thinking、Search 变体

---

### 2. Antigravity 模式（主要）

```
用户请求 (model="ag-gemini-2.5-flash")
    ↓
验证 API Key + 检查配额
    ↓
转发到 gcli2api: /antigravity/v1/chat/completions
    ↓
gcli2api 选择 Antigravity 凭证
    ↓
调用 Google Antigravity API
    ↓
返回响应 + 记录日志
```

**特点**:
- ✅ 模型以 `ag-` 开头（如 `ag-gemini-2.5-flash`）
- ✅ 使用 Antigravity 凭证池
- ✅ 支持 Gemini + Claude 模型
- ✅ 更高配额、实验性功能

---

### 3. OpenAI 模式（备用）

```
用户请求 (任意模型)
    ↓
验证 API Key + 检查配额
    ↓
查询后台配置的 OpenAI 端点
    ↓
按优先级遍历端点
    ├─ 端点 1: 尝试调用
    │   ├─ 成功 → 返回
    │   └─ 失败 → 下一个
    ├─ 端点 2: 尝试调用
    └─ 所有失败 → 503 错误
```

**特点**:
- ⚠️ 需要后台配置端点
- ⚠️ 当前版本仅作备用
- ✅ 支持任意 OpenAI 兼容 API
- ✅ 多端点自动切换

---

## 三、配额计算规则

### 配额字段

| 字段 | 说明 | 默认值 |
|------|------|--------|
| `daily_quota` | 每日配额（次数） | 100 |
| `current_usage` | 今日已用次数 | 实时统计 |

### 重置时间

**北京时间每天 15:00（UTC 07:00）**

```python
# 示例
当前时间: 2026-01-09 18:00 (北京时间)
重置时间: 2026-01-09 15:00 (北京时间)
统计范围: 2026-01-09 15:00 ~ 现在
```

### 配额消耗

- ✅ 每次成功请求 = -1 次配额
- ✅ 失败请求也消耗配额（已检查）
- ❌ GET 请求不消耗配额

### 配额增加

**方式 1**: 管理员手动调整
```
后台 → 用户管理 → 修改配额
```

**方式 2**: 上传凭证奖励
```
新凭证 + 公共池 = +1000 次配额
```

---

## 四、模型路由规则

### 模型前缀识别

```python
# GeminiCLI 模式（无前缀）
"gemini-2.5-flash"
"gemini-2.5-pro"
"gemini-3-pro-preview"
"gemini-2.5-flash-maxthinking"
"gemini-2.5-flash-search"

# Antigravity 模式（ag- 前缀）
"ag-gemini-2.5-flash"
"ag-gemini-3-pro-preview"
"ag-claude-sonnet-4-5"
"ag-claude-opus-4-5-thinking"

# OpenAI 模式（任意，需配置端点）
"gpt-4"
"deepseek-chat"
"qwen-max"
```

### 转发路径映射

| 模型类型 | 转发路径 | 凭证池 |
|---------|---------|--------|
| `gemini-*` | `/v1/chat/completions` | GeminiCLI |
| `ag-*` | `/antigravity/v1/chat/completions` | Antigravity |
| 其他 | `/chat/completions` | OpenAI 端点 |

---

## 五、日志记录

### 记录内容

```python
UsageLog {
    user_id: 123,
    model: "gemini-2.5-flash",
    endpoint: "/v1/chat/completions (gcli2api)",
    status_code: 200,
    latency_ms: 1234.5,
    client_ip: "1.2.3.4",
    user_agent: "curl/7.68.0",
    created_at: "2026-01-09 10:00:00"
}
```

### 记录时机

- ✅ 每次 API 调用（成功或失败）
- ✅ 流式响应完成后
- ✅ 错误发生时

### 用途

1. **配额统计**: 计算 `current_usage`
2. **日志查看**: 管理员查看全局日志
3. **个人统计**: 用户查看调用历史
4. **错误分析**: 分类错误类型

---

## 六、错误处理

### 常见错误码

| 状态码 | 说明 | 原因 |
|-------|------|------|
| 401 | 未授权 | API Key 无效或未提供 |
| 403 | 禁止访问 | 账户被禁用 |
| 429 | 配额耗尽 | 超过每日配额限制 |
| 503 | 服务不可用 | 所有端点都失败 |

### 错误响应示例

```json
// 401 错误
{
  "detail": "无效的API Key"
}

// 429 错误
{
  "detail": "已达到每日配额限制 (100/100)"
}

// 503 错误
{
  "detail": "所有 OpenAI 端点都失败了。最后错误: ..."
}
```

---

## 七、快速诊断流程

### 用户无法调用 API

```
1. 检查 API Key 是否正确
   → curl -H "Authorization: Bearer cat-xxx" http://localhost:10601/v1/models

2. 检查账户状态
   → 后台 → 用户管理 → 查看 is_active

3. 检查配额
   → 后台 → 用户管理 → 查看 daily_quota 和使用记录

4. 检查 gcli2api 服务
   → curl http://localhost:7861/health

5. 查看日志
   → 后台 → 日志查看 → 筛选该用户
```

### 配额异常消耗

```
1. 查看使用日志
   → 后台 → 日志查看 → 按时间筛选

2. 检查是否有失败请求
   → 失败请求也消耗配额

3. 检查重置时间
   → 确认是否在当前周期内

4. 手动调整配额
   → 后台 → 用户管理 → 修改配额
```

---

## 八、性能优化建议

### 1. 配额检查优化

**当前**: 每次请求都查询数据库统计
```python
current_usage = await db.execute(
    select(func.count(UsageLog.id))
    .where(UsageLog.user_id == user.id)
    .where(UsageLog.created_at >= start_of_day)
)
```

**优化**: 使用 Redis 缓存
```python
# 伪代码
current_usage = await redis.get(f"quota:{user.id}:{today}")
if current_usage is None:
    current_usage = await db.execute(...)
    await redis.set(f"quota:{user.id}:{today}", current_usage, ex=86400)
```

### 2. 日志写入优化

**当前**: 同步写入数据库
```python
db.add(log)
await db.commit()
```

**优化**: 异步队列
```python
# 伪代码
await log_queue.put(log)  # 后台任务批量写入
```

### 3. 模型列表缓存

**当前**: 5 分钟缓存
```python
MODELS_CACHE_TTL = 300  # 5分钟
```

**优化**: 可配置缓存时间
```python
MODELS_CACHE_TTL = settings.models_cache_ttl  # 从配置读取
```

---

## 九、安全建议

### 1. API Key 保护

- ✅ 使用 HTTPS
- ✅ 定期轮换 API Key
- ✅ 限制 API Key 权限

### 2. 配额限制

- ✅ 设置合理的默认配额
- ✅ 监控异常使用
- ✅ 实施速率限制（未实现）

### 3. 日志安全

- ✅ 截断敏感信息（已实现，2000 字符）
- ✅ 定期清理旧日志（未实现）
- ✅ 加密存储（未实现）

---

**快速参考版本**: v2.0
**完整文档**: 参见 `API_USAGE_FLOW.md`
