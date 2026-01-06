from pydantic_settings import BaseSettings
from typing import Optional
import os
import shutil

# 自动创建 .env 文件（如果不存在）
_env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
_env_example_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env.example')
if not os.path.exists(_env_path) and os.path.exists(_env_example_path):
    shutil.copy(_env_example_path, _env_path)
    print("✅ 已自动创建 .env 配置文件")


class Settings(BaseSettings):
    # 数据库
    database_url: str = "sqlite+aiosqlite:///./data/gemini_proxy.db"
    
    # JWT
    secret_key: str = "your-super-secret-key-change-this"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7天
    
    # 管理员
    admin_username: str = "admin"
    admin_password: str = "admin123"
    
    # 服务
    host: str = "0.0.0.0"
    port: int = int(os.getenv("PORT", "10601"))  # 默认端口10601，Zeabur会通过PORT环境变量设置端口
    
    # Gemini
    gemini_api_base: str = "https://generativelanguage.googleapis.com"
    
    # 用户配额（统一按次数）
    default_daily_quota: int = 100  # 新用户默认每日配额（次数）

    # 凭证奖励配额（上传凭证后获得的额外配额次数）
    credential_reward_quota: int = 1000  # 上传凭证奖励的配额次数
    
    # 速率限制 (RPM - requests per minute)
    base_rpm: int = 5  # 未上传凭证的用户
    contributor_rpm: int = 10  # 上传凭证的用户
    
    # 错误重试
    error_retry_count: int = 3  # 报错时切换凭证重试次数
    
    # CD 机制（冷却时间，单位：秒）
    cd_flash: int = 0   # Flash 模型组 CD（0=无CD）
    cd_pro: int = 4     # Pro 模型组 CD（默认4秒）
    cd_30: int = 4      # 3.0 模型组 CD（默认4秒）

    # 注册
    allow_registration: bool = True

    # 强制捐赠：上传凭证时强制设为公开
    force_donate: bool = False

    # 锁定捐赠：不允许取消捐赠（除非凭证失效）
    lock_donate: bool = False
    
    # 公告
    announcement_enabled: bool = False
    announcement_title: str = ""
    announcement_content: str = ""
    announcement_read_seconds: int = 5  # 阅读多少秒才能关闭
    
    # Google OAuth (Gemini CLI 官方配置)
    google_client_id: str = "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com"
    google_client_secret: str = "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"

    # Antigravity OAuth 配置
    antigravity_client_id: str = "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com"
    antigravity_client_secret: str = "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"
    antigravity_api_url: str = "https://daily-cloudcode-pa.sandbox.googleapis.com"
    
    # OpenAI API 反代 (可选)
    openai_api_key: str = ""  # 如果填写，则支持真正的 OpenAI API 反代
    openai_api_base: str = "https://api.openai.com"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()


# 可持久化的配置项
PERSISTENT_CONFIG_KEYS = [
    "allow_registration",
    "default_daily_quota",
    "credential_reward_quota",
    "base_rpm",
    "contributor_rpm",
    "force_donate",
    "lock_donate",
    "error_retry_count",
    "cd_flash",
    "cd_pro",
    "cd_30",
    "announcement_enabled",
    "announcement_title",
    "announcement_content",
    "announcement_read_seconds",
]


async def load_config_from_db():
    """从数据库加载配置"""
    from app.database import async_session
    from app.models.user import SystemConfig
    from sqlalchemy import select
    
    async with async_session() as db:
        result = await db.execute(select(SystemConfig))
        configs = result.scalars().all()
        
        for config in configs:
            if hasattr(settings, config.key):
                value = config.value
                # 类型转换
                attr_type = type(getattr(settings, config.key))
                if attr_type == bool:
                    value = value.lower() in ('true', '1', 'yes')
                elif attr_type == int:
                    value = int(value)
                setattr(settings, config.key, value)
                print(f"[Config] 从数据库加载: {config.key} = {value}")


async def save_config_to_db(key: str, value):
    """保存单个配置到数据库"""
    from app.database import async_session
    from app.models.user import SystemConfig
    from sqlalchemy import select
    
    async with async_session() as db:
        result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
        config = result.scalar_one_or_none()
        
        if config:
            config.value = str(value)
        else:
            config = SystemConfig(key=key, value=str(value))
            db.add(config)
        
        await db.commit()
