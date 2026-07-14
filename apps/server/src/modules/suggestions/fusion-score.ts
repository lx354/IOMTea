// 多模态融合评分引擎 — 老人安全指数

import { getChatProfile } from '../twin/chat/chat-profiles'

export interface FusionInput {
  patientId: string; patientName: string
  profileId?: string
  vitals: Record<string, number>         // 最新体征: heart_rate, spo2, systolic_bp, temperature, glucose
  behaviors24h: string[]                  // 24h 行为检测: falling, wandering, bed_exit
  postureScore: number | null             // 姿态综合评分 (0-100)
  cognitiveScore: number | null           // MMSE 等效分 (0-30, 转换到 0-100)
  moodStatus: string | null               // calm, anxious, depressed, confused
  recentAlerts: number                    // 24h 告警数量
}

export interface DimensionScore {
  label: string
  score: number           // 0-100
  weight: number          // 权重
  status: 'good' | 'fair' | 'poor' | 'danger'
  detail: string
}

export interface FusionReport {
  patientId: string; patientName: string
  timestamp: string
  overallIndex: number    // 0-100
  overallStatus: '安全' | '注意' | '高危'
  dimensions: DimensionScore[]
  summary: string
  alerts: string[]
}

// ── 各维度评分函数 ──

function scoreVitals(vitals: Record<string, number>): DimensionScore {
  let score = 80; const issues: string[] = []
  const hr = vitals['heart_rate']
  const spo2 = vitals['spo2']
  const sbp = vitals['systolic_bp']
  const temp = vitals['temperature']
  const glucose = vitals['glucose']

  if (hr != null) {
    if (hr > 120) { score -= 25; issues.push(`心率过高 ${hr}bpm`) }
    else if (hr > 100) { score -= 12; issues.push(`心率偏高 ${hr}bpm`) }
    else if (hr < 50) { score -= 25; issues.push(`心率过低 ${hr}bpm`) }
    else if (hr < 60) { score -= 8; issues.push(`心率偏低 ${hr}bpm`) }
  }
  if (spo2 != null) {
    if (spo2 < 90) { score -= 30; issues.push(`血氧过低 ${spo2}%`) }
    else if (spo2 < 94) { score -= 15; issues.push(`血氧偏低 ${spo2}%`) }
  }
  if (sbp != null) {
    if (sbp > 160) { score -= 20; issues.push(`收缩压过高 ${sbp}mmHg`) }
    else if (sbp < 80) { score -= 20; issues.push(`收缩压过低 ${sbp}mmHg`) }
  }
  if (temp != null && (temp > 38 || temp < 35)) { score -= 20; issues.push(`体温异常 ${temp}℃`) }
  if (glucose != null && (glucose > 10 || glucose < 3)) { score -= 15; issues.push(`血糖异常 ${glucose}`) }

  return {
    label: '体征健康', score: Math.max(0, Math.min(100, score)), weight: 0.30,
    status: score >= 70 ? 'good' : score >= 40 ? 'fair' : 'danger',
    detail: issues.length > 0 ? issues.join('; ') : '各项指标正常',
  }
}

function scoreBehavior(behaviors: string[]): DimensionScore {
  let score = 100; const issues: string[] = []
  if (behaviors.includes('falling')) { score -= 40; issues.push('检测到跌倒行为') }
  if (behaviors.includes('wandering')) { score -= 25; issues.push('检测到游走行为') }
  if (behaviors.includes('bed_exit')) { score -= 10; issues.push('检测到离床行为') }
  return {
    label: '行为安全', score: Math.max(0, score), weight: 0.25,
    status: score >= 70 ? 'good' : score >= 40 ? 'fair' : 'danger',
    detail: issues.length > 0 ? issues.join('; ') : '未检测到异常行为',
  }
}

function scorePosture(postureScore: number | null): DimensionScore {
  const score = postureScore ?? 60
  return {
    label: '姿态平衡', score, weight: 0.15,
    status: score >= 70 ? 'good' : score >= 50 ? 'fair' : 'poor',
    detail: postureScore != null ? `姿态综合评分 ${postureScore} 分` : '无姿态数据',
  }
}

function scoreCognitive(cognitiveScore: number | null): DimensionScore {
  const raw = cognitiveScore ?? 24
  const score = Math.round((raw / 30) * 100)
  return {
    label: '认知状态', score, weight: 0.20,
    status: score >= 70 ? 'good' : score >= 50 ? 'fair' : score >= 30 ? 'poor' : 'danger',
    detail: cognitiveScore != null ? `MMSE 等效分 ${cognitiveScore}/30` : '无认知评估数据',
  }
}

function scoreEmotional(mood: string | null, alers: number): DimensionScore {
  let score = 80
  const issues: string[] = []
  if (mood === 'depressed') { score -= 30; issues.push('抑郁情绪') }
  else if (mood === 'anxious') { score -= 20; issues.push('焦虑情绪') }
  else if (mood === 'confused') { score -= 15; issues.push('困惑状态') }
  if (alers > 3) { score -= 20; issues.push(`${alers} 条活跃告警`) }
  return {
    label: '情绪稳定', score: Math.max(0, Math.min(100, score)), weight: 0.10,
    status: score >= 70 ? 'good' : score >= 40 ? 'fair' : 'poor',
    detail: issues.length > 0 ? issues.join('; ') : '情绪稳定',
  }
}

// ── 主入口 ──

export function computeFusionScore(input: FusionInput): FusionReport {
  const dims: DimensionScore[] = [
    scoreVitals(input.vitals),
    scoreBehavior(input.behaviors24h),
    scorePosture(input.postureScore),
    scoreCognitive(input.cognitiveScore),
    scoreEmotional(input.moodStatus, input.recentAlerts),
  ]

  const overallIndex = Math.round(dims.reduce((s, d) => s + d.score * d.weight, 0))

  const alerts: string[] = []
  for (const d of dims) {
    if (d.status === 'danger') alerts.push(`🚨 ${d.label}: ${d.detail}`)
    else if (d.status === 'poor') alerts.push(`⚠ ${d.label}: ${d.detail}`)
  }

  // 个性化调整
  if (input.profileId) {
    const profile = getChatProfile(input.profileId)
    if (profile && profile.triggers?.length > 0) {
      alerts.push(`📋 ${profile.displayName}的注意因素: ${profile.triggers.slice(0, 3).join('、')}`)
    }
  }

  return {
    patientId: input.patientId,
    patientName: input.patientName,
    timestamp: new Date().toISOString(),
    overallIndex,
    overallStatus: overallIndex >= 70 ? '安全' : overallIndex >= 45 ? '注意' : '高危',
    dimensions: dims,
    summary: overallIndex >= 70 ? '各项指标良好，保持当前照护方案' :
      overallIndex >= 45 ? '部分维度需关注，建议检查详情' : '需要紧急干预，请立即查看详情',
    alerts,
  }
}
