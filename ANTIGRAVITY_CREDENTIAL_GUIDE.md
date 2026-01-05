# 🚀 Antigravity 凭证上传和使用指南

## 📖 什么是 Antigravity？

Antigravity 是 Google 的内部 API，提供了与 Gemini API 不同的访问方式。CatieCli 现在支持 Antigravity 反代功能，让您可以通过 OpenAI 兼容的接口使用 Antigravity。

---

## 🔑 凭证类型说明

CatieCli 现在支持两种凭证类型：

### 1. 🤖 Gemini 凭证
- 用于访问 Gemini 官方 API (`/v1/chat/completions`)
- 标签显示：蓝色 `🤖 Gemini`

### 2. 🚀 Antigravity 凭证
- 用于访问 Antigravity 反代 API (`/antigravity/v1/chat/completions`)
- 标签显示：紫色 `🚀 Antigravity`

**重要**：两种凭证是**独立的**，互不影响！

---

## 📥 如何上传 Antigravity 凭证

### 方法一：通过 OAuth 页面（推荐）

1. **访问 OAuth 页面**
   - 登录后台
   - 点击左侧菜单 "OAuth 认证"

2. **选择凭证类型**
   - 在页面顶部看到"选择凭证类型"
   - 点击 `🚀 Antigravity` 按钮（紫色高亮）

3. **登录并授权**
   - 点击"登录 Google 账号"
   - 按照提示完成 Google OAuth 授权

4. **粘贴回调 URL**
   - 授权后会打开一个无法访问的页面
   - 复制浏览器地址栏的完整 URL
   - 粘贴到"步骤2"的输入框

5. **提交并生成凭证**
   - 选择是否上传到公共池（可选）
   - 点击"提交并获取凭证"
   - 成功后会显示：`凭证获取成功！邮箱: xxx@gmail.com [Antigravity]`

### 方法二：上传 JSON 文件

如果您已经有 Antigravity 的 JSON 凭证文件：

1. 访问"凭证管理"页面
2. 上传 JSON 文件
3. **注意**：通过文件上传的凭证默认是 Gemini 类型
4. 如需 Antigravity 凭证，请使用方法一（OAuth 页面）

---

## 🔍 如何区分凭证类型

在"凭证管理"页面，每个凭证都会显示类型标签：

```
┌─────────────────────────────────────┐
│ example@gmail.com                   │
│ 🚀 Antigravity  ✅ 有效  ⭐ Pro    │  ← Antigravity 凭证
│ 📊 请求: 0  ❌ 失败: 0              │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ another@gmail.com                   │
│ 🤖 Gemini  ✅ 有效  2.5             │  ← Gemini 凭证
│ 📊 请求: 10  ❌ 失败: 0             │
└─────────────────────────────────────┘
```

---

## 🌐 如何使用 Antigravity API

### 1. 获取 API Key

在后台"API 密钥"页面生成或查看您的 API Key（格式：`cat-xxxxxxxx`）

### 2. 调用 Antigravity 接口

**OpenAI 兼容格式**：

```bash
curl https://你的域名.zeabur.app/antigravity/v1/chat/completions \
  -H "Authorization: Bearer cat-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

**Gemini 原生格式**：

```bash
curl https://你的域名.zeabur.app/antigravity/v1/models/gemini-2.5-flash:generateContent \
  -H "Authorization: Bearer cat-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{"text": "Hello"}]
      }
    ]
  }'
```

### 3. 在第三方应用中使用

在支持 OpenAI API 的应用中配置：

- **API Base URL**: `https://你的域名.zeabur.app/antigravity/v1`
- **API Key**: `cat-your-api-key`
- **Model**: `gemini-2.5-flash` 或其他 Gemini 模型

---

## ⚠️ 常见问题

### Q1: 为什么需要分开 Gemini 和 Antigravity 凭证？

**A**: 两者使用不同的 API 端点和认证方式：
- Gemini API: `generativelanguage.googleapis.com`
- Antigravity API: `cloudcode-pa.googleapis.com`

虽然都是 Google OAuth 凭证，但为了更好的管理和统计，我们将它们分开。

### Q2: 我可以同时拥有两种凭证吗？

**A**: 可以！您可以：
- 上传多个 Gemini 凭证
- 上传多个 Antigravity 凭证
- 同时使用两种 API

### Q3: 调用 Antigravity 接口时提示"没有可用的凭证"

**A**: 检查以下几点：
1. 确认已上传 **Antigravity 类型**的凭证（紫色标签）
2. 确认凭证状态为"有效"（绿色）
3. 如果上传的是 Gemini 凭证，需要重新上传为 Antigravity 类型

### Q4: 如何将现有凭证转换为 Antigravity 类型？

**A**: 目前不支持直接转换，需要：
1. 删除现有凭证（如果不需要）
2. 在 OAuth 页面选择"Antigravity"
3. 重新授权并上传

### Q5: Antigravity 凭证可以用于 Gemini API 吗？

**A**: 不可以。两种凭证是独立的：
- Gemini 凭证 → 只能用于 `/v1/chat/completions`
- Antigravity 凭证 → 只能用于 `/antigravity/v1/chat/completions`

### Q6: 公共池中的凭证如何区分类型？

**A**: 公共池也会区分凭证类型：
- 调用 Gemini API 时，只会使用 Gemini 类型的公共凭证
- 调用 Antigravity API 时，只会使用 Antigravity 类型的公共凭证

---

## 📊 权限和配额

### 管理员
- ✅ 无配额限制
- ✅ 可以使用所有公共凭证
- ✅ 可以查看所有用户的使用日志

### 普通用户
- 受配额限制（由管理员设置）
- 可以使用自己的凭证
- 可以使用公共池凭证（如果开启）
- 上传凭证可获得额外配额奖励

**注意**：Gemini 和 Antigravity 共享配额！

---

## 🔄 凭证管理最佳实践

### 1. 命名规范

系统会自动命名：
- Gemini 凭证：`OAuth - email@gmail.com`
- Antigravity 凭证：`Antigravity - email@gmail.com`

### 2. 定期检查

- 定期查看凭证状态
- 失效的凭证会显示红色"❌ 已失效"
- 及时删除或更新失效凭证

### 3. 公共池贡献

- 上传到公共池可获得额外配额
- 帮助其他用户，共同维护服务
- 管理员可能会设置强制捐赠

---

## 📝 使用日志

所有 Antigravity 请求都会记录在"使用日志"中：

- **端点**: `/antigravity/v1/chat/completions`
- **凭证**: 显示使用的 Antigravity 凭证邮箱
- **状态**: 成功/失败状态码
- **延迟**: 请求响应时间

---

## 🎯 快速开始

### 第一次使用 Antigravity

1. **上传凭证**
   ```
   OAuth 页面 → 选择 "🚀 Antigravity" → 登录授权 → 提交
   ```

2. **验证凭证**
   ```
   凭证管理 → 查看是否有紫色 "🚀 Antigravity" 标签
   ```

3. **测试接口**
   ```bash
   curl https://你的域名.zeabur.app/antigravity/v1/chat/completions \
     -H "Authorization: Bearer cat-your-api-key" \
     -H "Content-Type: application/json" \
     -d '{"model": "gemini-2.5-flash", "messages": [{"role": "user", "content": "测试"}]}'
   ```

4. **查看日志**
   ```
   使用日志 → 查看 Antigravity 请求记录
   ```

---

## 🆘 需要帮助？

如果遇到问题：

1. **检查凭证类型**：确认上传的是 Antigravity 凭证（紫色标签）
2. **检查凭证状态**：确认凭证有效（绿色标签）
3. **查看错误日志**：在使用日志中查看详细错误信息
4. **联系管理员**：如果问题持续，联系您的系统管理员

---

## 📚 相关文档

- **Antigravity API 说明**: `ANTIGRAVITY_README.md`
- **接口测试指南**: `ANTIGRAVITY_TEST.md`
- **部署修复指南**: `DEPLOYMENT_FIX.md`
- **备份恢复指南**: `BACKUP_AND_RECOVERY.md`

---

## 🎉 总结

- ✅ 两种凭证类型：Gemini（蓝色）和 Antigravity（紫色）
- ✅ 通过 OAuth 页面选择类型上传
- ✅ 凭证独立管理，互不影响
- ✅ 使用对应的 API 端点调用
- ✅ 所有请求都有日志记录

祝您使用愉快！🚀
