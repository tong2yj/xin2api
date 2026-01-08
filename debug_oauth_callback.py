"""
gcli2api OAuth 回调测试脚本
用于诊断 OAuth 回调失败的问题
"""

import httpx
import asyncio
import json
from urllib.parse import urlparse, parse_qs

# 配置
GCLI2API_BASE_URL = "http://localhost:7861"  # 修改为你的 gcli2api 地址
PANEL_PASSWORD = "catie_gcli2api_panel_password_2026"  # 修改为你的面板密码

# 测试用的回调 URL（从你的日志中复制）
TEST_CALLBACK_URL = "http://localhost:11452/?state=catie_gcli2api_panel_password_2026_55d7d6eb-8533-4ade-a721-8d34dcd7315e&code=4/0ATX87lON5GZiiz2KFCRFtxUwVH-CRRvV1cPOS9o6mUNP3AzgtxP8luBvnLjV7hz3-rQOoA&scope=email%20profile%20https://www.googleapis.com/auth/cloud-platform%20https://www.googleapis.com/auth/userinfo.email%20https://www.googleapis.com/auth/userinfo.profile%20openid&authuser=3&prompt=consent"

async def test_callback_url():
    """测试 /auth/callback-url 接口"""

    print("=" * 60)
    print("测试 gcli2api /auth/callback-url 接口")
    print("=" * 60)

    headers = {
        "Authorization": f"Bearer {PANEL_PASSWORD}",
        "Content-Type": "application/json"
    }

    # 解析回调 URL
    parsed = urlparse(TEST_CALLBACK_URL)
    params = parse_qs(parsed.query)

    print(f"\n回调 URL 信息:")
    print(f"  State: {params.get('state', ['N/A'])[0][:50]}...")
    print(f"  Code: {params.get('code', ['N/A'])[0][:30]}...")
    print(f"  Scope: {params.get('scope', ['N/A'])[0][:50]}...")

    async with httpx.AsyncClient(timeout=120.0) as client:

        # 测试 1: 先获取认证链接（创建 auth flow）
        print(f"\n{'='*60}")
        print("步骤 1: 获取认证链接（创建 auth flow）")
        print(f"{'='*60}")

        try:
            response = await client.post(
                f"{GCLI2API_BASE_URL}/auth/start",
                headers=headers,
                json={"use_antigravity": True}  # 使用布尔值而不是 mode 字符串
            )
            print(f"状态码: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 成功获取认证链接")
                print(f"   回调端口: {data.get('callback_port')}")
                print(f"   认证 URL: {data.get('auth_url')[:80]}...")
            else:
                print(f"❌ 失败: {response.text}")
                return
        except Exception as e:
            print(f"❌ 错误: {e}")
            return

        # 等待一下，让用户有时间完成授权
        print(f"\n⏳ 等待 3 秒...")
        await asyncio.sleep(3)

        # 测试 2: 提交回调 URL
        print(f"\n{'='*60}")
        print("步骤 2: 提交回调 URL")
        print(f"{'='*60}")

        try:
            response = await client.post(
                f"{GCLI2API_BASE_URL}/auth/callback-url",
                headers=headers,
                json={
                    "callback_url": TEST_CALLBACK_URL,
                    "use_antigravity": True
                }
            )

            print(f"状态码: {response.status_code}")
            print(f"\n完整响应:")
            print(f"{'-'*60}")

            try:
                data = response.json()
                print(json.dumps(data, indent=2, ensure_ascii=False))

                # 分析响应
                print(f"\n{'='*60}")
                print("响应分析:")
                print(f"{'='*60}")

                if "success" in data:
                    print(f"✅ 包含 'success' 字段: {data['success']}")
                else:
                    print(f"❌ 缺少 'success' 字段")

                if "credentials" in data:
                    print(f"✅ 包含 'credentials' 字段")
                    creds = data['credentials']
                    print(f"   - project_id: {creds.get('project_id', 'N/A')}")
                    print(f"   - client_id: {creds.get('client_id', 'N/A')[:30]}...")
                else:
                    print(f"❌ 缺少 'credentials' 字段")

                if "error" in data:
                    print(f"⚠️  包含 'error' 字段: {data['error']}")

                if "file_path" in data:
                    print(f"✅ 包含 'file_path' 字段: {data['file_path']}")

            except Exception as e:
                print(f"响应不是 JSON 格式:")
                print(response.text)

        except Exception as e:
            print(f"❌ 请求失败: {e}")

    print(f"\n{'='*60}")
    print("测试完成")
    print(f"{'='*60}")

if __name__ == "__main__":
    print("\n⚠️  注意：")
    print("1. 确保 gcli2api 正在运行")
    print("2. 确保已经先调用 /auth/start 创建了 auth flow")
    print("3. 测试用的回调 URL 中的 code 可能已过期")
    print("4. 如果 code 过期，需要重新获取新的回调 URL")
    print()

    asyncio.run(test_callback_url())
