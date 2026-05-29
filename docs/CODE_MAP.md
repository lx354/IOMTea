# 项目代码地图

本文档标注项目关键文件和目录的用途，供快速定位代码。

---

## 后端 (`apps/server/src/`)

### 入口与启动

| 文件 | 用途 |
|------|------|
| `index.ts` | 应用入口：中间件注册、路由挂载、bootstrap 启动流程（数据库→种子数据→HTTP→WebSocket） |

### REST API 路由 (`routes/`)

| 文件 | 路径前缀 | 主要端点 |
|------|---------|---------|
| `auth.ts` | `/auth` | register, login, refresh, logout |
| `patients.ts` | `/patients` | CRUD + 用户关联 |
| `twin.ts` | `/twin` | 仿真 CRUD、状态矩阵、ML 数据导出 |
| `alerts.ts` | `/alerts` | 告警列表、状态流转 |
| `pins.ts` | `/pins` | PIN 设备管理 |
| `data.ts` | `/data` | 体征时序数据查询 |
| 其余 9 个 | 各类业务 | 用药、计划、积分、导出等 |

### 数字孪生引擎 (`modules/twin/`)

| 文件 | 用途 |
|------|------|
| `engine.ts` | 仿真核心：调度器、tick 循环、观测值生成、状态转换记录 |
| `state-machine.ts` | 状态评估：11 维度阈值判断 + 4 级综合风险等级 |
| `profiles.ts` | 5 种患者画像：基线体征、计量配置、疾病标签 |
| `operations.ts` | 场景注入：9+2 种临床场景（含夜间离床、走失） |
| `scheduler.ts` | 定时器调度器：带速度控制和随机抖动的周期性任务 |

### 数据接入 (`mqtt-ingest/`)

| 文件 | 用途 |
|------|------|
| `listener.ts` | MQTT 客户端：连接 Broker、订阅 3 种主题模式 |
| `router.ts` | 消息路由：PIN 认证、指标归一化、范围校验、事件写入 |

### 数据库 (`core/db/`)

| 文件 | 用途 |
|------|------|
| `schema.ts` | 核心表定义（users, patients, events, 等） |
| `schema/` | 扩展表（pin, medication, plan, twin 等） |

### 中间件 (`middleware/`)

| 文件 | 用途 |
|------|------|
| `auth.ts` | JWT 令牌验证 |
| `rbac.ts` | 基于角色的权限检查 |

---

## 前端 (`apps/web/src/`)

| 文件/目录 | 用途 |
|----------|------|
| `main.tsx` | React 入口 |
| `routes.tsx` | 路由定义（TanStack Router） |
| `pages/TwinStatusMatrix.tsx` | 风险状态矩阵看板（核心页面） |
| `pages/ExpandedPatientRow.tsx` | 患者展开详情（sparkline + 状态历史） |
| `hooks/useTwinStatus.ts` | 状态矩阵数据轮询（30 秒间隔） |
| `api/client.ts` | 后端 API 封装（axios + 拦截器） |
| `components/StateComponents.tsx` | 通用加载/错误/空状态组件 |

---

## 树莓派硬件 (`hardware/raspberry-pi/`)

| 文件 | 用途 |
|------|------|
| `main.py` | 主循环：20 秒一轮，读取传感器 → YOLO 推理 → MQTT 发布 |
| `sensors.py` | DHT22 温湿度 + PIR 人体感应 |
| `yolo.py` | YOLOv8-pose 跌倒检测 |
| `mqtt_client.py` | MQTT 发布封装 |
| `config.py` | 配置项（PIN、Broker 地址、采集间隔） |
| `install.sh` | 一键安装脚本（Python 依赖 + YOLO 模型） |

---

## 数据流概要

```text
树莓派/模拟器 → MQTT / 孪生引擎 → events 表 → 状态评估引擎 → Web 看板
                                        ↓
                                    ML 数据接口 (ml-* API)
                                        ↓
                                    LSTM 模型训练（待接入）
```
