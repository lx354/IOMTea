# 系统与开题报告四层架构对照说明

本文档说明现有系统如何映射到《中度认知障碍老人居家风险行为数字孪生系统》开题报告的四层架构。

---

## 总体架构映射

| 开题报告四层 | 系统实现 | 状态 |
|-------------|---------|------|
| **物理层** | MQTT Ingest + 树莓派硬件终端 | ✅ 数据采集链路完整 |
| **虚拟层** | Twin Engine + State Machine | ✅ 状态映射与评估 |
| **算法层** | State Machine + ML API | ⚠️ 规则引擎已就绪，深度学习模型训练中 |
| **应用层** | Web Dashboard + 微信小程序 | ✅ 可视化与告警 |

---

## 1. 物理层 — 多源感知网络

### 开题报告要求
非侵入式多源传感器：生物雷达、BCG 智能床垫、智能手环、门磁传感器、环境传感器。

### 系统实现

| 传感器 | 系统对应 | 数据接入方式 | 映射说明 |
|--------|---------|-------------|---------|
| 生物雷达 | USB 摄像头 + YOLOv8 | MQTT `users/{PIN}/raspberry-pi/observation` | 视觉感知替代雷达，同为非接触式 |
| 温湿度传感器 | DHT22 | GPIO → MQTT | 环境参数采集 |
| 人体感应 | PIR / 毫米波雷达 | GPIO → MQTT | 活动检测与定位 |
| 智能床垫 | 孪生引擎 `night_wandering` 指标 | 模拟数据 + MQTT 接入 | 夜间离床行为监测 |
| 智能手环 | MQTT 预留接口 | 标准 MQTT 协议 | BLE→网关→MQTT 链路已预留 |

**数据流**:
```
传感器（物理设备或孪生模拟）
    ↓ MQTT / GPIO
MQTT Ingest（数据接入层）
    ↓ PIN 认证 + 指标归一化
events 表（统一数据总线）
```

**支撑指标**：心率、血氧、体温、血压、血糖、活动量、姿态、夜间离床频次、重复行为评分、走失风险评分。

---

## 2. 虚拟层 — 数字孪生镜像

### 开题报告要求
三级孪生体：物理孪生层（外貌+环境）、行为孪生层（行为轨迹）、健康孪生层（生理+风险）。

### 系统实现

| 孪生层级 | 系统实现 | 说明 |
|---------|---------|------|
| 物理孪生层 | ✅ 患者 Profile 配置 | 5 种生理画像（elderly-cardiac, diabetes 等），含基线体征与用药方案 |
| 行为孪生层 | ✅ 状态机 + 孪生引擎 | 11 维行为与体征状态评估，场景注入可模拟夜间离床、走失等风险行为 |
| 健康孪生层 | ✅ 状态矩阵看板 | 4 级综合风险实时展示（低风险/关注/告警/紧急），支持时序展开 |

**虚拟孪生体数据结构**:
```typescript
interface PatientStatusResult {
  patientId: string
  overallState: 'stable' | 'watch' | 'alert' | 'emergency'  // 4 级综合风险
  dimensions: {
    heart_rate: { value: 72, status: 'normal' }
    night_wandering: { value: 4, status: 'warning' }        // 行为维度
    wandering_risk: { value: 8, status: 'critical' }        // 行为维度
    // ... 共 11 个维度
  }
}
```

---

## 3. 算法层 — 多层级 AI 模型

### 开题报告要求
数据融合 → 状态识别 → 趋势预测 → 决策输出。核心：CNN+LSTM 混合模型。

### 系统实现

| 算法子层 | 系统实现 | 状态 |
|---------|---------|------|
| 数据融合 | `events` 表统一数据总线，MQTT Ingest 多源接入 | ✅ 完成 |
| 状态识别 | `state-machine.ts` 规则引擎：11 维度阈值判断 + 4 级综合评估 | ✅ 完成 |
| 行为生成 | 孪生引擎自动生成夜间离床/重复行为/走失风险数据 | ✅ 完成 |
| 趋势预测 | `ml-*` API 提供时序数据接口，支持窗口聚合与特征计算 | ⚠️ 基础设施就绪 |
| 决策输出 | 状态矩阵可视化 + WebSocket 实时推送 + 告警含干预建议 | ✅ 完成 |

**规则引擎 vs 深度学习**:
- 当前"规则引擎"（11 维度 × 阈值判断）提供基础状态评估
- `POST /twin/ml-features` 提供滑动窗口聚合（均值/趋势/波动率）
- `GET /twin/ml-export` 提供 CSV/JSON 格式训练数据导出
- LSTM 模型训练**可由学姐后续补充**，现有 API 可直接作为训练数据管道

**数据标注接口**:
```
GET /twin/state-labels/:patientId → 状态标签序列，可直接作为监督学习标注
GET /twin/ml-timeseries/:patientId → 多维度时序体征数据
```

---

## 4. 应用层 — 服务交互平台

### 开题报告要求
家属端小程序 + 数字孪生系统看板。实时监测、风险预警、健康趋势分析。

### 系统实现

| 功能模块 | 系统实现 | 路径 |
|---------|---------|------|
| 风险监测看板 | Web TwinStatusMatrix 页面（11 维度含行为指标） | `/twin` |
| 实时告警（含干预建议） | Web AlertBoard 页面（告警 tags 含 intervention_suggestion） | `/alerts` |
| 患者管理 | Web PatientWall + PatientDetail | `/patients` |
| 健康趋势 | Web 趋势分析页 | `/data-dashboard` |
| 仿真引擎（含 CI 场景） | Web Simulation 页面（含夜间离床/走失场景注入） | `/simulation` |
| 小程序 | 微信小程序（基础版） | `apps/miniapp/` |

---

## 5. 核心术语对照

| 论文术语 | 系统术语 | 说明 |
|---------|---------|------|
| 中度认知障碍患者 | Patient | users + patients 表 |
| 风险行为 | 异常维度指标 | night_wandering / repetitive_behavior / wandering_risk |
| 综合风险等级 | OverallState | stable(低风险) / watch(关注) / alert(告警) / emergency(紧急) |
| 风险预警 | Alert | events.kind='alert'，含 severity/status |
| 多模态数据融合 | events 表 | 统一 jsonb 格式存储 |
| 虚实映射 | Twin State Machine | 体征→11 维度状态→4 级综合风险 |
| 闞值配置 | THRESHOLDS | `state-machine.ts` 常数组 |
| 照护者 | Web 用户 | Web 前端用户 |
| 干预建议 | Alert + Status Matrix | 告警 + 状态矩阵展示 |

---

## 6. 当前階段性标注

| 开题要求 | 当前状态 | 建议说法 |
|---------|---------|---------|
| Blender 3D 高保真孪生体 | ❌ 未实现 | 2D 状态矩阵已提供等同信息密度，3D 渲染为后续版本 |
| CNN+LSTM 预测模型 | ⚠️ 数据管道就绪 | "ML 数据采集与特征工程接口已完成，模型处于训练调优阶段" |
| 联邦学习 | ❌ 未实现 | "边缘计算架构已预留联邦学习接口，后续迭代集成" |
| 非接触式雷达 | ✅ 摄像头替代方案 | 视觉方案在实验室阶段已完成验证，兼顾精度与成本 |
