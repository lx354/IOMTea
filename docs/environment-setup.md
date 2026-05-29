# 开发环境搭建指南

本文说明从零搭建 IOMTea 开发环境所需的全部步骤，包含 VS Code、Node.js、PostgreSQL、pnpm 和 OpenCode 的安装与配置。

---

## 目录

1. [安装 Node.js](#1-安装-nodejs)
2. [安装 pnpm](#2-安装-pnpm)
3. [安装 VS Code](#3-安装-vs-code)
4. [安装 PostgreSQL](#4-安装-postgresql)
5. [安装 Docker（备选方案）](#5-安装-docker备选方案)
6. [安装 OpenCode（可选）](#6-安装-opencode可选)
7. [验证环境](#7-验证环境)
8. [常见问题](#8-常见问题)

---

## 1. 安装 Node.js

Node.js 是服务端 JavaScript 运行时，本系统需要 **Node.js 24.14.0**（LTS 版本）。

### Windows

1. 打开浏览器访问 https://nodejs.org/en/download/
2. 找到 **v24.14.0 LTS** 版本，下载 Windows 安装包（`.msi`、64-bit）
3. 双击安装包，安装过程中全部保持默认选项，一路 Next
4. 安装完成后，打开命令提示符（Win + R → 输入 `cmd` → 回车），输入：

```bash
node --version
```

应输出 `v24.14.0`。如果版本号不同，可能是之前安装过其他版本，需卸载后重新安装。

### macOS

```bash
# 使用 Homebrew 安装（如未安装 Homebrew，先访问 https://brew.sh/）
brew install node@24

# 或从官网下载 .pkg 安装包
# https://nodejs.org/en/download/
```

### Linux（Ubuntu/Debian）

```bash
# 使用 NodeSource 官方源
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证
node --version   # 应输出 v24.14.0
```

> **版本说明**：本系统依赖 Node.js 22+ 的部分特性。`v24.14.0` 是经过测试的版本。如果使用其他版本，需确保 ≥22。

---

## 2. 安装 pnpm

pnpm 是 Node.js 的包管理器，比 npm 更快、更节省磁盘空间。

```bash
# 在命令提示符或终端中执行
npm install -g pnpm

# 验证
pnpm --version   # 应输出 9.x 或更高
```

如果遇到权限错误（Linux/macOS），加 `sudo`：

```bash
sudo npm install -g pnpm
```

---

## 3. 安装 VS Code

VS Code 是推荐的代码编辑器。如果偏好其他编辑器（如 WebStorm、Vim），可跳过此节。

### 下载与安装

1. 访问 https://code.visualstudio.com/
2. 点击下载按钮，选择对应操作系统的版本
3. 安装时建议勾选"添加到 PATH"（Add to PATH）选项，这样可以在命令行中直接输入 `code .` 打开当前目录

### 推荐的扩展

安装完成后，在扩展面板（Ctrl+Shift+X）中搜索并安装以下扩展：

| 扩展 | 用途 |
|------|------|
| **Biome** | 代码格式化与检查（本项目的 linter） |
| **GitLens** | Git 历史可视化 |
| **Markdown Preview Enhanced** | 预览 `.md` 文件 |

> 不必全部安装，按需取用即可。

---

## 4. 安装 PostgreSQL

PostgreSQL 是本系统的数据库。以下提供两种方式：**直接安装**（推荐）和 **Docker 安装**（备选）。

### 方式 A：直接安装（推荐）

#### Windows

1. 访问 https://www.postgresql.org/download/windows/
2. 下载 16.x 版本的安装包
3. 运行安装程序，注意以下配置：
   - 安装路径：保持默认
   - **密码**：设置一个你记得住的密码（例如 `postgres`）
   - **端口**：保持默认 `5432`
4. 安装完成后，搜索"pgAdmin"并打开，用设置的密码登录
5. 新建一个数据库：
   - 右键"Databases" → Create → Database
   - 名称填写 `iomtea`

#### macOS

```bash
# 使用 Homebrew
brew install postgresql@16
brew services start postgresql@16
createdb iomtea
```

#### Linux（Ubuntu/Debian）

```bash
# 安装
sudo apt update
sudo apt install postgresql-16

# 启动
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 创建数据库
sudo -u postgres createdb iomtea

# 设置密码（可选，用于 .env 配置）
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
```

#### 配置连接

安装后，确保 `DATABASE_URL` 能连接成功。默认配置为：

```
postgresql://postgres:postgres@127.0.0.1:5432/iomtea
```

如果安装时设置了不同的密码，将 `postgres`（密码部分）改为你设置的密码。

测试连接：

```bash
psql -U postgres -d iomtea -h 127.0.0.1
```

输入密码后应进入 PostgreSQL 交互终端（显示 `iomtea=#` 提示符）。输入 `\q` 退出。

### 方式 B：Docker 安装（如果已安装 Docker）

```bash
# 一条命令启动 PostgreSQL 16
docker run -d \
  --name iomtea-postgres \
  -e POSTGRES_DB=iomtea \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16-alpine

# 验证
docker ps  # 应看到 iomtea-postgres 状态为 Up
```

---

## 5. 安装 Docker（备选方案）

如果不想直接安装 PostgreSQL，可以安装 Docker 来运行 PostgreSQL 容器。

### Windows / macOS

1. 访问 https://www.docker.com/products/docker-desktop/
2. 下载 Docker Desktop 并安装
3. 启动 Docker Desktop，等待引擎启动完成
4. 验证：

```bash
docker --version
docker compose version
```

### Linux（Ubuntu/Debian）

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker $USER
# 退出当前终端重新登录后生效

# 安装 Docker Compose（如未自带）
sudo apt install docker-compose-plugin

# 验证
docker --version
docker compose version
```

---

## 6. 安装 OpenCode（可选）

OpenCode 是与本项目配合使用的 AI 编码辅助工具，通过 DeepSeek 模型提供代码生成和解释功能。**非必需**，但使用它可以快速理解不熟悉的代码段。

### 安装

```bash
# 使用 npm 全局安装
npm install -g @opencode/cli

# 验证
opencode --version
```

### 配置 DeepSeek API

1. 注册 DeepSeek 账号并获取 API Key：
   - 访问 https://platform.deepseek.com/
   - 注册并登录 → API Keys → 创建新 Key
   - 复制生成的 Key（以 `sk-` 开头）

2. 配置 OpenCode：

```bash
opencode config set OPENAI_API_KEY=你的DeepSeek_API_Key
opencode config set OPENAI_BASE_URL=https://api.deepseek.com/v1
opencode config set OPENAI_MODEL=deepseek-chat
```

3. 验证配置：

```bash
opencode "Hello, what model are you?"
```

应返回 DeepSeek 模型的回答。

### 基本用法

```bash
# 在项目目录中启动交互式对话
opencode

# 直接提问
opencode "解释 apps/server/src/index.ts 的启动流程"

# 查看帮助
opencode --help
```

> 配置完成后，OpenCode 会自动读取项目上下文（`AGENTS.md`、目录结构等），回答时能准确引用本项目中的文件名和代码行。

---

## 7. 验证环境

运行以下命令逐一确认环境就绪：

```bash
# 1. Node.js
node --version          # 需 ≥22，推荐 v24.14.0

# 2. pnpm
pnpm --version          # 需 ≥9

# 3. PostgreSQL
psql -U postgres -d iomtea -h 127.0.0.1 -c "SELECT 1"
# 应输出 "1 row" 表示连接成功

# 4. Docker（如果使用 Docker 方式）
docker ps               # 应列出运行中的容器

# 5. OpenCode（如果安装）
opencode --version      # 应输出版本号
```

如果全部通过，按照 README.md 的"一次启动流程"即可启动系统。

---

## 8. 常见问题

### Q: `node --version` 显示的是旧版本

**A**: 系统可能同时安装了多个 Node.js 版本。卸载旧版本，或使用 `nvm`（Node Version Manager）管理多版本：

```bash
# Windows: 下载 nvm-windows (https://github.com/coreybutler/nvm-windows/releases)
nvm install 24.14.0
nvm use 24.14.0

# macOS/Linux
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install 24.14.0
nvm use 24.14.0
```

### Q: `pnpm install` 时下载很慢

**A**: 设置国内镜像源以加速：

```bash
pnpm config set registry https://registry.npmmirror.com
```

### Q: PostgreSQL 连接失败（`ECONNREFUSED`）

**A**: 最常见的原因是 PostgreSQL 服务未启动：

```bash
# Windows: 搜索 "Services" → 找到 PostgreSQL → 启动
# macOS: brew services start postgresql@16
# Linux: sudo systemctl start postgresql
```

### Q: `psql` 命令找不到

**A**: PostgreSQL 未添加到系统 PATH。Windows 用户可在开始菜单中搜索"SQL Shell (psql)"来启动。或者手动将 PostgreSQL 的 `bin` 目录添加到 PATH 环境变量中。

### Q: Docker Desktop 启动后一直卡在 "Starting"

**A**: 尝试重启电脑。如果仍不行，检查 BIOS 中是否启用了虚拟化（Intel VT-x 或 AMD-V）。
