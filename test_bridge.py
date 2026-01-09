"""
测试 gcli2api 桥接功能
"""
import asyncio
import sys
import os

# 添加 backend 到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.services.gcli2api_bridge import gcli2api_bridge
from app.config import settings


async def test_bridge():
    """测试桥接功能"""
    print("=" * 60)
    print("测试 gcli2api 桥接功能")
    print("=" * 60)

    # 检查配置
    print(f"\n📋 配置检查:")
    print(f"  - 桥接启用: {settings.enable_gcli2api_bridge}")
    print(f"  - 服务地址: {settings.gcli2api_base_url}")
    print(f"  - API 密码: {'***' if settings.gcli2api_api_password else '未设置'}")
    print(f"  - 面板密码: {'***' if settings.gcli2api_panel_password else '未设置'}")

    if not settings.enable_gcli2api_bridge:
        print("\n⚠️  桥接功能未启用，请在 .env 中设置 ENABLE_GCLI2API_BRIDGE=true")
        return

    # 健康检查
    print(f"\n🏥 健康检查:")
    is_healthy = await gcli2api_bridge.health_check()
    if is_healthy:
        print(f"  ✅ gcli2api 服务可用")
    else:
        print(f"  ❌ gcli2api 服务不可用，请确保服务已启动")
        print(f"     地址: {settings.gcli2api_base_url}")
        return

    # 获取 GCLI 凭证
    print(f"\n📦 获取 GCLI 凭证:")
    gcli_creds = await gcli2api_bridge.get_gcli_credentials()
    print(f"  - 凭证数量: {len(gcli_creds)}")
    if gcli_creds:
        for i, cred in enumerate(gcli_creds[:3], 1):  # 只显示前3个
            print(f"  - [{i}] {cred.get('user_email') or cred['filename']}")
            print(f"       状态: {'禁用' if cred.get('disabled') else '启用'}")
            print(f"       错误: {len(cred.get('error_codes', []))} 个")

    # 获取 Antigravity 凭证
    print(f"\n🚀 获取 Antigravity 凭证:")
    ag_creds = await gcli2api_bridge.get_antigravity_credentials()
    print(f"  - 凭证数量: {len(ag_creds)}")
    if ag_creds:
        for i, cred in enumerate(ag_creds[:3], 1):
            print(f"  - [{i}] {cred.get('user_email') or cred['filename']}")
            print(f"       状态: {'禁用' if cred.get('disabled') else '启用'}")
            print(f"       错误: {len(cred.get('error_codes', []))} 个")

    # 总结
    print(f"\n" + "=" * 60)
    print(f"✅ 测试完成!")
    print(f"  - GCLI 凭证: {len(gcli_creds)} 个")
    print(f"  - Antigravity 凭证: {len(ag_creds)} 个")
    print(f"  - 总计: {len(gcli_creds) + len(ag_creds)} 个")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_bridge())
