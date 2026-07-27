// 预测性告警引擎 — 基于趋势分析的提前预警

export interface TrendPoint {
  metric: string
  slope: number         // 变化率 (per hour)
  currentValue: number
  predictedCrossTime: string | null  // 预计何时超标
  confidence: number    // 0-100
  severity: 'warning' | 'critical'
}

export interface PredictiveAlert {
  id: string
  patientId: string; patientName: string
  timestamp: string
  title: string
  description: string
  trends: TrendPoint[]
  overallConfidence: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  suggestedActions: string[]
}

// 阈值定义
const THRESHOLDS: Record<string, { low: number; high: number; critical: number }> = {
  heart_rate: { low: 50, high: 100, critical: 120 },
  spo2: { low: 92, high: 100, critical: 90 },
  systolic_bp: { low: 90, high: 140, critical: 160 },
  diastolic_bp: { low: 60, high: 90, critical: 100 },
  temperature: { low: 35.5, high: 37.5, critical: 38.5 },
  glucose: { low: 3.5, high: 7.0, critical: 11.0 },
}

const ACTION_TEMPLATES: Record<string, string[]> = {
  heart_rate: ['通知医生评估心血管风险', '让老人平卧减少活动', '记录心率异常发生时间和伴随症状'],
  spo2: ['准备吸氧设备', '检查呼吸道是否通畅', '如持续低于90%建议转诊'],
  systolic_bp: ['保持老人安静休息', '15分钟后复测血压', '如持续升高联系社区医生'],
  temperature: ['测量体温确认读数', '准备退烧药物', '如超过38.5℃建议就医'],
  glucose: ['测试指尖血糖确认', '准备好含糖食物备用', '如持续异常通知医生调整用药'],
}

export function generatePredictiveAlerts(
  patientId: string, patientName: string,
  vitalsHistory: Array<{ time: string; metric: string; value: number }>,
): PredictiveAlert | null {
  // 按指标分组
  const byMetric: Record<string, Array<{ time: Date; value: number }>> = {}
  for (const e of vitalsHistory) {
    if (!byMetric[e.metric]) byMetric[e.metric] = []
    byMetric[e.metric].push({ time: new Date(e.time), value: e.value })
  }

  const trends: TrendPoint[] = []
  for (const [metric, points] of Object.entries(byMetric)) {
    if (points.length < 3) continue
    const th = THRESHOLDS[metric]
    if (!th) continue

    // 排序按时间
    points.sort((a, b) => a.time.getTime() - b.time.getTime())
    const recent = points.slice(-5)

    // 简单线性回归：计算斜率
    const n = recent.length
    const xMean = recent.reduce((s, p) => s + p.time.getTime(), 0) / n
    const yMean = recent.reduce((s, p) => s + p.value, 0) / n
    let num = 0, den = 0
    for (const p of recent) {
      const dx = p.time.getTime() - xMean
      num += dx * (p.value - yMean)
      den += dx * dx
    }
    const slopePerMs = den > 0 ? num / den : 0
    const slopePerHour = slopePerMs * 3600000  // per hour

    const current = recent[recent.length - 1].value

    // 预测何时超标
    let crossTime: string | null = null
    let severity: 'warning' | 'critical' = 'warning'

    if (slopePerHour > 0 && current < th.high) {
      const hoursToHigh = (th.high - current) / slopePerHour
      if (hoursToHigh > 0 && hoursToHigh < 12) {
        crossTime = new Date(Date.now() + hoursToHigh * 3600000).toISOString()
        severity = hoursToHigh < 2 ? 'critical' : 'warning'
      }
    } else if (slopePerHour < 0 && current > th.low) {
      const hoursToLow = (current - th.low) / Math.abs(slopePerHour)
      if (hoursToLow > 0 && hoursToLow < 12) {
        crossTime = new Date(Date.now() + hoursToLow * 3600000).toISOString()
        severity = hoursToLow < 2 ? 'critical' : 'warning'
      }
    }

    // 置信度：基于趋势稳定性（R² 简化）
    const rSquared = den > 0 ? Math.min(1, num * num / (den * recent.reduce((s, p) => s + Math.pow(p.value - yMean, 2), 0) + 0.001)) : 0
    const confidence = Math.round(rSquared * 100)

    if (Math.abs(slopePerHour) > 0.5 && crossTime) {
      trends.push({ metric, slope: +slopePerHour.toFixed(3), currentValue: current, predictedCrossTime: crossTime, confidence: Math.min(100, Math.max(10, confidence)), severity })
    }
  }

  if (trends.length === 0) return null

  const overallConfidence = Math.round(trends.reduce((s, t) => s + t.confidence, 0) / trends.length)
  const hasCritical = trends.some((t) => t.severity === 'critical')

  return {
    id: `pred-${patientId}-${Date.now()}`,
    patientId, patientName,
    timestamp: new Date().toISOString(),
    title: hasCritical ? `${trends.map((t) => t.metric).join(',')}等指标快速恶化` : `${trends.map((t) => t.metric).join(',')}趋势预警`,
    description: trends.map((t) => {
      const dir = t.slope > 0 ? '上升' : '下降'
      const when = t.predictedCrossTime ? new Date(t.predictedCrossTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''
      return `${t.metric} 持续${dir}（${t.slope > 0 ? '+' : ''}${t.slope}/h），预计${when}超出安全范围`
    }).join('；'),
    trends,
    overallConfidence,
    riskLevel: hasCritical ? 'critical' : trends.length >= 2 ? 'high' : 'medium',
    suggestedActions: [...new Set(trends.flatMap((t) => ACTION_TEMPLATES[t.metric] || []))],
  }
}
