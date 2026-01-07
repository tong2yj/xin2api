"""
gcli2api 桥接服务
用于将请求转发到 gcli2api 项目
"""

import httpx
from typing import Optional, Dict, Any, AsyncIterator
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class Gcli2apiBridge:
    """gcli2api 桥接客户端"""

    def __init__(self):
        self.base_url = settings.gcli2api_base_url
        self.api_password = settings.gcli2api_api_password
        self.panel_password = settings.gcli2api_panel_password
        self.timeout = 120.0

    def _get_auth_header(self, use_panel_password: bool = False) -> Dict[str, str]:
        """获取认证头"""
        password = self.panel_password if use_panel_password else self.api_password
        return {"Authorization": f"Bearer {password}"}

    async def forward_request(
        self,
        path: str,
        method: str = "POST",
        json_data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        use_panel_password: bool = False,
        stream: bool = False
    ) -> Any:
        """
        转发请求到 gcli2api

        Args:
            path: API 路径，如 "/v1/chat/completions"
            method: HTTP 方法
            json_data: JSON 请求体
            params: URL 参数
            headers: 额外的请求头
            use_panel_password: 是否使用面板密码（用于管理接口）
            stream: 是否为流式请求

        Returns:
            响应数据或 StreamingResponse
        """
        if not settings.enable_gcli2api_bridge:
            raise HTTPException(
                status_code=503,
                detail="gcli2api bridge is not enabled. Set ENABLE_GCLI2API_BRIDGE=true in .env"
            )

        url = f"{self.base_url}{path}"

        # 合并请求头
        forward_headers = self._get_auth_header(use_panel_password)
        if headers:
            forward_headers.update(headers)

        logger.info(f"[gcli2api Bridge] {method} {url}")

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                if method.upper() == "POST":
                    response = await client.post(
                        url,
                        json=json_data,
                        headers=forward_headers,
                        params=params
                    )
                elif method.upper() == "GET":
                    response = await client.get(
                        url,
                        headers=forward_headers,
                        params=params
                    )
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")

                # 检查响应状态
                if response.status_code >= 400:
                    logger.error(
                        f"[gcli2api Bridge] Error {response.status_code}: {response.text}"
                    )
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=response.text
                    )

                # 流式响应
                if stream:
                    return response

                # 非流式响应
                try:
                    return response.json()
                except Exception:
                    return response.text

        except httpx.TimeoutException:
            logger.error(f"[gcli2api Bridge] Timeout: {url}")
            raise HTTPException(
                status_code=504,
                detail="gcli2api service timeout"
            )
        except httpx.ConnectError:
            logger.error(f"[gcli2api Bridge] Connection failed: {url}")
            raise HTTPException(
                status_code=503,
                detail="Cannot connect to gcli2api service. Please ensure it's running."
            )
        except Exception as e:
            logger.error(f"[gcli2api Bridge] Unexpected error: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"gcli2api bridge error: {str(e)}"
            )

    async def forward_stream(
        self,
        path: str,
        json_data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        use_panel_password: bool = False
    ) -> StreamingResponse:
        """
        转发流式请求到 gcli2api

        Args:
            path: API 路径
            json_data: JSON 请求体
            headers: 额外的请求头
            use_panel_password: 是否使用面板密码

        Returns:
            StreamingResponse
        """
        if not settings.enable_gcli2api_bridge:
            raise HTTPException(
                status_code=503,
                detail="gcli2api bridge is not enabled"
            )

        url = f"{self.base_url}{path}"

        # 合并请求头
        forward_headers = self._get_auth_header(use_panel_password)
        if headers:
            forward_headers.update(headers)

        logger.info(f"[gcli2api Bridge] POST {url} (stream)")

        async def stream_generator() -> AsyncIterator[bytes]:
            """流式生成器"""
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    async with client.stream(
                        "POST",
                        url,
                        json=json_data,
                        headers=forward_headers
                    ) as response:
                        # 检查响应状态
                        if response.status_code >= 400:
                            error_text = await response.aread()
                            logger.error(
                                f"[gcli2api Bridge] Stream error {response.status_code}: {error_text}"
                            )
                            # 返回错误信息
                            yield f"data: {{\"error\": \"{error_text.decode()}\"}}\n\n".encode()
                            return

                        # 流式传输数据
                        async for chunk in response.aiter_bytes():
                            yield chunk

            except httpx.TimeoutException:
                logger.error(f"[gcli2api Bridge] Stream timeout: {url}")
                yield b"data: {\"error\": \"gcli2api service timeout\"}\n\n"
            except httpx.ConnectError:
                logger.error(f"[gcli2api Bridge] Stream connection failed: {url}")
                yield b"data: {\"error\": \"Cannot connect to gcli2api service\"}\n\n"
            except Exception as e:
                logger.error(f"[gcli2api Bridge] Stream error: {str(e)}")
                yield f"data: {{\"error\": \"{str(e)}\"}}\n\n".encode()

        return StreamingResponse(
            stream_generator(),
            media_type="text/event-stream"
        )


# 全局实例
gcli2api_bridge = Gcli2apiBridge()
