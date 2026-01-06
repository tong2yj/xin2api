from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date, timedelta

from app.database import get_db
from app.models.user import User, APIKey, UsageLog, Credential
from app.services.auth import (
    get_password_hash, authenticate_user, create_access_token,
    get_current_user, get_current_admin
)
from app.config import settings
from app.utils.logger import log_info, log_warning, log_error, log_success, log_db_operation

router = APIRouter(prefix="/api/auth", tags=["认证"])


class UserRegister(BaseModel):
    username: str
    password: str
    email: Optional[str] = None


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class APIKeyCreate(BaseModel):
    name: str = "default"


class APIKeyResponse(BaseModel):
    id: int
    name: str
    key: str
    is_active: bool
    created_at: datetime
    last_used_at: Optional[datetime]


@router.post("/register", response_model=TokenResponse)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    """用户注册"""
    if not settings.allow_registration:
        raise HTTPException(status_code=403, detail="注册已关闭")

    # 检查用户名是否存在
    result = await db.execute(select(User).where(User.username == data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="用户名已存在")
    
    # 创建用户
    try:
        user = User(
            username=data.username,
            email=data.email,
            hashed_password=get_password_hash(data.password),
            daily_quota=settings.default_daily_quota
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        # 自动创建一个API Key
        api_key = APIKey(user_id=user.id, key=APIKey.generate_key(), name="default")
        db.add(api_key)
        await db.commit()
    except Exception as e:
        await db.rollback()
        log_error("Auth", f"用户注册失败: {e}", exc_info=e)
        raise HTTPException(status_code=500, detail=f"注册失败: {str(e)[:100]}")
    
    # 生成token
    token = create_access_token(data={"sub": user.username})
    
    return TokenResponse(
        access_token=token,
        user={
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "is_admin": user.is_admin,
            "daily_quota": user.daily_quota
        }
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    """用户登录"""
    user = await authenticate_user(db, data.username, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="账户已被禁用")
    
    token = create_access_token(data={"sub": user.username})
    
    return TokenResponse(
        access_token=token,
        user={
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "is_admin": user.is_admin,
            "daily_quota": user.daily_quota
        }
    )


@router.get("/me")
async def get_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """获取当前用户信息"""
    # 获取今日使用量
    now = datetime.utcnow()
    reset_time_utc = now.replace(hour=7, minute=0, second=0, microsecond=0)
    if now < reset_time_utc:
        start_of_day = reset_time_utc - timedelta(days=1)
    else:
        start_of_day = reset_time_utc
        
    result = await db.execute(
        select(func.count(UsageLog.id))
        .where(UsageLog.user_id == user.id)
        .where(UsageLog.created_at >= start_of_day)
    )
    today_usage = result.scalar() or 0
    
    # 获取用户凭证数量
    cred_result = await db.execute(
        select(func.count(Credential.id))
        .where(Credential.user_id == user.id)
        .where(Credential.is_active == True)
    )
    credential_count = cred_result.scalar() or 0
    
    # 统计公开凭证数量
    public_result = await db.execute(
        select(func.count(Credential.id))
        .where(Credential.user_id == user.id)
        .where(Credential.is_public == True)
        .where(Credential.is_active == True)
    )
    public_credential_count = public_result.scalar() or 0
    
    # 统计用户的 2.5 和 3.0 凭证数量
    cred_25_result = await db.execute(
        select(func.count(Credential.id))
        .where(Credential.user_id == user.id)
        .where(Credential.is_active == True)
        .where(Credential.model_tier != "3")
    )
    cred_25_count = cred_25_result.scalar() or 0
    
    cred_30_result = await db.execute(
        select(func.count(Credential.id))
        .where(Credential.user_id == user.id)
        .where(Credential.is_active == True)
        .where(Credential.model_tier == "3")
    )
    cred_30_count = cred_30_result.scalar() or 0

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_admin": user.is_admin,
        "is_active": user.is_active,
        "daily_quota": user.daily_quota,
        "today_usage": today_usage,
        "credential_count": credential_count,
        "public_credential_count": public_credential_count,
        "has_public_credentials": public_credential_count > 0,
        "created_at": user.created_at,
        "cred_25_count": cred_25_count,
        "cred_30_count": cred_30_count
    }


@router.get("/api-keys", response_model=List[APIKeyResponse])
async def list_api_keys(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """获取用户的API Keys"""
    result = await db.execute(
        select(APIKey).where(APIKey.user_id == user.id).order_by(APIKey.created_at.desc())
    )
    keys = result.scalars().all()
    return [
        APIKeyResponse(
            id=k.id,
            name=k.name,
            key=k.key,
            is_active=k.is_active,
            created_at=k.created_at,
            last_used_at=k.last_used_at
        )
        for k in keys
    ]


@router.post("/api-keys", response_model=APIKeyResponse)
async def create_api_key(
    data: APIKeyCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """创建新的API Key"""
    # 限制每个用户最多5个key
    result = await db.execute(
        select(func.count(APIKey.id)).where(APIKey.user_id == user.id)
    )
    count = result.scalar() or 0
    if count >= 5:
        raise HTTPException(status_code=400, detail="最多只能创建5个API Key")

    try:
        api_key = APIKey(user_id=user.id, key=APIKey.generate_key(), name=data.name)
        db.add(api_key)
        await db.commit()
        await db.refresh(api_key)
    except Exception as e:
        await db.rollback()
        log_error("Auth", f"API Key 创建失败: {e}", exc_info=e)
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)[:100]}")
    
    return APIKeyResponse(
        id=api_key.id,
        name=api_key.name,
        key=api_key.key,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        last_used_at=api_key.last_used_at
    )


@router.delete("/api-keys/{key_id}")
async def delete_api_key(
    key_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """删除API Key"""
    result = await db.execute(
        select(APIKey).where(APIKey.id == key_id, APIKey.user_id == user.id)
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=404, detail="API Key不存在")

    try:
        await db.delete(api_key)
        await db.commit()
    except Exception as e:
        await db.rollback()
        log_error("Auth", f"API Key 删除失败: {e}", exc_info=e)
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)[:100]}")

    return {"message": "删除成功"}


@router.post("/api-keys/{key_id}/regenerate", response_model=APIKeyResponse)
async def regenerate_api_key(
    key_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """重新生成API Key"""
    result = await db.execute(
        select(APIKey).where(APIKey.id == key_id, APIKey.user_id == user.id)
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=404, detail="API Key不存在")

    try:
        # 生成新的 key
        api_key.key = APIKey.generate_key()
        await db.commit()
        await db.refresh(api_key)
    except Exception as e:
        await db.rollback()
        log_error("Auth", f"API Key 重新生成失败: {e}", exc_info=e)
        raise HTTPException(status_code=500, detail=f"重新生成失败: {str(e)[:100]}")
    
    return APIKeyResponse(
        id=api_key.id,
        name=api_key.name,
        key=api_key.key,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        last_used_at=api_key.last_used_at
    )


# ===== 用户凭证管理 =====
from app.models.user import Credential
from fastapi import UploadFile, File, Form
from typing import List
import json

@router.post("/credentials/upload")
async def upload_credentials(
    files: List[UploadFile] = File(...),
    is_public: bool = Form(default=False),
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """上传 JSON 凭证文件（支持多文件和ZIP压缩包）- 仅管理员"""
    from app.services.crypto import encrypt_credential
    from app.config import settings
    import zipfile
    import io
    
    # 强制捐赠模式
    if settings.force_donate:
        is_public = True
    
    if not files:
        raise HTTPException(status_code=400, detail="请选择要上传的文件")
    
    results = []
    success_count = 0
    
    # 预处理：解压ZIP文件，收集所有JSON文件
    json_files = []  # [(filename, content_bytes), ...]
    
    for file in files:
        if file.filename.endswith('.zip'):
            # 解压ZIP文件
            try:
                zip_content = await file.read()
                with zipfile.ZipFile(io.BytesIO(zip_content), 'r') as zf:
                    for name in zf.namelist():
                        if name.endswith('.json') and not name.startswith('__MACOSX'):
                            json_files.append((name, zf.read(name)))
                results.append({"filename": file.filename, "status": "info", "message": f"已解压 {len([n for n in zf.namelist() if n.endswith('.json')])} 个JSON文件"})
            except zipfile.BadZipFile:
                results.append({"filename": file.filename, "status": "error", "message": "无效的ZIP文件"})
            except Exception as e:
                results.append({"filename": file.filename, "status": "error", "message": f"解压失败: {str(e)[:50]}"})
        elif file.filename.endswith('.json'):
            content = await file.read()
            json_files.append((file.filename, content))
        else:
            results.append({"filename": file.filename, "status": "error", "message": "只支持 JSON 或 ZIP 文件"})
    
    # 处理所有JSON文件
    for filename, content in json_files:
        try:
            cred_data = json.loads(content.decode('utf-8') if isinstance(content, bytes) else content)
            
            # 验证必要字段
            required_fields = ["refresh_token"]
            missing = [f for f in required_fields if f not in cred_data]
            if missing:
                results.append({"filename": filename, "status": "error", "message": f"缺少字段: {', '.join(missing)}"})
                continue
            
            # 创建凭证（加密存储）
            email = cred_data.get("email") or filename
            project_id = cred_data.get("project_id", "")
            refresh_token = cred_data.get("refresh_token")
            
            # 去重检查：根据 email 或 refresh_token 判断是否已存在（全局）
            existing = await db.execute(
                select(Credential).where(Credential.email == email)
            )
            if existing.scalar_one_or_none():
                results.append({"filename": filename, "status": "skip", "message": f"凭证已存在: {email}"})
                continue
            
            # 也检查 refresh_token 是否重复
            from app.services.crypto import encrypt_credential as enc
            existing_token = await db.execute(
                select(Credential).where(Credential.refresh_token == enc(refresh_token))
            )
            if existing_token.scalar_one_or_none():
                results.append({"filename": filename, "status": "skip", "message": f"凭证token已存在: {email}"})
                continue
            
            # 自动验证凭证有效性
            is_valid = False
            model_tier = "2.5"
            verify_msg = ""
            
            try:
                import httpx
                from app.services.credential_pool import CredentialPool
                
                # 创建临时凭证对象用于获取 token
                temp_cred = Credential(
                    api_key=encrypt_credential(cred_data.get("token") or cred_data.get("access_token", "")),
                    refresh_token=encrypt_credential(cred_data.get("refresh_token")),
                    client_id=encrypt_credential(cred_data.get("client_id")) if cred_data.get("client_id") else None,
                    client_secret=encrypt_credential(cred_data.get("client_secret")) if cred_data.get("client_secret") else None,
                    credential_type="oauth"
                )
                
                access_token = await CredentialPool.get_access_token(temp_cred, db)
                if access_token:
                    async with httpx.AsyncClient(timeout=15) as client:
                        # 使用 cloudcode-pa 端点测试（与 gcli2api 一致）
                        test_url = "https://cloudcode-pa.googleapis.com/v1internal:generateContent"
                        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
                        
                        # 先测试 2.5 判断凭证是否有效
                        test_payload_25 = {
                            "model": "gemini-2.5-flash",
                            "project": project_id,
                            "request": {"contents": [{"role": "user", "parts": [{"text": "hi"}]}]}
                        }
                        resp = await client.post(test_url, headers=headers, json=test_payload_25)
                        
                        if resp.status_code == 200 or resp.status_code == 429:
                            is_valid = True
                            model_tier = "2.5"
                            
                            # 凭证有效，再测试 3.0
                            test_payload_3 = {
                                "model": "gemini-3-pro-preview",
                                "project": project_id,
                                "request": {"contents": [{"role": "user", "parts": [{"text": "hi"}]}]}
                            }
                            resp3 = await client.post(test_url, headers=headers, json=test_payload_3)
                            
                            if resp3.status_code == 200 or resp3.status_code == 429:
                                model_tier = "3"
                                verify_msg = f"✅ 有效 (等级: 3)"
                            else:
                                verify_msg = f"✅ 有效 (等级: 2.5)"
                        else:
                            verify_msg = f"❌ 无效 ({resp.status_code})"
                else:
                    verify_msg = "❌ 无法获取 token"
            except Exception as e:
                verify_msg = f"⚠️ 验证失败: {str(e)[:30]}"
            
            # 如果要捐赠但凭证无效，不允许
            actual_public = is_public and is_valid
            
            credential = Credential(
                user_id=user.id,
                name=f"Upload - {email}",
                api_key=encrypt_credential(cred_data.get("token") or cred_data.get("access_token", "")),
                refresh_token=encrypt_credential(cred_data.get("refresh_token")),
                client_id=encrypt_credential(cred_data.get("client_id")) if cred_data.get("client_id") else None,
                client_secret=encrypt_credential(cred_data.get("client_secret")) if cred_data.get("client_secret") else None,
                project_id=project_id,
                credential_type="oauth",
                email=email,
                is_public=actual_public,
                is_active=is_valid,
                model_tier=model_tier
            )
            db.add(credential)
            
            # 如果是公开且有效的凭证，根据凭证等级增加额度奖励
            # 2.5凭证 = quota_flash + quota_25pro
            # 3.0凭证 = quota_flash + quota_25pro + quota_30pro
            if actual_public and is_valid:
                # 使用管理员配置的分类额度计算奖励（与前端显示一致）
                if model_tier == "3":
                    reward = settings.quota_flash + settings.quota_25pro + settings.quota_30pro
                else:
                    reward = settings.quota_flash + settings.quota_25pro
                user.daily_quota += reward
                log_info("Credential", f"用户 {user.username} 获得 {reward} 额度奖励 (等级: {model_tier})")
            
            status_msg = f"上传成功 {verify_msg}"
            if is_public and not is_valid:
                status_msg += " (无效凭证不会上传到公共池)"
            results.append({"filename": filename, "status": "success" if is_valid else "warning", "message": status_msg})
            success_count += 1
            
            # 每50个凭证提交一次，避免大事务超时
            if success_count % 50 == 0:
                try:
                    await db.commit()
                    log_info("Batch Upload", f"已提交 {success_count} 个凭证")
                except Exception as commit_err:
                    await db.rollback()
                    log_error("Batch Upload", f"批量提交失败: {commit_err}", exc_info=commit_err)
                    raise HTTPException(
                        status_code=500,
                        detail=f"数据保存失败（已保存 {success_count} 个）: {str(commit_err)[:100]}"
                    )
            
        except json.JSONDecodeError:
            results.append({"filename": filename, "status": "error", "message": "JSON 格式错误"})
        except Exception as e:
            results.append({"filename": filename, "status": "error", "message": str(e)})
    
    # 最终提交剩余的
    try:
        await db.commit()
        log_success("Batch Upload", f"最终提交完成，共 {success_count} 个凭证")
    except Exception as final_err:
        await db.rollback()
        log_error("Batch Upload", f"最终提交失败: {final_err}", exc_info=final_err)
        raise HTTPException(
            status_code=500,
            detail=f"数据保存失败（已保存 {success_count} 个）: {str(final_err)[:100]}"
        )

    return {"uploaded_count": success_count, "total_count": len(json_files), "results": results}


@router.get("/credentials")
async def list_my_credentials(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """获取我的凭证列表"""
    from datetime import datetime, timedelta
    from app.config import settings
    
    result = await db.execute(
        select(Credential).where(Credential.user_id == user.id).order_by(Credential.created_at.desc())
    )
    creds = result.scalars().all()
    
    now = datetime.utcnow()
    
    def get_cd_remaining(last_used, cd_seconds):
        """计算 CD 剩余秒数"""
        if not last_used or cd_seconds <= 0:
            return 0
        cd_end = last_used + timedelta(seconds=cd_seconds)
        remaining = (cd_end - now).total_seconds()
        return max(0, int(remaining))
    
    return [
        {
            "id": c.id,
            "name": c.name,
            "email": c.email,
            "is_public": c.is_public,
            "is_active": c.is_active,
            "model_tier": c.model_tier or "2.5",
            "account_type": c.account_type or "free",
            "total_requests": c.total_requests or 0,
            "last_used_at": (c.last_used_at.isoformat() + "Z") if c.last_used_at else None,
            "created_at": (c.created_at.isoformat() + "Z") if c.created_at else None,
            "cd_flash": get_cd_remaining(c.last_used_flash, settings.cd_flash),
            "cd_pro": get_cd_remaining(c.last_used_pro, settings.cd_pro),
            "cd_30": get_cd_remaining(c.last_used_30, settings.cd_30),
        }
        for c in creds
    ]


@router.patch("/credentials/{cred_id}")
async def update_my_credential(
    cred_id: int,
    is_public: bool = None,
    is_active: bool = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """更新我的凭证（公开/启用状态）"""
    result = await db.execute(
        select(Credential).where(Credential.id == cred_id, Credential.user_id == user.id)
    )
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404, detail="凭证不存在")
    
    if is_public is not None:
        # 捐赠时必须凭证有效且无错误记录
        if is_public:
            if not cred.is_active:
                raise HTTPException(status_code=400, detail="无效凭证不能捐赠，请先检测")
            # 检查是否有认证错误（403等）
            if cred.last_error and ('403' in cred.last_error or '401' in cred.last_error or '认证' in cred.last_error or '无效' in cred.last_error):
                raise HTTPException(status_code=400, detail="凭证存在认证错误，不能捐赠")
            # 捐赠奖励配额（只有从私有变公开才奖励，根据凭证等级）
            # 使用管理员配置的分类额度计算奖励（与前端显示一致）
            if not cred.is_public:
                if cred.model_tier == "3":
                    reward = settings.quota_flash + settings.quota_25pro + settings.quota_30pro
                else:
                    reward = settings.quota_flash + settings.quota_25pro
                user.daily_quota += reward
                log_info("Credential", f"用户 {user.username} 获得 {reward} 额度奖励 (等级: {cred.model_tier})")
        else:
            # 取消捐赠
            if cred.is_public:
                # 检查锁定捐赠（有效凭证不允许取消）
                if settings.lock_donate and cred.is_active:
                    raise HTTPException(status_code=400, detail="站长已锁定捐赠，有效凭证不能取消捐赠")
                # 根据凭证等级扣除额度（使用管理员配置的分类额度）
                if cred.model_tier == "3":
                    deduct = settings.quota_flash + settings.quota_25pro + settings.quota_30pro
                else:
                    deduct = settings.quota_flash + settings.quota_25pro
                # 仅在当前额度包含奖励部分时才回收，避免把自定义额度打回默认
                if user.daily_quota - settings.default_daily_quota >= deduct:
                    user.daily_quota = max(
                        settings.default_daily_quota,
                        user.daily_quota - deduct,
                    )
                log_info("Credential", f"用户 {user.username} 扣除 {deduct} 额度 (等级: {cred.model_tier})")
        cred.is_public = is_public
    if is_active is not None:
        # 手动启用时清除错误（但不清除403错误记录）
        cred.is_active = is_active

    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        log_error("Credential", f"凭证更新失败: {e}", exc_info=e)
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)[:100]}")

    return {"message": "更新成功", "is_public": cred.is_public, "is_active": cred.is_active}


@router.delete("/credentials/{cred_id}")
async def delete_my_credential(
    cred_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """删除我的凭证"""
    result = await db.execute(
        select(Credential).where(Credential.id == cred_id, Credential.user_id == user.id)
    )
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404, detail="凭证不存在")
    
    # 如果是公开凭证，删除时根据凭证等级扣除配额（使用管理员配置的分类额度）
    if cred.is_public:
        if cred.model_tier == "3":
            deduct = settings.quota_flash + settings.quota_25pro + settings.quota_30pro
        else:
            deduct = settings.quota_flash + settings.quota_25pro
        # 仅在当前额度包含奖励部分时才回收，避免把自定义额度打回默认
        if user.daily_quota - settings.default_daily_quota >= deduct:
            user.daily_quota = max(
                settings.default_daily_quota,
                user.daily_quota - deduct,
            )
            log_info("Credential", f"用户 {user.username} 扣除 {deduct} 额度 (等级: {cred.model_tier})")

    try:
        # 先解除使用记录的外键引用，避免外键约束导致删除失败
        await db.execute(
            update(UsageLog).where(UsageLog.credential_id == cred_id).values(credential_id=None)
        )
        await db.delete(cred)
        await db.commit()
    except Exception as e:
        await db.rollback()
        log_error("Credential", f"凭证删除失败: {e}", exc_info=e)
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)[:100]}")

    return {"message": "删除成功"}


@router.delete("/credentials/inactive/batch")
async def delete_my_inactive_credentials(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """批量删除我的所有失效凭证"""
    result = await db.execute(
        select(Credential).where(
            Credential.user_id == user.id,
            Credential.is_active == False
        )
    )
    inactive_creds = result.scalars().all()
    
    if not inactive_creds:
        return {"message": "没有失效凭证需要删除", "deleted_count": 0}
    
    # 先解除使用记录的外键引用，避免外键约束导致删除失败
    cred_ids = [c.id for c in inactive_creds]
    await db.execute(
        update(UsageLog).where(UsageLog.credential_id.in_(cred_ids)).values(credential_id=None)
    )
    
    deleted_count = 0
    for cred in inactive_creds:
        # 失效凭证不需要扣除额度（已经扣过了）
        await db.delete(cred)
        deleted_count += 1
        
        # 每100个提交一次，避免大事务超时
        if deleted_count % 100 == 0:
            try:
                await db.commit()
                log_info("Batch Delete", f"已删除 {deleted_count} 个凭证")
            except Exception as e:
                await db.rollback()
                log_error("Batch Delete", f"批量删除提交失败: {e}", exc_info=e)
                raise HTTPException(
                    status_code=500,
                    detail=f"批量删除失败（已删除 {deleted_count} 个）: {str(e)[:100]}"
                )
    
    # 最终提交
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        log_error("Batch Delete", f"批量删除最终提交失败: {e}", exc_info=e)
        raise HTTPException(
            status_code=500,
            detail=f"批量删除失败（已删除 {deleted_count} 个）: {str(e)[:100]}"
        )

    log_success("Batch Delete", f"用户 {user.username} 删除了 {deleted_count} 个失效凭证")
    return {"message": f"已删除 {deleted_count} 个失效凭证", "deleted_count": deleted_count}


@router.get("/credentials/{cred_id}/export")
async def export_my_credential(
    cred_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """导出我的凭证为 JSON 格式"""
    from app.services.crypto import decrypt_credential
    
    result = await db.execute(
        select(Credential).where(Credential.id == cred_id, Credential.user_id == user.id)
    )
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404, detail="凭证不存在")
    
    # 构建 gcli 兼容的 JSON 格式
    cred_data = {
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "refresh_token": decrypt_credential(cred.refresh_token) if cred.refresh_token else "",
        "token": decrypt_credential(cred.api_key) if cred.api_key else "",
        "project_id": cred.project_id or "",
        "email": cred.email or "",
        "type": "authorized_user"
    }
    
    return cred_data


@router.post("/credentials/{cred_id}/verify")
async def verify_my_credential(
    cred_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """验证我的凭证有效性和模型等级"""
    import httpx
    from app.services.credential_pool import CredentialPool
    
    try:
        log_info("Credential", f"开始检测凭证 {cred_id}")
        
        result = await db.execute(
            select(Credential).where(Credential.id == cred_id, Credential.user_id == user.id)
        )
        cred = result.scalar_one_or_none()
        if not cred:
            return {"is_valid": False, "model_tier": "2.5", "error": "凭证不存在", "supports_3": False}
        
        log_info("Credential", f"凭证 {cred.email} 开始获取 token")
        
        # 获取 access token
        try:
            access_token = await CredentialPool.get_access_token(cred, db)
        except Exception as e:
            log_warning("Credential", f"获取 token 异常: {e}")
            cred.is_active = False
            cred.last_error = f"获取 token 异常: {str(e)[:50]}"
            try:
                await db.commit()
            except Exception as commit_err:
                await db.rollback()
                log_error("Credential", f"凭证状态更新失败: {commit_err}", exc_info=commit_err)
            return {
                "is_valid": False,
                "model_tier": cred.model_tier or "2.5",
                "error": f"获取 token 异常: {str(e)[:50]}",
                "supports_3": False
            }

        if not access_token:
            cred.is_active = False
            cred.last_error = "无法获取 access token"
            try:
                await db.commit()
            except Exception as commit_err:
                await db.rollback()
                log_error("Credential", f"凭证状态更新失败: {commit_err}", exc_info=commit_err)
            return {
                "is_valid": False,
                "model_tier": cred.model_tier or "2.5",
                "error": "无法获取 access token",
                "supports_3": False
            }
        
        log_info("Credential", "获取到 token，开始测试")
        
        # 先检测账号类型（无论 API 是否可用）
        account_type = "unknown"
        type_result = None
        if cred.project_id:
            try:
                type_result = await CredentialPool.detect_account_type(access_token, cred.project_id)
                account_type = type_result.get("account_type", "unknown")
                log_info("Credential", f"账号类型检测结果: {type_result}")
            except Exception as e:
                log_warning("Credential", f"检测账号类型失败: {e}")
        
        # 测试 Gemini API
        is_valid = False
        supports_3 = False
        error_msg = None
        
        async with httpx.AsyncClient(timeout=15) as client:
            # 使用 cloudcode-pa 端点测试（与 gcli2api 一致）
            try:
                test_url = "https://cloudcode-pa.googleapis.com/v1internal:generateContent"
                headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
                
                # 先测试 2.5 判断凭证是否有效
                test_payload_25 = {
                    "model": "gemini-2.5-flash",
                    "project": cred.project_id or "",
                    "request": {"contents": [{"role": "user", "parts": [{"text": "hi"}]}]}
                }
                resp = await client.post(test_url, headers=headers, json=test_payload_25)
                log_info("Credential", f"gemini-2.5-flash 响应: {resp.status_code}")
                
                if resp.status_code == 200 or resp.status_code == 429:
                    is_valid = True
                    # 429 是检测时触发的限速，不是真正用完配额，不记录错误
                    
                    # 凭证有效，再测试 3.0
                    test_payload_3 = {
                        "model": "gemini-3-pro-preview",
                        "project": cred.project_id or "",
                        "request": {"contents": [{"role": "user", "parts": [{"text": "hi"}]}]}
                    }
                    resp3 = await client.post(test_url, headers=headers, json=test_payload_3)
                    log_info("Credential", f"gemini-3-pro-preview 响应: {resp3.status_code}")
                    
                    if resp3.status_code == 200 or resp3.status_code == 429:
                        supports_3 = True
                    else:
                        supports_3 = False
                elif resp.status_code in [401, 403]:
                    error_msg = f"认证失败 ({resp.status_code})"
                else:
                    error_msg = f"API 返回 {resp.status_code}"
            except Exception as e:
                error_msg = f"请求异常: {str(e)[:30]}"
        
        # 更新凭证状态
        cred.is_active = is_valid
        cred.model_tier = "3" if supports_3 else "2.5"
        # 正确使用 account_type 字段存储账号类型
        if account_type != "unknown":
            cred.account_type = account_type
        # last_error 只存储真正的错误信息
        cred.last_error = error_msg if error_msg else None

        try:
            await db.commit()
        except Exception as e:
            await db.rollback()
            log_error("Credential", f"凭证验证结果保存失败: {e}", exc_info=e)
            # 即使保存失败，也返回验证结果
            pass
        
        # 获取存储空间信息
        storage_gb = type_result.get("storage_gb") if type_result else None
        
        log_success("Credential", f"完成: valid={is_valid}, tier={cred.model_tier}, type={account_type}, storage={storage_gb}GB")
        
        return {
            "is_valid": is_valid,
            "model_tier": cred.model_tier,
            "supports_3": supports_3,
            "account_type": account_type,
            "storage_gb": storage_gb,
            "error": error_msg
        }
    except Exception as e:
        log_error("Credential", f"严重异常: {e}", exc_info=e)
        return {
            "is_valid": False,
            "model_tier": "2.5",
            "error": f"检测异常: {str(e)[:50]}",
            "supports_3": False
        }


@router.post("/credentials/{cred_id}/refresh-project-id")
async def refresh_credential_project_id(
    cred_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """刷新凭证的 project_id（使用 fetch_project_id 方法）"""
    import httpx
    from app.services.credential_pool import CredentialPool, fetch_project_id
    
    try:
        log_info("Credential", f"开始刷新凭证 {cred_id} 的 project_id")
        
        result = await db.execute(
            select(Credential).where(Credential.id == cred_id, Credential.user_id == user.id)
        )
        cred = result.scalar_one_or_none()
        if not cred:
            return {"success": False, "error": "凭证不存在", "project_id": None}
        
        # 获取 access token
        try:
            access_token = await CredentialPool.get_access_token(cred, db)
        except Exception as e:
            log_warning("Credential", f"获取 token 异常: {e}")
            return {"success": False, "error": f"获取 token 失败: {str(e)[:50]}", "project_id": cred.project_id}
        
        if not access_token:
            return {"success": False, "error": "无法获取 access token", "project_id": cred.project_id}
        
        log_info("Credential", "获取到 token，开始获取 project_id")
        
        # 使用 fetch_project_id 方法获取 project_id
        new_project_id = None
        try:
            new_project_id = await fetch_project_id(
                access_token=access_token,
                user_agent="CatieCli/1.0",
                api_base_url="https://cloudcode-pa.googleapis.com"
            )
            if new_project_id:
                log_success("Credential", f"fetch_project_id 获取到: {new_project_id}")
        except Exception as e:
            log_warning("Credential", f"fetch_project_id 失败: {e}")
        
        # 如果 fetch_project_id 失败，回退到 Cloud Resource Manager API
        if not new_project_id:
            log_info("Credential", "回退到 Cloud Resource Manager API...")
            try:
                async with httpx.AsyncClient(timeout=15) as client:
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
                                new_project_id = p.get("projectId")
                                break
                        if not new_project_id:
                            new_project_id = projects[0].get("projectId", "")
                        log_success("Credential", f"Cloud Resource Manager 获取到: {new_project_id}")
            except Exception as e:
                log_warning("Credential", f"Cloud Resource Manager 失败: {e}")
        
        if not new_project_id:
            return {"success": False, "error": "无法获取 project_id", "project_id": cred.project_id}

        # 更新数据库
        old_project_id = cred.project_id
        cred.project_id = new_project_id

        try:
            await db.commit()
        except Exception as e:
            await db.rollback()
            log_error("Credential", f"项目ID更新失败: {e}", exc_info=e)
            return {"success": False, "error": f"更新失败: {str(e)[:50]}", "project_id": old_project_id}

        log_success("Credential", f"完成: {old_project_id} -> {new_project_id}")
        
        return {
            "success": True,
            "project_id": new_project_id,
            "old_project_id": old_project_id,
            "message": f"项目ID已更新: {new_project_id}"
        }
        
    except Exception as e:
        log_error("Credential", f"严重异常: {e}", exc_info=e)
        return {"success": False, "error": f"刷新异常: {str(e)[:50]}", "project_id": None}


@router.get("/my-stats")
async def get_my_stats(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """获取个人统计信息"""
    from datetime import datetime, date

    # 获取用户凭证信息
    creds_result = await db.execute(
        select(Credential).where(Credential.user_id == user.id)
    )
    creds = creds_result.scalars().all()
    credentials_count = len(creds)
    cred_30_count = len([c for c in creds if c.model_tier == "3" and c.is_active])

    # 获取今日使用量
    today = date.today()
    today_usage_result = await db.execute(
        select(func.count(UsageLog.id)).where(
            UsageLog.user_id == user.id,
            func.date(UsageLog.created_at) == today
        )
    )
    today_usage = today_usage_result.scalar() or 0

    # 获取今日调用日志（最近50条）
    logs_result = await db.execute(
        select(UsageLog)
        .where(
            UsageLog.user_id == user.id,
            func.date(UsageLog.created_at) == today
        )
        .order_by(UsageLog.created_at.desc())
        .limit(50)
    )
    logs = logs_result.scalars().all()

    today_logs = [
        {
            "id": log.id,
            "model": log.model,
            "endpoint": log.endpoint,
            "status_code": log.status_code,
            "latency_ms": log.latency_ms,
            "tokens_input": log.tokens_input,
            "tokens_output": log.tokens_output,
            "credential_email": log.credential_email,
            "created_at": log.created_at.isoformat() + "Z" if log.created_at else None
        }
        for log in logs
    ]

    # 计算配额明细（简化版本，统一配额）
    from app.config import settings
    default_quota = settings.default_daily_quota
    bonus_quota = max(0, user.daily_quota - default_quota)

    return {
        "total_quota": user.daily_quota,
        "today_usage": today_usage,
        "credentials_count": credentials_count,
        "cred_30_count": cred_30_count,
        "today_logs": today_logs,
        "quota_breakdown": {
            "flash": 0,  # 已废弃，保留兼容性
            "pro_25": 0,  # 已废弃，保留兼容性
            "tier_3": 0,  # 已废弃，保留兼容性
            "daily": default_quota,  # 每日基础配额
            "bonus": bonus_quota  # 奖励配额（凭证奖励等）
        }
    }
