"""
Antigravity API Client - 简化版
用于调用 Google Antigravity 内部 API
"""
import httpx
import json
import uuid
from typing import Dict, Any, AsyncGenerator, Optional

# Antigravity API 配置
ANTIGRAVITY_API_BASE = "https://cloudcode-pa.googleapis.com"
ANTIGRAVITY_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"


def build_antigravity_request_body(
    contents: list,
    model: str,
    project_id: str,
    session_id: str,
    generation_config: Optional[Dict] = None,
    system_instruction: Optional[Dict] = None,
    tools: Optional[list] = None
) -> Dict[str, Any]:
    """
    构建 Antigravity 请求体

    Args:
        contents: 消息内容列表
        model: 模型名称
        project_id: 项目 ID
        session_id: 会话 ID
        generation_config: 生成配置
        system_instruction: 系统指令
        tools: 工具定义列表

    Returns:
        Antigravity 格式的请求体
    """
    request_body = {
        "project": project_id,
        "requestId": f"req-{uuid.uuid4()}",
        "model": model,
        "userAgent": "antigravity",
        "request": {
            "contents": contents,
            "session_id": session_id,
        }
    }

    # 添加生成配置
    if generation_config:
        request_body["request"]["generationConfig"] = generation_config

    # 添加系统指令
    if system_instruction:
        request_body["request"]["systemInstruction"] = system_instruction

    # 添加工具定义
    if tools:
        request_body["request"]["tools"] = tools
        request_body["request"]["toolConfig"] = {
            "functionCallingConfig": {"mode": "VALIDATED"}
        }

    return request_body


async def send_antigravity_request_stream(
    access_token: str,
    project_id: str,
    request_body: Dict[str, Any]
) -> AsyncGenerator[str, None]:
    """
    发送 Antigravity 流式请求

    Args:
        access_token: OAuth access token
        project_id: Google Cloud Project ID
        request_body: 请求体

    Yields:
        SSE 格式的响应行
    """
    headers = {
        'User-Agent': ANTIGRAVITY_USER_AGENT,
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip'
    }

    url = f"{ANTIGRAVITY_API_BASE}/v1internal:streamGenerateContent?alt=sse"

    timeout = httpx.Timeout(
        connect=30.0,
        read=180.0,
        write=30.0,
        pool=30.0
    )

    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", url, json=request_body, headers=headers) as response:
            if response.status_code != 200:
                error_text = await response.aread()
                error_msg = error_text.decode('utf-8', errors='ignore')
                print(f"[Antigravity] API错误 ({response.status_code}): {error_msg[:500]}", flush=True)
                raise Exception(f"Antigravity API error ({response.status_code}): {error_msg[:200]}")

            print(f"[Antigravity] 流式请求成功", flush=True)
            async for line in response.aiter_lines():
                if line:
                    yield line + "\n"


async def send_antigravity_request_no_stream(
    access_token: str,
    project_id: str,
    request_body: Dict[str, Any]
) -> Dict[str, Any]:
    """
    发送 Antigravity 非流式请求

    Args:
        access_token: OAuth access token
        project_id: Google Cloud Project ID
        request_body: 请求体

    Returns:
        响应数据
    """
    headers = {
        'User-Agent': ANTIGRAVITY_USER_AGENT,
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip'
    }

    url = f"{ANTIGRAVITY_API_BASE}/v1internal:generateContent"

    timeout = httpx.Timeout(
        connect=30.0,
        read=180.0,
        write=30.0,
        pool=30.0
    )

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, json=request_body, headers=headers)

        if response.status_code != 200:
            error_msg = response.text
            print(f"[Antigravity] API错误 ({response.status_code}): {error_msg[:500]}", flush=True)
            raise Exception(f"Antigravity API error ({response.status_code}): {error_msg[:200]}")

        print(f"[Antigravity] 非流式请求成功", flush=True)
        return response.json()


async def fetch_available_models(access_token: str) -> Dict[str, Any]:
    """
    获取可用模型列表

    Args:
        access_token: OAuth access token

    Returns:
        模型列表数据
    """
    headers = {
        'User-Agent': ANTIGRAVITY_USER_AGENT,
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
    }

    url = f"{ANTIGRAVITY_API_BASE}/v1internal:fetchAvailableModels"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json={}, headers=headers)

            if response.status_code == 200:
                data = response.json()
                print(f"[Antigravity] 获取模型列表成功", flush=True)
                return data
            else:
                print(f"[Antigravity] 获取模型列表失败 ({response.status_code})", flush=True)
                return {"models": {}}
    except Exception as e:
        print(f"[Antigravity] 获取模型列表异常: {e}", flush=True)
        return {"models": {}}
