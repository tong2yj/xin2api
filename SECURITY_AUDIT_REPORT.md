# 🔒 CatieCli 安全审计报告

**审计日期**: 2026-01-06
**审计范围**: 后端错误处理、异常管理、输入验证、边界情况
**严重程度**: 🔴 高危 | 🟠 中危 | 🟡 低危 | 🟢 信息

---

## 📋 执行摘要

本次审计发现了 **23 个安全问题**，包括：
- 🔴 **高危问题**: 6 个（被吞掉的异常、未验证的输入）
- 🟠 **中危问题**: 10 个（不完整的错误处理）
- 🟡 **低危问题**: 7 个（潜在的边界情况）

**主要风险**:
1. 多处异常被静默捕获，可能导致服务静默失败
2. JSON 解析缺少严格验证，可能导致服务崩溃
3. 数据库事务错误处理不完整，可能导致数据不一致
4. 流式响应中的异常处理不足，可能导致客户端挂起

---

## 🔴 高危问题

### 1. 被吞掉的异常 - JSON 解析

**位置**: `proxy.py:415-417`, `proxy.py:781-783`, `proxy.py:934-937`

**问题代码**:
```python
try:
    body = await request.json()
except:  # ❌ 裸 except，吞掉所有异常
    raise HTTPException(status_code=400, detail="无效的JSON请求体")
```

**风险**:
- 吞掉所有异常类型（包括 `KeyboardInterrupt`, `SystemExit`）
- 无法区分 JSON 格式错误和其他严重错误
- 无日志记录，难以调试

**修复方案**:
```python
try:
    body = await request.json()
except json.JSONDecodeError as e:
    print(f"[Proxy] JSON 解析错误: {e}", flush=True)
    raise HTTPException(status_code=400, detail=f"无效的JSON请求体: {str(e)}")
except Exception as e:
    print(f"[Proxy] 请求体读取异常: {e}", flush=True)
    raise HTTPException(status_code=500, detail="请求处理失败")
```

---

### 2. 数据库提交异常被吞掉

**位置**: `auth.py:464-468`, `auth.py:660-665`, `auth.py:668-672`

**问题代码**:
```python
try:
    await db.commit()
    print(f"[批量上传] 已提交 {success_count} 个凭证", flush=True)
except Exception as commit_err:
    print(f"[批量上传] 提交失败: {commit_err}", flush=True)
    # ❌ 异常被吞掉，继续执行，可能导致数据不一致
```

**风险**:
- 数据库提交失败但程序继续执行
- 用户可能收到成功响应但数据未保存
- 数据不一致（部分凭证保存，部分丢失）

**修复方案**:
```python
try:
    await db.commit()
    print(f"[批量上传] 已提交 {success_count} 个凭证", flush=True)
except Exception as commit_err:
    print(f"[批量上传] 提交失败: {commit_err}", flush=True)
    await db.rollback()
    raise HTTPException(
        status_code=500,
        detail=f"数据保存失败: {str(commit_err)[:100]}"
    )
```

---

### 3. 流式响应中的异常处理不足

**位置**: `proxy.py:181-202`, `proxy.py:656-690`

**问题代码**:
```python
except Exception as e:
    error_msg = str(e)
    # 记录错误
    endpoint.failed_requests = (endpoint.failed_requests or 0) + 1
    endpoint.last_error = error_msg[:500]
    await db.commit()
    # ... 记录日志 ...
    raise  # ❌ 在流式生成器中 raise 会导致客户端收到不完整响应
```

**风险**:
- 流式响应中途抛出异常会导致客户端连接中断
- 客户端可能收到部分数据后挂起
- 无法发送格式化的错误消息给客户端

**修复方案**:
```python
except Exception as e:
    error_msg = str(e)
    endpoint.failed_requests = (endpoint.failed_requests or 0) + 1
    endpoint.last_error = error_msg[:500]
    await db.commit()

    # 记录错误日志
    async with async_session() as log_db:
        log = UsageLog(...)
        log_db.add(log)
        await log_db.commit()

    # 发送错误消息而不是 raise
    yield f"data: {json.dumps({'error': error_msg})}\\n\\n"
    yield "data: [DONE]\\n\\n"
```

---

### 4. 缺少输入长度验证

**位置**: `auth.py:19-22`, `proxy.py:422-424`

**问题代码**:
```python
class UserRegister(BaseModel):
    username: str  # ❌ 无长度限制
    password: str  # ❌ 无长度限制
    email: Optional[str] = None  # ❌ 无格式验证
```

**风险**:
- 超长用户名/密码可能导致数据库错误
- 恶意用户可以提交巨大的 JSON 导致内存溢出
- 无邮箱格式验证可能导致无效数据

**修复方案**:
```python
from pydantic import BaseModel, Field, EmailStr, validator

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern="^[a-zA-Z0-9_-]+$")
    password: str = Field(..., min_length=8, max_length=128)
    email: Optional[EmailStr] = None

    @validator('password')
    def validate_password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('密码至少需要8个字符')
        return v
```

---

### 5. 凭证验证异常被吞掉

**位置**: `auth.py:422-423`, `auth.py:810-811`

**问题代码**:
```python
except Exception as e:
    verify_msg = f"⚠️ 验证失败: {str(e)[:30]}"
    # ❌ 异常被吞掉，凭证可能以无效状态保存
```

**风险**:
- 凭证验证失败但仍被保存到数据库
- 用户可能使用无效凭证导致后续请求失败
- 无法区分网络错误和凭证无效

**修复方案**:
```python
except httpx.TimeoutException as e:
    verify_msg = f"⚠️ 验证超时: {str(e)[:30]}"
    is_valid = False  # 明确标记为无效
except httpx.HTTPStatusError as e:
    verify_msg = f"❌ HTTP错误 {e.response.status_code}"
    is_valid = False
except Exception as e:
    print(f"[凭证验证] 严重异常: {e}", flush=True)
    verify_msg = f"⚠️ 验证失败: {str(e)[:30]}"
    is_valid = False
```

---

### 6. 缺少 API Key 格式验证

**位置**: `proxy.py:43-66`

**问题代码**:
```python
# 从多个来源提取 API Key，但没有格式验证
api_key = auth_header[7:]  # ❌ 可能是空字符串
if not api_key:
    api_key = request.headers.get("x-api-key")  # ❌ 可能是任意字符串
```

**风险**:
- 接受任意格式的 API Key，增加数据库查询负担
- 可能被用于 SQL 注入攻击（虽然使用了 ORM）
- 无法快速拒绝明显无效的请求

**修复方案**:
```python
import re

API_KEY_PATTERN = re.compile(r'^(sk-|cat-)[a-zA-Z0-9]{32,64}$')

def validate_api_key(api_key: str) -> bool:
    """验证 API Key 格式"""
    if not api_key or len(api_key) < 10 or len(api_key) > 100:
        return False
    return bool(API_KEY_PATTERN.match(api_key))

# 使用
if not api_key or not validate_api_key(api_key):
    raise HTTPException(status_code=401, detail="API Key 格式无效")
```

---

## 🟠 中危问题

### 7. 不完整的错误分类

**位置**: `proxy.py:24-40`

**问题代码**:
```python
def extract_status_code(error_str: str, default: int = 500) -> int:
    # 只匹配几种模式，可能遗漏其他格式
    patterns = [
        r'API Error (\d{3})',
        r'"code":\s*(\d{3})',
        # ...
    ]
```

**风险**:
- 无法正确提取所有错误状态码
- 默认返回 500 可能掩盖真实错误类型
- 影响错误统计和监控

**修复方案**:
```python
def extract_status_code(error_str: str, default: int = 500) -> int:
    """从错误信息中提取HTTP状态码"""
    if not error_str:
        return default

    patterns = [
        r'API Error (\d{3})',
        r'"code":\s*(\d{3})',
        r'status_code[=:]?\s*(\d{3})',
        r'HTTP[/\s](\d{3})',
        r'Error (\d{3}):',
        r'(\d{3})\s+(Bad Request|Unauthorized|Forbidden|Not Found)',  # 新增
    ]

    for pattern in patterns:
        match = re.search(pattern, error_str, re.IGNORECASE)
        if match:
            code = int(match.group(1))
            if 100 <= code < 600:  # 扩展范围检查
                return code

    # 记录未匹配的错误，便于改进
    print(f"[Warning] 无法提取状态码: {error_str[:100]}", flush=True)
    return default
```

---

### 8. 配额检查竞态条件

**位置**: `proxy.py:100-113`

**问题代码**:
```python
# 检查今日总使用次数
total_usage_result = await db.execute(...)
current_usage = total_usage_result.scalar() or 0

# 检查是否超过配额
if current_usage >= user.daily_quota:
    raise HTTPException(...)
# ❌ 在高并发下，多个请求可能同时通过检查
```

**风险**:
- 高并发下可能超出配额限制
- 多个请求同时检查时都认为配额充足
- 用户可能超额使用服务

**修复方案**:
```python
from sqlalchemy import func, and_

# 使用数据库级别的原子操作
async with db.begin():
    # 先增加使用计数（乐观锁）
    log = UsageLog(user_id=user.id, ...)
    db.add(log)
    await db.flush()  # 获取 log.id

    # 再检查配额
    total_usage_result = await db.execute(
        select(func.count(UsageLog.id))
        .where(UsageLog.user_id == user.id)
        .where(UsageLog.created_at >= start_of_day)
        .with_for_update()  # 行锁
    )
    current_usage = total_usage_result.scalar() or 0

    if current_usage > user.daily_quota:
        await db.rollback()
        raise HTTPException(status_code=429, detail="配额已用尽")
```

---

### 9. 缺少超时保护

**位置**: `proxy.py:877`, `auth.py:388`

**问题代码**:
```python
async with httpx.AsyncClient(timeout=120.0) as client:
    # ❌ 120秒超时太长，可能导致资源耗尽
```

**风险**:
- 超长超时可能导致连接池耗尽
- 恶意用户可以发起慢速攻击
- 影响其他正常用户的请求

**修复方案**:
```python
# 使用更细粒度的超时配置
timeout_config = httpx.Timeout(
    connect=5.0,    # 连接超时
    read=30.0,      # 读取超时
    write=10.0,     # 写入超时
    pool=5.0        # 连接池超时
)

async with httpx.AsyncClient(timeout=timeout_config) as client:
    ...
```

---

### 10. topK 参数验证不完整

**位置**: `proxy.py:861-866`, `proxy.py:1041-1044`

**问题代码**:
```python
if gen_config["topK"] is not None and (gen_config["topK"] < 1 or gen_config["topK"] > 64):
    gen_config["topK"] = 64
    # ❌ 只检查了数值范围，没检查类型
```

**风险**:
- 如果 topK 是字符串或其他类型会导致比较错误
- 可能抛出 TypeError 导致请求失败

**修复方案**:
```python
if "topK" in gen_config:
    try:
        top_k = int(gen_config["topK"]) if gen_config["topK"] is not None else None
        if top_k is not None and (top_k < 1 or top_k > 64):
            print(f"[Gemini API] ⚠️ topK={top_k} 超出范围，调整为 64", flush=True)
            gen_config["topK"] = 64
        elif top_k is not None:
            gen_config["topK"] = top_k
    except (ValueError, TypeError) as e:
        print(f"[Gemini API] ⚠️ topK 类型错误: {e}，移除该参数", flush=True)
        gen_config.pop("topK", None)
```

---

### 11. 文件上传缺少大小限制

**位置**: `auth.py:288-333`

**问题代码**:
```python
async def upload_credentials(
    files: List[UploadFile] = File(...),
    # ❌ 没有文件大小限制
```

**风险**:
- 用户可以上传巨大的文件导致内存溢出
- ZIP 炸弹攻击（压缩比极高的恶意文件）
- 服务器磁盘空间被耗尽

**修复方案**:
```python
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_ZIP_SIZE = 50 * 1024 * 1024   # 50MB
MAX_FILES_IN_ZIP = 1000

async def upload_credentials(
    files: List[UploadFile] = File(...),
    ...
):
    for file in files:
        # 检查文件大小
        file_content = await file.read()
        if len(file_content) > MAX_FILE_SIZE:
            results.append({
                "filename": file.filename,
                "status": "error",
                "message": f"文件过大（最大 {MAX_FILE_SIZE // 1024 // 1024}MB）"
            })
            continue

        if file.filename.endswith('.zip'):
            if len(file_content) > MAX_ZIP_SIZE:
                results.append({
                    "filename": file.filename,
                    "status": "error",
                    "message": "ZIP 文件过大"
                })
                continue

            # 检查 ZIP 内文件数量
            with zipfile.ZipFile(io.BytesIO(file_content), 'r') as zf:
                if len(zf.namelist()) > MAX_FILES_IN_ZIP:
                    results.append({
                        "filename": file.filename,
                        "status": "error",
                        "message": f"ZIP 包含文件过多（最大 {MAX_FILES_IN_ZIP}）"
                    })
                    continue
```

---

### 12. 缺少速率限制日志

**位置**: `proxy.py:462-477`

**问题代码**:
```python
if current_rpm >= max_rpm:
    raise HTTPException(
        status_code=429,
        detail=f"速率限制: {max_rpm} 次/分钟..."
    )
    # ❌ 没有记录速率限制事件
```

**风险**:
- 无法监控哪些用户频繁触发速率限制
- 无法识别潜在的滥用行为
- 难以调整速率限制策略

**修复方案**:
```python
if current_rpm >= max_rpm:
    print(
        f"[RateLimit] 用户 {user.username} 触发速率限制: "
        f"{current_rpm}/{max_rpm} RPM",
        flush=True
    )
    # 可选：记录到专门的速率限制日志表
    raise HTTPException(...)
```

---

### 13-16. 其他中危问题

- **缺少 WebSocket 错误处理** (`proxy.py:563-571`)
- **凭证刷新失败后继续使用** (`proxy.py:514-518`)
- **批量操作缺少进度反馈** (`auth.py:462-468`)
- **缺少请求ID追踪** (所有路由)

---

## 🟡 低危问题

### 17. 硬编码的魔法数字

**位置**: 多处

**问题代码**:
```python
if count >= 5:  # ❌ 硬编码
    raise HTTPException(status_code=400, detail="最多只能创建5个API Key")
```

**修复方案**:
```python
MAX_API_KEYS_PER_USER = 5

if count >= MAX_API_KEYS_PER_USER:
    raise HTTPException(
        status_code=400,
        detail=f"最多只能创建{MAX_API_KEYS_PER_USER}个API Key"
    )
```

---

### 18. 日志输出不一致

**位置**: 多处

**问题**: 有些地方使用 `print(..., flush=True)`，有些没有 `flush=True`

**修复方案**: 统一使用 Python logging 模块

---

### 19-23. 其他低危问题

- **缺少用户操作审计日志**
- **错误消息可能泄露敏感信息** (`auth.py:807`)
- **缺少 CSRF 保护**
- **缺少请求体大小限制**
- **时区处理不一致** (`proxy.py:83-88`)

---

## 🎯 边界情况 (Edge Cases)

### 边界情况 1: 空数组/空对象

**位置**: `proxy.py:426-427`

```python
messages = body.get("messages", [])
if not messages:
    raise HTTPException(status_code=400, detail="messages不能为空")
# ✅ 已处理
```

**潜在问题**: 如果 `messages = [{}]` 或 `messages = [{"role": ""}]`？

**修复方案**:
```python
messages = body.get("messages", [])
if not messages:
    raise HTTPException(status_code=400, detail="messages不能为空")

# 验证每条消息
for i, msg in enumerate(messages):
    if not isinstance(msg, dict):
        raise HTTPException(status_code=400, detail=f"消息 {i} 格式错误")
    if "role" not in msg or "content" not in msg:
        raise HTTPException(status_code=400, detail=f"消息 {i} 缺少必需字段")
    if not msg["role"] or not msg["content"]:
        raise HTTPException(status_code=400, detail=f"消息 {i} 字段不能为空")
```

---

### 边界情况 2: 数据库连接丢失

**位置**: 所有数据库操作

**场景**: 数据库连接在请求处理中途断开

**当前处理**: 依赖 SQLAlchemy 的自动重连

**风险**: 长时间运行的流式响应可能失败

**修复方案**:
```python
from sqlalchemy.exc import OperationalError, DisconnectionError

async def safe_db_operation(db_func, *args, max_retries=3, **kwargs):
    """带重试的数据库操作包装器"""
    for attempt in range(max_retries):
        try:
            return await db_func(*args, **kwargs)
        except (OperationalError, DisconnectionError) as e:
            if attempt == max_retries - 1:
                raise
            print(f"[DB] 连接错误，重试 {attempt + 1}/{max_retries}: {e}", flush=True)
            await asyncio.sleep(0.5 * (attempt + 1))
```

---

### 边界情况 3: 时间边界问题

**位置**: `proxy.py:83-88`

**问题代码**:
```python
now = datetime.utcnow()
reset_time_utc = now.replace(hour=7, minute=0, second=0, microsecond=0)
if now < reset_time_utc:
    start_of_day = reset_time_utc - timedelta(days=1)
else:
    start_of_day = reset_time_utc
```

**边界情况**:
- 在 06:59:59.999 和 07:00:00.001 之间的请求
- 夏令时切换时

**修复方案**:
```python
from datetime import timezone
import pytz

BEIJING_TZ = pytz.timezone('Asia/Shanghai')

def get_quota_reset_time():
    """获取配额重置时间（北京时间 15:00 = UTC 07:00）"""
    now_utc = datetime.now(timezone.utc)
    now_beijing = now_utc.astimezone(BEIJING_TZ)

    # 北京时间今天 15:00
    reset_beijing = now_beijing.replace(hour=15, minute=0, second=0, microsecond=0)

    if now_beijing < reset_beijing:
        # 还没到今天的重置时间，使用昨天的重置时间
        reset_beijing -= timedelta(days=1)

    return reset_beijing.astimezone(timezone.utc)
```

---

### 边界情况 4: 整数溢出

**位置**: `auth.py:558-560`, `proxy.py:558`

**问题代码**:
```python
cred.total_requests = (cred.total_requests or 0) + 1
# ❌ 如果 total_requests 达到整数上限会怎样？
```

**风险**: 虽然 Python 整数无上限，但数据库字段可能有限制

**修复方案**:
```python
# 在数据库模型中使用 BigInteger
from sqlalchemy import BigInteger

class Credential(Base):
    total_requests = Column(BigInteger, default=0)  # 而不是 Integer

# 或者添加溢出检查
MAX_SAFE_INTEGER = 2**53 - 1  # JavaScript 安全整数范围

if cred.total_requests and cred.total_requests >= MAX_SAFE_INTEGER:
    print(f"[Warning] 凭证 {cred.id} 请求计数接近上限", flush=True)
    cred.total_requests = 0  # 重置或采取其他措施
```

---

### 边界情况 5: Unicode 和特殊字符

**位置**: `auth.py:347-348`

**问题代码**:
```python
email = cred_data.get("email") or filename
# ❌ filename 可能包含特殊字符、emoji、路径遍历字符
```

**风险**:
- 文件名包含 `../` 可能导致路径遍历
- 超长文件名可能导致数据库错误
- 特殊字符可能破坏日志输出

**修复方案**:
```python
import unicodedata
import re

def sanitize_filename(filename: str, max_length: int = 100) -> str:
    """清理文件名"""
    # 移除路径分隔符
    filename = filename.replace('/', '_').replace('\\', '_')

    # 移除控制字符
    filename = ''.join(c for c in filename if unicodedata.category(c)[0] != 'C')

    # 只保留安全字符
    filename = re.sub(r'[^\w\s.-]', '_', filename)

    # 限制长度
    if len(filename) > max_length:
        name, ext = os.path.splitext(filename)
        filename = name[:max_length - len(ext)] + ext

    return filename or "unnamed"

email = cred_data.get("email") or sanitize_filename(filename)
```

---

### 边界情况 6: 并发写入冲突

**位置**: `auth.py:351-366`

**问题代码**:
```python
# 去重检查
existing = await db.execute(
    select(Credential).where(Credential.email == email)
)
if existing.scalar_one_or_none():
    continue  # 跳过

# 创建凭证
credential = Credential(...)
db.add(credential)
# ❌ 在检查和插入之间，另一个请求可能已经插入了相同的凭证
```

**风险**: 竞态条件导致重复凭证

**修复方案**:
```python
# 方案1: 使用数据库唯一约束
class Credential(Base):
    email = Column(String, unique=True, index=True)  # 添加唯一约束

try:
    credential = Credential(...)
    db.add(credential)
    await db.commit()
except IntegrityError:
    await db.rollback()
    results.append({
        "filename": filename,
        "status": "skip",
        "message": f"凭证已存在: {email}"
    })
    continue

# 方案2: 使用 INSERT ... ON CONFLICT (PostgreSQL)
from sqlalchemy.dialects.postgresql import insert

stmt = insert(Credential).values(...)
stmt = stmt.on_conflict_do_nothing(index_elements=['email'])
await db.execute(stmt)
```

---

### 边界情况 7: 流式响应客户端断开

**位置**: 所有 `StreamingResponse`

**问题**: 客户端中途断开连接，服务器继续生成数据

**风险**:
- 浪费服务器资源
- 凭证继续被使用
- 日志记录不准确

**修复方案**:
```python
async def stream_generator_with_disconnect_detection():
    try:
        async for chunk in original_generator():
            try:
                yield chunk
            except (ConnectionResetError, BrokenPipeError):
                print("[Stream] 客户端断开连接", flush=True)
                # 记录部分完成的日志
                await log_usage(status_code=499, error_msg="客户端断开")
                break
    finally:
        # 清理资源
        pass
```

---

## 📊 优先级建议

### 🔥 立即修复（1-3天）
1. ✅ 修复所有被吞掉的异常（问题 1, 2, 5）
2. ✅ 添加输入验证（问题 4, 6）
3. ✅ 修复流式响应异常处理（问题 3）

### ⚡ 短期修复（1-2周）
4. 添加文件大小限制（问题 11）
5. 修复配额竞态条件（问题 8）
6. 改进超时配置（问题 9）
7. 完善参数验证（问题 10）

### 🎯 中期改进（1个月）
8. 统一日志系统
9. 添加请求追踪
10. 实现审计日志
11. 改进错误分类

### 🔮 长期优化（持续）
12. 性能监控和告警
13. 自动化安全测试
14. 代码质量扫描

---

## 🛠️ 通用修复模式

### 模式 1: 异常处理三原则

```python
try:
    # 危险操作
    result = await dangerous_operation()
except SpecificException as e:
    # 1. 记录详细日志
    logger.error(f"操作失败: {e}", exc_info=True)

    # 2. 清理资源
    await cleanup_resources()

    # 3. 返回有意义的错误
    raise HTTPException(
        status_code=appropriate_code,
        detail=user_friendly_message
    )
```

### 模式 2: 输入验证模板

```python
from pydantic import BaseModel, Field, validator

class RequestModel(BaseModel):
    field: str = Field(..., min_length=1, max_length=100)

    @validator('field')
    def validate_field(cls, v):
        # 自定义验证逻辑
        if not is_valid(v):
            raise ValueError('验证失败')
        return sanitize(v)
```

### 模式 3: 数据库操作模板

```python
async def safe_db_operation():
    try:
        async with db.begin():
            # 数据库操作
            result = await db.execute(...)
            await db.commit()
            return result
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(status_code=409, detail="数据冲突")
    except OperationalError as e:
        await db.rollback()
        logger.error(f"数据库错误: {e}")
        raise HTTPException(status_code=503, detail="数据库暂时不可用")
```

---

## 📈 监控建议

### 需要监控的指标

1. **异常率**: 每小时异常数量和类型
2. **速率限制触发次数**: 识别滥用行为
3. **数据库连接池状态**: 防止连接耗尽
4. **流式响应中断率**: 检测网络问题
5. **平均响应时间**: 性能基线
6. **凭证失败率**: 凭证质量监控

### 告警规则

```python
# 示例：异常率告警
if exception_count_per_hour > 100:
    send_alert("异常率过高")

# 示例：数据库连接告警
if db_connection_pool_usage > 0.8:
    send_alert("数据库连接池接近饱和")
```

---

## ✅ 测试建议

### 单元测试

```python
import pytest
from fastapi.testclient import TestClient

def test_invalid_json():
    """测试无效 JSON 处理"""
    response = client.post("/v1/chat/completions", data="invalid json")
    assert response.status_code == 400
    assert "JSON" in response.json()["detail"]

def test_quota_exceeded():
    """测试配额超限"""
    # 模拟配额用尽
    response = client.post("/v1/chat/completions", ...)
    assert response.status_code == 429
```

### 集成测试

```python
async def test_concurrent_quota_check():
    """测试并发配额检查"""
    import asyncio

    # 同时发送多个请求
    tasks = [make_request() for _ in range(10)]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # 验证配额限制正确工作
    success_count = sum(1 for r in results if r.status_code == 200)
    assert success_count <= user.daily_quota
```

### 压力测试

```bash
# 使用 locust 或 k6 进行压力测试
locust -f loadtest.py --host=http://localhost:5001
```

---

## 📚 参考资源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [Python Exception Handling Best Practices](https://docs.python.org/3/tutorial/errors.html)
- [SQLAlchemy Best Practices](https://docs.sqlalchemy.org/en/14/orm/session_basics.html)

---

**报告生成**: 2026-01-06
**下次审计建议**: 2026-02-06 或重大功能更新后
