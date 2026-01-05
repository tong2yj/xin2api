# Antigravity 模型列表

本文档列出了通过 Antigravity 反代可用的所有模型。

## 🎯 模型命名规则

所有 Antigravity 模型都使用 `ag-` 前缀，以便与 Gemini CLI 模型区分。

## 📋 可用模型

### Gemini 模型（通过 Antigravity）

| 模型 ID | 真实模型名称 | 说明 |
|---------|-------------|------|
| `ag-gemini-2.5-pro` | `gemini-2.5-pro` | Gemini 2.5 Pro |
| `ag-gemini-2.5-flash` | `gemini-2.5-flash` | Gemini 2.5 Flash |
| `ag-gemini-2.5-flash-thinking` | `gemini-2.5-flash-thinking` | Gemini 2.5 Flash Thinking 模式 |
| `ag-gemini-3-pro-preview` | `gemini-3-pro-preview` | Gemini 3 Pro Preview（实验性） |
| `ag-gemini-3-flash-preview` | `gemini-3-flash-preview` | Gemini 3 Flash Preview（实验性） |
| `ag-gemini-3-pro-low` | `gemini-3-pro-low` | Gemini 3 Pro Low（低成本版本） |
| `ag-gemini-3-pro-high` | `gemini-3-pro-high` | Gemini 3 Pro High（高性能版本） |
| `ag-gemini-3-pro-image` | `gemini-3-pro-image` | Gemini 3 Pro Image（图像处理） |
| `ag-gemini-2.5-flash-lite` | `gemini-2.5-flash-lite` | Gemini 2.5 Flash Lite（轻量版） |
| `ag-gemini-2.5-flash-image` | `gemini-2.5-flash-image` | Gemini 2.5 Flash Image（图像处理） |

### Claude 模型（通过 Antigravity）

| 模型 ID | 真实模型名称 | 说明 |
|---------|-------------|------|
| `ag-claude-sonnet-4-5` | `claude-sonnet-4-5` | Claude Sonnet 4.5 |
| `ag-claude-sonnet-4-5-thinking` | `claude-sonnet-4-5-thinking` | Claude Sonnet 4.5 Thinking 模式 |
| `ag-claude-opus-4-5-thinking` | `claude-opus-4-5-thinking` | Claude Opus 4.5 Thinking 模式 |

## 🔄 模型映射

当调用 Antigravity API 时，系统会自动：
1. 检测 `ag-` 前缀
2. 移除前缀，获取真实模型名称
3. 使用 Antigravity 凭证调用对应的模型
4. 在响应中恢复 `ag-` 前缀

## 📝 使用示例

### 调用 Claude Sonnet 4.5

```bash
curl http://localhost:5002/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ag-claude-sonnet-4-5",
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'
```

### 调用 Claude Thinking 模式

```bash
curl http://localhost:5002/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ag-claude-sonnet-4-5-thinking",
    "messages": [
      {"role": "user", "content": "解释量子纠缠"}
    ]
  }'
```

### 调用 Gemini 3 Pro Preview

```bash
curl http://localhost:5002/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ag-gemini-3-pro-preview",
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'
```

## ⚠️ 注意事项

1. **凭证要求**：使用 Antigravity 模型需要先在 OAuth 页面获取 Antigravity 类型的凭证
2. **Client ID**：Antigravity 使用不同的 Google OAuth Client ID（`1071006060591-...`）
3. **权限范围**：Antigravity 需要 5 个 OAuth 权限，而 Gemini CLI 只需要 3 个
4. **模型可用性**：某些实验性模型（如 `gemini-3-pro-preview`）可能不稳定或有使用限制

## 🔗 相关文档

- [TEST_GUIDE.md](./TEST_GUIDE.md) - 完整的测试指南
- [README.md](./README.md) - 项目说明
