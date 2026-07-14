# IOMTea 架构规范 — DDD-Lite

> **生效日期**: 2026-05-10
> **适用场景**: 单人全栈 + AI 辅助生成 + 测试人手不足
> **核心原则**: 只拿 DDD 中对这类开发场景有实际助力的部分，拒绝模板代码和过度抽象

---

## 1. Bounded Contexts（有界上下文）

系统划分为三个上下文。每个上下文内部自由依赖，上下文之间**只通过 Domain Event 或 tRPC 调用通信**，绝不跨 Context import 内部实现。

```
apps/server/src/

├── core/                    ← Context: 核心业务
│   ├── db/schema.ts              Drizzle Schema = Repository
│   ├── lib/                     纯工具函数（jwt, password）
│   ├── services/                业务逻辑（auth, device, patient）
│   └── trpc/                    tRPC 路由（Application Layer，薄层）
│
├── simulator/               ← Context: 仿真
│   ├── engine.ts                引擎入口
│   ├── clock.ts                 仿真时钟
│   ├── factory.ts               患者实例工厂
│   ├── profiles/                患者档案配置
│   ├── physiology/              生理信号模型（纯函数）
│   ├── devices/                 虚拟设备模拟器（纯函数）
│   ├── scenarios/               场景脚本
│   ├── db-writer.ts             events 表批量写入
│   └── trpc/                    仿真控制 tRPC 路由
│
├── ingest/                  ← Context: 数据接入（规划中）
│   ├── mqtt/
│   ├── tcp/
│   └── trpc/
│
└── events/                  ← Domain Event 共享层
    └── （即 db/schema.ts 中的 events 表）
```

### Context 间通信规则

```
simulator ──写入──▶ events 表 ◀──读取── core (dataRouter)
simulator ◀──tRPC── core (deviceRouter.create/register)
ingest    ──写入──▶ events 表          （未来）
ingest    ◀──tRPC── core               （未来）
```

**禁止**：
- `simulator/` import `core/services/` 的任何内容
- `simulator/` import `core/trpc/` 的任何实现
- Context 之间 import type 仅限 `shared-types` 包

**允许**：
- 所有 Context 读写 `events` 表（Domain Event）
- 所有 Context 调用 tRPC 路由（跨 Context 的 Application Layer 入口）
- 所有 Context import `@iomtea/shared-types`（Zod schema）

---

## 2. Ubiquitous Language（统一术语）

### 命名强制

| 术语 | 含义 | 禁止别名 |
|------|------|----------|
| `Event` | events 表中的一行，kind=observation 或 alert | 不要叫 Record、DataPoint、Sample |
| `Observation` | kind='observation' 的事件 | 不要叫 Metric、Measurement |
| `Alert` | kind='alert' 的事件 | 不要叫 Alarm、Warning、Notification |
| `Patient` | patients 表中的实体 | — |
| `Device` | devices 表中的实体 | 不要叫 Sensor、Node、Endpoint |
| `PatientInstance` | 模拟器中运行的患者实例 | 区分 Patient（DB实体） |
| `SimulatedEvent` | 模拟器生成的事件 | 区分 Event（DB持久化后） |
| `Profile` | 患者生理档案（配置模板） | 不要叫 Template、Preset、Config |
| `Scenario` | 场景注入脚本 | 不要叫 Script、Case、Test |
| `Ingest` | 数据接入层 | 不要叫 Input、Receive、Collector |
| `Tag` | events.tags 中的键值对 | 不要叫 Label、Meta、Attribute |
| `Metric` | events.metric 的值 | 不要叫 Key、Type、Field |

### 代码中自查

如果两个变量名指向同一概念，必须统一。如果发现 `const heartRate = await getObservations()` 和 `const hrData = await queryEvents()` 做同一件事，合并为一个。

---

## 3. Domain Event（事件驱动核心）

### events 表是系统的单一数据总线

```
所有数据流入:
  simulator ──▶ events 表 ◀── ingest (未来)
                    │
所有数据流出:        ▼
  data.timeseries ──▶ Dashboard
  data.latest     ──▶ 患者卡片
  alert.list      ──▶ 告警面板
```

### Event 结构（窄表）

```
events (
  id, patient_id, device_id,
  kind,        -- 'observation' | 'alert'
  metric,      -- 自由文本，不校验枚举
  value,       -- double，alert 可 null
  unit,        -- 自由文本
  severity,    -- 仅 alert
  status,      -- 仅 alert
  tags,        -- jsonb，核心扩展机制
  recorded_at,
  created_at
)
```

### tags 扩展约定

tags 是实现"不迁移 Schema 即可扩展"的核心机制。约定以下 key（非强制，仅推荐）：

| tag key | 用途 | 示例 |
|---------|------|------|
| `category` | 前端分组 | `"vital"`, `"motion"`, `"environment"` |
| `source` | 传感器来源 | `"ppg"`, `"piezo"`, `"ir_sensor"` |
| `quality` | 信号质量 0-1 | `0.98` |
| `simulated` | 是否仿真数据 | `true` |
| `protocol` | 解析协议名 | `"mattress_v3.lua"` |
| `scenario` | 关联场景 | `"emergency_2026-05-10"` |

任何设备可自定义任意 tag，后端不校验、不拦截、不报错。

---

## 4. Layer Discipline（分层纪律）

### 三层结构

```
tRPC Route (Application Layer)
  │ 职责: 参数校验（Zod）、鉴权、调用 Service
  │ 不写业务逻辑，不直接操作 DB
  ▼
Service (Domain Layer)  
  │ 职责: 业务逻辑、编排
  │ 不处理 HTTP、不 import tRPC/Hono 类型
  ▼
Drizzle DB (Repository Layer)
  │ 职责: 数据访问
  │ Drizzle 本身即为 Repository，不写接口抽象
```

### 简单操作可跳过 Service

```typescript
// ✅ 当逻辑 = 单条 Drizzle 查询时，路由内联即可
list: protectedProcedure.query(({ ctx }) =>
  ctx.db.select().from(patients)
)

// ✅ 当逻辑 = 多步编排时，抽 Service 函数
register: publicProcedure.mutation(({ ctx, input }) =>
  authService.register(ctx.db, input)
)
```

**规则**：如果一个 tRPC procedure 内的代码超过 8 行（不含 import），必须抽 Service 函数。

---

## 5. 反模式（禁止事项）

| 反模式 | 为什么禁止 | 替代方案 |
|--------|-----------|----------|
| `interface IPatientRepo` | Drizzle 本身就是类型安全的 Repository | 直接注入 `db` |
| `class PatientService` | 无状态逻辑不需要类 | `export function registerPatient(...)` |
| `class HeartRate extends ValueObject` | 模板代码 / 序列化成本 / AI 生成质量差 | `{ metric: "heart_rate", value: 72 }` |
| Repository + Service 双层抽象（简单 CRUD） | 空转 | 路由内联 Drizzle 调用 |
| Aggregate Root 不变性守卫 | 校验逻辑本就在 Zod schema 里 | Zod `.refine()` |
| CQRS / Event Sourcing | 系统规模不需要 | 直接 SELECT + INSERT |
| `any` 类型 | 破坏类型安全 | Zod schema 推导 |
| 直接 import 跨 Context 内部实现 | 破坏模块边界 | 走 events 表或 tRPC 调用 |

---

## 6. 文件约束

| 约束 | 值 |
|------|-----|
| 每个 Bounded Context 文件数 | ≤ 15 个 |
| 每个文件行数 | ≤ 200 行 |
| 函数体行数 | ≤ 20 行 |
| 每个文件 `export` 数 | ≤ 5 个具名导出 |
| 函数优先于类 | 无状态 = function，有生命周期 = class |

**理由**：这些数字对应 AI 的最佳上下文窗口。一个 150 行的文件 + 其 imports 能完整塞进一次 prompt 而无需截断。

---

## 7. AI 辅助开发契约

### 给 AI 的 Context Prompt 模板

向 AI 描述任务时，统一使用如下格式：

```
Context: IOMTea 项目，Bounded Context = {core|simulator|ingest}
规则:
  - 你可以导入: drizzle-orm, @iomtea/shared-types, {Context}/ 内部模块
  - 你不能导入: {其他 Context}/ 的任何模块
  - 数据访问: 直接使用 ctx.db（Drizzle 实例），不创建 Repository 接口
  - 错误处理: throw TRPCError
  - 校验: Zod schema（从 @iomtea/shared-types 引入或内联定义）
任务: {具体描述}
```

### 生成代码的质量标准

- 类型错误 = 0（`tsc --noEmit` 通过）
- 不引入新的 `any`
- 不创建超过 1 层的抽象（不写 XxxInterface + XxxImpl）
- 不 import 跨 Context 模块
- 新文件不超过 200 行

---

## 8. 测试策略（务实版）

| 测试类型 | 优先级 | 何时写 |
|----------|--------|--------|
| **类型检查** (`tsc --noEmit`) | 每次提交 | CI 强制 |
| **纯函数单元测试** (`physiology/`) | P1 | 函数写完即写，1 个文件对 1 个 test |
| **tRPC 集成测试** (auth, data.ingest) | P2 | 路由改完即写 |
| **E2E 测试** | P3 | 演示前补关键路径 |

**不写**：Repository 层单测（Drizzle 本身可信）、UI 层单测（变化快、人手不足）

---

## 9. 版本

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-05-10 | 初始版，定义 Bounded Context + 术语 + 分层 + 反模式 + AI 契约 |
