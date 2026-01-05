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

from app.database import get_db
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

    # 如果用户没有自己的凭证，尝试使用公共池
    if not credential and settings.credential_pool_mode in ["tier3_shared", "full_shared"]:
        result = await db.execute(
            select(Credential)
            .where(Credential.is_public == True)
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


async def convert_antigravity_stream_to_openai(lines_generator, model: str, request_id: str):
    """将 Antigravity 流式响应转换为 OpenAI SSE 格式"""
    created = int(time.time())
    content_buffer = ""

    try:
        async for line in lines_generator:
            if not line or not line.startswith("data: "):
                continue

            raw = line[6:].strip()
            if raw == "[DONE]":
                yield "data: [DONE]\n\n"
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
                    usage = {
                        "prompt_tokens": usage_metadata.get("promptTokenCount", 0),
                        "completion_tokens": usage_metadata.get("candidatesTokenCount", 0),
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
                    break
            except Exception as e:
                print(f"[Antigravity] 解析错误: {e}", flush=True)
                continue
    except Exception as e:
        print(f"[Antigravity] 流式转换错误: {e}", flush=True)
        error_response = {
            "error": {
                "message": str(e),
                "type": "api_error",
                "code": 500
            }
        }
        yield f"data: {json.dumps(error_response)}\n\n"


async def convert_antigravity_stream_to_gemini(lines_generator):
    """将 Antigravity 流式响应转换为 Gemini SSE 格式"""
    try:
        async for line in lines_generator:
            if not line or not line.startswith("data: "):
                continue

            raw = line[6:].strip()
            if raw == "[DONE]":
                continue

            try:
                data = json.loads(raw)
                # Antigravity 响应格式: {"response": {...}}
                # Gemini 响应格式: {...}
                gemini_data = data.get("response", data)
                yield f"data: {json.dumps(gemini_data)}\n\n"
            except Exception as e:
                print(f"[Antigravity Gemini] 解析错误: {e}", flush=True)
                continue
    except Exception as e:
        print(f"[Antigravity Gemini] 流式转换错误: {e}", flush=True)
        error_response = {
            "error": {
                "message": str(e),
                "code": 500,
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

        total_quota = user.daily_quota + user.bonus_quota
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
            # 流式响应
            lines_gen = send_antigravity_request_stream(access_token, project_id, request_body)

            # 记录成功日志
            latency_ms = (time.time() - start_time) * 1000
            await log_usage(db, user, credential, model, "/antigravity/v1/chat/completions", 200, latency_ms=latency_ms)

            return StreamingResponse(
                convert_antigravity_stream_to_openai(lines_gen, model, request_id),
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
            latency_ms = (time.time() - start_time) * 1000
            await log_usage(
                db, user, credential, model, "/antigravity/v1/chat/completions", 200,
                latency_ms=latency_ms,
                tokens_input=usage["prompt_tokens"],
                tokens_output=usage["completion_tokens"]
            )

            return JSONResponse(content=openai_response)

    except Exception as e:
        # 记录错误日志
        latency_ms = (time.time() - start_time) * 1000
        await log_usage(db, user, credential, model, "/antigravity/v1/chat/completions", 500,
                       error_message=str(e), latency_ms=latency_ms)

        raise HTTPException(status_code=500, detail=f"Antigravity API错误: {str(e)}")


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
        print(f"[Antigravity] 获取模型列表失败: {e}", flush=True)
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
        print(f"[Antigravity Gemini] 获取模型列表失败: {e}", flush=True)
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
        latency_ms = (time.time() - start_time) * 1000
        await log_usage(db, user, credential, model, f"/antigravity/v1/models/{model}:generateContent", 200, latency_ms=latency_ms)

        return JSONResponse(content=gemini_response)

    except Exception as e:
        latency_ms = (time.time() - start_time) * 1000
        await log_usage(db, user, credential, model, f"/antigravity/v1/models/{model}:generateContent", 500,
                       error_message=str(e), latency_ms=latency_ms)
        raise HTTPException(status_code=500, detail=f"Antigravity API错误: {str(e)}")


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
        # 发送流式请求
        lines_gen = send_antigravity_request_stream(access_token, project_id, request_body)

        # 记录日志
        latency_ms = (time.time() - start_time) * 1000
        await log_usage(db, user, credential, model, f"/antigravity/v1/models/{model}:streamGenerateContent", 200, latency_ms=latency_ms)

        return StreamingResponse(
            convert_antigravity_stream_to_gemini(lines_gen),
            media_type="text/event-stream"
        )

    except Exception as e:
        latency_ms = (time.time() - start_time) * 1000
        await log_usage(db, user, credential, model, f"/antigravity/v1/models/{model}:streamGenerateContent", 500,
                       error_message=str(e), latency_ms=latency_ms)
        raise HTTPException(status_code=500, detail=f"Antigravity API错误: {str(e)}")
