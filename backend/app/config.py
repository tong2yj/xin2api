from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional, List, Union
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
    credential_reward_quota: int = 1000  # 上传凭证奖励的配额次数

    # 注册
    allow_registration: bool = True
    require_approval: bool = False  # 新用户是否需要管理员审核

    # 公告
    announcement_enabled: bool = False
    announcement_title: str = ""
    announcement_content: str = ""
    announcement_read_seconds: int = 5  # 阅读多少秒才能关闭

    # Google OAuth (已废弃，仅支持 gcli2api 桥接模式)
    # google_client_id: str = ""
    # google_client_secret: str = ""

    # Antigravity OAuth 配置 (已废弃，仅支持 gcli2api 桥接模式)
    # antigravity_client_id: str = ""
    # antigravity_client_secret: str = ""
    # antigravity_api_url: str = ""

    # OpenAI API 反代 (可选)
    openai_api_key: str = ""  # 如果填写，则支持真正的 OpenAI API 反代
    openai_api_base: str = "https://api.openai.com"

    # gcli2api 桥接配置（强制启用）
    enable_gcli2api_bridge: bool = True  # 强制启用 gcli2api 桥接模式
    gcli2api_base_url: str = "http://localhost:7861"  # gcli2api 服务地址
    gcli2api_api_password: str = ""  # gcli2api 的 API_PASSWORD (用于聊天接口)
    gcli2api_panel_password: str = ""  # gcli2api 的 PANEL_PASSWORD (用于管理接口)

    # 三端点轮询配置
    endpoint_priority: Union[str, List[str]] = "gcli2api,antigravity,openai"  # 端点优先级顺序

    @field_validator('endpoint_priority', mode='before')
    @classmethod
    def parse_endpoint_priority(cls, v):
        """解析端点优先级配置，支持字符串和列表两种格式"""
        if isinstance(v, str):
            # 从环境变量读取的逗号分隔字符串
            return [x.strip() for x in v.split(',') if x.strip()]
        elif isinstance(v, list):
            # 已经是列表格式
            return v
        return ["gcli2api", "antigravity", "openai"]  # 默认值

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()


# 可持久化的配置项
PERSISTENT_CONFIG_KEYS = [
    "allow_registration",
    "require_approval",
    "default_daily_quota",
    "credential_reward_quota",
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
