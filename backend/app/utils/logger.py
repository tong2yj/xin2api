"""
统一日志系统模块

提供标准化的日志记录功能，替代项目中的 print() 调用
支持颜色输出、日志级别、结构化日志等功能
"""
import logging
import sys
from typing import Optional, Any
from datetime import datetime


class ColoredFormatter(logging.Formatter):
    """带颜色的日志格式化器（仅在终端环境下启用）"""

    # ANSI 颜色代码
    COLORS = {
        'DEBUG': '\033[36m',    # 青色
        'INFO': '\033[32m',     # 绿色
        'WARNING': '\033[33m',  # 黄色
        'ERROR': '\033[31m',    # 红色
        'CRITICAL': '\033[35m', # 紫色
    }
    RESET = '\033[0m'

    def __init__(self, *args, use_colors: bool = True, **kwargs):
        super().__init__(*args, **kwargs)
        self.use_colors = use_colors and sys.stdout.isatty()

    def format(self, record):
        if self.use_colors:
            levelname = record.levelname
            if levelname in self.COLORS:
                record.levelname = f"{self.COLORS[levelname]}{levelname}{self.RESET}"
        return super().format(record)


def setup_logger(
    name: str = "cati_cli",
    level: str = "INFO",
    use_colors: bool = True,
    log_file: Optional[str] = None
) -> logging.Logger:
    """
    设置日志记录器

    Args:
        name: 日志记录器名称
        level: 日志级别 (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        use_colors: 是否使用颜色输出
        log_file: 日志文件路径（可选）

    Returns:
        配置好的 Logger 实例
    """
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper()))

    # 避免重复添加 handler
    if logger.handlers:
        return logger

    # 控制台 handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)
    console_formatter = ColoredFormatter(
        '%(asctime)s [%(levelname)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
        use_colors=use_colors
    )
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)

    # 文件 handler（可选）
    if log_file:
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)
        file_formatter = logging.Formatter(
            '%(asctime)s [%(levelname)s] %(name)s: %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)

    return logger


# 全局日志实例
logger = setup_logger()


# ===== 便捷日志函数 =====

def log_debug(module: str, message: str, **kwargs):
    """
    记录 DEBUG 级别日志

    Args:
        module: 模块名称（如 "Proxy", "Auth"）
        message: 日志消息
        **kwargs: 额外的上下文信息
    """
    extra_info = f" | {kwargs}" if kwargs else ""
    logger.debug(f"[{module}] {message}{extra_info}")


def log_info(module: str, message: str, **kwargs):
    """
    记录 INFO 级别日志

    Args:
        module: 模块名称
        message: 日志消息
        **kwargs: 额外的上下文信息
    """
    extra_info = f" | {kwargs}" if kwargs else ""
    logger.info(f"[{module}] {message}{extra_info}")


def log_warning(module: str, message: str, **kwargs):
    """
    记录 WARNING 级别日志（带 ⚠️ emoji）

    Args:
        module: 模块名称
        message: 日志消息
        **kwargs: 额外的上下文信息
    """
    extra_info = f" | {kwargs}" if kwargs else ""
    logger.warning(f"[{module}] ⚠️ {message}{extra_info}")


def log_error(module: str, message: str, exc_info: Optional[Exception] = None, **kwargs):
    """
    记录 ERROR 级别日志（带 ❌ emoji）

    Args:
        module: 模块名称
        message: 日志消息
        exc_info: 异常对象（可选）
        **kwargs: 额外的上下文信息
    """
    extra_info = f" | {kwargs}" if kwargs else ""
    logger.error(f"[{module}] ❌ {message}{extra_info}", exc_info=exc_info)


def log_success(module: str, message: str, **kwargs):
    """
    记录成功日志（INFO 级别，带 ✅ emoji）

    Args:
        module: 模块名称
        message: 日志消息
        **kwargs: 额外的上下文信息
    """
    extra_info = f" | {kwargs}" if kwargs else ""
    logger.info(f"[{module}] ✅ {message}{extra_info}")


def log_critical(module: str, message: str, exc_info: Optional[Exception] = None, **kwargs):
    """
    记录 CRITICAL 级别日志（带 🔥 emoji）

    Args:
        module: 模块名称
        message: 日志消息
        exc_info: 异常对象（可选）
        **kwargs: 额外的上下文信息
    """
    extra_info = f" | {kwargs}" if kwargs else ""
    logger.critical(f"[{module}] 🔥 {message}{extra_info}", exc_info=exc_info)


# ===== 特殊用途日志函数 =====

def log_request(
    module: str,
    method: str,
    path: str,
    status_code: Optional[int] = None,
    latency_ms: Optional[int] = None,
    **kwargs
):
    """
    记录 HTTP 请求日志

    Args:
        module: 模块名称
        method: HTTP 方法
        path: 请求路径
        status_code: 响应状态码
        latency_ms: 响应延迟（毫秒）
        **kwargs: 额外信息
    """
    status_str = f"status={status_code}" if status_code else ""
    latency_str = f"latency={latency_ms}ms" if latency_ms else ""
    extra_parts = [status_str, latency_str] + [f"{k}={v}" for k, v in kwargs.items()]
    extra_info = " | " + ", ".join(filter(None, extra_parts)) if any(extra_parts) else ""

    logger.info(f"[{module}] {method} {path}{extra_info}")


def log_credential_usage(
    module: str,
    email: str,
    model: str,
    project_id: Optional[str] = None,
    **kwargs
):
    """
    记录凭证使用日志

    Args:
        module: 模块名称
        email: 凭证邮箱
        model: 使用的模型
        project_id: 项目 ID
        **kwargs: 额外信息
    """
    project_str = f", project_id={project_id}" if project_id else ""
    extra_info = f" | {kwargs}" if kwargs else ""
    logger.info(f"[{module}] 使用凭证: {email}, model={model}{project_str}{extra_info}")


def log_db_operation(
    module: str,
    operation: str,
    table: str,
    success: bool = True,
    error: Optional[Exception] = None,
    **kwargs
):
    """
    记录数据库操作日志

    Args:
        module: 模块名称
        operation: 操作类型（create, update, delete, query）
        table: 表名
        success: 是否成功
        error: 错误对象
        **kwargs: 额外信息
    """
    extra_info = f" | {kwargs}" if kwargs else ""

    if success:
        logger.info(f"[{module}] 数据库操作成功: {operation} {table}{extra_info}")
    else:
        error_msg = f": {str(error)[:100]}" if error else ""
        logger.error(f"[{module}] ❌ 数据库操作失败: {operation} {table}{error_msg}{extra_info}", exc_info=error)


def log_quota_check(
    module: str,
    user: str,
    current: int,
    limit: int,
    passed: bool = True,
    **kwargs
):
    """
    记录配额检查日志

    Args:
        module: 模块名称
        user: 用户名
        current: 当前使用量
        limit: 配额限制
        passed: 是否通过检查
        **kwargs: 额外信息
    """
    extra_info = f" | {kwargs}" if kwargs else ""

    if passed:
        logger.info(f"[{module}] 配额检查通过: user={user}, usage={current}/{limit}{extra_info}")
    else:
        logger.warning(f"[{module}] ⚠️ 配额超限: user={user}, usage={current}/{limit}{extra_info}")


# ===== 兼容性函数（逐步迁移用） =====

def print_log(message: str, level: str = "INFO", module: str = "App", flush: bool = True):
    """
    兼容旧的 print() 调用（逐步迁移用）

    Args:
        message: 日志消息
        level: 日志级别
        module: 模块名称
        flush: 忽略（兼容性参数）
    """
    level_map = {
        "DEBUG": log_debug,
        "INFO": log_info,
        "WARNING": log_warning,
        "ERROR": log_error,
        "CRITICAL": log_critical,
    }

    log_func = level_map.get(level.upper(), log_info)
    log_func(module, message)


# ===== 导出 =====
__all__ = [
    'logger',
    'setup_logger',
    'log_debug',
    'log_info',
    'log_warning',
    'log_error',
    'log_success',
    'log_critical',
    'log_request',
    'log_credential_usage',
    'log_db_operation',
    'log_quota_check',
    'print_log',
]
