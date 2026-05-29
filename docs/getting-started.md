# IOMTea 部署与使用指南

按以下步骤顺序操作，每步完成后有 ✅ 验证标记，通过后再进入下一步。

---

## Step 1 — 安装 Node.js

**目标**：安装 Node.js **v24.14.0**，这是服务端运行环境。

### 操作

1. 访问 https://nodejs.org/en/download/
2. 下载 **v24.14.0 LTS**（Windows 选 `.msi`，macOS 选 `.pkg`）
3. 运行安装包，全部保持默认选项
4. 打开命令行验证

### 验证

```bash
node --version
```

```
预期输出: v24.14.0
```

> 如果输出其他版本，需卸载后重新安装 v24.14.0。

---

## Step 2 — 安装 pnpm

**目标**：安装 pnpm 包管理器（Node.js 的依赖管理工具）。

### 操作

```bash
npm install -g pnpm
```

### 验证

```bash
pnpm --version
```

```
预期输出: 9.x.x (版本号以 9 开头)
```

---

## Step 3 — 安装 Git

**目标**：安装 Git 版本管理工具，用于下载项目代码。

### 操作

1. 访问 https://git-scm.com/downloads
2. 下载对应系统的版本，全部默认选项安装

### 验证

```bash
git --version
```

```
预期输出: git version 2.x.x
```

---

## Step 4 — 安装并启动 PostgreSQL 数据库

**目标**：确保 PostgreSQL 16 运行中，且已创建 `iomtea` 数据库。

**以下两种方式选其一。**

### 方式 A：使用 Docker（推荐）

#### 操作

1. 访问 https://www.docker.com/products/docker-desktop/ 下载并安装 Docker Desktop
2. 启动 Docker Desktop，等待引擎就绪
3. 在项目根目录运行：

```bash
docker compose up -d postgres
```

#### 验证

```bash
docker ps
```

```
预期输出: 看到名为 iomtea-postgres-1 的容器，STATUS 为 Up
```

### 方式 B：直接安装 PostgreSQL

#### 操作

1. 访问 https://www.postgresql.org/download/ 下载 16.x 安装包
2. 安装时设置密码（例如 `postgres`），端口保持 `5432`
3. 打开命令行，创建数据库：

```bash
psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE iomtea;"
```

#### 验证

```bash
psql -U postgres -d iomtea -h 127.0.0.1 -c "SELECT 1"
```

```
预期输出: 显示 1 row，连接成功
```

---

## Step 5 — 下载项目代码

**目标**：将本仓库克隆到本地。

### 操作

```bash
cd ~/Desktop
git clone <仓库地址> iomtea
cd iomtea
```

### 验证

```bash
ls
```

```
预期输出: 看到 package.json、apps/、docs/ 等文件和目录
```

---

## Step 6 — 安装项目依赖

**目标**：安装项目所需的全部 Node.js 依赖包。

### 操作

```bash
pnpm install
```

### 验证

```
预期输出: 无报错，末尾显示  Done 或 ELIFECYCLE 但无红色 error
```

> 如果下载慢，先设置镜像源：`pnpm config set registry https://registry.npmmirror.com`，然后重试 `pnpm install`。

---

## Step 7 — 配置环境变量

**目标**：复制默认配置文件。

### 操作

```bash
cp .env.example .env
```

### 说明

系统内置了开发默认值，**不修改 `.env` 也能启动**。如需自定义数据库地址或 JWT 密钥，再用编辑器打开 `.env` 修改。

---

## Step 8 — 初始化数据库表结构

**目标**：在 PostgreSQL 中创建项目所需的全部数据表。

### 操作

```bash
pnpm --filter @iomtea/server db:migrate
```

### 验证

```
预期输出: 末尾显示 Migrations completed 或类似成功信息，无报错
```

> 如果报错说 PostgreSQL 连接失败，回到 Step 4 确认数据库已启动。

---

## Step 9 — 启动开发服务器

**目标**：同时启动后端 API 服务（端口 3000）和前端 Web 服务（端口 5173）。

### 操作

```bash
pnpm dev
```

首次启动会自动创建：
- 演示账号：`demo` / `demo123`
- 3 位虚拟患者及其 48 小时体征事件和告警
- RBAC 权限表

### 验证

等待控制台输出以下内容（通常需 5-15 秒）：

```
@iomtea/server:0: Server running at http://localhost:3000
@iomtea/web:0:   ➜  Local:   http://localhost:5173/
```

> **⚠️ 不要关闭此命令行窗口**，关闭后服务器停止。

---

## Step 10 — 登录 Web 管理端

**目标**：确认前端页面正常加载，能登录系统。

### 操作

1. 打开浏览器，访问 `http://localhost:5173`
2. 输入账号：`demo`，密码：`demo123`
3. 点击登录

### 验证

登录成功后看到仪表盘页面，显示统计卡片和患者列表。

---

## Step 11 — 查看风险状态矩阵

**目标**：确认数字孪生看板正常展示患者数据。

### 操作

1. 点击左侧导航栏 **"孪生状态"**，或访问 `http://localhost:5173/twin`

### 验证

页面包含：
- 顶部 4 张统计卡片：低风险 / 关注 / 告警 / 紧急 人数
- 彩色表格：每行一位患者，每列是一种健康指标
- 格子颜色：🟢 正常 🟡 临界 🔴 异常 ⚫ 无数据
- 点击行可展开查看详情（体征趋势 + 状态转换历史）

---

## Step 12 — 验证告警系统

**目标**：确认告警页面有预置数据。

### 操作

访问 `http://localhost:5173/alerts`

### 验证

能看到预置的告警记录（如夜间离床告警、血糖异常等），包含告警级别、时间和干预建议。

---

## Step 13 — 验证 API 导出

**目标**：确认 ML 数据接口正常。

### 操作

```bash
# 将 <患者ID> 替换为实际 UUID
curl http://localhost:3000/twin/ml-timeseries/<患者ID>?metrics=heart_rate
```

### 验证

返回 JSON 数组，每项包含 `timestamp`、`metric`、`value`。

---

## （可选）Step 14 — 安装 Docker Compose 完整环境

**目标**：如需启动 MQTT 接入树莓派硬件。

### 操作

```bash
docker compose up -d mosquitto
```

然后在 `.env` 中将 `MQTT_ENABLED` 改为 `true`，重启 `pnpm dev`。

---

## 常见问题

### Q: `pnpm dev` 启动后浏览器无法访问
**A**: 等待 10-15 秒让前端编译完成。如果仍然无法访问，确认控制台无报错，检查 `CORS_ORIGIN` 是否包含 `http://localhost:5173`。

### Q: 状态矩阵全是灰色格子
**A**: 首次启动需要等待种子数据写入（约 5 秒）。刷新页面。如果仍为空，去 `http://localhost:5173/simulation` 创建一个模拟并启动。

### Q: 登录提示"用户名或密码错误"
**A**: 账号为 `demo`，密码 `demo123`。确认不是第一次启动（首次启动才自动创建）。如果数据库已清空过，重启服务即可重新创建。

### Q: `pnpm install` 报错
**A**: 最常见原因是网络问题。设置镜像源重试：`pnpm config set registry https://registry.npmmirror.com && pnpm install`。

### Q: `docker compose up -d postgres` 报错
**A**: 确认 Docker Desktop 正在运行。如果端口 5432 被占用，先停止本地的 PostgreSQL 服务。
