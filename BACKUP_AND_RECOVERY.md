# 🛡️ 备份与恢复指南

## 为什么需要备份？

在更新到 Zeabur 之前备份，可以确保：
- ✅ 如果新版本有问题，可以快速回滚
- ✅ 数据不会丢失
- ✅ 可以对比新旧版本的差异

---

## 📦 需要备份什么？

### 1. 代码备份（本地）
**位置**: `D:\cc\CatieCli-main`
**内容**: 所有项目文件

### 2. 数据库备份（Zeabur）
**内容**:
- 用户账号
- API 密钥
- 凭证池
- 使用日志

### 3. 环境变量备份（Zeabur）
**内容**:
- 数据库连接 URL
- JWT 密钥
- 其他配置

---

## 🔄 完整备份步骤

### 步骤一：备份本地代码

#### 方法1：复制整个文件夹（推荐）

1. **打开文件资源管理器**

2. **进入** `D:\cc\`

3. **右键** `CatieCli-main` 文件夹

4. **选择** "复制"

5. **在同一位置粘贴**，会自动创建 `CatieCli-main - 副本`

6. **重命名**为：`CatieCli-main-backup-20260105`
   - 使用日期命名，方便识别

**结果**：
```
D:\cc\
├── CatieCli-main\              ← 当前版本（即将更新）
└── CatieCli-main-backup-20260105\  ← 备份版本
```

#### 方法2：压缩备份

1. **右键** `CatieCli-main` 文件夹

2. **发送到** → **压缩(zipped)文件夹**

3. **重命名**为：`CatieCli-backup-20260105.zip`

4. **移动**到安全位置（如 `D:\backups\`）

---

### 步骤二：备份 Zeabur 环境变量

1. **登录** Zeabur：https://zeabur.com

2. **进入**你的 CatieCli 项目

3. **点击**服务卡片

4. **点击** Settings → Variables（变量）

5. **复制所有环境变量**到文本文件：

创建文件 `D:\cc\zeabur-env-backup.txt`，内容如下：

```bash
# Zeabur 环境变量备份 - 2026-01-05

# 数据库连接
DATABASE_URL=postgresql://user:password@host:port/dbname

# JWT 配置
JWT_SECRET_KEY=your-secret-key-here
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=43200

# 其他配置（如果有）
# ...
```

⚠️ **重要**：这个文件包含敏感信息，妥善保管！

---

### 步骤三：备份数据库（可选但推荐）

#### 方法1：通过 Zeabur 控制台

1. **进入** Zeabur 项目

2. **找到**数据库服务（PostgreSQL）

3. **点击** Settings

4. **查找** "Backup" 或 "Export" 选项

5. **下载**数据库备份文件

#### 方法2：使用 pg_dump（需要安装 PostgreSQL 客户端）

```bash
# 从 Zeabur 获取数据库连接信息
# 格式：postgresql://user:password@host:port/dbname

# 执行备份
pg_dump "postgresql://user:password@host:port/dbname" > backup-20260105.sql
```

保存到：`D:\cc\database-backup-20260105.sql`

#### 方法3：通过 Zeabur CLI（如果已安装）

```bash
zeabur database backup <database-id>
```

---

## 🚀 更新前检查清单

在上传新版本之前，确认：

- [ ] 已复制 `CatieCli-main` 文件夹
- [ ] 已保存环境变量到文本文件
- [ ] 已备份数据库（可选）
- [ ] 已记录当前域名和访问地址
- [ ] 已测试当前版本正常工作

---

## ⚠️ 两种更新策略

### 策略A：保守更新（推荐新手）

**不删除原服务，创建新服务测试**

1. **保留**现有的 CatieCli 服务（继续运行）

2. **创建新服务**：
   - 点击 "Add Service"
   - 上传新版本 ZIP
   - 使用**临时域名**测试

3. **测试新服务**：
   - 配置环境变量
   - 连接数据库
   - 测试所有功能

4. **确认无误后**：
   - 将域名切换到新服务
   - 删除旧服务

**优点**：
- ✅ 旧版本始终可用
- ✅ 可以随时切换回去
- ✅ 零停机时间

**缺点**：
- ❌ 需要两倍资源（短期）
- ❌ 需要手动切换域名

---

### 策略B：直接覆盖（适合有经验用户）

**直接上传新版本替换**

1. **备份**完成后

2. **直接上传** ZIP 到现有服务

3. **等待**重新部署

**优点**：
- ✅ 操作简单
- ✅ 不需要额外资源

**缺点**：
- ❌ 有短暂停机时间（2-5分钟）
- ❌ 如果失败需要手动恢复

---

## 🔧 如何恢复到备份版本

### 情况1：本地代码恢复

如果只是本地文件改错了：

1. **删除** `D:\cc\CatieCli-main`

2. **复制** `D:\cc\CatieCli-main-backup-20260105`

3. **重命名**为 `CatieCli-main`

---

### 情况2：Zeabur 服务恢复

#### 方法1：重新上传旧版本

1. **压缩**备份文件夹：
   - `CatieCli-main-backup-20260105.zip`

2. **登录** Zeabur

3. **上传**旧版本 ZIP

4. **等待**重新部署

#### 方法2：使用 Zeabur 部署历史（如果可用）

1. **进入** Zeabur 服务设置

2. **找到** "Deployments" 或 "部署历史"

3. **选择**之前的成功部署版本

4. **点击** "Redeploy"（重新部署）

---

### 情况3：数据库恢复

⚠️ **警告**：数据库恢复会覆盖当前数据！

#### 使用 SQL 备份文件恢复

```bash
# 连接到数据库并恢复
psql "postgresql://user:password@host:port/dbname" < backup-20260105.sql
```

#### 通过 Zeabur 控制台恢复

1. **进入**数据库服务设置

2. **找到** "Restore" 或 "Import"

3. **上传**备份文件

4. **确认**恢复操作

---

## 🧪 更新后验证清单

更新完成后，逐项检查：

### 1. 基础功能测试

- [ ] 能访问管理后台：`https://你的域名.zeabur.app`
- [ ] 能正常登录管理员账号
- [ ] 用户列表正常显示
- [ ] 凭证池正常显示

### 2. API 功能测试

**测试原有 Gemini 接口**：
```bash
curl https://你的域名.zeabur.app/v1/chat/completions \
  -H "Authorization: Bearer cat-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"model": "gemini-2.5-flash", "messages": [{"role": "user", "content": "测试"}]}'
```

**测试新增 Antigravity 接口**：
```bash
curl https://你的域名.zeabur.app/antigravity/v1/chat/completions \
  -H "Authorization: Bearer cat-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"model": "gemini-2.5-flash", "messages": [{"role": "user", "content": "测试"}]}'
```

### 3. 数据完整性检查

- [ ] 用户数量正确
- [ ] API 密钥数量正确
- [ ] 凭证池数量正确
- [ ] 使用日志有历史记录

### 4. 权限测试

- [ ] 管理员能访问所有功能
- [ ] 普通用户受配额限制
- [ ] API 密钥认证正常

---

## ❌ 常见问题和解决方案

### Q1: 更新后无法访问

**可能原因**：
- 部署失败
- 环境变量丢失
- 端口配置错误

**解决方案**：
1. 检查 Zeabur 部署日志
2. 确认环境变量已配置
3. 尝试重新部署
4. 如果无法解决，恢复备份版本

---

### Q2: 更新后数据丢失

**可能原因**：
- 数据库连接断开
- 数据库服务被误删

**解决方案**：
1. 检查数据库服务是否运行
2. 检查 `DATABASE_URL` 环境变量
3. 重新连接数据库服务
4. 如果数据真的丢失，从备份恢复

---

### Q3: 新功能不工作，旧功能正常

**可能原因**：
- 代码上传不完整
- 依赖安装失败

**解决方案**：
1. 检查部署日志中的错误
2. 确认 `requirements.txt` 包含 `httpx`
3. 重新打包上传（确保包含所有文件）

---

### Q4: 环境变量丢失

**可能原因**：
- 创建新服务时忘记配置
- 覆盖部署时被清空

**解决方案**：
1. 从备份文件 `zeabur-env-backup.txt` 恢复
2. 在 Zeabur Settings → Variables 中重新添加

---

## 📋 快速恢复命令

如果需要快速回滚到备份版本：

### Windows 命令提示符

```cmd
REM 1. 删除当前版本
cd D:\cc
rmdir /s /q CatieCli-main

REM 2. 恢复备份
xcopy CatieCli-main-backup-20260105 CatieCli-main /E /I /H

REM 3. 压缩备份版本
REM 手动压缩 CatieCli-main 为 ZIP

REM 4. 上传到 Zeabur
REM 手动在浏览器中上传
```

### PowerShell

```powershell
# 1. 删除当前版本
Remove-Item -Path "D:\cc\CatieCli-main" -Recurse -Force

# 2. 恢复备份
Copy-Item -Path "D:\cc\CatieCli-main-backup-20260105" -Destination "D:\cc\CatieCli-main" -Recurse

# 3. 压缩备份版本
Compress-Archive -Path "D:\cc\CatieCli-main\*" -DestinationPath "D:\cc\CatieCli-recovery.zip"

# 4. 上传到 Zeabur（手动操作）
Write-Host "请在浏览器中上传 D:\cc\CatieCli-recovery.zip 到 Zeabur"
```

---

## 🎯 最佳实践建议

### 1. 定期备份

- 每次重大更新前备份
- 每周备份一次数据库
- 保留最近 3 个版本的备份

### 2. 备份命名规范

```
CatieCli-main-backup-YYYYMMDD
例如：CatieCli-main-backup-20260105
```

### 3. 备份存储位置

```
D:\backups\
├── 20260105\
│   ├── CatieCli-main-backup-20260105.zip
│   ├── database-backup-20260105.sql
│   └── zeabur-env-backup-20260105.txt
├── 20260101\
└── 20251225\
```

### 4. 测试备份可用性

- 定期验证备份文件可以正常解压
- 在测试环境恢复备份验证完整性

---

## 📞 需要帮助？

如果遇到恢复问题：

1. **不要慌张**，备份就是为了这种情况
2. **检查**备份文件是否完整
3. **告诉我**具体的错误信息
4. **提供**部署日志截图

我会帮你一步步恢复！

---

## 📚 相关文档

- **更新指南**: `ZEABUR_ZIP_UPLOAD.md`
- **功能说明**: `ANTIGRAVITY_README.md`
- **测试指南**: `ANTIGRAVITY_TEST.md`
