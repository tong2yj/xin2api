# Antigravity 反代功能测试脚本

## 测试前准备

1. 确保服务已启动：`python backend/run.py`
2. 获取你的 API Key（登录后台 → 仪表盘 → 复制 API Key）
3. 确保已上传至少一个有效的 Gemini 凭证

## 测试用例

### 1. 测试 OpenAI 兼容接口（非流式）

```bash
curl http://localhost:5001/antigravity/v1/chat/completions \
  -H "Authorization: Bearer cat-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {"role": "user", "content": "你好，请用一句话介绍你自己"}
    ],
    "stream": false
  }'
```

**预期结果**：返回 JSON 格式的 OpenAI 兼容响应

---

### 2. 测试 OpenAI 兼容接口（流式）

```bash
curl http://localhost:5001/antigravity/v1/chat/completions \
  -H "Authorization: Bearer cat-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {"role": "user", "content": "写一首关于春天的诗"}
    ],
    "stream": true
  }'
```

**预期结果**：返回 SSE 流式响应，逐字输出

---

### 3. 测试模型列表接口

```bash
curl http://localhost:5001/antigravity/v1/models \
  -H "Authorization: Bearer cat-your-api-key"
```

**预期结果**：返回可用模型列表

---

### 4. 测试 Gemini 原生接口（非流式）

```bash
curl http://localhost:5001/antigravity/v1/models/gemini-2.5-flash:generateContent \
  -H "Authorization: Bearer cat-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{"text": "解释一下量子计算"}]
      }
    ]
  }'
```

**预期结果**：返回 Gemini 格式的响应

---

### 5. 测试 Gemini 原生接口（流式）

```bash
curl http://localhost:5001/antigravity/v1/models/gemini-2.5-flash:streamGenerateContent \
  -H "Authorization: Bearer cat-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{"text": "讲一个笑话"}]
      }
    ]
  }'
```

**预期结果**：返回 Gemini 格式的 SSE 流式响应

---

### 6. 测试权限控制（使用无效 API Key）

```bash
curl http://localhost:5001/antigravity/v1/chat/completions \
  -H "Authorization: Bearer invalid-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [{"role": "user", "content": "test"}]
  }'
```

**预期结果**：返回 401 错误，提示"无效的API Key"

---

### 7. 测试配额限制（普通用户）

使用普通用户的 API Key，连续发送请求直到超过配额：

```bash
# 循环发送请求（Linux/Mac）
for i in {1..150}; do
  curl http://localhost:5001/antigravity/v1/chat/completions \
    -H "Authorization: Bearer cat-user-api-key" \
    -H "Content-Type: application/json" \
    -d '{"model": "gemini-2.5-flash", "messages": [{"role": "user", "content": "hi"}]}'
  echo "\n--- Request $i ---"
done
```

**预期结果**：超过配额后返回 429 错误

---

### 8. 测试管理员无限配额

使用管理员的 API Key，发送大量请求：

```bash
curl http://localhost:5001/antigravity/v1/chat/completions \
  -H "Authorization: Bearer cat-admin-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-4-5",
    "messages": [{"role": "user", "content": "test"}]
  }'
```

**预期结果**：即使超过普通用户配额，管理员仍可正常使用

---

## Python 测试脚本

```python
import requests
import json

# 配置
BASE_URL = "http://localhost:5001"
API_KEY = "cat-your-api-key"  # 替换为你的 API Key

def test_openai_chat():
    """测试 OpenAI 兼容接口"""
    url = f"{BASE_URL}/antigravity/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "gemini-2.5-flash",
        "messages": [
            {"role": "user", "content": "你好，请用一句话介绍你自己"}
        ],
        "stream": False
    }

    response = requests.post(url, headers=headers, json=data)
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")

def test_openai_stream():
    """测试 OpenAI 流式接口"""
    url = f"{BASE_URL}/antigravity/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "gemini-2.5-flash",
        "messages": [
            {"role": "user", "content": "写一首关于春天的诗"}
        ],
        "stream": True
    }

    response = requests.post(url, headers=headers, json=data, stream=True)
    print(f"Status: {response.status_code}")
    print("Streaming response:")
    for line in response.iter_lines():
        if line:
            print(line.decode('utf-8'))

def test_models_list():
    """测试模型列表"""
    url = f"{BASE_URL}/antigravity/v1/models"
    headers = {
        "Authorization": f"Bearer {API_KEY}"
    }

    response = requests.get(url, headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Models: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")

if __name__ == "__main__":
    print("=== 测试 OpenAI 兼容接口 ===")
    test_openai_chat()

    print("\n=== 测试 OpenAI 流式接口 ===")
    test_openai_stream()

    print("\n=== 测试模型列表 ===")
    test_models_list()
```

---

## 检查日志

在管理后台查看使用日志：

1. 登录管理后台：http://localhost:5001
2. 进入"使用日志"页面
3. 查看 Antigravity 请求记录（endpoint 包含 `/antigravity/`）

---

## 常见问题

### Q: 返回 403 "没有可用的凭证"
**A**: 请先在后台上传至少一个有效的 Gemini 凭证（通过 OAuth 授权）

### Q: 返回 429 "今日配额已用完"
**A**: 普通用户配额已用完，可以：
- 等待北京时间 15:00 配额重置
- 联系管理员增加配额
- 上传凭证获得奖励配额

### Q: 返回 500 "Antigravity API错误"
**A**: 检查：
- 凭证是否有效（未过期）
- project_id 是否正确
- 网络是否能访问 cloudcode-pa.googleapis.com

### Q: 管理员如何查看所有用户的使用情况？
**A**: 登录管理后台 → 使用日志 → 筛选 endpoint 包含 `/antigravity/`
