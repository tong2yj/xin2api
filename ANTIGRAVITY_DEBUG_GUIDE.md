# Antigravity 模型调用问题诊断

## 📊 当前状态

从日志来看：
```
2026-01-08 00:56:06 [INFO] [Bridge] [gcli2api] 转发请求: ag-gemini-3-pro-high, stream=True
INFO: "POST /v1/chat/completions HTTP/1.1" 200 OK
```

- ✅ 请求已成功转发到 gcli2api
- ✅ 返回状态码 200（成功）
- ✅ 用户认证通过
- ✅ 配额验证通过

但你说有报错，可能的问题：

---

## 🔍 可能的问题

### 1. 前端流式响应解析错误

**症状**：
- 后端返回 200
- 但前端显示错误或没有内容

**原因**：
- gcli2api 返回的流式数据格式不符合 OpenAI 格式
- 或者返回了错误内容但状态码是 200

**排查**：
查看浏览器控制台（F12）的错误信息

---

### 2. gcli2api 没有可用的 Antigravity 凭证

**症状**：
- 请求转发成功
- 但 gcli2api 返回错误（如"没有可用的凭证"）

**原因**：
- gcli2api 中没有 Antigravity 凭证
- 或凭证已失效

**排查**：
```bash
# 检查 gcli2api 的凭证状态
curl -H "Authorization: Bearer catie_gcli2api_panel_password_2026" \
     http://localhost:7861/antigravity/creds/status
```

**预期输出**：
```json
{
  "total": 1,
  "active": 1,
  "credentials": [...]
}
```

---

### 3. 模型名称映射问题

**症状**：
- CatieCli 使用 `ag-gemini-3-pro-high`
- 但 gcli2api 不认识这个模型名

**原因**：
- CatieCli 和 gcli2api 的模型名称不一致

**排查**：
检查 gcli2api 支持的模型列表：
```bash
curl -H "Authorization: Bearer catie_gcli2api_api_password_2026" \
     http://localhost:7861/v1/models
```

---

## 🔧 诊断步骤

### 步骤 1: 检查前端错误

打开浏览器控制台（F12），查看：
1. **Console 标签**：是否有 JavaScript 错误
2. **Network 标签**：
   - 找到 `/v1/chat/completions` 请求
   - 查看 Response 内容
   - 是否有完整的流式数据

### 步骤 2: 检查 gcli2api 日志

```bash
# 查看 gcli2api 日志
docker-compose -f D:\cc\gcli2api-master\docker-compose.yml logs -f

# 或者查看日志文件
cat D:\cc\gcli2api-master\data\logs\log.txt | tail -100
```

**关键日志**：
- `[INFO] 请求模型: ag-gemini-3-pro-high`
- `[INFO] 使用凭证: xxx`
- `[ERROR] ...` （如果有错误）

### 步骤 3: 测试 gcli2api 直接调用

绕过 CatieCli，直接测试 gcli2api：

```bash
curl -X POST http://localhost:7861/v1/chat/completions \
  -H "Authorization: Bearer catie_gcli2api_api_password_2026" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ag-gemini-3-pro-high",
    "messages": [
      {"role": "user", "content": "Hello"}
    ],
    "stream": false
  }'
```

**预期输出**：
```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "model": "ag-gemini-3-pro-high",
  "choices": [...]
}
```

### 步骤 4: 检查凭证状态

```bash
# 检查 Antigravity 凭证
curl -H "Authorization: Bearer catie_gcli2api_panel_password_2026" \
     http://localhost:7861/antigravity/creds/status
```

---

## 📝 需要提供的信息

为了帮你精确诊断，请提供：

1. **前端错误信息**：
   - 浏览器控制台的错误
   - Network 标签中的 Response 内容

2. **完整的后端日志**：
   ```bash
   docker-compose logs --tail=100 backend | grep -A 20 "ag-gemini-3-pro-high"
   ```

3. **gcli2api 日志**：
   ```bash
   docker-compose -f D:\cc\gcli2api-master\docker-compose.yml logs --tail=100
   ```

4. **gcli2api 凭证状态**：
   ```bash
   curl -H "Authorization: Bearer catie_gcli2api_panel_password_2026" \
        http://localhost:7861/antigravity/creds/status
   ```

---

## 🎯 快速检查清单

- [ ] gcli2api 正在运行
- [ ] gcli2api 中有可用的 Antigravity 凭证
- [ ] 凭证状态为 active
- [ ] 模型名称正确（`ag-gemini-3-pro-high`）
- [ ] 密码配置正确
- [ ] 网络连接正常

---

## 💡 常见解决方案

### 问题：没有可用的凭证

**解决**：
1. 重新上传 Antigravity 凭证
2. 检查凭证是否被禁用
3. 检查凭证是否过期

### 问题：模型不支持

**解决**：
1. 使用 `ag-gemini-2.5-flash`（更稳定）
2. 检查 gcli2api 支持的模型列表

### 问题：流式响应解析错误

**解决**：
1. 尝试非流式请求（`stream: false`）
2. 检查前端的流式解析代码
3. 查看 gcli2api 返回的原始数据格式

---

**最后更新**: 2026-01-08
