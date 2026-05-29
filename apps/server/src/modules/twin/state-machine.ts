import { normalizeMetric } from '../../core/lib/metrics'

// 单维度状态（11 维体征/行为指标各有一个）
export type DimensionStatus = 'normal' | 'warning' | 'critical' | 'no_data'
// 四档综合风险等级，按紧急程度升序
export type OverallState = 'stable' | 'watch' | 'alert' | 'emergency'
export type DimensionName =
  | 'heart_rate'
  | 'spo2'
  | 'temperature'
  | 'systolic_bp'
  | 'diastolic_bp'
  | 'glucose'
  | 'motion_index'
  | 'posture'
  | 'night_wandering'
  | 'repetitive_behavior'
  | 'wandering_risk'

export interface PatientStatusResult {
  patientId: string
  overallState: OverallState
  dimensions: Partial<Record<DimensionName, { value: unknown; status: DimensionStatus }>>
  timestamp: string
}

type ThresholdRange = {
  normalMin: number
  normalMax: number
  warnLow?: number
  warnHigh?: number
  critLow?: number
  critHigh?: number
}

// 阈值定义：
// normalMin/normalMax = 正常范围
// warnLow/warnHigh = 警告阈值（超出正常范围但未达到临界）
// critLow/critHigh = 临界阈值（超出此范围即为严重偏离）
// 数值超出 crit 边界时额外检查是否在正常范围内以判定 critical
export const THRESHOLDS: Record<string, ThresholdRange> = {
  heart_rate: { normalMin: 60, normalMax: 100, warnLow: 50, warnHigh: 120, critLow: 0, critHigh: 200 },
  spo2: { normalMin: 95, normalMax: 100, warnLow: 90, warnHigh: 94, critLow: 0, critHigh: 89 },
  temperature: { normalMin: 36.1, normalMax: 37.2, warnLow: 35.5, warnHigh: 38.0, critLow: 0, critHigh: 42 },
  systolic_bp: { normalMin: 90, normalMax: 130, warnLow: 80, warnHigh: 160, critLow: 0, critHigh: 200 },
  diastolic_bp: { normalMin: 60, normalMax: 85, warnLow: 50, warnHigh: 100, critLow: 0, critHigh: 150 },
  glucose: { normalMin: 3.9, normalMax: 6.1, warnLow: 3.0, warnHigh: 7.0, critLow: 0, critHigh: 30 },
  motion_index: { normalMin: 0.3, normalMax: 10, warnLow: 0.1, warnHigh: 10, critLow: 0, critHigh: 10 },
  night_wandering: { normalMin: 0, normalMax: 1, warnLow: 0, warnHigh: 3, critLow: 0, critHigh: 10 },
  repetitive_behavior: { normalMin: 0, normalMax: 2, warnLow: 0, warnHigh: 6, critLow: 0, critHigh: 10 },
  wandering_risk: { normalMin: 0, normalMax: 2, warnLow: 0, warnHigh: 6, critLow: 0, critHigh: 10 },
}

function evaluateNumericDimension(
  value: unknown,
  threshold: ThresholdRange,
): DimensionStatus {
  if (value === null || value === undefined) return 'no_data'
  const num = typeof value === 'string' ? Number(value) : Number(value)
  if (isNaN(num)) return 'no_data'

  if (
    (threshold.critLow !== undefined && num < threshold.critLow) ||
    (threshold.critHigh !== undefined && num > threshold.critHigh)
  ) {
    const normal = num >= threshold.normalMin && num <= threshold.normalMax
    if (!normal) return 'critical'
  }

  if (num >= threshold.normalMin && num <= threshold.normalMax) return 'normal'

  if (threshold.warnLow !== undefined && num < threshold.warnLow) return 'warning'
  if (threshold.warnHigh !== undefined && num > threshold.normalMax) {
    if (num <= threshold.warnHigh) return 'warning'
    return 'critical'
  }

  if (num < threshold.normalMin) return num >= (threshold.warnLow ?? 0) ? 'warning' : 'critical'
  if (num > threshold.normalMax) return num <= (threshold.warnHigh ?? 999) ? 'warning' : 'critical'

  return 'no_data'
}

function evaluatePosture(value: unknown, allVitals: Record<string, unknown>): DimensionStatus {
  if (value === null || value === undefined) return 'no_data'
  const str = String(value).toLowerCase()
  if (str === 'lying') {
    const fallDetected = allVitals['fall_detected'] ?? allVitals['fall']
    if (fallDetected === true || fallDetected === 'true' || fallDetected === 1) return 'critical'
    return 'warning'
  }
  if (str === 'standing' || str === 'sitting') return 'normal'
  return 'normal'
}

function evaluateDimension(
  name: DimensionName,
  value: unknown,
  allVitals: Record<string, unknown>,
): DimensionStatus {
  if (name === 'posture') return evaluatePosture(value, allVitals)
  const threshold = THRESHOLDS[name]
  if (!threshold) return 'no_data'
  return evaluateNumericDimension(value, threshold)
}

const ALL_DIMENSIONS: DimensionName[] = [
  'heart_rate',
  'spo2',
  'temperature',
  'systolic_bp',
  'diastolic_bp',
  'glucose',
  'motion_index',
  'posture',
  'night_wandering',
  'repetitive_behavior',
  'wandering_risk',
]

// 患者综合状态评估入口
// 输入: patientId + 最新各维度值（key=metric name, value=数值|字符串）
// 输出: 每维度状态 + 综合风险等级
//
// 评估逻辑:
//   emergency ← 任一维度 critical 或 fall_detected=true
//   alert    ← 3+ 维度 warning 或 2 维度 warning
//   watch    ← 1 维度 warning
//   stable   ← 全部 normal 或 no_data
export function evaluatePatientState(
  patientId: string,
  latestVitals: Record<string, unknown>,
): PatientStatusResult {
  const dimensions: PatientStatusResult['dimensions'] = {}
  const normalizedVitals: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(latestVitals)) {
    normalizedVitals[normalizeMetric(key)] = value
  }

  let warningCount = 0
  let criticalCount = 0
  let hasFall = false

  if (
    normalizedVitals['fall_detected'] === true ||
    normalizedVitals['fall_detected'] === 'true' ||
    normalizedVitals['fall_detected'] === 1
  ) {
    hasFall = true
  }

  for (const dim of ALL_DIMENSIONS) {
    const value = normalizedVitals[dim]
    const status = evaluateDimension(dim, value, normalizedVitals)
    dimensions[dim] = { value: value ?? null, status }
    if (status === 'warning') warningCount++
    if (status === 'critical') criticalCount++
  }

  let overallState: OverallState
  if (criticalCount > 0 || hasFall) {
    overallState = 'emergency'
  } else if (warningCount >= 3) {
    overallState = 'alert'
  } else if (warningCount >= 2) {
    overallState = 'alert'
  } else if (warningCount >= 1) {
    overallState = 'watch'
  } else {
    overallState = 'stable'
  }

  return {
    patientId,
    overallState,
    dimensions,
    timestamp: new Date().toISOString(),
  }
}

export function getStatePriority(state: OverallState): number {
  const priorities: Record<OverallState, number> = {
    stable: 0,
    watch: 1,
    alert: 2,
    emergency: 3,
  }
  return priorities[state]
}
