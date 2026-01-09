# CatieCli API 调用限制逻辑与工作流程详解

## 目录
1. [用户限制逻辑](#用户限制逻辑)
2. [GeminiCLI 模式工作流程](#geminicli-模式工作流程)
3. [Antigravity 模式工作流程](#antigravity-模式工作流程)
4. [OpenAI 模式工作流程](#openai-模式工作流程)
5. [配额计算详解](#配额计算详解)
6. [日志记录机制](#日志记录机制)

---

## 用户限制逻辑

### 1. API Key 验证流程

**代码位置**: `backend/app/routers/proxy.py:47-120`

#### 步骤 1: 提取 API Key

支持 4 种方式提取 API Key（按优先级）：

```python
# 优先级 1: Authorization Header
Authorization: Bearer cat-xxxxxx

# 优先级 2: x-api-key Header
x-api-key: cat-xxxxxx

# 优先级 3: x-goog-api-key Header (兼容 Gemini 原生客户端)
x-goog-api-key: cat-xxxxxx

# 优先级 4: 查询参数
?key=cat-xxxxxx
```

**代码**:
```python
# proxy.py:51-66
auth_header = request.headers.get("Authorization", "")
if auth_header.startswith("Bearer "):
    api_key = auth_header[7:]

if not api_key:
    api_key = request.headers.get("x-api-key")

if not api_key:
    api_key = request.headers.get("x-goog-api-key")

if not api_key:
    api_key = request.query_params.get("key")
```

#### 步骤 2: 验证 API Key 有效性

```python
# proxy.py:72-79
user = await get_user_by_api_key(db, api_key)
if not user:
    raise HTTPException(status_code=401, detail="无效的API Key")

if not user.is_active:
    raise HTTPException(status_code=403, detail="账户已被禁用")
```

**验证点**:
- ✅ API Key 存在于数据库
- ✅ 关联的用户账户存在
- ✅ 用户账户未被禁用（`is_active=True`）

#### 步骤 3: 检查配额（仅 POST 请求）

**GET 请求（如 `/v1/models`）不检查配额**:
```python
# proxy.py:81-83
if request.method == "GET":
    return user  # 直接返回，不检查配额
```

**POST 请求检查每日配额**:

```python
# proxy.py:85-117
# 1. 计算配额重置时间（北京时间 15:00 = UTC 07:00）
now = datetime.utcnow()
reset_time_utc = now.replace(hour=7, minute=0, second=0, microsecond=0)
if now < reset_time_utc:
    start_of_day = reset_time_utc - timedelta(days=1)
else:
    start_of_day = reset_time_utc

# 2. 统计今日已使用次数
total_usage_result = await db.execute(
    select(func.count(UsageLog.id))
    .where(UsageLog.user_id == user.id)
    .where(UsageLog.created_at >= start_of_day)
)
current_usage = total_usage_result.scalar() or 0

# 3. 检查是否超过配额
if current_usage >= user.daily_quota:
    raise HTTPException(
        status_code=429,
        detail=f"已达到每日配额限制 ({current_usage}/{user.daily_quota})"
    )
```

---

### 2. 配额限制规则

#### 配额类型

| 字段 | 说明 | 默认值 | 配置位置 |
|------|------|--------|---------|
| `user.daily_quota` | 用户每日配额（次数） | 100 | `config.py:35` |
| `current_usage` | 今日已使用次数 | 0 | 实时统计 |

#### 配额重置时间

**北京时间每天 15:00 重置**（UTC 07:00）

**为什么选择 15:00？**
- 避开高峰期（上午工作时间）
- 给用户一天的使用时间
- 与 Google 配额重置时间对齐

**计算逻辑**:
```python
# 示例 1: 当前时间 2026-01-09 10:00 UTC (北京时间 18:00)
# reset_time_utc = 2026-01-09 07:00
# now (10:00) > reset_time_utc (07:00)
# start_of_day = 2026-01-09 07:00  ← 今天的重置时间

# 示例 2: 当前时间 2026-01-09 05:00 UTC (北京时间 13:00)
# reset_time_utc = 2026-01-09 07:00
# now (05:00) < reset_time_utc (07:00)
# start_of_day = 2026-01-08 07:00  ← 昨天的重置时间
```

#### 配额消耗规则

**每次成功的 API 调用消耗 1 次配额**:
- ✅ 成功的聊天请求（200 状态码）
- ✅ 流式响应完成
- ❌ 失败的请求**不消耗配额**（记录日志但不计入 usage）

**重要**: 配额检查在**请求前**进行，即使请求失败也不会"退款"。

---

### 3. 用户状态检查

#### 账户状态字段

| 字段 | 类型 | 说明 | 影响 |
|------|------|------|------|
| `is_active` | Boolean | 账户是否激活 | `False` 时无法调用 API |
| `is_approved` | Boolean | 是否通过审核 | 不影响 API 调用（仅前端提示） |
| `is_admin` | Boolean | 是否管理员 | 不影响配额限制 |

**注意**: `is_approved` 字段仅用于前端显示提示，不影响 API 调用权限。

---

## GeminiCLI 模式工作流程

### 1. 模型识别

**触发条件**: 模型名称**不以 `ag-` 开头**

**支持的模型**:
```python
# proxy.py:365-395
base_models = [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-3-pro-preview",
    "gemini-3-flash-preview",
]

# 变体后缀
thinking_suffixes = ["-maxthinking", "-nothinking"]
search_suffix = "-search"

# 组合示例
"gemini-2.5-flash"                    # 基础模型
"gemini-2.5-flash-maxthinking"        # Thinking 变体
"gemini-2.5-flash-search"             # Search 变体
"gemini-2.5-flash-maxthinking-search" # 组合变体
"gemini-2.5-flash-image"              # 图像模型
```

---

### 2. 请求流程（gcli2api 桥接模式）

**代码位置**: `proxy.py:509-580`

#### 流程图

```
用户请求
    ↓
验证 API Key (get_user_from_api_key)
    ↓
检查配额 (current_usage < daily_quota)
    ↓
解析请求体 (model, messages, stream)
    ↓
判断模型类型 (不以 ag- 开头)
    ↓
转发到 gcli2api: /v1/chat/completions
    ↓
gcli2api 处理请求
    ├─ 选择可用的 GeminiCLI 凭证
    ├─ 调用 Google Gemini API
    ├─ 处理响应（流式/非流式）
    └─ 返回结果
    ↓
CatieCli 记录使用日志
    ↓
返回响应给用户
```

#### 详细步骤

**步骤 1: 验证和配额检查**
```python
# 由 Depends(get_user_from_api_key) 自动执行
# 1. 提取 API Key
# 2. 验证用户
# 3. 检查配额（如果是 POST 请求）
```

**步骤 2: 解析请求**
```python
# proxy.py:491-507
body = await request.json()
model = body.get("model", "gemini-2.5-flash")
messages = body.get("messages", [])
stream = body.get("stream", False)

if not messages:
    raise HTTPException(status_code=400, detail="messages不能为空")
```

**步骤 3: 转发到 gcli2api**
```python
# proxy.py:519-523
bridge_path = "/v1/chat/completions"
bridge_endpoint_name = "/v1/chat/completions (gcli2api)"
log_info("Bridge", f"[gcli2api] GeminiCLI 转发: {model}, stream={stream}")
```

**步骤 4: 处理响应**

**流式响应**:
```python
# proxy.py:526-549
if stream:
    response = await gcli2api_bridge.forward_stream(
        path=bridge_path,
        json_data=body
    )

    # 记录日志（异步，不阻塞）
    log = UsageLog(
        user_id=user.id,
        model=model,
        endpoint=bridge_endpoint_name,
        status_code=200,
        latency_ms=round((time.time() - start_time) * 1000, 1),
        client_ip=client_ip,
        user_agent=user_agent
    )
    db.add(log)
    await db.commit()

    return response  # StreamingResponse
```

**非流式响应**:
```python
# proxy.py:550-580
else:
    result = await gcli2api_bridge.forward_request(
        path=bridge_path,
        method="POST",
        json_data=body
    )

    # 记录日志
    log = UsageLog(
        user_id=user.id,
        model=model,
        endpoint=bridge_endpoint_name,
        status_code=200,
        latency_ms=round((time.time() - start_time) * 1000, 1),
        client_ip=client_ip,
        user_agent=user_agent
    )
    db.add(log)
    await db.commit()

    # 发送 WebSocket 通知
    await notify_log_update({...})
    await notify_stats_update()

    return JSONResponse(content=result)
```

---

### 3. gcli2api 内部处理（参考）

**gcli2api 的职责**:
1. 从凭证池选择可用的 GeminiCLI 凭证
2. 检查凭证的 CD（冷却时间）
3. 调用 Google Gemini API
4. 处理错误和重试
5. 更新凭证状态

**CatieCli 不关心**:
- ❌ 凭证选择逻辑
- ❌ CD 管理
- ❌ 凭证轮换
- ❌ Google API 调用细节

**CatieCli 只负责**:
- ✅ 用户认证
- ✅ 配额管理
- ✅ 请求转发
- ✅ 日志记录

---

## Antigravity 模式工作流程

### 1. 模型识别

**触发条件**: 模型名称**以 `ag-` 开头**

**支持的模型**:
```python
# proxy.py:397-420
# Gemini 模型（通过 Antigravity）
ag_gemini_models = [
    "ag-gemini-2.5-pro",
    "ag-gemini-2.5-flash",
    "ag-gemini-2.5-flash-thinking",
    "ag-gemini-3-pro-preview",
    "ag-gemini-3-flash-preview",
    "ag-gemini-3-pro-low",
    "ag-gemini-3-pro-high",
    "ag-gemini-3-pro-image",
    "ag-gemini-2.5-flash-lite",
    "ag-gemini-2.5-flash-image",
]

# Claude 模型（通过 Antigravity）
ag_claude_models = [
    "ag-claude-sonnet-4-5",
    "ag-claude-sonnet-4-5-thinking",
    "ag-claude-opus-4-5-thinking",
]
```

---

### 2. 请求流程（gcli2api 桥接模式）

**代码位置**: `proxy.py:514-580`

#### 流程图

```
用户请求 (model="ag-gemini-2.5-flash")
    ↓
验证 API Key (get_user_from_api_key)
    ↓
检查配额 (current_usage < daily_quota)
    ↓
解析请求体 (model, messages, stream)
    ↓
判断模型类型 (以 ag- 开头)
    ↓
转发到 gcli2api: /antigravity/v1/chat/completions
    ↓
gcli2api 处理请求
    ├─ 选择可用的 Antigravity 凭证
    ├─ 调用 Google Antigravity API
    ├─ 处理响应（流式/非流式）
    └─ 返回结果
    ↓
CatieCli 记录使用日志
    ↓
返回响应给用户
```

#### 关键差异

**与 GeminiCLI 模式的唯一区别**:

```python
# proxy.py:514-523
if model.startswith("ag-"):
    # Antigravity 模式
    bridge_path = "/antigravity/v1/chat/completions"
    bridge_endpoint_name = "/antigravity/v1/chat/completions (gcli2api)"
    log_info("Bridge", f"[gcli2api] Antigravity 转发: {model}, stream={stream}")
else:
    # GeminiCLI 模式
    bridge_path = "/v1/chat/completions"
    bridge_endpoint_name = "/v1/chat/completions (gcli2api)"
    log_info("Bridge", f"[gcli2api] GeminiCLI 转发: {model}, stream={stream}")
```

**其他流程完全相同**:
- ✅ 配额检查逻辑相同
- ✅ 日志记录逻辑相同
- ✅ 响应处理逻辑相同

---

### 3. Antigravity 特性

#### 什么是 Antigravity？

Antigravity 是 Google 内部的实验性 API 端点，提供：
- 🚀 更高的配额
- 🆕 实验性模型（如 Claude 模型）
- 🔬 新功能测试

#### 凭证要求

Antigravity 凭证需要额外的 OAuth Scopes:
```python
# oauth.py:33-39 (已删除，仅供参考)
ANTIGRAVITY_SCOPES = [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/cclog",              # 额外权限
    "https://www.googleapis.com/auth/experimentsandconfigs",  # 额外权限
]
```

#### API 端点

```python
# config.py:55 (已注释)
antigravity_api_url = "https://daily-cloudcode-pa.sandbox.googleapis.com"
```

---

## OpenAI 模式工作流程

### 1. 触发条件

**仅在以下情况下使用 OpenAI 模式**:
- ❌ **未启用** gcli2api 桥接（`enable_gcli2api_bridge=False`）
- ✅ **已配置** OpenAI 兼容端点（后台添加）

**当前版本**: 由于强制启用桥接模式，OpenAI 模式**仅作为备用方案**。

---

### 2. 请求流程

**代码位置**: `proxy.py:583-603`

#### 流程图

```
用户请求
    ↓
验证 API Key (get_user_from_api_key)
    ↓
检查配额 (current_usage < daily_quota)
    ↓
解析请求体 (model, messages, stream)
    ↓
检查是否启用 gcli2api 桥接
    ├─ 是 → 使用 gcli2api（上述流程）
    └─ 否 → 继续
    ↓
查询 OpenAI 端点配置（按优先级排序）
    ↓
遍历端点，尝试转发请求
    ├─ 端点 1: 尝试调用
    │   ├─ 成功 → 返回响应
    │   └─ 失败 → 记录错误，尝试下一个
    ├─ 端点 2: 尝试调用
    │   └─ ...
    └─ 所有端点都失败
    ↓
返回 503 错误
```

---

### 3. OpenAI 端点配置

#### 数据库表结构

```python
# models/user.py:120-136
class OpenAIEndpoint(Base):
    __tablename__ = "openai_endpoints"

    id = Column(Integer, primary_key=True)
    name = Column(String(100))              # 端点名称（如 "DeepSeek"）
    api_key = Column(Text)                  # API Key
    base_url = Column(String(500))          # API Base URL
    is_active = Column(Boolean, default=True)  # 是否启用
    priority = Column(Integer, default=0)   # 优先级（数字越大越优先）
    total_requests = Column(Integer, default=0)
    failed_requests = Column(Integer, default=0)
    last_used_at = Column(DateTime)
    last_error = Column(Text)
```

#### 端点选择逻辑

```python
# proxy.py:133-139
result = await db.execute(
    select(OpenAIEndpoint)
    .where(OpenAIEndpoint.is_active == True)
    .order_by(OpenAIEndpoint.priority.desc(), OpenAIEndpoint.id)
)
endpoints = result.scalars().all()
```

**排序规则**:
1. 优先级高的优先（`priority DESC`）
2. 相同优先级按 ID 排序（`id ASC`）

---

### 4. 请求转发详细流程

**代码位置**: `proxy.py:128-345`

#### 步骤 1: 遍历端点

```python
# proxy.py:145-146
last_error = None
for endpoint in endpoints:
```

#### 步骤 2: 构建请求

```python
# proxy.py:148-154
headers = {
    "Authorization": f"Bearer {endpoint.api_key}",
    "Content-Type": "application/json"
}

url = f"{endpoint.base_url}/chat/completions"
```

#### 步骤 3: 发送请求

**流式响应**:
```python
# proxy.py:156-242
if stream:
    async def stream_generator():
        client = httpx.AsyncClient(timeout=60.0)
        try:
            async with client.stream("POST", url, json=body, headers=headers) as response:
                response.raise_for_status()

                # 更新端点统计
                endpoint.total_requests += 1
                endpoint.last_used_at = datetime.utcnow()
                await db.commit()

                # 流式传输数据
                async for chunk in response.aiter_bytes():
                    yield chunk

                # 记录成功日志
                log = UsageLog(
                    user_id=user.id,
                    model=model,
                    endpoint="/v1/chat/completions",
                    status_code=200,
                    latency_ms=round((time.time() - start_time), 1),
                    client_ip=client_ip,
                    user_agent=user_agent
                )
                db.add(log)
                await db.commit()
        except Exception as e:
            # 记录错误日志
            log = UsageLog(
                user_id=user.id,
                model=model,
                endpoint="/v1/chat/completions",
                status_code=500,
                error_message=str(e)[:2000],
                ...
            )
            db.add(log)
            await db.commit()
        finally:
            await client.aclose()

    return StreamingResponse(stream_generator(), media_type="text/event-stream")
```

**非流式响应**:
```python
# proxy.py:244-297
else:
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, json=body, headers=headers)
        response.raise_for_status()

        # 更新端点统计
        endpoint.total_requests += 1
        endpoint.last_used_at = datetime.utcnow()
        await db.commit()

        # 记录成功日志
        log = UsageLog(
            user_id=user.id,
            model=model,
            endpoint="/v1/chat/completions",
            status_code=200,
            latency_ms=round((time.time() - start_time) * 1000, 1),
            client_ip=client_ip,
            user_agent=user_agent
        )
        db.add(log)
        await db.commit()

        return JSONResponse(content=response.json())
```

#### 步骤 4: 错误处理

```python
# proxy.py:298-342
except httpx.HTTPStatusError as e:
    # HTTP 错误（4xx, 5xx）
    last_error = f"{endpoint.name}: HTTP {e.response.status_code}"

    endpoint.failed_requests += 1
    endpoint.last_error = last_error[:500]
    await db.commit()

    # 记录错误日志
    log = UsageLog(
        user_id=user.id,
        model=model,
        endpoint="/v1/chat/completions",
        status_code=e.response.status_code,
        error_message=last_error[:2000],
        ...
    )
    db.add(log)
    await db.commit()

    continue  # 尝试下一个端点

except Exception as e:
    # 其他异常（网络错误、超时等）
    last_error = f"{endpoint.name}: {str(e)}"

    endpoint.failed_requests += 1
    endpoint.last_error = last_error[:500]
    await db.commit()

    # 记录错误日志
    log = UsageLog(
        user_id=user.id,
        model=model,
        endpoint="/v1/chat/completions",
        status_code=500,
        error_message=last_error[:2000],
        ...
    )
    db.add(log)
    await db.commit()

    continue  # 尝试下一个端点
```

#### 步骤 5: 所有端点都失败

```python
# proxy.py:344-345
# 所有端点都失败了
raise HTTPException(status_code=503, detail=f"所有 OpenAI 端点都失败了。最后错误: {last_error}")
```

---

## 配额计算详解

### 1. 配额字段

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `user.daily_quota` | Integer | 每日配额（次数） | 100 |
| `current_usage` | Integer | 今日已使用次数 | 45 |
| `remaining` | Integer | 剩余配额 | 55 |

### 2. 配额计算公式

```python
# 剩余配额
remaining = user.daily_quota - current_usage

# 使用率
usage_rate = (current_usage / user.daily_quota) * 100

# 是否超额
is_over_quota = current_usage >= user.daily_quota
```

### 3. 配额重置逻辑

**重置时间**: 每天北京时间 15:00（UTC 07:00）

**实现方式**: 不是定时任务，而是**动态计算**

```python
# proxy.py:86-92
now = datetime.utcnow()
reset_time_utc = now.replace(hour=7, minute=0, second=0, microsecond=0)

if now < reset_time_utc:
    # 当前时间在今天的重置时间之前，使用昨天的重置时间
    start_of_day = reset_time_utc - timedelta(days=1)
else:
    # 当前时间在今天的重置时间之后，使用今天的重置时间
    start_of_day = reset_time_utc
```

**示例**:

| 当前时间（UTC） | 当前时间（北京） | start_of_day（UTC） | 说明 |
|----------------|----------------|-------------------|------|
| 2026-01-09 10:00 | 2026-01-09 18:00 | 2026-01-09 07:00 | 今天的重置时间 |
| 2026-01-09 05:00 | 2026-01-09 13:00 | 2026-01-08 07:00 | 昨天的重置时间 |
| 2026-01-09 07:00 | 2026-01-09 15:00 | 2026-01-09 07:00 | 刚好重置 |

### 4. 配额统计查询

```python
# proxy.py:104-109
total_usage_result = await db.execute(
    select(func.count(UsageLog.id))
    .where(UsageLog.user_id == user.id)
    .where(UsageLog.created_at >= start_of_day)
)
current_usage = total_usage_result.scalar() or 0
```

**查询逻辑**:
- 统计 `usage_logs` 表中的记录数
- 过滤条件: `user_id` 匹配 且 `created_at >= start_of_day`
- 包括成功和失败的请求（都计入配额）

---

### 5. 配额增加机制

#### 方式 1: 管理员手动调整

**后台操作**: 用户管理 → 修改配额

```python
# admin.py
await db.execute(
    update(User)
    .where(User.id == user_id)
    .values(daily_quota=new_quota)
)
await db.commit()
```

#### 方式 2: 上传凭证奖励

**触发条件**:
- ✅ 新凭证（不是更新）
- ✅ 上传到公共池（`is_public=True`）

**奖励逻辑**:
```python
# oauth.py:223-228
if is_new_credential and data.is_public:
    reward_quota = settings.credential_reward_quota  # 默认 1000
    user.daily_quota += reward_quota
    await db.commit()
```

**示例**:
```
原配额: 100
上传凭证: +1000
新配额: 1100
```

---

## 日志记录机制

### 1. UsageLog 表结构

```python
# models/user.py:49-76
class UsageLog(Base):
    __tablename__ = "usage_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    api_key_id = Column(Integer, ForeignKey("api_keys.id"))
    credential_id = Column(Integer, ForeignKey("credentials.id"))
    model = Column(String(100))              # 请求的模型
    endpoint = Column(String(200))           # 调用的端点
    status_code = Column(Integer)            # HTTP 状态码
    latency_ms = Column(Float)               # 延迟（毫秒）
    cd_seconds = Column(Integer)             # CD 秒数（429 错误时）
    created_at = Column(DateTime, default=datetime.utcnow)
    error_message = Column(Text)             # 错误信息
    request_body = Column(Text)              # 请求内容（截断）
    client_ip = Column(String(50))           # 客户端 IP
    user_agent = Column(String(500))         # User Agent
    error_type = Column(String(50))          # 错误类型
    error_code = Column(String(100))         # 错误码
    credential_email = Column(String(100))   # 使用的凭证邮箱
```

### 2. 日志记录时机

#### 成功请求

```python
# 非流式响应
log = UsageLog(
    user_id=user.id,
    model=model,
    endpoint=bridge_endpoint_name,
    status_code=200,
    latency_ms=round((time.time() - start_time) * 1000, 1),
    client_ip=client_ip,
    user_agent=user_agent
)
db.add(log)
await db.commit()
```

#### 失败请求

```python
log = UsageLog(
    user_id=user.id,
    model=model,
    endpoint=bridge_endpoint_name,
    status_code=500,
    latency_ms=round((time.time() - start_time) * 1000, 1),
    error_message=str(error)[:2000],
    client_ip=client_ip,
    user_agent=user_agent
)
db.add(log)
await db.commit()
```

### 3. WebSocket 实时通知

```python
# proxy.py:571-578
await notify_log_update({
    "username": user.username,
    "model": model,
    "status_code": 200,
    "latency_ms": round((time.time() - start_time) * 1000, 1),
    "created_at": datetime.utcnow().isoformat()
})
await notify_stats_update()
```

**通知对象**:
- 管理员（查看全局日志）
- 当前用户（查看个人统计）

---

## 总结对比表

| 特性 | GeminiCLI 模式 | Antigravity 模式 | OpenAI 模式 |
|------|---------------|-----------------|------------|
| **模型前缀** | 无前缀 | `ag-` | 任意 |
| **转发路径** | `/v1/chat/completions` | `/antigravity/v1/chat/completions` | `/chat/completions` |
| **凭证来源** | gcli2api（GeminiCLI 池） | gcli2api（Antigravity 池） | 后台配置的端点 |
| **配额检查** | ✅ 统一检查 | ✅ 统一检查 | ✅ 统一检查 |
| **日志记录** | ✅ 统一记录 | ✅ 统一记录 | ✅ 统一记录 |
| **流式支持** | ✅ 支持 | ✅ 支持 | ✅ 支持 |
| **错误处理** | gcli2api 负责 | gcli2api 负责 | CatieCli 负责 |
| **端点选择** | gcli2api 自动 | gcli2api 自动 | 按优先级遍历 |
| **当前状态** | ✅ 主要模式 | ✅ 主要模式 | ⚠️ 备用方案 |

---

## 常见问题

### Q1: 配额是按次数还是按 Token 计算？

**A**: 按**次数**计算。每次成功的 API 调用消耗 1 次配额，与 Token 数量无关。

### Q2: 失败的请求会消耗配额吗？

**A**: **会**。配额检查在请求前进行，即使请求失败也已经消耗配额。但失败的请求会记录在日志中，管理员可以根据情况手动补偿。

### Q3: 为什么 GET 请求不检查配额？

**A**: GET 请求（如 `/v1/models`）只是查询模型列表，不消耗实际的 API 资源，因此不检查配额。

### Q4: 如何区分 GeminiCLI 和 Antigravity 模式？

**A**: 通过模型名称前缀：
- `gemini-2.5-flash` → GeminiCLI 模式
- `ag-gemini-2.5-flash` → Antigravity 模式

### Q5: OpenAI 模式还能用吗？

**A**: 可以，但需要：
1. 在后台添加 OpenAI 兼容端点
2. 当前版本强制启用 gcli2api 桥接，OpenAI 模式仅作为备用

### Q6: 配额什么时候重置？

**A**: 每天北京时间 15:00（UTC 07:00）自动重置。

### Q7: 如何增加配额？

**A**: 两种方式：
1. 管理员手动调整
2. 上传凭证到公共池（+1000 次）

---

**文档版本**: v2.0 (Bridge Mode Only)
**更新时间**: 2026-01-09
**作者**: Claude Sonnet 4.5
