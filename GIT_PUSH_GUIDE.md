# 🎯 Git 推送到 Zeabur - 详细操作步骤

## 第一步：检查 Git 是否安装

### 1. 打开命令提示符
- 按 `Win + R`
- 输入 `cmd`
- 按回车

### 2. 检查 Git
```bash
git --version
```

**如果显示版本号**（如 `git version 2.x.x`）：
- ✅ 已安装，继续下一步

**如果提示"不是内部或外部命令"**：
- ❌ 需要安装 Git
- 下载地址：https://git-scm.com/download/win
- 下载后双击安装，一路点"Next"
- 安装完成后**重新打开命令提示符**

---

## 第二步：进入项目目录

```bash
cd D:\cc\CatieCli-main
```

**验证是否成功**：
```bash
dir
```
应该能看到 `backend`、`frontend`、`zbpack.json` 等文件

---

## 第三步：初始化 Git 仓库

```bash
git init
```

**预期输出**：
```
Initialized empty Git repository in D:/cc/CatieCli-main/.git/
```

---

## 第四步：配置 Git 用户信息（首次使用）

```bash
# 设置你的 GitHub 用户名
git config --global user.name "你的GitHub用户名"

# 设置你的 GitHub 邮箱
git config --global user.email "你的GitHub邮箱"
```

**示例**：
```bash
git config --global user.name "zhangsan"
git config --global user.email "zhangsan@example.com"
```

---

## 第五步：创建 GitHub 仓库

### 方式A：在 GitHub 网站创建（推荐）

1. **打开浏览器**，访问：https://github.com/new

2. **填写信息**：
   - Repository name: `CatieCli`（或其他名字）
   - Description: `CatieCli with Antigravity support`
   - 选择 **Private**（私有仓库，推荐）
   - ⚠️ **不要勾选** "Add a README file"
   - ⚠️ **不要勾选** "Add .gitignore"
   - ⚠️ **不要勾选** "Choose a license"

3. **点击** "Create repository"

4. **复制仓库地址**：
   - 在新页面找到 HTTPS 地址
   - 格式：`https://github.com/你的用户名/CatieCli.git`
   - 点击复制按钮

### 方式B：使用现有仓库

如果你已经有 CatieCli 仓库：
- 直接复制仓库地址即可

---

## 第六步：连接远程仓库

```bash
# 替换为你刚才复制的仓库地址
git remote add origin https://github.com/你的用户名/CatieCli.git
```

**验证连接**：
```bash
git remote -v
```

**预期输出**：
```
origin  https://github.com/你的用户名/CatieCli.git (fetch)
origin  https://github.com/你的用户名/CatieCli.git (push)
```

---

## 第七步：添加文件到 Git

```bash
git add .
```

**说明**：这会添加所有文件（包括新增的 Antigravity 功能）

**验证**：
```bash
git status
```

应该看到很多绿色的 "new file:" 提示

---

## 第八步：提交更改

```bash
git commit -m "添加 Antigravity 反代功能"
```

**预期输出**：
```
[main (root-commit) xxxxxxx] 添加 Antigravity 反代功能
 XX files changed, XXXX insertions(+)
 create mode 100644 backend/app/services/antigravity_client.py
 create mode 100644 backend/app/routers/antigravity.py
 ...
```

---

## 第九步：推送到 GitHub

```bash
git push -u origin main
```

### ⚠️ 可能遇到的情况

#### 情况1：要求登录

**弹出登录窗口**：
1. 用户名：输入你的 GitHub 用户名
2. 密码：**不要输入密码！** 需要使用 Token

**生成 GitHub Token**：
1. 访问：https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. Note: 填写 `CatieCli Deploy`
4. Expiration: 选择 `No expiration`（永不过期）
5. 勾选权限：
   - ✅ `repo`（全部勾选）
6. 滚动到底部，点击 "Generate token"
7. **复制 Token**（只显示一次！）
8. 回到命令提示符，粘贴 Token 作为密码

#### 情况2：提示分支名错误

如果提示 `main` 分支不存在：
```bash
# 先检查当前分支
git branch

# 如果是 master，改用 master
git push -u origin master

# 或者重命名为 main
git branch -M main
git push -u origin main
```

#### 情况3：推送成功

**预期输出**：
```
Enumerating objects: XX, done.
Counting objects: 100% (XX/XX), done.
Delta compression using up to X threads
Compressing objects: 100% (XX/XX), done.
Writing objects: 100% (XX/XX), XX.XX KiB | XX.XX MiB/s, done.
Total XX (delta XX), reused 0 (delta 0), pack-reused 0
To https://github.com/你的用户名/CatieCli.git
 * [new branch]      main -> main
Branch 'main' set up to track remote branch 'main' from 'origin'.
```

✅ **成功！代码已推送到 GitHub**

---

## 第十步：配置 Zeabur 自动部署

### 1. 登录 Zeabur
- 访问：https://zeabur.com
- 使用 GitHub 账号登录

### 2. 进入你的项目
- 在 Dashboard 找到你的 CatieCli 项目
- 点击进入

### 3. 检查 Git 连接

**如果已连接 GitHub**：
- 服务卡片会显示 GitHub 图标
- Zeabur 会自动检测到更新
- 等待 2-3 分钟自动部署

**如果未连接 GitHub**：
1. 点击服务卡片
2. 点击 "Settings"
3. 找到 "Git Repository"
4. 点击 "Connect to GitHub"
5. 授权 Zeabur 访问你的仓库
6. 选择 `CatieCli` 仓库
7. 选择 `main` 分支
8. 保存

### 4. 等待部署完成

- 在 Zeabur 控制台可以看到部署进度
- 状态从 "Building" → "Deploying" → "Running"
- 大约 2-3 分钟完成

---

## 第十一步：验证部署成功

### 1. 测试原有功能

```bash
# 替换为你的域名和 API Key
curl https://your-domain.zeabur.app/v1/chat/completions \
  -H "Authorization: Bearer cat-your-api-key" \
  -H "Content-Type: application/json" \
  -d "{\"model\": \"gemini-2.5-flash\", \"messages\": [{\"role\": \"user\", \"content\": \"测试\"}]}"
```

### 2. 测试新增的 Antigravity 功能

```bash
# 替换为你的域名和 API Key
curl https://your-domain.zeabur.app/antigravity/v1/chat/completions \
  -H "Authorization: Bearer cat-your-api-key" \
  -H "Content-Type: application/json" \
  -d "{\"model\": \"gemini-2.5-flash\", \"messages\": [{\"role\": \"user\", \"content\": \"测试 Antigravity\"}]}"
```

### 3. 检查后台日志

1. 登录后台：`https://your-domain.zeabur.app`
2. 进入"使用日志"
3. 查看是否有新的 Antigravity 请求记录

---

## 🎉 完成！

如果所有测试都通过，说明更新成功！

---

## 📝 以后如何更新

以后如果有新的改动，只需要：

```bash
cd D:\cc\CatieCli-main
git add .
git commit -m "更新说明"
git push
```

Zeabur 会自动检测并部署！

---

## ❓ 常见问题

### Q1: 推送时提示 "Permission denied"

**A**: Token 权限不足或已过期
```bash
# 重新生成 Token
# 访问：https://github.com/settings/tokens
# 确保勾选了 repo 权限
```

### Q2: 推送时提示 "remote: Repository not found"

**A**: 仓库地址错误
```bash
# 检查远程仓库地址
git remote -v

# 如果错误，删除重新添加
git remote remove origin
git remote add origin https://github.com/正确的用户名/CatieCli.git
```

### Q3: Zeabur 没有自动部署

**A**: 检查 Git 连接
1. Zeabur 控制台 → 服务设置
2. 确认已连接 GitHub 仓库
3. 手动触发部署：Settings → Redeploy

### Q4: 部署失败

**A**: 查看部署日志
1. Zeabur 控制台 → 服务卡片
2. 点击 "Logs"
3. 查看错误信息
4. 常见原因：
   - 依赖安装失败
   - 端口配置错误
   - 环境变量缺失

---

## 🆘 需要帮助？

如果遇到问题，请告诉我：
1. 在哪一步卡住了
2. 看到什么错误信息
3. 截图发给我

我会帮你解决！
