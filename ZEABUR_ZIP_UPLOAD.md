# 📦 Zeabur 直接上传更新 - 最简单方法

## 为什么选择这个方法？

✅ 不需要安装 Git
✅ 不需要 GitHub 账号
✅ 不需要运行命令行
✅ 只需要压缩和上传

---

## 第一步：打包项目

### 1. 找到项目文件夹

打开文件资源管理器，进入：
```
D:\cc\CatieCli-main
```

### 2. 排除不需要的文件（可选）

**如果存在**以下文件夹，可以先删除（节省上传时间）：
- `node_modules`（如果有）
- `.git`（如果有）
- `__pycache__`（如果有）
- `.pytest_cache`（如果有）

**保留**以下重要文件：
- `backend/` 文件夹（所有代码）
- `frontend/` 文件夹（前端代码）
- `zbpack.json`（Zeabur 配置）
- 所有 `.md` 文档文件

### 3. 压缩整个项目

1. **选中** `CatieCli-main` 文件夹内的**所有文件**
   - 按 `Ctrl + A` 全选
   - 或者手动选中所有文件和文件夹

2. **右键** → **发送到** → **压缩(zipped)文件夹**
   - 或者使用 WinRAR/7-Zip：右键 → **添加到压缩文件**

3. **重命名**压缩包为：`CatieCli.zip`

⚠️ **注意**：压缩包内应该**直接包含**文件，而不是再套一层文件夹！

**正确的结构**：
```
CatieCli.zip
├── backend/
├── frontend/
├── zbpack.json
├── ANTIGRAVITY_README.md
└── ...其他文件
```

**错误的结构**（避免）：
```
CatieCli.zip
└── CatieCli-main/  ❌ 多了一层文件夹
    ├── backend/
    ├── frontend/
    └── ...
```

---

## 第二步：登录 Zeabur

1. **打开浏览器**，访问：https://zeabur.com

2. **登录**你的账号

3. **进入**你的 CatieCli 项目

---

## 第三步：上传更新

### 方法A：通过服务设置上传

1. **点击**你的服务卡片

2. **点击**右上角的 **Settings**（设置）

3. **找到** "Source" 或 "部署来源"

4. **选择** "Upload"（上传）

5. **拖拽**或**选择** `CatieCli.zip` 文件

6. **点击**确认上传

### 方法B：直接替换部署

1. **删除**现有服务：
   - 点击服务卡片
   - Settings → Danger Zone → Delete Service
   - ⚠️ **注意**：先确认数据库服务独立存在

2. **创建新服务**：
   - 点击 "Add Service"
   - 选择 "Upload Code"
   - 上传 `CatieCli.zip`

3. **配置环境变量**：
   - 在新服务中重新添加环境变量
   - 复制之前的配置（数据库 URL、JWT 密钥等）

4. **连接数据库**：
   - Settings → Networking
   - 连接到现有的数据库服务

---

## 第四步：等待部署

1. **观察部署进度**：
   - 在 Zeabur 控制台可以看到日志
   - 状态：Uploading → Building → Deploying → Running

2. **预计时间**：2-5 分钟

3. **部署成功标志**：
   - 服务状态变为绿色 "Running"
   - 可以看到日志输出

---

## 第五步：验证功能

### 1. 测试原有功能

打开浏览器，访问你的后台管理：
```
https://你的域名.zeabur.app
```

使用管理员账号登录，检查：
- ✅ 能正常登录
- ✅ 凭证池正常
- ✅ 用户管理正常

### 2. 测试 Antigravity 新功能

在命令提示符或 PowerShell 中测试：

```bash
# 替换为你的域名和 API Key
curl https://你的域名.zeabur.app/antigravity/v1/chat/completions ^
  -H "Authorization: Bearer cat-your-api-key" ^
  -H "Content-Type: application/json" ^
  -d "{\"model\": \"gemini-2.5-flash\", \"messages\": [{\"role\": \"user\", \"content\": \"Hello\"}]}"
```

**预期结果**：
```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gemini-2.5-flash",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ]
}
```

### 3. 检查使用日志

1. 登录后台管理：`https://你的域名.zeabur.app`
2. 进入 "使用日志"
3. 查看是否有新的 Antigravity 请求记录

---

## 🎉 完成！

如果所有测试通过，说明更新成功！

---

## 📝 以后如何更新

以后如果有新的改动，重复上述步骤：

1. 压缩更新后的项目
2. 上传到 Zeabur
3. 等待重新部署

---

## ❓ 常见问题

### Q1: 上传后提示文件结构错误

**A**: 检查 ZIP 包结构
- 解压 ZIP 文件检查
- 确保 `zbpack.json` 在根目录
- 不要多套一层文件夹

### Q2: 部署失败，提示缺少依赖

**A**: 检查 `requirements.txt`
- 确保包含所有必要的 Python 包
- 特别确认有 `httpx`（Antigravity 需要）

### Q3: 部署成功，但 Antigravity 接口报错

**A**: 检查环境变量
- 确保数据库连接正确
- 确保 JWT 密钥存在

### Q4: 原有数据丢失

**A**: 数据库独立部署
- 只要数据库服务没删除，数据就不会丢
- 新服务只需重新连接数据库即可

### Q5: 上传速度很慢

**A**: 减小 ZIP 包大小
- 删除 `node_modules`
- 删除 `.git` 文件夹
- 删除 `__pycache__` 等缓存

---

## 🆘 需要帮助？

如果遇到问题，请告诉我：
1. 在哪一步卡住了
2. 看到什么错误信息
3. 截图发给我

我会帮你解决！

---

## 📚 相关文档

- **功能说明**: `ANTIGRAVITY_README.md`
- **接口测试**: `ANTIGRAVITY_TEST.md`
- **手动命令**: `MANUAL_PUSH_GUIDE.md`（如果你想用 Git）
