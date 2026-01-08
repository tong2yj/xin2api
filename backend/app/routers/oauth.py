from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
import httpx
import secrets
import json
from urllib.parse import urlencode, quote

from app.database import get_db
from app.models.user import User, Credential
from app.services.auth import get_current_user, get_current_admin
from app.config import settings
from app.services.credential_pool import fetch_project_id
from app.utils.logger import log_info, log_warning, log_error, log_success

router = APIRouter(prefix="/api/oauth", tags=["OAuth认证"])

# OAuth 配置
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

# OAuth 所需的 scope
OAUTH_SCOPES = [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]

# Antigravity OAuth 所需的 scope（额外增加两个权限）
ANTIGRAVITY_SCOPES = [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/cclog",
    "https://www.googleapis.com/auth/experimentsandconfigs",
]

# 存储 OAuth state (生产环境应使用 Redis)
oauth_states = {}


class OAuthConfig(BaseModel):
    client_id: str
    client_secret: str


class CallbackURLRequest(BaseModel):
    callback_url: str
    is_public: bool = False  # 是否捐赠到公共池
    for_antigravity: bool = False  # 是否用于 Antigravity


@router.get("/config")
async def get_oauth_config(admin: User = Depends(get_current_admin)):
    """获取 OAuth 配置状态"""
    return {
        "configured": bool(settings.google_client_id and settings.google_client_secret),
        "client_id": settings.google_client_id[:20] + "..." if settings.google_client_id else None
    }


@router.post("/config")
async def set_oauth_config(
    config: OAuthConfig,
    admin: User = Depends(get_current_admin)
):
    """设置 OAuth 配置 (仅运行时生效)"""
    settings.google_client_id = config.client_id
    settings.google_client_secret = config.client_secret
    return {"message": "配置已更新"}


@router.get("/auth-url")
async def get_auth_url(
    request: Request,
    get_all_projects: bool = False,
    for_antigravity: bool = False,  # 新增：是否用于 Antigravity
    user: User = Depends(get_current_user)
):
    """获取 OAuth 认证链接（需登录）"""
    return await _get_auth_url_impl(get_all_projects, user.id if user else None, for_antigravity)


async def _get_auth_url_impl(get_all_projects: bool, user_id: int = None, for_antigravity: bool = False):
    """获取 OAuth 认证链接实现"""

    # ========== gcli2api 桥接模式 ==========
    if settings.enable_gcli2api_bridge:
        from app.services.gcli2api_bridge import gcli2api_bridge

        log_info("Bridge", f"[gcli2api] OAuth 获取认证链接, for_antigravity={for_antigravity}")

        try:
            result = await gcli2api_bridge.forward_request(
                path="/auth/start",
                method="POST",
                json_data={
                    "mode": "antigravity" if for_antigravity else "geminicli"
                },
                use_panel_password=True  # OAuth 接口使用面板密码
            )

            # gcli2api 返回格式: {"auth_url": "...", "callback_port": 11451}
            return {
                "auth_url": result.get("auth_url"),
                "state": "gcli2api_bridge",  # 标记为桥接模式
                "redirect_uri": f"http://localhost:{result.get('callback_port', 11451)}"
            }
        except Exception as e:
            log_error("Bridge", f"获取OAuth链接失败: {e}")
            raise HTTPException(status_code=500, detail=f"gcli2api OAuth 失败: {str(e)}")
    # ========== gcli2api 桥接模式结束 ==========

    # 根据凭证类型选择不同的 OAuth 配置
    if for_antigravity:
        client_id = settings.antigravity_client_id
        client_secret = settings.antigravity_client_secret
        scopes = ANTIGRAVITY_SCOPES
    else:
        client_id = settings.google_client_id
        client_secret = settings.google_client_secret
        scopes = OAUTH_SCOPES

    if not client_id:
        raise HTTPException(status_code=400, detail="未配置 OAuth Client ID")

    # 生成 state
    state = secrets.token_urlsafe(32)
    oauth_states[state] = {
        "user_id": user_id,
        "get_all_projects": get_all_projects,
        "for_antigravity": for_antigravity  # 保存凭证类型标记
    }

    # Gemini CLI 官方 OAuth 固定使用 localhost:8080 作为回调
    redirect_uri = "http://localhost:8080"

    # 构建 OAuth URL
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": " ".join(scopes),
        "response_type": "code",
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state
    }

    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    return {
        "auth_url": auth_url,
        "state": state,
        "redirect_uri": redirect_uri
    }


@router.get("/callback")
async def oauth_callback(
    code: str,
    state: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """OAuth 回调处理"""
    # 验证 state
    state_data = oauth_states.pop(state, None)
    if not state_data:
        return RedirectResponse(url="/dashboard?error=invalid_state")
    
    try:
        # 获取 access token (使用 Gemini CLI 官方 redirect_uri)
        redirect_uri = "http://localhost:8080"

        # 根据凭证类型选择对应的 client credentials
        is_antigravity = state_data.get("for_antigravity", False)
        if is_antigravity:
            client_id = settings.antigravity_client_id
            client_secret = settings.antigravity_client_secret
        else:
            client_id = settings.google_client_id
            client_secret = settings.google_client_secret

        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri
                }
            )
            token_data = token_response.json()
        
        if "error" in token_data:
            return RedirectResponse(url=f"/dashboard?error={token_data.get('error_description', 'token_error')}")
        
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        
        # 获取用户信息
        async with httpx.AsyncClient() as client:
            userinfo_response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            userinfo = userinfo_response.json()
        
        email = userinfo.get("email", "unknown")

        # 确定凭证类型
        cred_type = "oauth_antigravity" if state_data.get("for_antigravity") else "oauth"
        cred_name = f"Antigravity - {email}" if state_data.get("for_antigravity") else f"OAuth - {email}"

        # 保存凭证
        credential = Credential(
            name=cred_name,
            api_key=access_token,  # 这里存储的是 access_token
            refresh_token=refresh_token,
            credential_type=cred_type,
            email=email
        )
        db.add(credential)
        await db.commit()
        
        return RedirectResponse(url="/dashboard?oauth=success")
    
    except Exception as e:
        return RedirectResponse(url=f"/dashboard?oauth=error&msg={str(e)[:50]}")


@router.post("/from-callback-url")
async def credential_from_callback_url(
    data: CallbackURLRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """从回调 URL 手动获取凭证 (适用于无法直接回调的场景)"""
    from urllib.parse import urlparse, parse_qs

    import sys
    log_info("OAuth", f"收到回调URL: {data.callback_url}")

    # ========== gcli2api 桥接模式 ==========
    if settings.enable_gcli2api_bridge:
        from app.services.gcli2api_bridge import gcli2api_bridge

        log_info("Bridge", f"[gcli2api] OAuth 处理回调URL, for_antigravity={data.for_antigravity}")

        try:
            result = await gcli2api_bridge.forward_request(
                path="/auth/callback-url",  # 使用 callback-url 接口而不是 callback
                method="POST",
                json_data={
                    "callback_url": data.callback_url,
                    "use_antigravity": data.for_antigravity  # 参数名是 use_antigravity 而不是 mode
                },
                use_panel_password=True  # OAuth 接口使用面板密码
            )

            # gcli2api 返回格式: {"success": true, "credentials": {...}, "file_path": "...", "auto_detected_project": true}
            if not result.get("success"):
                error_msg = result.get("error", "未知错误")
                log_error("Bridge", f"[gcli2api] 凭证获取失败: {error_msg}")
                raise HTTPException(status_code=400, detail=error_msg)

            credentials = result.get("credentials", {})
            project_id = credentials.get("project_id", "")
            # gcli2api 的 credentials 中没有 email 字段，需要从 token 中获取或设置默认值
            email = "gcli2api-user"

            log_success("OAuth", f"[gcli2api] 凭证获取成功: project={project_id}")

            # 注意：gcli2api 已经保存了凭证，这里只需要记录用户贡献
            # 如果需要在 CatieCli 也保存一份，可以在这里添加逻辑

            return {
                "message": "凭证已成功保存到 gcli2api",
                "email": email,
                "project_id": project_id,
                "model_tier": "2.5",  # gcli2api 不返回 model_tier，默认设置为 2.5
                "credential_type": "oauth_antigravity" if data.for_antigravity else "gemini_cli"
            }
        except Exception as e:
            log_error("Bridge", f"OAuth回调处理失败: {e}")
            raise HTTPException(status_code=500, detail=f"gcli2api OAuth 回调失败: {str(e)}")
    # ========== gcli2api 桥接模式结束 ==========

    try:
        parsed = urlparse(data.callback_url)
        params = parse_qs(parsed.query)
        
        code = params.get("code", [None])[0]
        log_info("OAuth", f"解析到code: {code[:20] if code else 'None'}...")
        
        if not code:
            raise HTTPException(status_code=400, detail="URL 中未找到 code 参数")
        
        # 获取 access token (使用 Gemini CLI 官方 redirect_uri)
        redirect_uri = "http://localhost:8080"

        # 根据凭证类型选择对应的 client credentials
        if data.for_antigravity:
            client_id = settings.antigravity_client_id
            client_secret = settings.antigravity_client_secret
        else:
            client_id = settings.google_client_id
            client_secret = settings.google_client_secret

        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri
                }
            )
            token_data = token_response.json()
        
        log_info("OAuth", f"Token response: {token_data}")
        
        if "error" in token_data:
            error_msg = token_data.get("error_description") or token_data.get("error", "获取 token 失败")
            raise HTTPException(status_code=400, detail=error_msg)
        
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        
        # 获取用户信息
        async with httpx.AsyncClient() as client:
            userinfo_response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            userinfo = userinfo_response.json()
        
        email = userinfo.get("email", "unknown")
        
        # 使用新的 fetch_project_id 方法获取 project_id（sukaka 提供）
        project_id = ""
        try:
            # 根据凭证类型选择不同的 API URL 和 User-Agent
            if data.for_antigravity:
                api_base_url = settings.antigravity_api_url
                user_agent = "antigravity/1.11.3 windows/amd64"
            else:
                api_base_url = "https://cloudcode-pa.googleapis.com"
                user_agent = "CatieCli/1.0"

            # 优先使用 loadCodeAssist/onboardUser 方法获取 project_id
            project_id = await fetch_project_id(
                access_token=access_token,
                user_agent=user_agent,
                api_base_url=api_base_url
            )
            if project_id:
                log_success("OAuth", f"获取到 project_id: {project_id}")
        except Exception as e:
            log_warning("OAuth", f"获取失败: {e}")
        
        # 如果新方法失败，回退到 Cloud Resource Manager API
        if not project_id:
            log_info("OAuth", "回退到 Cloud Resource Manager API...")
            try:
                async with httpx.AsyncClient() as client:
                    projects_response = await client.get(
                        "https://cloudresourcemanager.googleapis.com/v1/projects",
                        headers={"Authorization": f"Bearer {access_token}"},
                        params={"filter": "lifecycleState:ACTIVE"}
                    )
                    projects_data = projects_response.json()
                    projects = projects_data.get("projects", [])
                    
                    if projects:
                        # 选择第一个项目，或者找 default 项目
                        for p in projects:
                            if "default" in p.get("projectId", "").lower() or "default" in p.get("name", "").lower():
                                project_id = p.get("projectId")
                                break
                        if not project_id:
                            project_id = projects[0].get("projectId", "")
                        log_success("OAuth", f"获取到 project_id: {project_id}")
            except Exception as e:
                log_warning("OAuth", f"获取项目列表失败: {e}")
        
        # 如果获取到了 project_id，尝试启用必需的 API 服务
        if project_id:
            try:
                async with httpx.AsyncClient() as client:
                    required_services = [
                        "geminicloudassist.googleapis.com",
                        "cloudaicompanion.googleapis.com",
                    ]
                    for service in required_services:
                        try:
                            enable_url = f"https://serviceusage.googleapis.com/v1/projects/{project_id}/services/{service}:enable"
                            enable_response = await client.post(
                                enable_url,
                                headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                                json={}
                            )
                            if enable_response.status_code in [200, 201]:
                                log_success("OAuth", f"已启用服务: {service}")
                            else:
                                log_warning("OAuth", f"启用服务 {service}: {enable_response.status_code}")
                        except Exception as se:
                            log_warning("OAuth", f"启用服务 {service} 失败: {se}")
            except Exception as e:
                log_warning("OAuth", f"启用服务失败: {e}")
        
        # 检查是否已存在相同邮箱+相同类型的凭证（去重）
        # 注意：同一邮箱可以同时拥有 GeminiCLI 和 Antigravity 两种凭证
        from sqlalchemy import select
        from app.services.crypto import encrypt_credential

        # 确定当前要创建的凭证类型
        target_cred_type = "oauth_antigravity" if data.for_antigravity else "gemini_cli"

        existing_cred = await db.execute(
            select(Credential).where(
                Credential.user_id == user.id,
                Credential.email == email,
                Credential.credential_type == target_cred_type  # 同时匹配凭证类型
            )
        )
        existing = existing_cred.scalar_one_or_none()

        if existing:
            # 更新现有凭证而不是新增（只更新相同类型的凭证）
            existing.api_key = encrypt_credential(access_token)
            existing.refresh_token = encrypt_credential(refresh_token)
            existing.project_id = project_id
            existing.name = f"Antigravity - {email}" if data.for_antigravity else f"GeminiCli - {email}"
            credential = existing
            is_new_credential = False
            log_info("Credential", f"更新现有凭证: {email} (类型: {target_cred_type})")
        else:
            # 创建新凭证
            cred_type = "oauth_antigravity" if data.for_antigravity else "gemini_cli"
            cred_name = f"Antigravity - {email}" if data.for_antigravity else f"GeminiCli - {email}"
            credential = Credential(
                user_id=user.id,
                name=cred_name,
                api_key=encrypt_credential(access_token),
                refresh_token=encrypt_credential(refresh_token),
                project_id=project_id,
                credential_type=cred_type,
                email=email,
                is_public=data.is_public
            )
            is_new_credential = True
            log_info("Credential", f"创建新凭证: {email} (类型: {cred_type})")
        
        # 验证凭证是否有效（尝试调用 API）
        is_valid = True
        detected_tier = "2.5"
        try:
            async with httpx.AsyncClient(timeout=30.0) as test_client:
                # 用简单请求测试凭证有效性
                test_url = "https://cloudcode-pa.googleapis.com/v1internal:generateContent"
                test_payload = {
                    "model": "gemini-2.5-flash",
                    "project": project_id,
                    "request": {"contents": [{"role": "user", "parts": [{"text": "hi"}]}]}
                }
                test_response = await test_client.post(
                    test_url,
                    headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                    json=test_payload
                )
                if test_response.status_code == 200:
                    log_success("Credential", "凭证有效")
                    # 测试 3.0 模型资格
                    test_payload_3 = {
                        "model": "gemini-3-pro-preview",
                        "project": project_id,
                        "request": {"contents": [{"role": "user", "parts": [{"text": "hi"}]}]}
                    }
                    test_response_3 = await test_client.post(
                        test_url,
                        headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                        json=test_payload_3
                    )
                    if test_response_3.status_code == 200:
                        detected_tier = "3"
                        log_success("Credential", "检测到 Gemini 3 资格！")
                elif test_response.status_code in [401, 403]:
                    is_valid = False
                    log_error("Credential", f"凭证无效: {test_response.status_code}")
        except Exception as ve:
            log_warning("Credential", f"验证失败: {ve}")
        
        credential.model_tier = detected_tier
        credential.is_active = is_valid  # 无效凭证自动禁用
        
        # 只有新凭证才添加到数据库
        if is_new_credential:
            db.add(credential)
        
        # 奖励用户额度（只有新凭证、捐赠到公共池且凭证有效才奖励）
        reward_quota = 0
        if is_new_credential and data.is_public and is_valid:
            # 统一奖励配额
            reward_quota = settings.credential_reward_quota
            user.daily_quota += reward_quota
            log_info("Credential", f"用户 {user.username} 获得 {reward_quota} 次数奖励")
        elif not is_new_credential:
            log_info("Credential", "已存在凭证，不重复奖励额度")

        await db.commit()
        
        # 如果捐赠，通知更新
        if data.is_public:
            from app.services.websocket import notify_credential_update
            await notify_credential_update()
        
        # 构建返回消息
        msg_parts = ["凭证更新成功" if not is_new_credential else "凭证获取成功"]
        if not is_new_credential:
            msg_parts.append("（已存在相同邮箱凭证，已更新token）")
        if not is_valid:
            msg_parts.append("⚠️ 凭证验证失败，已禁用")
        else:
            msg_parts.append(f"✅ 等级: {detected_tier}")
            if detected_tier == "3":
                msg_parts.append("🎉 支持 Gemini 3！")
        if reward_quota:
            msg_parts.append(f"奖励 +{reward_quota} 额度")
        
        return {
            "message": "，".join(msg_parts), 
            "email": email,
            "is_public": data.is_public,
            "credential_id": credential.id,
            "reward_quota": reward_quota,
            "is_valid": is_valid,
            "model_tier": detected_tier
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")

