from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import secrets
from app.database import Base


class User(Base):
    """用户表"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    daily_quota = Column(Integer, default=100)  # 每日配额（统一按次数）
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")
    usage_logs = relationship("UsageLog", back_populates="user", cascade="all, delete-orphan")
    credentials = relationship("Credential", back_populates="owner")


class APIKey(Base):
    """用户API密钥表"""
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    key = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(100), default="default")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)
    
    # 关系
    user = relationship("User", back_populates="api_keys")
    
    @staticmethod
    def generate_key():
        """生成API密钥: cat-xxxxxxxx"""
        return f"cat-{secrets.token_hex(24)}"


class UsageLog(Base):
    """使用记录表"""
    __tablename__ = "usage_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    api_key_id = Column(Integer, ForeignKey("api_keys.id"), nullable=True)
    credential_id = Column(Integer, ForeignKey("credentials.id", ondelete="SET NULL"), nullable=True)  # 使用的凭证
    model = Column(String(100), nullable=True)
    endpoint = Column(String(200), nullable=True)
    tokens_input = Column(Integer, default=0)
    tokens_output = Column(Integer, default=0)
    status_code = Column(Integer, nullable=True)
    latency_ms = Column(Float, nullable=True)
    cd_seconds = Column(Integer, nullable=True)  # 429 时设置的 CD 秒数
    created_at = Column(DateTime, default=datetime.utcnow)
    # 详细报错信息
    error_message = Column(Text, nullable=True)  # 错误信息
    request_body = Column(Text, nullable=True)   # 请求内容（截断保存）
    client_ip = Column(String(50), nullable=True)  # 客户端 IP
    user_agent = Column(String(500), nullable=True)  # User Agent
    # 错误分类字段（新增）
    error_type = Column(String(50), nullable=True, index=True)  # 错误类型：AUTH_ERROR, RATE_LIMIT, QUOTA_EXHAUSTED 等
    error_code = Column(String(100), nullable=True)  # 错误码：PERMISSION_DENIED, RESOURCE_EXHAUSTED 等
    credential_email = Column(String(100), nullable=True)  # 使用的凭证邮箱（方便排查）
    
    # 关系
    user = relationship("User", back_populates="usage_logs")
    credential = relationship("Credential")


class Credential(Base):
    """Gemini凭证池"""
    __tablename__ = "credentials"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # 所属用户
    name = Column(String(100), nullable=False)
    api_key = Column(Text, nullable=False)  # Gemini API Key 或 OAuth access_token
    refresh_token = Column(Text, nullable=True)  # OAuth refresh_token
    client_id = Column(Text, nullable=True)  # OAuth client_id（加密存储）
    client_secret = Column(Text, nullable=True)  # OAuth client_secret（加密存储）
    project_id = Column(String(200), nullable=True)  # Google Cloud Project ID
    credential_type = Column(String(20), default="api_key")  # api_key, oauth, oauth_antigravity
    model_tier = Column(String(10), default="2.5")  # 模型等级: "3" 或 "2.5"
    account_type = Column(String(20), default="free")  # 账号类型: "pro" 或 "free"
    email = Column(String(100), nullable=True)  # OAuth 关联的邮箱
    is_public = Column(Boolean, default=False)  # 是否捐赠到公共池
    is_active = Column(Boolean, default=True)
    total_requests = Column(Integer, default=0)
    failed_requests = Column(Integer, default=0)
    last_used_at = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    # CD 机制：按模型组记录最后使用时间
    last_used_flash = Column(DateTime, nullable=True)  # Flash 模型组 CD
    last_used_pro = Column(DateTime, nullable=True)    # Pro 模型组 CD
    last_used_30 = Column(DateTime, nullable=True)     # 3.0 模型组 CD
    
    # 关系
    owner = relationship("User", back_populates="credentials")


class SystemConfig(Base):
    """系统配置表（持久化存储）"""
    __tablename__ = "system_config"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class OpenAIEndpoint(Base):
    """OpenAI 兼容端点管理表"""
    __tablename__ = "openai_endpoints"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # 端点名称（如：DeepSeek、通义千问等）
    api_key = Column(Text, nullable=False)  # API Key
    base_url = Column(String(500), nullable=False)  # API Base URL
    is_active = Column(Boolean, default=True)  # 是否启用
    priority = Column(Integer, default=0)  # 优先级（数字越大优先级越高）
    total_requests = Column(Integer, default=0)  # 总请求数
    failed_requests = Column(Integer, default=0)  # 失败请求数
    last_used_at = Column(DateTime, nullable=True)  # 最后使用时间
    last_error = Column(Text, nullable=True)  # 最后错误信息
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

