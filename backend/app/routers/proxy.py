from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from datetime import date, datetime, timedelta
from typing import Optional
import json
import time

from app.database import get_db, async_session
from app.models.user import User, UsageLog, OpenAIEndpoint
from app.services.auth import get_user_by_api_key
from app.services.websocket import notify_log_update, notify_stats_update
from app.services.error_classifier import classify_error_simple, ErrorType
from app.config import settings
from app.utils.logger import log_info, log_warning, log_error, log_credential_usage
import re
import httpx

router = APIRouter(tags=["API代理"])

# 模型列表缓存（5分钟过期）
_models_cache = {}
_models_cache_time = {}
MODELS_CACHE_TTL = 300  # 5分钟


def extract_status_code(error_str: str, default: int = 500) -> int:
    """从错误信息中提取HTTP状态码"""
    # 匹配 "API Error 403" 或 "code": 403 或 status_code=403 等模式
    patterns = [
        r'API Error (\d{3})',
        r'"code":\s*(\d{3})',
        r'status_code[=:]\s*(\d{3})',
        r'HTTP (\d{3})',
        r'Error (\d{3}):',
    ]
    for pattern in patterns:
        match = re.search(pattern, error_str)
        if match:
            code = int(match.group(1))
            if 400 <= code < 600:
                return code
    return default


async def get_user_from_api_key(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    """从请求中提取API Key并验证用户"""
    api_key = None

    # 1. 从Authorization header获取
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        api_key = auth_header[7:]

    # 2. 从x-api-key header获取
    if not api_key:
        api_key = request.headers.get("x-api-key")

    # 3. 从x-goog-api-key header获取（Gemini原生客户端支持）
    if not api_key:
        api_key = request.headers.get("x-goog-api-key")

    # 4. 从查询参数获取
    if not api_key:
        api_key = request.query_params.get("key")

    if not api_key:
        log_warning("Auth", "未提供API Key")
        raise HTTPException(status_code=401, detail="未提供API Key")

    user = await get_user_by_api_key(db, api_key)
    if not user:
        log_warning("Auth", f"无效的API Key: {api_key[:10]}...")
        raise HTTPException(status_code=401, detail="无效的API Key")

    if not user.is_active:
        log_warning("Auth", f"账户已被禁用: {user.username}")
        raise HTTPException(status_code=403, detail="账户已被禁用")

    # GET 请求（如 /v1/models）不需要检查配额
    if request.method == "GET":
        return user

    # 检查配额
    # 配额在北京时间 15:00 (UTC 07:00) 重置
    now = datetime.utcnow()
    reset_time_utc = now.replace(hour=7, minute=0, second=0, microsecond=0)
    if now < reset_time_utc:
        start_of_day = reset_time_utc - timedelta(days=1)
    else:
        start_of_day = reset_time_utc

    # 获取请求的模型
    body = await request.json()
    model = body.get("model", "gemini-2.5-flash")

    log_info("Auth", f"User: {user.username}, Model: {model}, Quota: {user.daily_quota}")

    # 所有用户都可以使用所有模型，不再检查凭证等级限制
    # 只通过次数配额来限制使用

    # 检查今日总使用次数(只统计成功的请求,status_code=200)
    total_usage_result = await db.execute(
        select(func.count(UsageLog.id))
        .where(UsageLog.user_id == user.id)
        .where(UsageLog.created_at >= start_of_day)
        .where(UsageLog.status_code == 200)
    )
    current_usage = total_usage_result.scalar() or 0

    # 检查是否超过配额
    if current_usage >= user.daily_quota:
        log_warning("Auth", f"配额已用尽: {user.username}, {current_usage}/{user.daily_quota}")
        raise HTTPException(
            status_code=429,
            detail=f"已达到每日配额限制 ({current_usage}/{user.daily_quota})"
        )

    log_info("Auth", f"验证通过: {user.username}, 已用: {current_usage}/{user.daily_quota}")
    return user


# ===== 三端点顺序轮询逻辑 =====

async def sequential_request_fallback(
    body: dict,
    user: User,
    db: AsyncSession,
    client_ip: str,
    user_agent: str,
    start_time: float
):
    """
    顺序轮询三个端点，失败后尝试下一个

    Args:
        body: 请求体
        user: 用户对象
        db: 数据库会话
        client_ip: 客户端 IP
        user_agent: User Agent
        start_time: 请求开始时间

    Returns:
        响应对象（JSONResponse 或 StreamingResponse）
    """
    from app.services.gcli2api_bridge import gcli2api_bridge

    model = body.get("model", "gemini-2.5-flash")
    stream = body.get("stream", False)

    # 定义端点优先级（从配置读取）
    endpoint_priority = getattr(settings, 'endpoint_priority', ['gcli2api', 'antigravity', 'openai'])

    last_error = None
    last_status_code = 500

    for endpoint_name in endpoint_priority:
        try:
            log_info("Sequential", f"尝试端点: {endpoint_name}, 模型: {model}")

            # ========== 端点 1: GeminiCLI (gcli2api) ==========
            if endpoint_name == "gcli2api" and settings.enable_gcli2api_bridge:
                bridge_path = "/v1/chat/completions"
                bridge_endpoint_name = "/v1/chat/completions (gcli2api)"

                if stream:
                    response = await gcli2api_bridge.forward_stream(
                        path=bridge_path,
                        json_data=body
                    )
                else:
                    result = await gcli2api_bridge.forward_request(
                        path=bridge_path,
                        method="POST",
                        json_data=body
                    )
                    response = JSONResponse(content=result)

                # 记录成功日志
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

                if not stream:
                    await notify_log_update({
                        "username": user.username,
                        "model": model,
                        "endpoint": endpoint_name,
                        "status_code": 200,
                        "latency_ms": round((time.time() - start_time) * 1000, 1),
                        "created_at": datetime.utcnow().isoformat()
                    })
                    await notify_stats_update()

                log_info("Sequential", f"端点 {endpoint_name} 成功")
                return response

            # ========== 端点 2: Antigravity (gcli2api) ==========
            elif endpoint_name == "antigravity" and settings.enable_gcli2api_bridge:
                bridge_path = "/antigravity/v1/chat/completions"
                bridge_endpoint_name = "/antigravity/v1/chat/completions (gcli2api)"

                if stream:
                    response = await gcli2api_bridge.forward_stream(
                        path=bridge_path,
                        json_data=body
                    )
                else:
                    result = await gcli2api_bridge.forward_request(
                        path=bridge_path,
                        method="POST",
                        json_data=body
                    )
                    response = JSONResponse(content=result)

                # 记录成功日志
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

                if not stream:
                    await notify_log_update({
                        "username": user.username,
                        "model": model,
                        "endpoint": endpoint_name,
                        "status_code": 200,
                        "latency_ms": round((time.time() - start_time) * 1000, 1),
                        "created_at": datetime.utcnow().isoformat()
                    })
                    await notify_stats_update()

                log_info("Sequential", f"端点 {endpoint_name} 成功")
                return response

            # ========== 端点 3: OpenAI 端点 ==========
            elif endpoint_name == "openai":
                # 获取可用的 OpenAI 端点
                result = await db.execute(
                    select(OpenAIEndpoint)
                    .where(OpenAIEndpoint.is_active == True)
                    .order_by(OpenAIEndpoint.priority.desc(), OpenAIEndpoint.id)
                )
                endpoints = result.scalars().all()

                if not endpoints:
                    log_warning("Sequential", "没有可用的 OpenAI 端点")
                    continue

                # 尝试 OpenAI 端点（内部也会轮询）
                return await handle_openai_endpoint(
                    request=None,  # 不需要 request 对象
                    user=user,
                    db=db,
                    body=body,
                    client_ip=client_ip,
                    user_agent=user_agent,
                    start_time=start_time
                )

        except HTTPException as e:
            last_error = e.detail
            last_status_code = e.status_code
            log_warning("Sequential", f"端点 {endpoint_name} 失败: {last_error}")

            # 记录失败日志
            try:
                log = UsageLog(
                    user_id=user.id,
                    model=model,
                    endpoint=f"{endpoint_name} (failed)",
                    status_code=last_status_code,
                    latency_ms=round((time.time() - start_time) * 1000, 1),
                    error_message=str(last_error)[:2000],
                    client_ip=client_ip,
                    user_agent=user_agent
                )
                db.add(log)
                await db.commit()
            except:
                pass

            continue

        except Exception as e:
            last_error = str(e)
            last_status_code = extract_status_code(last_error, 500)
            log_error("Sequential", f"端点 {endpoint_name} 异常: {last_error}")

            # 记录失败日志
            try:
                log = UsageLog(
                    user_id=user.id,
                    model=model,
                    endpoint=f"{endpoint_name} (error)",
                    status_code=last_status_code,
                    latency_ms=round((time.time() - start_time) * 1000, 1),
                    error_message=str(last_error)[:2000],
                    client_ip=client_ip,
                    user_agent=user_agent
                )
                db.add(log)
                await db.commit()
            except:
                pass

            continue

    # 所有端点都失败
    log_error("Sequential", f"所有端点都失败，最后错误: {last_error}")
    raise HTTPException(
        status_code=503,
        detail=f"所有端点都失败了。最后错误: {last_error}"
    )


# ===== CORS 预检请求处理 =====
# 注意：由于 URL 规范化中间件的存在，用户输入的任意前缀（如 /ABC/v1/...）都会被自动修正
# 因此这里只需要定义标准路径即可


async def handle_openai_endpoint(request: Request, user: User, db: AsyncSession, body: dict, client_ip: str, user_agent: str, start_time: float):
    """处理 OpenAI 端点转发"""
    model = body.get("model", "")
    stream = body.get("stream", False)

    # 获取可用的 OpenAI 端点（按优先级排序，只选择启用的）
    result = await db.execute(
        select(OpenAIEndpoint)
        .where(OpenAIEndpoint.is_active == True)
        .order_by(OpenAIEndpoint.priority.desc(), OpenAIEndpoint.id)
    )
    endpoints = result.scalars().all()

    if not endpoints:
        raise HTTPException(status_code=503, detail="没有可用的 OpenAI 端点，请联系管理员配置")

    # 尝试每个端点
    last_error = None
    for endpoint in endpoints:
        try:
            # 构建请求
            headers = {
                "Authorization": f"Bearer {endpoint.api_key}",
                "Content-Type": "application/json"
            }

            url = f"{endpoint.base_url}/chat/completions"

            if stream:
                # 流式响应 - 不能在 async with 中使用，需要在外部管理客户端
                async def stream_generator():
                    client = httpx.AsyncClient(timeout=60.0)
                    log_recorded = False  # 标记是否已记录日志，避免重复记录
                    stream_success = False  # 标记流式传输是否成功完成
                    try:
                        async with client.stream("POST", url, json=body, headers=headers) as response:
                            response.raise_for_status()

                            # 更新端点统计（使用独立会话）
                            try:
                                async with async_session() as stats_db:
                                    from sqlalchemy import update
                                    await stats_db.execute(
                                        update(OpenAIEndpoint)
                                        .where(OpenAIEndpoint.id == endpoint.id)
                                        .values(
                                            total_requests=OpenAIEndpoint.total_requests + 1,
                                            last_used_at=datetime.utcnow()
                                        )
                                    )
                                    await stats_db.commit()
                            except:
                                pass

                            # 流式传输数据
                            async for chunk in response.aiter_bytes():
                                yield chunk

                            # 流式传输成功完成，记录成功日志
                            try:
                                async with async_session() as log_db:
                                    log = UsageLog(
                                        user_id=user.id,
                                        model=model,
                                        endpoint="/v1/chat/completions",
                                        status_code=200,
                                        latency_ms=round((time.time() - start_time), 1),
                                        client_ip=client_ip,
                                        user_agent=user_agent
                                    )
                                    log_db.add(log)
                                    await log_db.commit()
                                log_recorded = True
                                stream_success = True
                            except Exception as log_err:
                                log_error("OpenAI Stream", f"日志记录失败: {log_err}")
                                stream_success = True  # 流式传输本身成功了
                    except Exception as e:
                        error_msg = str(e)
                        # 尝试从 httpx 异常中获取状态码
                        actual_status_code = 500
                        if hasattr(e, 'response') and e.response is not None:
                            actual_status_code = e.response.status_code
                        else:
                            # 从错误信息中提取状态码
                            actual_status_code = extract_status_code(error_msg, 500)

                        # 只有在未记录成功日志时才记录错误日志
                        if not log_recorded and not stream_success:
                            try:
                                async with async_session() as err_db:
                                    from sqlalchemy import update
                                    await err_db.execute(
                                        update(OpenAIEndpoint)
                                        .where(OpenAIEndpoint.id == endpoint.id)
                                        .values(
                                            failed_requests=OpenAIEndpoint.failed_requests + 1,
                                            last_error=error_msg[:500]
                                        )
                                    )
                                    log = UsageLog(
                                        user_id=user.id,
                                        model=model,
                                        endpoint="/v1/chat/completions",
                                        status_code=actual_status_code,
                                        latency_ms=round((time.time() - start_time), 1),
                                        error_message=error_msg[:2000],
                                        client_ip=client_ip,
                                        user_agent=user_agent
                                    )
                                    err_db.add(log)
                                    await err_db.commit()
                            except Exception as log_err:
                                log_error("OpenAI Stream", f"错误日志记录失败: {log_err}")
                        # 向客户端发送错误信息
                        yield f"data: {json.dumps({'error': error_msg})}\n\n".encode()
                    finally:
                        try:
                            await client.aclose()
                        except:
                            pass

                return StreamingResponse(
                    stream_generator(),
                    media_type="text/event-stream",
                    headers={
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive",
                    }
                )
            else:
                # 非流式响应
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(url, json=body, headers=headers)
                    response.raise_for_status()

                    # 更新端点统计
                    endpoint.total_requests = (endpoint.total_requests or 0) + 1
                    endpoint.last_used_at = datetime.utcnow()
                    await db.commit()

                    response_data = response.json()

                    # 记录日志
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

                    await notify_log_update({
                        "username": user.username,
                        "model": model,
                        "status_code": 200,
                        "latency_ms": round((time.time() - start_time), 1),
                        "created_at": datetime.utcnow().isoformat()
                    })
                    await notify_stats_update()

                    return JSONResponse(content=response_data)

        except httpx.HTTPStatusError as e:
            last_error = f"{endpoint.name}: HTTP {e.response.status_code} - {e.response.text}"
            endpoint.failed_requests = (endpoint.failed_requests or 0) + 1
            endpoint.last_error = last_error[:500]
            await db.commit()

            # 记录错误日志
            log = UsageLog(
                user_id=user.id,
                model=model,
                endpoint="/v1/chat/completions",
                status_code=e.response.status_code,
                latency_ms=round((time.time() - start_time), 1),
                error_message=last_error[:2000],
                client_ip=client_ip,
                user_agent=user_agent
            )
            db.add(log)
            await db.commit()

            log_error("OpenAI Endpoint", f"{endpoint.name} 失败: {last_error}")
            continue

        except Exception as e:
            last_error = f"{endpoint.name}: {str(e)}"
            # 尝试从异常中提取状态码
            actual_status_code = extract_status_code(str(e), 500)

            endpoint.failed_requests = (endpoint.failed_requests or 0) + 1
            endpoint.last_error = last_error[:500]
            await db.commit()

            # 记录错误日志
            log = UsageLog(
                user_id=user.id,
                model=model,
                endpoint="/v1/chat/completions",
                status_code=actual_status_code,
                latency_ms=round((time.time() - start_time), 1),
                error_message=last_error[:2000],
                client_ip=client_ip,
                user_agent=user_agent
            )
            db.add(log)
            await db.commit()

            log_error("OpenAI Endpoint", f"{endpoint.name} 异常: {last_error}")
            continue

    # 所有端点都失败了
    raise HTTPException(status_code=503, detail=f"所有 OpenAI 端点都失败了。最后错误: {last_error}")


@router.options("/v1/chat/completions")
@router.options("/v1/models")
async def options_handler():
    """处理 CORS 预检请求"""
    return JSONResponse(content={}, headers={
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
    })


@router.get("/v1/models")
async def list_models(request: Request, user: User = Depends(get_user_from_api_key), db: AsyncSession = Depends(get_db)):
    """列出可用模型 (OpenAI兼容) - 统一端点，自动轮询三个端点"""

    # ========== Gemini 模型（无前缀，自动轮询）==========
    # 基础模型 (包含 2.5 和 3.0)
    base_models = [
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-3-pro-preview",
        "gemini-3-flash-preview",
    ]

    # Thinking 后缀
    thinking_suffixes = ["-maxthinking", "-nothinking"]
    # Search 后缀
    search_suffix = "-search"

    models = []
    for base in base_models:
        # 基础模型
        models.append({"id": base, "object": "model", "owned_by": "google"})

        # thinking 变体
        for suffix in thinking_suffixes:
            models.append({"id": f"{base}{suffix}", "object": "model", "owned_by": "google"})

        # search 变体
        models.append({"id": f"{base}{search_suffix}", "object": "model", "owned_by": "google"})

        # thinking + search 组合
        for suffix in thinking_suffixes:
            combined = f"{suffix}{search_suffix}"
            models.append({"id": f"{base}{combined}", "object": "model", "owned_by": "google"})

    # Image 模型
    models.append({"id": "gemini-2.5-flash-image", "object": "model", "owned_by": "google"})

    # Antigravity 特有模型（无前缀）
    antigravity_models = [
        "gemini-3-pro-low",
        "gemini-3-pro-high",
        "gemini-3-pro-image",
        "gemini-2.5-flash-lite",
    ]
    for model_id in antigravity_models:
        models.append({"id": model_id, "object": "model", "owned_by": "google"})

    # ========== Claude 模型（无前缀，自动轮询）==========
    claude_models = [
        "claude-sonnet-4-5",
        "claude-sonnet-4-5-thinking",
        "claude-opus-4-5-thinking",
    ]
    for model_id in claude_models:
        models.append({"id": model_id, "object": "model", "owned_by": "anthropic"})

    # ========== OpenAI 兼容端点的模型 ==========
    # 获取所有启用的 OpenAI 端点
    openai_endpoints_result = await db.execute(
        select(OpenAIEndpoint)
        .where(OpenAIEndpoint.is_active == True)
        .order_by(OpenAIEndpoint.priority.desc())
    )
    openai_endpoints = openai_endpoints_result.scalars().all()

    # 从每个端点获取模型列表（带缓存）
    current_time = time.time()
    for endpoint in openai_endpoints:
        cache_key = f"endpoint_{endpoint.id}"

        # 检查缓存
        if cache_key in _models_cache and cache_key in _models_cache_time:
            if current_time - _models_cache_time[cache_key] < MODELS_CACHE_TTL:
                # 使用缓存
                models.extend(_models_cache[cache_key])
                continue

        # 缓存过期或不存在，重新获取
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{endpoint.base_url}/v1/models",
                    headers={"Authorization": f"Bearer {endpoint.api_key}"}
                )
                if response.status_code == 200:
                    upstream_data = response.json()
                    endpoint_models = []
                    # 添加上游模型到列表
                    if "data" in upstream_data:
                        for model in upstream_data["data"]:
                            model_id = model.get("id", "")
                            if model_id:
                                model_entry = {
                                    "id": model_id,
                                    "object": "model",
                                    "owned_by": model.get("owned_by", endpoint.name)
                                }
                                endpoint_models.append(model_entry)

                    # 更新缓存
                    _models_cache[cache_key] = endpoint_models
                    _models_cache_time[cache_key] = current_time
                    models.extend(endpoint_models)
        except Exception as e:
            # 静默失败，不影响其他模型的返回
            log_warning("Models", f"从 {endpoint.name} 获取模型失败: {str(e)}")
            continue

    return {"object": "list", "data": models}


@router.post("/v1/chat/completions")
async def chat_completions(
    request: Request,
    user: User = Depends(get_user_from_api_key),
    db: AsyncSession = Depends(get_db)
):
    """Chat Completions (OpenAI兼容) - 三端点顺序轮询模式"""
    start_time = time.time()

    # 获取客户端信息
    client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown").split(",")[0].strip()
    user_agent = request.headers.get("User-Agent", "")[:500]

    try:
        body = await request.json()
    except json.JSONDecodeError as e:
        log_error("Proxy", f"JSON 解析错误: {e}")
        raise HTTPException(status_code=400, detail=f"无效的JSON请求体: {str(e)}")
    except Exception as e:
        log_error("Proxy", f"请求体读取失败: {e}")
        raise HTTPException(status_code=500, detail="请求处理失败")

    # 保存请求内容摘要（截断到2000字符）
    request_body_str = json.dumps(body, ensure_ascii=False)[:2000] if body else None

    model = body.get("model", "gemini-2.5-flash")
    messages = body.get("messages", [])

    if not messages:
        raise HTTPException(status_code=400, detail="messages不能为空")

    log_info("Proxy", f"收到请求: 用户={user.username}, 模型={model}, 流式={body.get('stream', False)}")

    # ========== 使用三端点顺序轮询模式 ==========
    return await sequential_request_fallback(
        body=body,
        user=user,
        db=db,
        client_ip=client_ip,
        user_agent=user_agent,
        start_time=start_time
    )


# ===== Gemini 原生接口支持 =====
# 注意：由于 URL 规范化中间件的存在，以下路径都会被自动匹配：
# - /v1beta/models/... (标准路径)
# - /v1/v1beta/models/... (SillyTavern 等客户端可能添加 /v1 前缀)
# - /ABC/v1beta/models/... (用户错误添加任意前缀)

@router.options("/v1beta/models/{model:path}:generateContent")
@router.options("/v1beta/models/{model:path}:streamGenerateContent")
async def gemini_options_handler(model: str):
    """Gemini 接口 CORS 预检"""
    return JSONResponse(content={}, headers={
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
    })


@router.get("/v1beta/models")
async def list_gemini_models(request: Request, user: User = Depends(get_user_from_api_key), db: AsyncSession = Depends(get_db)):
    """Gemini 格式模型列表"""
    base_models = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-3-pro-preview", "gemini-3-flash-preview"]

    models = []
    for base in base_models:
        models.append({
            "name": f"models/{base}",
            "version": "001",
            "displayName": base,
            "description": f"Gemini {base} model",
            "inputTokenLimit": 1000000,
            "outputTokenLimit": 65536,
            "supportedGenerationMethods": ["generateContent", "streamGenerateContent"],
        })

    return {"models": models}


@router.post("/v1beta/models/{model:path}:generateContent")
async def gemini_generate_content(
    model: str,
    request: Request,
    user: User = Depends(get_user_from_api_key),
    db: AsyncSession = Depends(get_db)
):
    """Gemini 原生 generateContent 接口"""
    start_time = time.time()

    try:
        body = await request.json()
    except json.JSONDecodeError as e:
        log_error("Gemini CLI", f"generateContent JSON 解析错误: {e}")
        raise HTTPException(status_code=400, detail=f"无效的JSON请求体: {str(e)}")
    except Exception as e:
        log_error("Gemini CLI", f"generateContent 请求体读取失败: {e}")
        raise HTTPException(status_code=500, detail="请求处理失败")

    contents = body.get("contents", [])
    if not contents:
        raise HTTPException(status_code=400, detail="contents不能为空")

    # 清理模型名（移除 models/ 前缀）
    if model.startswith("models/"):
        model = model[7:]

    # ========== gcli2api 桥接模式 ==========
    if settings.enable_gcli2api_bridge:
        from app.services.gcli2api_bridge import gcli2api_bridge

        log_info("Bridge", f"[gcli2api] Gemini generateContent: {model}")

        result = await gcli2api_bridge.forward_request(
            path=f"/v1beta/models/{model}:generateContent",
            method="POST",
            json_data=body
        )

        # 记录使用日志
        log = UsageLog(
            user_id=user.id,
            model=model,
            endpoint="/v1beta/models:generateContent (gcli2api)",
            status_code=200,
            latency_ms=round((time.time() - start_time) * 1000, 1),
            client_ip=request.client.host if request.client else "unknown",
            user_agent=request.headers.get("User-Agent", "")[:500]
        )
        db.add(log)
        await db.commit()

        return JSONResponse(content=result)
    # ========== gcli2api 桥接模式结束 ==========
    # 未启用 gcli2api 桥接
    raise HTTPException(
        status_code=503,
        detail="Gemini 原生接口需要启用 gcli2api 桥接。请在 .env 中设置 ENABLE_GCLI2API_BRIDGE=true"
    )

@router.post("/v1beta/models/{model:path}:streamGenerateContent")
async def gemini_stream_generate_content(
    model: str,
    request: Request,
    user: User = Depends(get_user_from_api_key),
    db: AsyncSession = Depends(get_db)
):
    """Gemini 原生 streamGenerateContent 接口"""
    start_time = time.time()

    try:
        body = await request.json()
    except json.JSONDecodeError as e:
        log_error("Gemini CLI", f"streamGenerateContent JSON 解析错误: {e}")
        raise HTTPException(status_code=400, detail=f"无效的JSON请求体: {str(e)}")
    except Exception as e:
        log_error("Gemini CLI", f"streamGenerateContent 请求体读取失败: {e}")
        raise HTTPException(status_code=500, detail="请求处理失败")

    contents = body.get("contents", [])
    if not contents:
        raise HTTPException(status_code=400, detail="contents不能为空")

    # 清理模型名（移除 models/ 前缀）
    if model.startswith("models/"):
        model = model[7:]

    # ========== gcli2api 桥接模式 ==========
    if settings.enable_gcli2api_bridge:
        from app.services.gcli2api_bridge import gcli2api_bridge

        log_info("Bridge", f"[gcli2api] Gemini streamGenerateContent: {model}")

        response = await gcli2api_bridge.forward_stream(
            path=f"/v1beta/models/{model}:streamGenerateContent",
            json_data=body
        )

        # 记录使用日志（异步，不阻塞响应）
        try:
            log = UsageLog(
                user_id=user.id,
                model=model,
                endpoint="/v1beta/models:streamGenerateContent (gcli2api)",
                status_code=200,
                latency_ms=round((time.time() - start_time) * 1000, 1),
                client_ip=request.client.host if request.client else "unknown",
                user_agent=request.headers.get("User-Agent", "")[:500]
            )
            db.add(log)
            await db.commit()
        except Exception as log_err:
            log_error("Bridge", f"日志记录失败: {log_err}")

        return response
    # ========== gcli2api 桥接模式结束 ==========
    # 未启用 gcli2api 桥接
    raise HTTPException(
        status_code=503,
        detail="Gemini 原生接口需要启用 gcli2api 桥接。请在 .env 中设置 ENABLE_GCLI2API_BRIDGE=true"
    )

# ===== OpenAI 原生反代 =====

@router.api_route("/openai/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def openai_proxy(
    path: str,
    request: Request,
    user: User = Depends(get_user_from_api_key),
    db: AsyncSession = Depends(get_db)
):
    """OpenAI 原生 API 反代 - 直接转发到 OpenAI"""
    import httpx
    
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="未配置 OpenAI API Key，无法使用 OpenAI 反代")
    
    start_time = time.time()
    
    # 检查速率限制 - 管理员豁免
    user_has_public = await CredentialPool.check_user_has_public_creds(db, user.id)
    if not user.is_admin:
        one_minute_ago = datetime.utcnow() - timedelta(minutes=1)
        rpm_result = await db.execute(
            select(func.count(UsageLog.id))
            .where(UsageLog.user_id == user.id)
            .where(UsageLog.created_at >= one_minute_ago)
        )
        current_rpm = rpm_result.scalar() or 0
        max_rpm = settings.contributor_rpm if user_has_public else settings.base_rpm
        
        if current_rpm >= max_rpm:
            raise HTTPException(status_code=429, detail=f"速率限制: {max_rpm} 次/分钟")
    
    # 构建目标 URL
    target_url = f"{settings.openai_api_base}/{path}"
    if request.query_params:
        target_url += f"?{request.query_params}"
    
    # 获取请求体
    body = None
    if request.method in ["POST", "PUT", "PATCH"]:
        body = await request.body()
    
    # 构建请求头（替换 Authorization）
    headers = dict(request.headers)
    headers["Authorization"] = f"Bearer {settings.openai_api_key}"
    # 移除 host 头
    headers.pop("host", None)
    headers.pop("Host", None)
    
    # 记录日志
    async def log_usage(status_code: int = 200, error_msg: str = None):
        latency = round((time.time() - start_time), 1)
        
        # 错误分类
        error_type = None
        error_code = None
        if status_code != 200 and error_msg:
            error_type, error_code = classify_error_simple(status_code, error_msg)
        
        log = UsageLog(
            user_id=user.id,
            credential_id=None,
            model="openai",
            endpoint=f"/openai/{path}",
            status_code=status_code,
            latency_ms=latency,
            error_message=error_msg[:2000] if error_msg else None,
            error_type=error_type,
            error_code=error_code
        )
        db.add(log)
        await db.commit()
        await notify_log_update({
            "username": user.username,
            "model": "openai",
            "status_code": status_code,
            "error_type": error_type,
            "latency_ms": round(latency, 0),
            "created_at": datetime.utcnow().isoformat()
        })
        await notify_stats_update()
    
    # 判断是否是流式请求
    is_stream = False
    if body:
        try:
            body_json = json.loads(body)
            is_stream = body_json.get("stream", False)
        except (json.JSONDecodeError, TypeError, AttributeError) as e:
            log_warning("OpenAI Proxy", f"流式判断失败: {e}")
            is_stream = False

    log_info("OpenAI Proxy", f"{request.method} {target_url}, stream={is_stream}")
    
    try:
        if is_stream:
            # 流式响应
            async def stream_generator():
                log_recorded = False  # 标记是否已记录日志，避免重复记录
                try:
                    async with httpx.AsyncClient(timeout=120.0) as client:
                        async with client.stream(
                            request.method, target_url,
                            headers=headers,
                            content=body
                        ) as response:
                            if response.status_code != 200:
                                error = await response.aread()
                                await log_usage(response.status_code, error_msg=error.decode()[:500])
                                log_recorded = True
                                yield f"data: {json.dumps({'error': error.decode()})}\n\n"
                                return
                            
                            async for line in response.aiter_lines():
                                if line:
                                    yield f"{line}\n"
                    
                    await log_usage()
                    log_recorded = True
                except Exception as e:
                    error_str = str(e)
                    status_code = extract_status_code(error_str)
                    if not log_recorded:
                        await log_usage(status_code, error_msg=error_str)
                    yield f"data: {json.dumps({'error': error_str})}\n\n"
            
            return StreamingResponse(
                stream_generator(),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
            )
        else:
            # 非流式响应
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.request(
                    request.method, target_url,
                    headers=headers,
                    content=body
                )
                
                await log_usage(response.status_code)
                
                # 返回响应
                return JSONResponse(
                    content=response.json() if response.headers.get("content-type", "").startswith("application/json") else {"text": response.text},
                    status_code=response.status_code
                )
    
    except Exception as e:
        error_str = str(e)
        status_code = extract_status_code(error_str)
        await log_usage(status_code, error_msg=error_str)
        raise HTTPException(status_code=status_code, detail=f"OpenAI API 请求失败: {error_str}")
