"""
管理功能路由 - 凭证管理、配置、统计等
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
import sqlalchemy
from typing import List, Optional
from datetime import datetime, timedelta
import json
import io
import zipfile

from app.database import get_db
from app.models.user import User, Credential, UsageLog, OpenAIEndpoint
from app.services.auth import get_current_user, get_current_admin
from app.services.crypto import encrypt_credential, decrypt_credential
from app.services.websocket import notify_stats_update
from app.config import settings


router = APIRouter(prefix="/api/manage", tags=["管理功能"])


# 简单内存缓存
class SimpleCache:
    def __init__(self):
        self._cache = {}
        self._timestamps = {}
    
    def get(self, key):
        if key not in self._cache:
            return None
        # 检查是否过期
        import time
        if time.time() - self._timestamps.get(key, 0) > 5:  # 5秒过期
            del self._cache[key]
            del self._timestamps[key]
            return None
        return self._cache[key]
    
    def set(self, key, value, ttl=5):
        import time
        self._cache[key] = value
        self._timestamps[key] = time.time()

cache = SimpleCache()


# ===== 凭证管理增强 =====

@router.get("/credentials/status")
async def get_credentials_status(
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """获取所有凭证的详细状态"""
    result = await db.execute(
        select(Credential).order_by(Credential.created_at.desc())
    )
    credentials = result.scalars().all()
    
    return {
        "total": len(credentials),
        "active": sum(1 for c in credentials if c.is_active),
        "public": sum(1 for c in credentials if c.is_public),
        "tier_3_count": sum(1 for c in credentials if c.model_tier == "3"),
        "credentials": [
            {
                "id": c.id,
                "name": c.name,
                "email": c.email,
                "project_id": c.project_id,
                "credential_type": c.credential_type,
                "model_tier": c.model_tier or "2.5",
                "is_active": c.is_active,
                "is_public": c.is_public,
                "total_requests": c.total_requests,
                "failed_requests": c.failed_requests,
                "last_used_at": (c.last_used_at.isoformat() + "Z") if c.last_used_at else None,
                "last_error": c.last_error,
                "created_at": (c.created_at.isoformat() + "Z") if c.created_at else None,
            }
            for c in credentials
        ]
    }


@router.post("/credentials/batch-action")
async def batch_credential_action(
    action: str = Form(...),  # enable, disable, delete
    credential_ids: str = Form(...),  # 逗号分隔的ID
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """批量操作凭证"""
    ids = [int(x.strip()) for x in credential_ids.split(",") if x.strip()]
    
    if not ids:
        raise HTTPException(status_code=400, detail="未选择凭证")
    
    if action == "enable":
        await db.execute(
            update(Credential).where(Credential.id.in_(ids)).values(is_active=True)
        )
    elif action == "disable":
        await db.execute(
            update(Credential).where(Credential.id.in_(ids)).values(is_active=False)
        )
    elif action == "delete":
        result = await db.execute(select(Credential).where(Credential.id.in_(ids)))
        for cred in result.scalars().all():
            await db.delete(cred)
    else:
        raise HTTPException(status_code=400, detail="无效的操作")
    
    await db.commit()
    return {"message": f"已对 {len(ids)} 个凭证执行 {action} 操作"}


@router.delete("/credentials/inactive")
async def delete_inactive_credentials(
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """一键删除所有无效凭证"""
    result = await db.execute(
        select(Credential).where(Credential.is_active == False)
    )
    inactive_creds = result.scalars().all()
    
    if not inactive_creds:
        return {"message": "没有无效凭证", "deleted_count": 0}
    
    deleted_count = len(inactive_creds)
    cred_ids = [c.id for c in inactive_creds]
    
    # 先解除使用记录的外键引用，避免外键约束导致删除失败
    await db.execute(
        update(UsageLog).where(UsageLog.credential_id.in_(cred_ids)).values(credential_id=None)
    )
    for cred in inactive_creds:
        await db.delete(cred)
    
    await db.commit()
    return {"message": f"已删除 {deleted_count} 个无效凭证", "deleted_count": deleted_count}


@router.get("/credentials/export")
async def export_credentials(
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """导出所有凭证为 ZIP 文件"""
    result = await db.execute(select(Credential))
    credentials = result.scalars().all()
    
    # 创建内存中的 ZIP 文件
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for cred in credentials:
            cred_data = {
                "client_id": "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com",
                "client_secret": "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",
                "refresh_token": decrypt_credential(cred.refresh_token) if cred.refresh_token else "",
                "token": decrypt_credential(cred.api_key) if cred.api_key else "",
                "project_id": cred.project_id or "",
                "email": cred.email or "",
            }
            filename = f"{cred.email or cred.id}.json"
            zf.writestr(filename, json.dumps(cred_data, indent=2))
    
    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=credentials.zip"}
    )


@router.post("/credentials/{credential_id}/toggle")
async def toggle_credential(
    credential_id: int,
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """切换凭证启用/禁用状态"""
    result = await db.execute(select(Credential).where(Credential.id == credential_id))
    cred = result.scalar_one_or_none()
    
    if not cred:
        raise HTTPException(status_code=404, detail="凭证不存在")
    
    cred.is_active = not cred.is_active
    await db.commit()
    
    return {"message": f"凭证已{'启用' if cred.is_active else '禁用'}", "is_active": cred.is_active}


@router.post("/credentials/{credential_id}/donate")
async def toggle_donate(
    credential_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """切换凭证捐赠状态"""
    result = await db.execute(
        select(Credential).where(Credential.id == credential_id, Credential.user_id == user.id)
    )
    cred = result.scalar_one_or_none()
    
    if not cred:
        raise HTTPException(status_code=404, detail="凭证不存在或无权限")
    
    cred.is_public = not cred.is_public
    await db.commit()
    
    return {"message": f"凭证已{'捐赠' if cred.is_public else '取消捐赠'}", "is_public": cred.is_public}


@router.post("/credentials/{credential_id}/tier")
async def set_credential_tier(
    credential_id: int,
    tier: str = Form(...),  # "3" 或 "2.5"
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """设置凭证模型等级（管理员）"""
    if tier not in ["3", "2.5"]:
        raise HTTPException(status_code=400, detail="等级只能是 '3' 或 '2.5'")
    
    result = await db.execute(select(Credential).where(Credential.id == credential_id))
    cred = result.scalar_one_or_none()
    
    if not cred:
        raise HTTPException(status_code=404, detail="凭证不存在")
    
    cred.model_tier = tier
    await db.commit()
    
    return {"message": f"凭证等级已设为 {tier}", "model_tier": tier}


@router.post("/credentials/{credential_id}/verify")
async def verify_credential(
    credential_id: int,
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """验证凭证有效性和模型等级"""
    import httpx
    from app.services.credential_pool import CredentialPool
    from app.services.crypto import decrypt_credential
    
    result = await db.execute(select(Credential).where(Credential.id == credential_id))
    cred = result.scalar_one_or_none()
    
    if not cred:
        raise HTTPException(status_code=404, detail="凭证不存在")
    
    # 获取 access token
    access_token = await CredentialPool.get_access_token(cred, db)
    if not access_token:
        cred.is_active = False
        cred.last_error = "无法获取 access token"
        await db.commit()
        return {
            "is_valid": False,
            "model_tier": cred.model_tier,
            "error": "无法获取 access token",
            "supports_3": False
        }
    
    # 测试 Gemini 2.5
    is_valid = False
    supports_3 = False
    error_msg = None
    
    async with httpx.AsyncClient(timeout=15) as client:
        # 使用 cloudcode-pa 端点测试（与 gcli2api 一致）
        try:
            test_url = "https://cloudcode-pa.googleapis.com/v1internal:generateContent"
            headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
            
            # 先测试 3.0（优先）
            test_payload_3 = {
                "model": "gemini-2.5-pro",
                "project": cred.project_id or "",
                "request": {"contents": [{"role": "user", "parts": [{"text": "hi"}]}]}
            }
            resp3 = await client.post(test_url, headers=headers, json=test_payload_3)
            if resp3.status_code == 200:
                is_valid = True
                supports_3 = True
            elif resp3.status_code == 429:
                is_valid = True
                supports_3 = True
                error_msg = "配额已用尽 (429)"
            else:
                # 3.0 失败，再测试 2.5
                test_payload_25 = {
                    "model": "gemini-2.5-flash",
                    "project": cred.project_id or "",
                    "request": {"contents": [{"role": "user", "parts": [{"text": "hi"}]}]}
                }
                resp25 = await client.post(test_url, headers=headers, json=test_payload_25)
                if resp25.status_code == 200:
                    is_valid = True
                    supports_3 = False
                elif resp25.status_code == 429:
                    is_valid = True
                    supports_3 = False
                    error_msg = "配额已用尽 (429)"
                elif resp25.status_code in [401, 403]:
                    error_msg = f"认证失败 ({resp25.status_code})"
                else:
                    error_msg = f"API 返回 {resp25.status_code}"
        except Exception as e:
            error_msg = f"请求异常: {str(e)[:30]}"
    
    # 更新凭证状态
    cred.is_active = is_valid
    cred.model_tier = "3" if supports_3 else "2.5"
    if error_msg:
        cred.last_error = error_msg
    await db.commit()
    
    return {
        "is_valid": is_valid,
        "model_tier": cred.model_tier,
        "supports_3": supports_3,
        "error": error_msg
    }


# 后台任务状态存储
_background_tasks = {}

@router.post("/credentials/start-all")
async def start_all_credentials(
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """一键启动所有凭证（后台任务，立即返回）"""
    import asyncio
    from app.services.credential_pool import CredentialPool
    from app.services.crypto import encrypt_credential
    from app.database import async_session
    
    result = await db.execute(
        select(Credential).where(
            Credential.credential_type == "oauth",
            Credential.refresh_token.isnot(None)
        )
    )
    creds = result.scalars().all()
    total = len(creds)
    
    # 提取凭证数据（避免 session 关闭后无法访问）
    cred_data = [{
        "id": c.id,
        "email": c.email,
        "refresh_token": c.refresh_token,
        "client_id": c.client_id,
        "client_secret": c.client_secret,
    } for c in creds]
    
    task_id = f"start_{datetime.utcnow().timestamp()}"
    _background_tasks[task_id] = {"status": "running", "total": total, "success": 0, "failed": 0, "progress": 0}
    
    async def run_in_background():
        """后台执行刷新"""
        semaphore = asyncio.Semaphore(50)  # 更高并发
        success = 0
        failed = 0
        
        async def refresh_single(data):
            nonlocal success, failed
            async with semaphore:
                try:
                    # 创建临时凭证对象用于刷新
                    temp_cred = Credential(
                        id=data["id"],
                        refresh_token=data["refresh_token"],
                        client_id=data["client_id"],
                        client_secret=data["client_secret"]
                    )
                    access_token = await CredentialPool.refresh_access_token(temp_cred)
                    return {"id": data["id"], "email": data["email"], "token": access_token}
                except Exception as e:
                    print(f"[启动凭证] ❌ {data['email']} 异常: {e}", flush=True)
                    return {"id": data["id"], "email": data["email"], "token": None}
        
        # 并发刷新
        print(f"[启动凭证] 后台开始刷新 {total} 个凭证...", flush=True)
        results = await asyncio.gather(*[refresh_single(d) for d in cred_data])
        
        # 批量更新数据库
        async with async_session() as session:
            for res in results:
                if res["token"]:
                    result = await session.execute(
                        update(Credential)
                        .where(Credential.id == res["id"])
                        .values(
                            api_key=encrypt_credential(res["token"]),
                            is_active=True,
                            last_error=None
                        )
                    )
                    # 检查是否实际更新了行
                    if result.rowcount > 0:
                        success += 1
                        print(f"[启动凭证] ✅ {res['email']}", flush=True)
                    else:
                        failed += 1
                        print(f"[启动凭证] ⚠️ {res['email']} Token获取成功但数据库更新失败(凭证可能已被删除)", flush=True)
                else:
                    failed += 1
            await session.commit()
        
        _background_tasks[task_id] = {"status": "done", "total": total, "success": success, "failed": failed}
        print(f"[启动凭证] 完成: 成功 {success}, 失败 {failed}", flush=True)
        
        # 通知前端刷新统计数据
        await notify_stats_update()
    
    # 启动后台任务
    asyncio.create_task(run_in_background())
    
    return {"message": "后台任务已启动", "task_id": task_id, "total": total}


@router.get("/credentials/task-status/{task_id}")
async def get_task_status(
    task_id: str,
    user: User = Depends(get_current_admin)
):
    """查询后台任务状态"""
    if task_id not in _background_tasks:
        raise HTTPException(status_code=404, detail="任务不存在")
    return _background_tasks[task_id]


@router.post("/credentials/verify-all")
async def verify_all_credentials(
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """一键检测所有凭证（后台任务，立即返回）"""
    import asyncio
    import httpx
    from app.services.credential_pool import CredentialPool
    from app.database import async_session
    
    result = await db.execute(select(Credential))
    creds = result.scalars().all()
    total = len(creds)
    
    # 提取凭证数据
    cred_data = [{
        "id": c.id,
        "email": c.email,
        "refresh_token": c.refresh_token,
        "client_id": c.client_id,
        "client_secret": c.client_secret,
        "project_id": c.project_id,
        "credential_type": c.credential_type,
        "api_key": c.api_key,
    } for c in creds]
    
    task_id = f"verify_{datetime.utcnow().timestamp()}"
    _background_tasks[task_id] = {"status": "running", "total": total, "valid": 0, "invalid": 0, "tier3": 0, "pro": 0}
    
    async def run_in_background():
        """后台执行检测"""
        semaphore = asyncio.Semaphore(50)
        valid = 0
        invalid = 0
        tier3 = 0
        pro = 0
        updates = []
        
        async def verify_single(data):
            async with semaphore:
                try:
                    # 获取 access_token
                    temp_cred = Credential(
                        id=data["id"],
                        refresh_token=data["refresh_token"],
                        client_id=data["client_id"],
                        client_secret=data["client_secret"],
                        project_id=data["project_id"],
                        credential_type=data["credential_type"],
                        api_key=data["api_key"],
                    )
                    access_token = await CredentialPool.refresh_access_token(temp_cred) if temp_cred.refresh_token else None
                    if not access_token:
                        return {"id": data["id"], "email": data["email"], "is_valid": False, "supports_3": False, "account_type": "unknown"}
                    
                    is_valid = False
                    supports_3 = False
                    account_type = "unknown"
                    
                    async with httpx.AsyncClient(timeout=10) as client:
                        test_url = "https://cloudcode-pa.googleapis.com/v1internal:generateContent"
                        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
                        
                        # 测试 2.5
                        test_payload = {
                            "model": "gemini-2.5-flash",
                            "project": data["project_id"] or "",
                            "request": {"contents": [{"role": "user", "parts": [{"text": "hi"}]}]}
                        }
                        resp = await client.post(test_url, headers=headers, json=test_payload)
                        if resp.status_code in [200, 429]:
                            is_valid = True
                            # 测试 3.0
                            test_payload["model"] = "gemini-3-pro-preview"
                            resp_3 = await client.post(test_url, headers=headers, json=test_payload)
                            supports_3 = resp_3.status_code in [200, 429]
                    
                    # 检测账号类型
                    if is_valid and data["project_id"]:
                        try:
                            type_result = await CredentialPool.detect_account_type(access_token, data["project_id"])
                            account_type = type_result.get("account_type", "unknown")
                        except:
                            pass
                    
                    return {"id": data["id"], "email": data["email"], "is_valid": is_valid, "supports_3": supports_3, "account_type": account_type, "token": access_token}
                except Exception as e:
                    print(f"[检测] ❌ {data['email']} 异常: {e}", flush=True)
                    return {"id": data["id"], "email": data["email"], "is_valid": False, "supports_3": False, "account_type": "unknown"}
        
        print(f"[检测凭证] 后台开始检测 {total} 个凭证...", flush=True)
        results = await asyncio.gather(*[verify_single(d) for d in cred_data])
        
        # 批量更新数据库
        async with async_session() as session:
            for res in results:
                model_tier = "3" if res["supports_3"] else "2.5"
                update_vals = {"is_active": res["is_valid"], "model_tier": model_tier}
                if res.get("account_type") != "unknown":
                    update_vals["account_type"] = res["account_type"]
                if res.get("token"):
                    from app.services.crypto import encrypt_credential
                    update_vals["api_key"] = encrypt_credential(res["token"])
                
                result = await session.execute(
                    update(Credential).where(Credential.id == res["id"]).values(**update_vals)
                )
                
                # 检查是否实际更新了行
                if result.rowcount > 0:
                    if res["is_valid"]:
                        valid += 1
                        if res["supports_3"]:
                            tier3 += 1
                        if res["account_type"] == "pro":
                            pro += 1
                        print(f"[检测] ✅ {res['email']} tier={model_tier}", flush=True)
                    else:
                        invalid += 1
                        print(f"[检测] ❌ {res['email']}", flush=True)
                else:
                    print(f"[检测] ⚠️ {res['email']} 数据库更新失败(凭证可能已被删除)", flush=True)
            
            await session.commit()
        
        _background_tasks[task_id] = {"status": "done", "total": total, "valid": valid, "invalid": invalid, "tier3": tier3, "pro": pro}
        print(f"[检测凭证] 完成: 有效 {valid}, 无效 {invalid}, 3.0 {tier3}", flush=True)
        
        # 通知前端刷新统计数据
        await notify_stats_update()
    
    asyncio.create_task(run_in_background())
    
    return {"message": "后台任务已启动", "task_id": task_id, "total": total}


# Google Gemini CLI 配额参考（每日请求数限制）
# Pro 订阅账号: CLI 总额度 1500，2.5/3.0 共用 250
# 普通账号: 总额度 1000，2.5/3.0 共用 200
QUOTA_LIMITS = {
    "pro": {"total": 1500, "premium": 250},   # Pro 账号
    "free": {"total": 1000, "premium": 200},  # 普通账号
}

# 高级模型（2.5-pro, 3.0 系列）共享 premium 配额
PREMIUM_MODELS = ["gemini-2.5-pro", "gemini-3-pro", "gemini-3-pro-preview", "gemini-3-pro-high", "gemini-3-pro-low", "gemini-3-pro-image"]


@router.get("/credentials/{credential_id}/quota")
async def get_credential_quota(
    credential_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取单个凭证的配额使用情况"""
    # 检查凭证权限
    cred = await db.get(Credential, credential_id)
    if not cred:
        raise HTTPException(status_code=404, detail="凭证不存在")
    if cred.user_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="无权查看此凭证")
    
    # 获取今天的开始时间（北京时间 15:00 = UTC 07:00 重置）
    now = datetime.utcnow()
    today_7am = now.replace(hour=7, minute=0, second=0, microsecond=0)
    # 如果当前时间还没到 UTC 07:00，则从昨天 07:00 开始
    today_start = today_7am if now >= today_7am else today_7am - timedelta(days=1)
    
    # 判断账号类型（从 account_type 字段读取）
    is_pro = cred.account_type == "pro"
    quota_config = QUOTA_LIMITS["pro"] if is_pro else QUOTA_LIMITS["free"]
    
    # 查询今天该凭证按模型的使用次数
    result = await db.execute(
        select(UsageLog.model, func.count(UsageLog.id).label("count"))
        .where(UsageLog.credential_id == credential_id)
        .where(UsageLog.created_at >= today_start)
        .where(UsageLog.status_code == 200)  # 只统计成功的请求
        .group_by(UsageLog.model)
    )
    usage_by_model = result.all()
    
    # 统计各模型使用情况
    quota_info = []
    total_used = 0
    premium_used = 0
    
    for model, count in usage_by_model:
        if not model:
            continue
        total_used += count
        
        # 获取基础模型名（去掉后缀）
        base_model = model
        for suffix in ["-maxthinking", "-nothinking", "-search"]:
            if base_model.endswith(suffix):
                base_model = base_model.replace(suffix, "")
                break
        
        # 判断是否为高级模型
        is_premium = any(pm in base_model for pm in PREMIUM_MODELS)
        if is_premium:
            premium_used += count
        
        quota_info.append({
            "model": model,
            "used": count,
            "is_premium": is_premium
        })
    
    # 按使用量排序
    quota_info.sort(key=lambda x: -x["used"])
    
    # 计算 Flash 使用量（非高级模型）
    flash_used = total_used - premium_used
    
    # 计算高级模型配额（2.5-pro + 3.0 共享）
    premium_limit = quota_config["premium"]
    premium_remaining = max(0, premium_limit - premium_used)
    premium_percentage = min(100, (premium_remaining / premium_limit) * 100) if premium_limit > 0 else 0
    
    # 计算 Flash 配额（总配额 - 高级配额 = Flash 专用）
    flash_limit = quota_config["total"] - quota_config["premium"]  # 750 或 1300
    flash_remaining = max(0, flash_limit - flash_used)
    flash_percentage = min(100, (flash_remaining / flash_limit) * 100) if flash_limit > 0 else 0
    
    # 总配额
    total_limit = quota_config["total"]
    total_remaining = max(0, total_limit - total_used)
    total_percentage = min(100, (total_remaining / total_limit) * 100) if total_limit > 0 else 0
    
    # 获取下次重置时间（北京时间 15:00 = UTC 07:00）
    next_reset = today_start + timedelta(days=1)
    
    return {
        "credential_id": credential_id,
        "credential_name": cred.name,
        "email": cred.email,
        "account_type": "pro" if is_pro else "free",
        "reset_time": next_reset.isoformat() + "Z",
        "flash": {
            "used": flash_used,
            "limit": flash_limit,
            "remaining": flash_remaining,
            "percentage": round(flash_percentage, 1),
            "note": "2.5-flash 专用"
        },
        "premium": {
            "used": premium_used,
            "limit": premium_limit,
            "remaining": premium_remaining,
            "percentage": round(premium_percentage, 1),
            "note": "2.5-pro 和 3.0 共用"
        },
        "models": quota_info
    }


# ===== 使用统计 =====

@router.get("/stats/overview")
async def get_stats_overview(
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """获取统计概览"""
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    
    # 计算今天的开始时间（UTC 07:00 = 北京时间 15:00）
    reset_time_utc = now.replace(hour=7, minute=0, second=0, microsecond=0)
    if now < reset_time_utc:
        start_of_day = reset_time_utc - timedelta(days=1)
    else:
        start_of_day = reset_time_utc
    
    # 今日请求数（基于 UTC 07:00 重置）
    today_result = await db.execute(
        select(func.count(UsageLog.id)).where(UsageLog.created_at >= start_of_day)
    )
    today_requests = today_result.scalar() or 0
    
    # 本周请求数
    week_result = await db.execute(
        select(func.count(UsageLog.id)).where(UsageLog.created_at >= week_ago)
    )
    week_requests = week_result.scalar() or 0
    
    # 本月请求数
    month_result = await db.execute(
        select(func.count(UsageLog.id)).where(UsageLog.created_at >= month_ago)
    )
    month_requests = month_result.scalar() or 0
    
    # 总请求数
    total_result = await db.execute(select(func.count(UsageLog.id)))
    total_requests = total_result.scalar() or 0
    
    # 活跃用户数
    active_users_result = await db.execute(
        select(func.count(func.distinct(UsageLog.user_id))).where(UsageLog.created_at >= week_ago)
    )
    active_users = active_users_result.scalar() or 0
    
    # 凭证统计
    cred_result = await db.execute(select(func.count(Credential.id)))
    total_credentials = cred_result.scalar() or 0
    
    active_cred_result = await db.execute(
        select(func.count(Credential.id)).where(Credential.is_active == True)
    )
    active_credentials = active_cred_result.scalar() or 0
    
    return {
        "requests": {
            "today": today_requests,
            "week": week_requests,
            "month": month_requests,
            "total": total_requests,
        },
        "users": {
            "active_this_week": active_users,
        },
        "credentials": {
            "total": total_credentials,
            "active": active_credentials,
        }
    }


@router.get("/stats/by-model")
async def get_stats_by_model(
    days: int = 7,
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """按模型统计使用量"""
    since = datetime.utcnow() - timedelta(days=days)
    
    result = await db.execute(
        select(UsageLog.model, func.count(UsageLog.id).label("count"))
        .where(UsageLog.created_at >= since)
        .group_by(UsageLog.model)
        .order_by(func.count(UsageLog.id).desc())
    )
    
    return {
        "period_days": days,
        "models": [{"model": row[0] or "unknown", "count": row[1]} for row in result.all()]
    }


@router.get("/stats/by-user")
async def get_stats_by_user(
    days: int = 7,
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """按用户统计使用量"""
    since = datetime.utcnow() - timedelta(days=days)
    
    result = await db.execute(
        select(User.username, func.count(UsageLog.id).label("count"))
        .join(User, UsageLog.user_id == User.id)
        .where(UsageLog.created_at >= since)
        .group_by(User.username)
        .order_by(func.count(UsageLog.id).desc())
        .limit(20)
    )
    
    return {
        "period_days": days,
        "users": [{"username": row[0], "count": row[1]} for row in result.all()]
    }


@router.get("/stats/daily")
async def get_daily_stats(
    days: int = 30,
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """获取每日统计数据（用于图表）"""
    since = datetime.utcnow() - timedelta(days=days)
    
    result = await db.execute(
        select(
            func.date(UsageLog.created_at).label("date"),
            func.count(UsageLog.id).label("count")
        )
        .where(UsageLog.created_at >= since)
        .group_by(func.date(UsageLog.created_at))
        .order_by(func.date(UsageLog.created_at))
    )
    
    return {
        "period_days": days,
        "daily": [{"date": str(row[0]), "count": row[1]} for row in result.all()]
    }


# ===== 配置管理 =====

@router.get("/config")
async def get_config(user: User = Depends(get_current_admin)):
    """获取当前配置"""
    from app.config import settings
    return {
        "allow_registration": settings.allow_registration,
        "default_daily_quota": settings.default_daily_quota,
        "credential_reward_quota": settings.credential_reward_quota,
        "base_rpm": settings.base_rpm,
        "contributor_rpm": settings.contributor_rpm,
        "error_retry_count": settings.error_retry_count,
        "cd_flash": settings.cd_flash,
        "cd_pro": settings.cd_pro,
        "cd_30": settings.cd_30,
        "admin_username": settings.admin_username,
        "force_donate": settings.force_donate,
        "lock_donate": settings.lock_donate,
        "announcement_enabled": settings.announcement_enabled,
        "announcement_title": settings.announcement_title,
        "announcement_content": settings.announcement_content,
        "announcement_read_seconds": settings.announcement_read_seconds,
    }


@router.get("/announcement")
async def get_announcement():
    """获取公告（公开接口）"""
    from app.config import settings
    if not settings.announcement_enabled:
        return {"enabled": False}
    return {
        "enabled": True,
        "title": settings.announcement_title,
        "content": settings.announcement_content,
        "read_seconds": settings.announcement_read_seconds,
    }


@router.get("/public-config")
async def get_public_config():
    """获取公开配置（普通用户可访问）"""
    from app.config import settings
    return {
        "force_donate": settings.force_donate,
        "lock_donate": settings.lock_donate,
        "base_rpm": settings.base_rpm,
        "contributor_rpm": settings.contributor_rpm,
    }


@router.post("/config")
async def update_config(
    allow_registration: Optional[bool] = Form(None),
    default_daily_quota: Optional[int] = Form(None),
    credential_reward_quota: Optional[int] = Form(None),
    base_rpm: Optional[int] = Form(None),
    contributor_rpm: Optional[int] = Form(None),
    error_retry_count: Optional[int] = Form(None),
    cd_flash: Optional[int] = Form(None),
    cd_pro: Optional[int] = Form(None),
    cd_30: Optional[int] = Form(None),
    force_donate: Optional[bool] = Form(None),
    lock_donate: Optional[bool] = Form(None),
    announcement_enabled: Optional[bool] = Form(None),
    announcement_title: Optional[str] = Form(None),
    announcement_content: Optional[str] = Form(None),
    announcement_read_seconds: Optional[int] = Form(None),
    user: User = Depends(get_current_admin)
):
    """更新配置（持久化保存到数据库）"""
    from app.config import settings, save_config_to_db

    updated = {}
    if allow_registration is not None:
        settings.allow_registration = allow_registration
        await save_config_to_db("allow_registration", allow_registration)
        updated["allow_registration"] = allow_registration
    if default_daily_quota is not None:
        settings.default_daily_quota = default_daily_quota
        await save_config_to_db("default_daily_quota", default_daily_quota)
        updated["default_daily_quota"] = default_daily_quota
    if credential_reward_quota is not None:
        settings.credential_reward_quota = credential_reward_quota
        await save_config_to_db("credential_reward_quota", credential_reward_quota)
        updated["credential_reward_quota"] = credential_reward_quota
    if base_rpm is not None:
        settings.base_rpm = base_rpm
        await save_config_to_db("base_rpm", base_rpm)
        updated["base_rpm"] = base_rpm
    if contributor_rpm is not None:
        settings.contributor_rpm = contributor_rpm
        await save_config_to_db("contributor_rpm", contributor_rpm)
        updated["contributor_rpm"] = contributor_rpm
    if error_retry_count is not None:
        settings.error_retry_count = error_retry_count
        await save_config_to_db("error_retry_count", error_retry_count)
        updated["error_retry_count"] = error_retry_count
    if cd_flash is not None:
        settings.cd_flash = cd_flash
        await save_config_to_db("cd_flash", cd_flash)
        updated["cd_flash"] = cd_flash
    if cd_pro is not None:
        settings.cd_pro = cd_pro
        await save_config_to_db("cd_pro", cd_pro)
        updated["cd_pro"] = cd_pro
    if cd_30 is not None:
        settings.cd_30 = cd_30
        await save_config_to_db("cd_30", cd_30)
        updated["cd_30"] = cd_30
    if force_donate is not None:
        settings.force_donate = force_donate
        await save_config_to_db("force_donate", force_donate)
        updated["force_donate"] = force_donate
    if lock_donate is not None:
        settings.lock_donate = lock_donate
        await save_config_to_db("lock_donate", lock_donate)
        updated["lock_donate"] = lock_donate

    # 公告配置
    if announcement_enabled is not None:
        settings.announcement_enabled = announcement_enabled
        await save_config_to_db("announcement_enabled", announcement_enabled)
        updated["announcement_enabled"] = announcement_enabled
    if announcement_title is not None:
        settings.announcement_title = announcement_title
        await save_config_to_db("announcement_title", announcement_title)
        updated["announcement_title"] = announcement_title
    if announcement_content is not None:
        settings.announcement_content = announcement_content
        await save_config_to_db("announcement_content", announcement_content)
        updated["announcement_content"] = announcement_content
    if announcement_read_seconds is not None:
        settings.announcement_read_seconds = announcement_read_seconds
        await save_config_to_db("announcement_read_seconds", announcement_read_seconds)
        updated["announcement_read_seconds"] = announcement_read_seconds

    return {"message": "配置已保存", "updated": updated}


# ===== 全站统计 =====

@router.get("/stats/global")
async def get_global_stats(
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """获取全站统计 - 带缓存"""
    # 尝试从缓存获取（缓存5秒）
    cached_stats = cache.get("stats:global")
    if cached_stats:
        return cached_stats

    now = datetime.utcnow()
    hour_ago = now - timedelta(hours=1)
    day_ago = now - timedelta(days=1)

    # 计算今天的开始时间（UTC 07:00）
    reset_time_utc = now.replace(hour=7, minute=0, second=0, microsecond=0)
    if now < reset_time_utc:
        start_of_day = reset_time_utc - timedelta(days=1)
    else:
        start_of_day = reset_time_utc

    # 按模型分类统计（今日）- 获取Top 3
    model_stats_result = await db.execute(
        select(UsageLog.model, func.count(UsageLog.id).label("count"))
        .where(UsageLog.created_at >= start_of_day)
        .where(UsageLog.model.isnot(None))  # 排除空模型
        .group_by(UsageLog.model)
        .order_by(func.count(UsageLog.id).desc())
        .limit(10)  # 获取前10个，用于显示
    )
    model_stats = [{"model": row[0] or "unknown", "count": row[1]} for row in model_stats_result.all()]

    # 获取Top 3模型
    top_3_models = model_stats[:3] if len(model_stats) >= 3 else model_stats

    # 最近1小时请求数
    hour_result = await db.execute(
        select(func.count(UsageLog.id)).where(UsageLog.created_at >= hour_ago)
    )
    hour_requests = hour_result.scalar() or 0

    # 今日总请求数
    today_result = await db.execute(
        select(func.count(UsageLog.id)).where(UsageLog.created_at >= start_of_day)
    )
    today_requests = today_result.scalar() or 0

    # 今日成功/失败统计
    today_success_result = await db.execute(
        select(func.count(UsageLog.id))
        .where(UsageLog.created_at >= start_of_day)
        .where(UsageLog.status_code == 200)
    )
    today_success = today_success_result.scalar() or 0
    today_failed = today_requests - today_success

    # 报错统计（按错误码分类，今日）
    error_stats_result = await db.execute(
        select(UsageLog.status_code, func.count(UsageLog.id).label("count"))
        .where(UsageLog.created_at >= start_of_day)
        .where(UsageLog.status_code != 200)
        .group_by(UsageLog.status_code)
        .order_by(func.count(UsageLog.id).desc())
    )
    error_by_code = {str(row[0]): row[1] for row in error_stats_result.all()}

    # 最近的报错详情（最近10条非200的记录）
    recent_errors_result = await db.execute(
        select(UsageLog, User.username)
        .join(User, UsageLog.user_id == User.id)
        .where(UsageLog.status_code != 200)
        .order_by(UsageLog.created_at.desc())
        .limit(10)
    )
    recent_errors = [
        {
            "id": log.UsageLog.id,
            "username": log.username,
            "model": log.UsageLog.model,
            "status_code": log.UsageLog.status_code,
            "cd_seconds": log.UsageLog.cd_seconds,
            "created_at": log.UsageLog.created_at.isoformat() + "Z"
        }
        for log in recent_errors_result.all()
    ]

    # 凭证统计
    total_creds = await db.execute(select(func.count(Credential.id)))
    active_creds = await db.execute(
        select(func.count(Credential.id)).where(Credential.is_active == True)
    )
    public_creds = await db.execute(
        select(func.count(Credential.id)).where(
            Credential.is_public == True,
            Credential.is_active == True
        )
    )

    tier3_cred_result = await db.execute(
        select(func.count(Credential.id))
        .where(Credential.model_tier == "3")
        .where(Credential.is_active == True)
    )
    tier3_creds = tier3_cred_result.scalar() or 0

    # 公共池中的3.0凭证数量
    public_tier3_result = await db.execute(
        select(func.count(Credential.id))
        .where(Credential.model_tier == "3")
        .where(Credential.is_active == True)
        .where(Credential.is_public == True)
    )
    public_tier3_creds = public_tier3_result.scalar() or 0

    # 按账号类型统计凭证数量
    pro_creds_result = await db.execute(
        select(func.count(Credential.id))
        .where(Credential.account_type == "pro")
        .where(Credential.is_active == True)
    )
    pro_creds = pro_creds_result.scalar() or 0

    free_creds_result = await db.execute(
        select(func.count(Credential.id))
        .where(Credential.account_type != "pro")
        .where(Credential.is_active == True)
    )
    free_creds = free_creds_result.scalar() or 0

    # 用户统计
    total_users_result = await db.execute(
        select(func.count(User.id)).where(User.is_active == True)
    )
    total_users = total_users_result.scalar() or 0

    # 活跃用户数（最近24小时）
    active_users_result = await db.execute(
        select(func.count(func.distinct(UsageLog.user_id)))
        .where(UsageLog.created_at >= day_ago)
    )
    active_users = active_users_result.scalar() or 0

    total_count = total_creds.scalar() or 0
    active_count = active_creds.scalar() or 0
    public_active_count = public_creds.scalar() or 0

    result = {
        "requests": {
            "last_hour": hour_requests,
            "today": today_requests,
            "today_success": today_success,
            "today_failed": today_failed,
            "top_models": top_3_models,  # Top 3 模型统计
        },
        "credentials": {
            "total": total_count,
            "active": active_count,
            "public": public_active_count,
            "tier_3": tier3_creds,
            "public_tier_3": public_tier3_creds,
            "pro": pro_creds,
            "free": free_creds,
        },
        "users": {
            "total": total_users,
            "active_24h": active_users,
        },
        "models": model_stats[:10],  # Top 10 模型
        "errors": {
            "by_code": error_by_code,
            "recent": recent_errors,
        },
    }

    # 缓存结果5秒
    cache.set("stats:global", result, ttl=5)

    return result


@router.get("/logs/{log_id}")
async def get_log_detail(
    log_id: int,
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """获取日志详情（包含错误信息、请求内容等）"""
    result = await db.execute(
        select(UsageLog, User.username, Credential.email.label("credential_email"))
        .join(User, UsageLog.user_id == User.id)
        .outerjoin(Credential, UsageLog.credential_id == Credential.id)
        .where(UsageLog.id == log_id)
    )
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="日志不存在")
    
    log = row.UsageLog
    return {
        "id": log.id,
        "username": row.username,
        "credential_email": row.credential_email,
        "model": log.model,
        "endpoint": log.endpoint,
        "status_code": log.status_code,
        "latency_ms": log.latency_ms,
        "cd_seconds": log.cd_seconds,
        "error_message": log.error_message,
        "request_body": log.request_body,
        "client_ip": log.client_ip,
        "user_agent": log.user_agent,
        "created_at": log.created_at.isoformat() + "Z" if log.created_at else None
    }


@router.get("/stats/errors")
async def get_error_stats(
    page: int = 1,
    page_size: int = 50,
    status_code: Optional[int] = None,
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """获取详细的报错统计"""
    start_of_day = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # 按错误码分类统计（今日），并包含每个错误码下的用户+模型详情
    error_stats_result = await db.execute(
        select(UsageLog.status_code, func.count(UsageLog.id).label("count"))
        .where(UsageLog.created_at >= start_of_day)
        .where(UsageLog.status_code != 200)
        .group_by(UsageLog.status_code)
        .order_by(func.count(UsageLog.id).desc())
    )
    error_by_code = []
    for row in error_stats_result.all():
        code = row[0]
        count = row[1]
        
        # 获取该错误码下的用户+模型详情（最近5条）
        details_result = await db.execute(
            select(UsageLog, User.username)
            .join(User, UsageLog.user_id == User.id)
            .where(UsageLog.status_code == code)
            .where(UsageLog.created_at >= start_of_day)
            .order_by(UsageLog.created_at.desc())
            .limit(10)
        )
        details = [
            {
                "id": log.UsageLog.id,
                "username": log.username,
                "model": log.UsageLog.model,
                "created_at": log.UsageLog.created_at.isoformat() + "Z"
            }
            for log in details_result.all()
        ]
        
        error_by_code.append({
            "status_code": code,
            "count": count,
            "details": details
        })
    
    # 报错记录分页查询
    query = (
        select(UsageLog, User.username, Credential.email.label("credential_email"))
        .join(User, UsageLog.user_id == User.id)
        .outerjoin(Credential, UsageLog.credential_id == Credential.id)
        .where(UsageLog.status_code != 200)
    )
    
    if status_code:
        query = query.where(UsageLog.status_code == status_code)
    
    # 总数
    count_query = select(func.count(UsageLog.id)).where(UsageLog.status_code != 200)
    if status_code:
        count_query = count_query.where(UsageLog.status_code == status_code)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # 分页
    query = query.order_by(UsageLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    
    errors = [
        {
            "id": row.UsageLog.id,
            "username": row.username,
            "credential_email": row.credential_email,
            "model": row.UsageLog.model,
            "endpoint": row.UsageLog.endpoint,
            "status_code": row.UsageLog.status_code,
            "latency_ms": row.UsageLog.latency_ms,
            "cd_seconds": row.UsageLog.cd_seconds,
            "client_ip": row.UsageLog.client_ip,
            "created_at": row.UsageLog.created_at.isoformat() + "Z" if row.UsageLog.created_at else None
        }
        for row in result.all()
    ]
    
    return {
        "error_by_code": error_by_code,
        "errors": errors,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


# ===== OpenAI 端点管理 =====

@router.get("/openai-endpoints")
async def get_openai_endpoints(
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """获取所有 OpenAI 端点列表（仅管理员）"""
    result = await db.execute(
        select(OpenAIEndpoint).order_by(OpenAIEndpoint.priority.desc(), OpenAIEndpoint.id)
    )
    endpoints = result.scalars().all()

    return [{
        "id": ep.id,
        "name": ep.name,
        "api_key": ep.api_key,
        "base_url": ep.base_url,
        "is_active": ep.is_active,
        "priority": ep.priority,
        "total_requests": ep.total_requests,
        "failed_requests": ep.failed_requests,
        "last_used_at": ep.last_used_at.isoformat() if ep.last_used_at else None,
        "last_error": ep.last_error,
        "created_at": ep.created_at.isoformat(),
    } for ep in endpoints]


@router.post("/openai-endpoints")
async def create_openai_endpoint(
    name: str = Form(...),
    api_key: str = Form(...),
    base_url: str = Form(...),
    is_active: bool = Form(True),
    priority: int = Form(0),
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """创建新的 OpenAI 端点（仅管理员）"""
    endpoint = OpenAIEndpoint(
        name=name,
        api_key=api_key,
        base_url=base_url.rstrip('/'),  # 移除末尾斜杠
        is_active=is_active,
        priority=priority
    )
    db.add(endpoint)
    await db.commit()
    await db.refresh(endpoint)

    return {
        "message": "OpenAI 端点创建成功",
        "id": endpoint.id
    }


@router.put("/openai-endpoints/{endpoint_id}")
async def update_openai_endpoint(
    endpoint_id: int,
    name: Optional[str] = Form(None),
    api_key: Optional[str] = Form(None),
    base_url: Optional[str] = Form(None),
    is_active: Optional[bool] = Form(None),
    priority: Optional[int] = Form(None),
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """更新 OpenAI 端点（仅管理员）"""
    result = await db.execute(
        select(OpenAIEndpoint).where(OpenAIEndpoint.id == endpoint_id)
    )
    endpoint = result.scalar_one_or_none()

    if not endpoint:
        raise HTTPException(status_code=404, detail="端点不存在")

    if name is not None:
        endpoint.name = name
    if api_key is not None:
        endpoint.api_key = api_key
    if base_url is not None:
        endpoint.base_url = base_url.rstrip('/')
    if is_active is not None:
        endpoint.is_active = is_active
    if priority is not None:
        endpoint.priority = priority

    await db.commit()

    return {"message": "端点更新成功"}


@router.delete("/openai-endpoints/{endpoint_id}")
async def delete_openai_endpoint(
    endpoint_id: int,
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """删除 OpenAI 端点（仅管理员）"""
    result = await db.execute(
        select(OpenAIEndpoint).where(OpenAIEndpoint.id == endpoint_id)
    )
    endpoint = result.scalar_one_or_none()

    if not endpoint:
        raise HTTPException(status_code=404, detail="端点不存在")

    await db.delete(endpoint)
    await db.commit()

    return {"message": "端点删除成功"}

