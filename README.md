# IOMTea — 认知障碍老人居家风险行为数字孪生系统

面向中度认知障碍老人居家监护的数字孪生系统。

---

**👉 首次阅读请从 [先看我.md](先看我.md) 开始。**

---

## 快速入口

| 目的 | 文档 |
|------|------|
| 项目总览与文档索引 | [先看我.md](先看我.md) |
| 从零搭建环境 | [docs/environment-setup.md](docs/environment-setup.md) |
| 部署与运行 | [docs/getting-started.md](docs/getting-started.md) |
| 论文架构映射 | [docs/thesis-alignment.md](docs/thesis-alignment.md) |
| 代码文件导航 | [docs/CODE_MAP.md](docs/CODE_MAP.md) |
| 树莓派硬件指南 | [hardware/raspberry-pi/README.md](hardware/raspberry-pi/README.md) |

```bash
# 快速启动（需先安装 Node.js v24.14.0 + PostgreSQL）
pnpm install
pnpm --filter @iomtea/server db:migrate
pnpm dev
# 浏览器 → http://localhost:5173 → demo / demo123
```
