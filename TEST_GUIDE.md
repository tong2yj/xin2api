# CatieCli 测试指南

## 🚀 服务信息

- **服务地址**: `http://localhost:5002`
- **前端页面**: `http://localhost:5002`
- **API端点**: `http://localhost:5002/v1/`

## 📝 测试步骤

### 1. 登录系统

1. 打开浏览器访问：`http://localhost:5002`
2. 使用管理员账号登录：
   - 用户名：`admin`
   - 密码：`admin123`

### 2. 获取 API Key

登录后：
1. 进入 **仪表盘** (Dashboard)
2. 找到 **API Keys** 部分
3. 点击 **创建新的 API Key**
4. 复制生成的 API Key（格式：`sk-xxxxxxxxxxxxxxxx`）

### 3. 测试 OAuth 凭证获取

#### 测试 Gemini CLI 凭证：
1. 访问：`http://localhost:5002/oauth`
2. 选择 **🤖 Gemini API** 按钮
3. 点击 **登录 Google 账号**
4. 按照指引完成 OAuth 流程

#### 测试 Antigravity 凭证：
1. 访问：`http://localhost:5002/oauth`
2. 选择 **🚀 Antigravity** 按钮
3. 点击 **登录 Google 账号**
4. 按照指引完成 OAuth 流程

**关键区别**：
- Gemini 使用 Client ID: `681255809395-...`
- Antigravity 使用 Client ID: `1071006060591-...`
- Antigravity 请求额外的 2 个权限（cclog, experimentsandconfigs）

### 4. 测试模型列表

使用您的 API Key 测试：

```bash
curl http://localhost:5002/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**预期结果**：
- 如果有 Gemini 凭证：显示 `gemini-2.5-flash`, `gemini-2.5-pro` 等
- 如果有 Antigravity 凭证：额外显示 `ag-gemini-2.5-flash`, `ag-gemini-3-pro-preview`, `ag-claude-sonnet-4-5`, `ag-claude-sonnet-4-5-thinking` 等

### 5. 测试聊天补全（Gemini CLI）

```bash
curl http://localhost:5002/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {"role": "user", "content": "你好，请用一句话介绍你自己"}
    ]
  }'
```

**预期结果**：返回 Gemini 的响应

### 6. 测试聊天补全（Antigravity - Gemini）

```bash
curl http://localhost:5002/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ag-gemini-2.5-flash",
    "messages": [
      {"role": "user", "content": "你好，请用一句话介绍你自己"}
    ]
  }'
```

**预期结果**：通过 Antigravity 反代调用 Gemini

### 7. 测试聊天补全（Antigravity - Claude Sonnet 4.5）

```bash
curl http://localhost:5002/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ag-claude-sonnet-4-5",
    "messages": [
      {"role": "user", "content": "你好，请用一句话介绍你自己"}
    ]
  }'
```

**预期结果**：通过 Antigravity 反代调用 Claude Sonnet 4.5

### 8. 测试聊天补全（Antigravity - Claude Thinking）

```bash
curl http://localhost:5002/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ag-claude-sonnet-4-5-thinking",
    "messages": [
      {"role": "user", "content": "解释一下量子纠缠"}
    ]
  }'
```

**预期结果**：通过 Antigravity 反代调用 Claude Sonnet 4.5 Thinking 模式

### 9. 测试聊天补全（Antigravity - Gemini 3 Pro Preview）

```bash
curl http://localhost:5002/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ag-gemini-3-pro-preview",
    "messages": [
      {"role": "user", "content": "你好，请用一句话介绍你自己"}
    ]
  }'
```

**预期结果**：通过 Antigravity 反代调用 Gemini 3 Pro Preview

### 10. 测试流式响应

```bash
curl http://localhost:5002/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {"role": "user", "content": "从1数到10"}
    ],
    "stream": true
  }'
```

**预期结果**：实时流式输出响应

### 11. 测试 Thinking 模式

```bash
curl http://localhost:5002/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash-maxthinking",
    "messages": [
      {"role": "user", "content": "解释一下量子纠缠"}
    ]
  }'
```

**预期结果**：返回包含思考过程的响应

### 12. 测试 Search 模式

```bash
curl http://localhost:5002/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash-search",
    "messages": [
      {"role": "user", "content": "2024年诺贝尔物理学奖得主是谁？"}
    ]
  }'
```

**预期结果**：返回基于搜索的响应

## ✅ 验证清单

- [ ] 能够成功登录系统
- [ ] 能够创建 API Key
- [ ] 能够获取 Gemini CLI 凭证
- [ ] 能够获取 Antigravity 凭证
- [ ] OAuth 认证链接使用不同的 Client ID
- [ ] 模型列表包含 Gemini 模型
- [ ] 模型列表包含 Antigravity Gemini 模型（`ag-gemini-3-pro-preview` 等）
- [ ] 模型列表包含 Antigravity Claude 模型（`ag-claude-sonnet-4-5`, `ag-claude-sonnet-4-5-thinking` 等）
- [ ] 模型列表**不包含**假流式和流式抗截断模型
- [ ] 能够使用 Gemini 模型聊天
- [ ] 能够使用 Antigravity Gemini 模型聊天
- [ ] 能够使用 Antigravity Claude 模型聊天
- [ ] 能够使用 Claude Thinking 模式
- [ ] 流式响应正常工作
- [ ] Thinking 模式正常工作
- [ ] Search 模式正常工作

## 🔍 常见问题

### Q: 提示"无效的API Key"
A: 确保使用正确的 API Key，格式为 `Bearer YOUR_API_KEY`

### Q: 提示"没有可用凭证"
A: 需要先在 OAuth 页面获取凭证

### Q: Antigravity 模型不显示
A: 需要先获取 Antigravity 类型的凭证（选择 🚀 Antigravity 按钮）

### Q: 容器无法启动
A: 运行 `docker-compose logs backend` 查看错误日志

## 📊 模型对比

| 模型前缀 | 后端 | 可用模型示例 |
|---------|------|------------|
| 无前缀 | Gemini CLI | `gemini-2.5-flash`, `gemini-2.5-pro` |
| `ag-` | Antigravity | **Gemini**: `ag-gemini-2.5-flash`, `ag-gemini-3-pro-preview`, `ag-gemini-3-pro-high`<br>**Claude**: `ag-claude-sonnet-4-5`, `ag-claude-sonnet-4-5-thinking`, `ag-claude-opus-4-5-thinking` |

## 🎯 测试重点

1. **统一端点**：所有请求都使用 `/v1/` 端点
2. **模型前缀**：通过 `ag-` 前缀自动路由到 Antigravity
3. **凭证隔离**：Gemini 和 Antigravity 使用不同的凭证类型
4. **简洁模型列表**：已删除假流式和流式抗截断变体

---

**祝测试顺利！** 🚀
