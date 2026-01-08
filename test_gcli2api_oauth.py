"""
测试 gcli2api OAuth 接口
用于诊断 OAuth 回调失败问题
"""

import httpx
import asyncio
import json

# 配置
GCLI2API_BASE_URL = "http://localhost:7861"  # 修改为你的 gcli2api 地址
PANEL_PASSWORD = "catie_gcli2api_panel_password_2026"  # 修改为你的面板密码

async def test_oauth_endpoints():
    """测试 OAuth 相关端点"""

    headers = {
        "Authorization": f"Bearer {PANEL_PASSWORD}",
        "Content-Type": "application/json"
    }

    print("=" * 60)
    print("测试 gcli2api OAuth 接口")
    print("=" * 60)

    async with httpx.AsyncClient(timeout=30.0) as client:

        # 1. 测试根路径
        print("\n1. 测试根路径...")
        try:
            response = await client.get(f"{GCLI2API_BASE_URL}/")
            print(f"   状态码: {response.status_code}")
            print(f"   响应: {response.text[:200]}")
        except Exception as e:
            print(f"   ❌ 错误: {e}")

        # 2. 测试 /auth/start (GeminiCLI)
        print("\n2. 测试 /auth/start (GeminiCLI)...")
        try:
            response = await client.post(
                f"{GCLI2API_BASE_URL}/auth/start",
                headers=headers,
                json={"mode": "geminicli"}
            )
            print(f"   状态码: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ 成功: {json.dumps(data, indent=2, ensure_ascii=False)}")
            else:
                print(f"   响应: {response.text}")
        except Exception as e:
            print(f"   ❌ 错误: {e}")

        # 3. 测试 /auth/start (Antigravity)
        print("\n3. 测试 /auth/start (Antigravity)...")
        try:
            response = await client.post(
                f"{GCLI2API_BASE_URL}/auth/start",
                headers=headers,
                json={"mode": "antigravity"}
            )
            print(f"   状态码: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ 成功: {json.dumps(data, indent=2, ensure_ascii=False)}")
            else:
                print(f"   响应: {response.text}")
        except Exception as e:
            print(f"   ❌ 错误: {e}")

        # 4. 测试可能的其他路径
        alternative_paths = [
            "/oauth/auth-url",
            "/api/oauth/auth-url",
            "/panel/oauth/start",
            "/oauth/start",
        ]

        print("\n4. 测试其他可能的 OAuth 路径...")
        for path in alternative_paths:
            try:
                response = await client.post(
                    f"{GCLI2API_BASE_URL}{path}",
                    headers=headers,
                    json={"mode": "geminicli"}
                )
                if response.status_code < 500:
                    print(f"   {path}: {response.status_code}")
                    if response.status_code == 200:
                        print(f"      ✅ 找到有效端点!")
            except Exception:
                pass

        # 5. 测试 API 文档端点
        print("\n5. 检查 API 文档...")
        doc_paths = ["/docs", "/redoc", "/openapi.json"]
        for path in doc_paths:
            try:
                response = await client.get(f"{GCLI2API_BASE_URL}{path}")
                if response.status_code == 200:
                    print(f"   ✅ {path} 可访问")
            except Exception:
                pass

    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_oauth_endpoints())
