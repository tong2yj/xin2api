from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.user import User, Credential
from app.services.auth import get_current_user, get_current_admin
from app.config import settings
from app.utils.logger import log_info, log_warning, log_error, log_success

router = APIRouter(prefix="/api/oauth", tags=["OAuth认证"])


class CallbackURLRequest(BaseModel):
    callback_url: str
    is_public: bool = False  # 是否捐赠到公共池
    for_antigravity: bool = False  # 是否用于 Antigravity


@router.get("/config")
async def get_oauth_config(admin: User = Depends(get_current_admin)):
    """获取 OAuth 配置状态（gcli2api 桥接模式下此接口仅供参考）"""
    return {
        "configured": True,
        "mode": "gcli2api_bridge",
        "gcli2api_url": settings.gcli2api_base_url
    }


@router.post("/config")
async def set_oauth_config(
    config: dict,
    admin: User = Depends(get_current_admin)
):
    """设置 OAuth 配置（gcli2api 桥接模式下无需配置）"""
    return {"message": "gcli2api 桥接模式下无需配置 OAuth，请在 gcli2api 服务中配置"}


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
    """获取 OAuth 认证链接实现（仅支持 gcli2api 桥接模式）"""
    from app.services.gcli2api_bridge import gcli2api_bridge

    log_info("Bridge", f"[gcli2api] OAuth 获取认证链接, for_antigravity={for_antigravity}")

    try:
        result = await gcli2api_bridge.forward_request(
            path="/auth/start",
            method="POST",
            json_data={
                "use_antigravity": for_antigravity  # 使用布尔值而不是 mode 字符串
            },
            use_panel_password=True  # OAuth 接口使用面板密码
        )

        # gcli2api 返回格式: {"auth_url": "...", "state": "...", "callback_port": 11451}
        return {
            "auth_url": result.get("auth_url"),
            "state": result.get("state", "gcli2api_bridge"),  # 使用 gcli2api 返回的 state
            "redirect_uri": f"http://localhost:{result.get('callback_port', 11451)}"
        }
    except Exception as e:
        log_error("Bridge", f"获取OAuth链接失败: {e}")
        raise HTTPException(status_code=500, detail=f"gcli2api OAuth 失败: {str(e)}")


@router.get("/callback")
async def oauth_callback(
    code: str,
    state: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """OAuth 回调处理（已废弃，仅支持 /from-callback-url 接口）"""
    return RedirectResponse(url="/dashboard?oauth=error&msg=请使用手动粘贴回调URL的方式")


@router.post("/from-callback-url")
async def credential_from_callback_url(
    data: CallbackURLRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """从回调 URL 手动获取凭证（gcli2api 桥接模式）"""
    from urllib.parse import urlparse, parse_qs

    import sys
    log_info("OAuth", f"收到回调URL: {data.callback_url}")

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

        # 记录完整的返回结果用于调试
        log_info("Bridge", f"[gcli2api] 返回结果: {result}")

        # gcli2api 返回格式兼容处理
        # 格式1: {"success": true, "credentials": {...}, "file_path": "..."}
        # 格式2: {"credentials": {...}, "file_path": "..."} (直接返回凭证，表示成功)

        # 检查是否成功
        has_success_field = "success" in result
        is_success = result.get("success", True) if has_success_field else ("credentials" in result)

        if not is_success:
            error_msg = result.get("error", f"未知错误，完整响应: {result}")
            log_error("Bridge", f"[gcli2api] 凭证获取失败: {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)

        credentials = result.get("credentials", {})
        if not credentials:
            error_msg = f"响应中缺少 credentials 字段，完整响应: {result}"
            log_error("Bridge", f"[gcli2api] {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)

        project_id = credentials.get("project_id", "")
        # gcli2api 的 credentials 中没有 email 字段，需要从 token 中获取或设置默认值
        email = "gcli2api-user"

        log_success("OAuth", f"[gcli2api] 凭证获取成功: project={project_id}")

        # 在 CatieCli 数据库中也保存一份凭证记录（用于前端显示）
        from sqlalchemy import select
        from app.services.crypto import encrypt_credential

        # 确定凭证类型
        target_cred_type = "oauth_antigravity" if data.for_antigravity else "gemini_cli"
        cred_name = f"Antigravity - {project_id}" if data.for_antigravity else f"GeminiCli - {project_id}"

        # 检查是否已存在相同 project_id 的凭证
        existing_cred = await db.execute(
            select(Credential).where(
                Credential.user_id == user.id,
                Credential.project_id == project_id,
                Credential.credential_type == target_cred_type
            )
        )
        existing = existing_cred.scalar_one_or_none()

        if existing:
            # 更新现有凭证
            existing.name = cred_name
            existing.is_active = True
            credential = existing
            is_new_credential = False
            log_info("Credential", f"更新现有凭证: {project_id} (类型: {target_cred_type})")
        else:
            # 创建新凭证记录（只保存 project_id，实际凭证在 gcli2api）
            credential = Credential(
                user_id=user.id,
                name=cred_name,
                api_key=encrypt_credential("gcli2api_managed"),  # 标记为 gcli2api 管理
                refresh_token=encrypt_credential("gcli2api_managed"),
                project_id=project_id,
                credential_type=target_cred_type,
                email=email,
                is_public=data.is_public,
                is_active=True
            )
            is_new_credential = True
            db.add(credential)
            log_info("Credential", f"创建新凭证记录: {project_id} (类型: {target_cred_type})")

        # 奖励用户额度（只有新凭证、捐赠到公共池才奖励）
        reward_quota = 0
        if is_new_credential and data.is_public:
            reward_quota = settings.credential_reward_quota
            user.daily_quota += reward_quota
            log_info("Credential", f"用户 {user.username} 获得 {reward_quota} 次数奖励")

        await db.commit()

        # 如果捐赠，通知更新
        if data.is_public:
            from app.services.websocket import notify_credential_update
            await notify_credential_update()

        return {
            "message": "凭证已成功保存到 gcli2api" + (f"，奖励 +{reward_quota} 额度" if reward_quota else ""),
            "email": email,
            "project_id": project_id,
            "model_tier": "2.5",  # gcli2api 不返回 model_tier，默认设置为 2.5
            "credential_type": target_cred_type,
            "credential_id": credential.id,
            "reward_quota": reward_quota,
            "is_valid": True,
            "is_public": data.is_public
        }
    except HTTPException:
        raise
    except Exception as e:
        log_error("Bridge", f"OAuth回调处理失败: {e}")
        raise HTTPException(status_code=500, detail=f"gcli2api OAuth 回调失败: {str(e)}")

