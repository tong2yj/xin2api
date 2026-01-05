# 🎉 Antigravity 凭证系统更新说明

## ✨ 新功能

### 凭证类型区分

现在支持两种独立的凭证类型：

- **🤖 Gemini 凭证**：用于 Gemini 官方 API (`/v1/chat/completions`)
- **🚀 Antigravity 凭证**：用于 Antigravity 反代 API (`/antigravity/v1/chat/completions`)

## 📥 如何使用

### 上传 Antigravity 凭证

1. 登录后台 → OAuth 认证
2. 选择 **🚀 Antigravity**（紫色按钮）
3. 登录 Google 授权
4. 粘贴回调 URL → 提交

### 查看凭证类型

在"凭证管理"页面，每个凭证都会显示类型标签：

- 紫色 `🚀 Antigravity`：Antigravity 凭证
- 蓝色 `🤖 Gemini`：Gemini 凭证

## 🔧 技术改动

- 扩展 `credential_type` 字段支持 `oauth_antigravity`
- OAuth 页面添加凭证类型选择器
- Antigravity API 只使用 Antigravity 类型凭证
- 凭证列表显示类型标签

## 📚 文档

- **使用指南**：`ANTIGRAVITY_CREDENTIAL_GUIDE.md`
- **实现总结**：`ANTIGRAVITY_IMPLEMENTATION_SUMMARY.md`
- **API 说明**：`ANTIGRAVITY_README.md`

## ⚠️ 注意事项

- 两种凭证完全独立，互不影响
- 现有凭证自动识别为 Gemini 类型
- 无需数据库迁移，向后兼容

## 🚀 立即体验

访问 OAuth 页面，选择 Antigravity 类型，开始使用！
