"""
Antigravity 反代路由 - 完全复用 CatieCli 认证和权限系统
支持 OpenAI 兼容接口和 Gemini 原生接口
"""
from fastapi import APIRouter, Request, HTTPException, Depends, Path
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json
import time
import uuid
from datetime import datetime, timedelta

from app.database import get_db, async_session
from app.models.user import User, Credential, UsageLog
from app.services.auth import get_user_by_api_key
from app.services.antigravity_client import (
    build_antigravity_request_body,
    send_antigravity_request_stream,
    send_antigravity_request_no_stream,
    fetch_available_models
)
from app.services.crypto import decrypt_credential
from app.config import settings
from app.utils.logger import log_warning, log_error


def extract_status_code(error_str: str, default: int = 500) -> int:
    """从错误信息中提取HTTP状态码"""
    import re
    patterns = [
        r'API error \((\d{3})\)',  # Antigravity API error (401)
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

router = APIRouter(prefix="/antigravity", tags=["Antigravity反代"])


async def get_user_and_credential_from_api_key(request: Request, db: AsyncSession = Depends(get_db)):
    """
    从请求中提取API Key并验证用户，返回 (user, credential)
    完全复用 CatieCli 的认证逻辑
    """
    # 1. 提取 API Key (支持多种方式)
    api_key = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        api_key = auth_header[7:]

    if not api_key:
        api_key = request.headers.get("x-api-key")

    if not api_key:
        api_key = request.headers.get("x-goog-api-key")

    if not api_key:
        api_key = request.query_params.get("key")

    if not api_key:
        raise HTTPException(status_code=401, detail="未提供API Key")

    # 2. 验证用户 (复用现有函数)
    user = await get_user_by_api_key(db, api_key)
    if not user:
        raise HTTPException(status_code=401, detail="无效的API Key")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="账户已被禁用")

    # 3. 获取用户的可用 Antigravity 凭证
    # 只使用 oauth_antigravity 类型的凭证
    # 优先获取用户自己的凭证，如果没有则尝试公共池（根据配置）
    result = await db.execute(
        select(Credential)
        .where(Credential.user_id == user.id)
        .where(Credential.credential_type == "oauth_antigravity")  # 只查找 Antigravity 凭证
        .where(Credential.is_active == True)
        .order_by(Credential.last_used_at.asc().nullsfirst())
        .limit(1)
    )
    credential = result.scalar_one_or_none()

    # 如果用户没有自己的凭证，使用任意可用凭证（所有用户都可以使用所有凭证）
    if not credential:
        result = await db.execute(
            select(Credential)
            .where(Credential.credential_type == "oauth_antigravity")  # 只查找 Antigravity 凭证
            .where(Credential.is_active == True)
            .order_by(Credential.last_used_at.asc().nullsfirst())
            .limit(1)
        )
        credential = result.scalar_one_or_none()

    if not credential:
        raise HTTPException(status_code=403, detail="没有可用的 Antigravity 凭证，请先上传 Antigravity 专用凭证")

    return user, credential


def openai_to_antigravity_contents(messages: list) -> list:
    """将 OpenAI 消息格式转换为 Antigravity contents"""
    contents = []
    system_messages = []

    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")

        if role == "system":
            system_messages.append(content)
            continue
        elif role == "user":
            parts = []
            # 如果有系统消息，合并到第一条用户消息
            if system_messages:
                for sys_msg in system_messages:
                    parts.append({"text": sys_msg})
                system_messages = []
            parts.append({"text": content})
            contents.append({"role": "user", "parts": parts})
        elif role == "assistant":
            contents.append({
                "role": "model",
                "parts": [{"text": content}]
            })

    return contents


def gemini_to_antigravity_contents(gemini_contents: list) -> list:
    """将 Gemini 原生 contents 格式转换为 Antigravity contents"""
    # Gemini 和 Antigravity 格式基本一致，直接返回
    return gemini_contents


async def convert_antigravity_stream_to_openai(
    lines_generator,
    model: str,
    request_id: str,
    user_id: int = None,
    credential_id: int = None,
    credential_email: str = None,
    start_time: float = None
):
    """将 Antigravity 流式响应转换为 OpenAI SSE 格式，并在完成时记录日志"""
    created = int(time.time())
    content_buffer = ""
    stream_success = False
    tokens_input = 0
    tokens_output = 0

    try:
        async for line in lines_generator:
            if not line or not line.startswith("data: "):
                continue

            raw = line[6:].strip()
            if raw == "[DONE]":
                yield "data: [DONE]\n\n"
                stream_success = True
                break

            try:
                data = json.loads(raw)
                parts = data.get("response", {}).get("candidates", [{}])[0].get("content", {}).get("parts", [])

                for part in parts:
                    # 处理文本内容
                    if "text" in part:
                        text = part.get("text", "")
                        content_buffer += text

                        chunk = {
                            "id": request_id,
                            "object": "chat.completion.chunk",
                            "created": created,
                            "model": model,
                            "choices": [{
                                "index": 0,
                                "delta": {"content": text},
                                "finish_reason": None
                            }]
                        }
                        yield f"data: {json.dumps(chunk)}\n\n"

                # 检查是否结束
                finish_reason = data.get("response", {}).get("candidates", [{}])[0].get("finishReason")
                if finish_reason:
                    # 提取使用统计
                    usage_metadata = data.get("response", {}).get("usageMetadata", {})
                    tokens_input = usage_metadata.get("promptTokenCount", 0)
                    tokens_output = usage_metadata.get("candidatesTokenCount", 0)
                    usage = {
                        "prompt_tokens": tokens_input,
                        "completion_tokens": tokens_output,
                        "total_tokens": usage_metadata.get("totalTokenCount", 0)
                    }

                    chunk = {
                        "id": request_id,
                        "object": "chat.completion.chunk",
                        "created": created,
                        "model": model,
                        "choices": [{
                            "index": 0,
                            "delta": {},
                            "finish_reason": "stop"
                        }],
                        "usage": usage
                    }
                    yield f"data: {json.dumps(chunk)}\n\n"
                    yield "data: [DONE]\n\n"
                    stream_success = True
                    break
            except Exception as e:
                log_error("Antigravity", f"解析错误: {e}")
                continue

        # 流式传输成功完成，记录成功日志
        if stream_success and user_id and credential_id:
            try:
                async with async_session() as log_db:
                    latency_ms = round((time.time() - start_time), 1) if start_time else None
                    log = UsageLog(
                        user_id=user_id,
                        credential_id=credential_id,
                        model=model,
                        endpoint="/v1/chat/completions",
                        status_code=200,
                        latency_ms=latency_ms,
                        tokens_input=tokens_input,
                        tokens_output=tokens_output,
                        credential_email=credential_email,
                        created_at=datetime.utcnow()
                    )
                    log_db.add(log)
                    # 更新凭证使用时间
                    from sqlalchemy import update
                    await log_db.execute(
                        update(Credential)
                        .where(Credential.id == credential_id)
                        .values(
                            last_used_at=datetime.utcnow(),
                            total_requests=Credential.total_requests + 1
                        )
                    )
                    await log_db.commit()
            except Exception as log_err:
                log_error("Antigravity", f"日志记录失败: {log_err}")

    except Exception as e:
        error_msg = str(e)
        log_error("Antigravity", f"流式转换错误: {e}")

        # 记录错误日志
        if user_id and credential_id:
            try:
                actual_status_code = extract_status_code(error_msg, 500)
                async with async_session() as err_db:
                    latency_ms = round((time.time() - start_time), 1) if start_time else None
                    log = UsageLog(
                        user_id=user_id,
                        credential_id=credential_id,
                        model=model,
                        endpoint="/v1/chat/completions",
                        status_code=actual_status_code,
                        error_message=error_msg[:2000],
                        latency_ms=latency_ms,
                        credential_email=credential_email,
                        created_at=datetime.utcnow()
                    )
                    err_db.add(log)
                    # 更新凭证错误信息
                    from sqlalchemy import update
                    await err_db.execute(
                        update(Credential)
                        .where(Credential.id == credential_id)
                        .values(
                            last_used_at=datetime.utcnow(),
                            total_requests=Credential.total_requests + 1,
                            failed_requests=Credential.failed_requests + 1,
                            last_error=error_msg[:500]
                        )
                    )
                    await err_db.commit()
            except Exception as log_err:
                log_error("Antigravity", f"错误日志记录失败: {log_err}")

        error_response = {
            "error": {
                "message": str(e),
                "type": "api_error",
                "code": extract_status_code(error_msg, 500)
            }
        }
        yield f"data: {json.dumps(error_response)}\n\n"


async def convert_antigravity_stream_to_gemini(
    lines_generator,
    model: str = None,
    user_id: int = None,
    credential_id: int = None,
    credential_email: str = None,
    start_time: float = None,
    endpoint: str = None
):
    """将 Antigravity 流式响应转换为 Gemini SSE 格式，并在完成时记录日志"""
    stream_success = False

    try:
        async for line in lines_generator:
            if not line or not line.startswith("data: "):
                continue

            raw = line[6:].strip()
            if raw == "[DONE]":
                stream_success = True
                continue

            try:
                data = json.loads(raw)
                # Antigravity 响应格式: {"response": {...}}
                # Gemini 响应格式: {...}
                gemini_data = data.get("response", data)

                # 检查是否有 finishReason，表示流结束
                candidates = gemini_data.get("candidates", [])
                if candidates and candidates[0].get("finishReason"):
                    stream_success = True

                yield f"data: {json.dumps(gemini_data)}\n\n"
            except Exception as e:
                log_error("Antigravity", f"Gemini 解析错误: {e}")
                continue

        # 流式传输成功完成，记录成功日志
        if stream_success and user_id and credential_id:
            try:
                async with async_session() as log_db:
                    latency_ms = round((time.time() - start_time), 1) if start_time else None
                    log = UsageLog(
                        user_id=user_id,
                        credential_id=credential_id,
                        model=model,
                        endpoint=endpoint or "/antigravity/gemini",
                        status_code=200,
                        latency_ms=latency_ms,
                        credential_email=credential_email,
                        created_at=datetime.utcnow()
                    )
                    log_db.add(log)
                    # 更新凭证使用时间
                    from sqlalchemy import update
                    await log_db.execute(
                        update(Credential)
                        .where(Credential.id == credential_id)
                        .values(
                            last_used_at=datetime.utcnow(),
                            total_requests=Credential.total_requests + 1
                        )
                    )
                    await log_db.commit()
            except Exception as log_err:
                log_error("Antigravity", f"Gemini 日志记录失败: {log_err}")

    except Exception as e:
        error_msg = str(e)
        log_error("Antigravity", f"Gemini 流式转换错误: {e}")

        # 记录错误日志
        if user_id and credential_id:
            try:
                actual_status_code = extract_status_code(error_msg, 500)
                async with async_session() as err_db:
                    latency_ms = round((time.time() - start_time), 1) if start_time else None
                    log = UsageLog(
                        user_id=user_id,
                        credential_id=credential_id,
                        model=model,
                        endpoint=endpoint or "/antigravity/gemini",
                        status_code=actual_status_code,
                        error_message=error_msg[:2000],
                        latency_ms=latency_ms,
                        credential_email=credential_email,
                        created_at=datetime.utcnow()
                    )
                    err_db.add(log)
                    # 更新凭证错误信息
                    from sqlalchemy import update
                    await err_db.execute(
                        update(Credential)
                        .where(Credential.id == credential_id)
                        .values(
                            last_used_at=datetime.utcnow(),
                            total_requests=Credential.total_requests + 1,
                            failed_requests=Credential.failed_requests + 1,
                            last_error=error_msg[:500]
                        )
                    )
                    await err_db.commit()
            except Exception as log_err:
                log_error("Antigravity", f"Gemini 错误日志记录失败: {log_err}")

        error_response = {
            "error": {
                "message": str(e),
                "code": extract_status_code(error_msg, 500),
                "status": "INTERNAL"
            }
        }
        yield f"data: {json.dumps(error_response)}\n\n"


async def log_usage(
    db: AsyncSession,
    user: User,
    credential: Credential,
    model: str,
    endpoint: str,
    status_code: int,
    error_message: str = None,
    latency_ms: float = None,
    tokens_input: int = 0,
    tokens_output: int = 0
):
    """记录使用日志 (复用 CatieCli 的日志系统)"""
    log = UsageLog(
        user_id=user.id,
        credential_id=credential.id,
        model=model,
        endpoint=endpoint,
        status_code=status_code,
        error_message=error_message,
        latency_ms=latency_ms,
        tokens_input=tokens_input,
        tokens_output=tokens_output,
        credential_email=credential.email,
        created_at=datetime.utcnow()
    )
    db.add(log)

    # 更新凭证使用时间
    credential.last_used_at = datetime.utcnow()
    credential.total_requests += 1
    if status_code != 200:
        credential.failed_requests += 1
        credential.last_error = error_message

    await db.commit()


# ==================== OpenAI 兼容接口 ====================

async def handle_chat_completions_antigravity(request: Request, user: User, db: AsyncSession, body: dict):
    """
    Antigravity 聊天补全处理函数（可被 proxy.py 调用）
    - 接收已认证的 user 和解析好的 body
    - 返回 StreamingResponse 或 JSONResponse
    """
    start_time = time.time()

    # 1. 获取 Antigravity 凭证
    result = await db.execute(
        select(Credential)
        .where(Credential.user_id == user.id)
        .where(Credential.credential_type == "oauth_antigravity")
        .where(Credential.is_active == True)
        .order_by(Credential.last_used_at.asc().nullsfirst())
        .limit(1)
    )
    credential = result.scalar_one_or_none()

    # 如果用户没有自己的凭证，使用任意可用凭证（所有用户都可以使用所有凭证）
    if not credential:
        result = await db.execute(
            select(Credential)
            .where(Credential.credential_type == "oauth_antigravity")
            .where(Credential.is_active == True)
            .order_by(Credential.last_used_at.asc().nullsfirst())
            .limit(1)
        )
        credential = result.scalar_one_or_none()

    if not credential:
        raise HTTPException(status_code=403, detail="没有可用的 Antigravity 凭证，请先上传 Antigravity 专用凭证")

    # 2. 解析请求（移除 ag- 前缀）
    model = body.get("model", "gemini-2.5-flash")
    if model.startswith("ag-"):
        model = model[3:]  # 移除 ag- 前缀

    messages = body.get("messages", [])
    stream = body.get("stream", False)

    # 3. 检查配额 (管理员无限制)
    if not user.is_admin:
        # 检查今日配额
        now = datetime.utcnow()
        reset_time_utc = now.replace(hour=7, minute=0, second=0, microsecond=0)
        if now < reset_time_utc:
            start_of_day = reset_time_utc - timedelta(days=1)
        else:
            start_of_day = reset_time_utc

        # 统计今日使用量
        result = await db.execute(
            select(UsageLog)
            .where(UsageLog.user_id == user.id)
            .where(UsageLog.created_at >= start_of_day)
            .where(UsageLog.status_code == 200)
        )
        today_logs = result.scalars().all()
        today_usage = len(today_logs)

        total_quota = user.daily_quota
        if today_usage >= total_quota:
            raise HTTPException(status_code=429, detail=f"今日配额已用完 ({today_usage}/{total_quota})")

    # 4. 转换消息格式
    contents = openai_to_antigravity_contents(messages)

    # 5. 解密凭证
    access_token = decrypt_credential(credential.api_key)
    project_id = credential.project_id or "default-project"

    # 6. 构建请求
    session_id = f"session-{uuid.uuid4().hex}"
    generation_config = {
        "temperature": body.get("temperature", 1.0),
        "topP": body.get("top_p", 0.95),
        "maxOutputTokens": body.get("max_tokens", 8192),
        "candidateCount": 1,
    }

    request_body = build_antigravity_request_body(
        contents=contents,
        model=model,
        project_id=project_id,
        session_id=session_id,
        generation_config=generation_config
    )

    request_id = f"chatcmpl-{int(time.time() * 1000)}"

    try:
        if stream:
            # 流式响应 - 日志在流完成后由 convert_antigravity_stream_to_openai 记录
            lines_gen = send_antigravity_request_stream(access_token, project_id, request_body)

            return StreamingResponse(
                convert_antigravity_stream_to_openai(
                    lines_gen,
                    f"ag-{model}",
                    request_id,
                    user_id=user.id,
                    credential_id=credential.id,
                    credential_email=credential.email,
                    start_time=start_time
                ),
                media_type="text/event-stream"
            )
        else:
            # 非流式响应
            response_data = await send_antigravity_request_no_stream(access_token, project_id, request_body)

            # 提取文本
            parts = response_data.get("response", {}).get("candidates", [{}])[0].get("content", {}).get("parts", [])
            content = "".join(part.get("text", "") for part in parts if "text" in part)

            # 提取使用统计
            usage_metadata = response_data.get("response", {}).get("usageMetadata", {})
            usage = {
                "prompt_tokens": usage_metadata.get("promptTokenCount", 0),
                "completion_tokens": usage_metadata.get("candidatesTokenCount", 0),
                "total_tokens": usage_metadata.get("totalTokenCount", 0)
            }

            # 构建 OpenAI 格式响应
            openai_response = {
                "id": request_id,
                "object": "chat.completion",
                "created": int(time.time()),
                "model": f"ag-{model}",  # 返回时带上 ag- 前缀
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": content
                    },
                    "finish_reason": "stop"
                }],
                "usage": usage
            }

            # 记录成功日志
            latency_ms = round((time.time() - start_time), 1)
            await log_usage(
                db, user, credential, f"ag-{model}", "/v1/chat/completions", 200,
                latency_ms=latency_ms,
                tokens_input=usage["prompt_tokens"],
                tokens_output=usage["completion_tokens"]
            )

            return JSONResponse(content=openai_response)

    except Exception as e:
        # 记录错误日志
        error_msg = str(e)
        actual_status_code = extract_status_code(error_msg, 500)
        latency_ms = round((time.time() - start_time), 1)
        await log_usage(db, user, credential, f"ag-{model}", "/v1/chat/completions", actual_status_code,
                       error_message=error_msg, latency_ms=latency_ms)

        raise HTTPException(status_code=actual_status_code, detail=f"Antigravity API错误: {error_msg}")


@router.post("/v1/chat/completions")
async def antigravity_chat_completions(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Antigravity OpenAI 兼容接口
    - 使用 CatieCli 的 API Key 认证
    - 支持管理员/用户权限区分
    - 记录使用日志
    """
    start_time = time.time()

    # 1. 验证用户并获取凭证
    user, credential = await get_user_and_credential_from_api_key(request, db)

    # 2. 解析请求
    body = await request.json()
    model = body.get("model", "gemini-2.5-flash")
    messages = body.get("messages", [])
    stream = body.get("stream", False)

    # 3. 检查配额 (管理员无限制)
    if not user.is_admin:
        # 检查今日配额
        now = datetime.utcnow()
        reset_time_utc = now.replace(hour=7, minute=0, second=0, microsecond=0)
        if now < reset_time_utc:
            start_of_day = reset_time_utc - timedelta(days=1)
        else:
            start_of_day = reset_time_utc

        # 统计今日使用量
        result = await db.execute(
            select(UsageLog)
            .where(UsageLog.user_id == user.id)
            .where(UsageLog.created_at >= start_of_day)
            .where(UsageLog.status_code == 200)
        )
        today_logs = result.scalars().all()
        today_usage = len(today_logs)

        total_quota = user.daily_quota
        if today_usage >= total_quota:
            raise HTTPException(status_code=429, detail=f"今日配额已用完 ({today_usage}/{total_quota})")

    # 4. 转换消息格式
    contents = openai_to_antigravity_contents(messages)

    # 5. 解密凭证
    access_token = decrypt_credential(credential.api_key)
    project_id = credential.project_id or "default-project"

    # 6. 构建请求
    session_id = f"session-{uuid.uuid4().hex}"
    generation_config = {
        "temperature": body.get("temperature", 1.0),
        "topP": body.get("top_p", 0.95),
        "maxOutputTokens": body.get("max_tokens", 8192),
        "candidateCount": 1,
    }

    request_body = build_antigravity_request_body(
        contents=contents,
        model=model,
        project_id=project_id,
        session_id=session_id,
        generation_config=generation_config
    )

    request_id = f"chatcmpl-{int(time.time() * 1000)}"

    try:
        if stream:
            # 流式响应 - 日志在流完成后由 convert_antigravity_stream_to_openai 记录
            lines_gen = send_antigravity_request_stream(access_token, project_id, request_body)

            return StreamingResponse(
                convert_antigravity_stream_to_openai(
                    lines_gen,
                    model,
                    request_id,
                    user_id=user.id,
                    credential_id=credential.id,
                    credential_email=credential.email,
                    start_time=start_time
                ),
                media_type="text/event-stream"
            )
        else:
            # 非流式响应
            response_data = await send_antigravity_request_no_stream(access_token, project_id, request_body)

            # 提取文本
            parts = response_data.get("response", {}).get("candidates", [{}])[0].get("content", {}).get("parts", [])
            content = "".join(part.get("text", "") for part in parts if "text" in part)

            # 提取使用统计
            usage_metadata = response_data.get("response", {}).get("usageMetadata", {})
            usage = {
                "prompt_tokens": usage_metadata.get("promptTokenCount", 0),
                "completion_tokens": usage_metadata.get("candidatesTokenCount", 0),
                "total_tokens": usage_metadata.get("totalTokenCount", 0)
            }

            # 构建 OpenAI 格式响应
            openai_response = {
                "id": request_id,
                "object": "chat.completion",
                "created": int(time.time()),
                "model": model,
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": content
                    },
                    "finish_reason": "stop"
                }],
                "usage": usage
            }

            # 记录成功日志
            latency_ms = round((time.time() - start_time), 1)
            await log_usage(
                db, user, credential, model, "/antigravity/v1/chat/completions", 200,
                latency_ms=latency_ms,
                tokens_input=usage["prompt_tokens"],
                tokens_output=usage["completion_tokens"]
            )

            return JSONResponse(content=openai_response)

    except Exception as e:
        # 记录错误日志
        error_msg = str(e)
        actual_status_code = extract_status_code(error_msg, 500)
        latency_ms = round((time.time() - start_time), 1)
        await log_usage(db, user, credential, model, "/antigravity/v1/chat/completions", actual_status_code,
                       error_message=error_msg, latency_ms=latency_ms)

        raise HTTPException(status_code=actual_status_code, detail=f"Antigravity API错误: {error_msg}")


@router.get("/v1/models")
async def list_antigravity_models(request: Request, db: AsyncSession = Depends(get_db)):
    """
    列出可用的 Antigravity 模型
    需要认证
    """
    # 验证用户
    user, credential = await get_user_and_credential_from_api_key(request, db)

    # 尝试从 API 获取模型列表
    try:
        access_token = decrypt_credential(credential.api_key)
        models_data = await fetch_available_models(access_token)

        model_list = []
        if "models" in models_data and isinstance(models_data["models"], dict):
            for model_id in models_data["models"].keys():
                model_list.append({
                    "id": model_id,
                    "object": "model",
                    "created": int(time.time()),
                    "owned_by": "google"
                })
    except Exception as e:
        log_warning("Antigravity", f"获取模型列表失败: {e}")
        # 返回默认模型列表
        model_list = [
            {"id": "gemini-2.5-flash", "object": "model", "created": int(time.time()), "owned_by": "google"},
            {"id": "gemini-2.5-pro", "object": "model", "created": int(time.time()), "owned_by": "google"},
            {"id": "gemini-3-pro-preview", "object": "model", "created": int(time.time()), "owned_by": "google"},
            {"id": "claude-sonnet-4-5", "object": "model", "created": int(time.time()), "owned_by": "google"},
            {"id": "claude-opus-4-5", "object": "model", "created": int(time.time()), "owned_by": "google"},
        ]

    return {"object": "list", "data": model_list}


# ==================== Gemini 原生接口 ====================

@router.get("/v1beta/models")
@router.get("/v1/models")
async def gemini_list_models(request: Request, db: AsyncSession = Depends(get_db)):
    """返回 Gemini 格式的模型列表"""
    # 验证用户
    user, credential = await get_user_and_credential_from_api_key(request, db)

    # 尝试从 API 获取模型列表
    try:
        access_token = decrypt_credential(credential.api_key)
        models_data = await fetch_available_models(access_token)

        gemini_models = []
        if "models" in models_data and isinstance(models_data["models"], dict):
            for model_id in models_data["models"].keys():
                gemini_models.append({
                    "name": f"models/{model_id}",
                    "version": "001",
                    "displayName": model_id,
                    "description": f"Antigravity API - {model_id}",
                    "supportedGenerationMethods": ["generateContent", "streamGenerateContent"],
                })
    except Exception as e:
        log_warning("Antigravity", f"Gemini 获取模型列表失败: {e}")
        # 返回默认模型列表
        gemini_models = [
            {"name": "models/gemini-2.5-flash", "version": "001", "displayName": "gemini-2.5-flash",
             "description": "Antigravity API - gemini-2.5-flash", "supportedGenerationMethods": ["generateContent", "streamGenerateContent"]},
            {"name": "models/gemini-2.5-pro", "version": "001", "displayName": "gemini-2.5-pro",
             "description": "Antigravity API - gemini-2.5-pro", "supportedGenerationMethods": ["generateContent", "streamGenerateContent"]},
        ]

    return JSONResponse(content={"models": gemini_models})


@router.post("/v1beta/models/{model:path}:generateContent")
@router.post("/v1/models/{model:path}:generateContent")
async def gemini_generate_content(
    model: str = Path(..., description="Model name"),
    request: Request = None,
    db: AsyncSession = Depends(get_db)
):
    """处理 Gemini 格式的非流式内容生成请求"""
    start_time = time.time()

    # 验证用户并获取凭证
    user, credential = await get_user_and_credential_from_api_key(request, db)

    # 解析请求
    request_data = await request.json()

    # 提取模型名称（移除 "models/" 前缀）
    if model.startswith("models/"):
        model = model[7:]

    # 转换 contents
    contents = gemini_to_antigravity_contents(request_data.get("contents", []))

    # 解密凭证
    access_token = decrypt_credential(credential.api_key)
    project_id = credential.project_id or "default-project"

    # 构建请求
    session_id = f"session-{uuid.uuid4().hex}"
    gemini_config = request_data.get("generationConfig", {})
    generation_config = {
        "temperature": gemini_config.get("temperature", 1.0),
        "topP": gemini_config.get("topP", 0.95),
        "topK": gemini_config.get("topK", 40),
        "maxOutputTokens": gemini_config.get("maxOutputTokens", 8192),
        "candidateCount": 1,
    }

    system_instruction = request_data.get("systemInstruction")
    tools = request_data.get("tools")

    request_body = build_antigravity_request_body(
        contents=contents,
        model=model,
        project_id=project_id,
        session_id=session_id,
        generation_config=generation_config,
        system_instruction=system_instruction,
        tools=tools
    )

    try:
        # 发送非流式请求
        response_data = await send_antigravity_request_no_stream(access_token, project_id, request_body)

        # 转换为 Gemini 格式
        gemini_response = response_data.get("response", response_data)

        # 记录日志
        latency_ms = round((time.time() - start_time), 1)
        await log_usage(db, user, credential, model, f"/antigravity/v1/models/{model}:generateContent", 200, latency_ms=latency_ms)

        return JSONResponse(content=gemini_response)

    except Exception as e:
        error_msg = str(e)
        actual_status_code = extract_status_code(error_msg, 500)
        latency_ms = round((time.time() - start_time), 1)
        await log_usage(db, user, credential, model, f"/antigravity/v1/models/{model}:generateContent", actual_status_code,
                       error_message=error_msg, latency_ms=latency_ms)
        raise HTTPException(status_code=actual_status_code, detail=f"Antigravity API错误: {error_msg}")


@router.post("/v1beta/models/{model:path}:streamGenerateContent")
@router.post("/v1/models/{model:path}:streamGenerateContent")
async def gemini_stream_generate_content(
    model: str = Path(..., description="Model name"),
    request: Request = None,
    db: AsyncSession = Depends(get_db)
):
    """处理 Gemini 格式的流式内容生成请求"""
    start_time = time.time()

    # 验证用户并获取凭证
    user, credential = await get_user_and_credential_from_api_key(request, db)

    # 解析请求
    request_data = await request.json()

    # 提取模型名称（移除 "models/" 前缀）
    if model.startswith("models/"):
        model = model[7:]

    # 转换 contents
    contents = gemini_to_antigravity_contents(request_data.get("contents", []))

    # 解密凭证
    access_token = decrypt_credential(credential.api_key)
    project_id = credential.project_id or "default-project"

    # 构建请求
    session_id = f"session-{uuid.uuid4().hex}"
    gemini_config = request_data.get("generationConfig", {})
    generation_config = {
        "temperature": gemini_config.get("temperature", 1.0),
        "topP": gemini_config.get("topP", 0.95),
        "topK": gemini_config.get("topK", 40),
        "maxOutputTokens": gemini_config.get("maxOutputTokens", 8192),
        "candidateCount": 1,
    }

    system_instruction = request_data.get("systemInstruction")
    tools = request_data.get("tools")

    request_body = build_antigravity_request_body(
        contents=contents,
        model=model,
        project_id=project_id,
        session_id=session_id,
        generation_config=generation_config,
        system_instruction=system_instruction,
        tools=tools
    )

    try:
        # 发送流式请求 - 日志在流完成后由 convert_antigravity_stream_to_gemini 记录
        lines_gen = send_antigravity_request_stream(access_token, project_id, request_body)

        return StreamingResponse(
            convert_antigravity_stream_to_gemini(
                lines_gen,
                model=model,
                user_id=user.id,
                credential_id=credential.id,
                credential_email=credential.email,
                start_time=start_time,
                endpoint=f"/antigravity/v1/models/{model}:streamGenerateContent"
            ),
            media_type="text/event-stream"
        )

    except Exception as e:
        error_msg = str(e)
        actual_status_code = extract_status_code(error_msg, 500)
        latency_ms = round((time.time() - start_time), 1)
        await log_usage(db, user, credential, model, f"/antigravity/v1/models/{model}:streamGenerateContent", actual_status_code,
                       error_message=error_msg, latency_ms=latency_ms)
        raise HTTPException(status_code=actual_status_code, detail=f"Antigravity API错误: {error_msg}")
