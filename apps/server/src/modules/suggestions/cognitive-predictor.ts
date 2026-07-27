// 认知衰退预测引擎 — 基于历史趋势 + 风险因子

export interface CognitiveRiskFactor {
  name: string; impact: 'high' | 'medium' | 'low'
  description: string; score: number
}

export interface CognitivePrediction {
  patientId: string; patientName: string
  currentScore: number          // 当前 MMSE 等效分
  predictedScore6m: number      // 6 个月后预测
  predictedScore12m: number     // 12 个月后预测
  annualDeclineRate: number     // 年衰退速率 (分/年)
  riskLevel: 'low' | 'moderate' | 'high' | 'severe'
  riskScore: number             // 0-100 综合风险分
  trend: Array<{ date: string; score: number; label: string }>  // 历史+预测数据点
  riskFactors: CognitiveRiskFactor[]
  recommendations: string[]
}

export function predictCognitiveDecline(
  patientId: string, patientName: string,
  historicalScores: Array<{ date: string; mmse: number }>,
  riskProfile: {
    age: number; diagnosis: string; stage: string
    comorbidities: string[]; medications: string[]
    cognitiveLevel: string; recentMood: string | null
    behaviorAlerts: number
  },
): CognitivePrediction {
  const sorted = [...historicalScores].sort((a, b) => a.date.localeCompare(b.date))
  const currentScore = sorted.length > 0 ? sorted[sorted.length - 1].mmse : 24

  // 简单线性回归预测
  let slope = 0
  if (sorted.length >= 2) {
    const n = sorted.length
    const xMean = sorted.reduce((s, _, i) => s + i, 0) / n
    const yMean = sorted.reduce((s, d) => s + d.mmse, 0) / n
    let num = 0, den = 0
    for (let i = 0; i < n; i++) {
      const dx = i - xMean; const dy = sorted[i].mmse - yMean
      num += dx * dy; den += dx * dx
    }
    slope = den > 0 ? num / den : 0
  }

  // 如果无历史，用诊断和认知水平推算
  if (sorted.length < 2) {
    if (riskProfile.stage?.includes('重度')) slope = -1.5
    else if (riskProfile.stage?.includes('中度')) slope = -0.8
    else if (riskProfile.stage?.includes('轻度')) slope = -0.3
    else slope = -0.5
  }

  // 风险因子计算
  const riskFactors: CognitiveRiskFactor[] = []

  // 年龄因子
  const ageScore = riskProfile.age >= 85 ? 20 : riskProfile.age >= 75 ? 12 : riskProfile.age >= 65 ? 5 : 0
  riskFactors.push({ name: '高龄', impact: ageScore >= 15 ? 'high' : ageScore >= 8 ? 'medium' : 'low', description: `${riskProfile.age}岁`, score: ageScore })

  // 诊断因子
  const diagScore = riskProfile.diagnosis?.includes('重度') ? 15 : riskProfile.diagnosis?.includes('中度') ? 8 : 3
  riskFactors.push({ name: '认知诊断', impact: diagScore >= 10 ? 'high' : diagScore >= 5 ? 'medium' : 'low', description: riskProfile.diagnosis || '未知', score: diagScore })

  // 共病因子
  const comorbScore = Math.min(20, (riskProfile.comorbidities || []).length * 4)
  if (comorbScore > 0) riskFactors.push({ name: '合并症', impact: comorbScore >= 12 ? 'high' : 'medium', description: (riskProfile.comorbidities || []).join('、'), score: comorbScore })

  // 行为异常因子
  const behavScore = Math.min(15, riskProfile.behaviorAlerts * 3)
  if (behavScore > 0) riskFactors.push({ name: '行为异常', impact: behavScore >= 10 ? 'high' : 'medium', description: `24h ${riskProfile.behaviorAlerts} 次告警`, score: behavScore })

  // 情绪因子
  const moodScore = riskProfile.recentMood === 'depressed' ? 10 : riskProfile.recentMood === 'anxious' ? 6 : 0
  if (moodScore > 0) riskFactors.push({ name: '情绪状态', impact: moodScore >= 8 ? 'medium' : 'low', description: riskProfile.recentMood === 'depressed' ? '抑郁' : '焦虑', score: moodScore })

  // 药物因子
  const medCount = (riskProfile.medications || []).length
  if (medCount >= 4) riskFactors.push({ name: '多重用药', impact: 'medium', description: `服用 ${medCount} 种药物`, score: 8 })

  const totalRisk = riskFactors.reduce((s, f) => s + f.score, 0)

  // 调整衰退速率
  const adjustedSlope = slope - (totalRisk / 100) * 0.5
  const annualDeclineRate = Math.abs(adjustedSlope) * 12

  const predicted6m = Math.max(0, Math.round(currentScore + adjustedSlope * 6))
  const predicted12m = Math.max(0, Math.round(currentScore + adjustedSlope * 12))

  // 风险等级
  let riskLevel: CognitivePrediction['riskLevel'] = 'low'
  if (annualDeclineRate > 10 || predicted12m < 10) riskLevel = 'severe'
  else if (annualDeclineRate > 6 || predicted12m < 15) riskLevel = 'high'
  else if (annualDeclineRate > 3 || predicted12m < 20) riskLevel = 'moderate'

  const riskScore = Math.min(100, Math.round(totalRisk + Math.abs(adjustedSlope) * 10))

  // 趋势数据：历史 + 预测
  const trend = sorted.map((d) => ({ date: d.date, score: d.mmse, label: '实测' }))
  for (let m = 1; m <= 12; m++) {
    const date = new Date()
    date.setMonth(date.getMonth() + m)
    trend.push({ date: date.toISOString().slice(0, 7), score: Math.max(0, Math.round(currentScore + adjustedSlope * m)), label: '预测' })
  }

  // 建议
  const recommendations: string[] = []
  if (annualDeclineRate > 5) recommendations.push('建议每 3 个月复查神经内科')
  if (riskScore > 50) recommendations.push('启动认知康复训练（怀旧疗法、认知刺激）')
  if (riskProfile.recentMood === 'depressed') recommendations.push('评估抗抑郁药物是否需要调整')
  if (medCount >= 4) recommendations.push('建议药师审核多重用药方案')
  recommendations.push('增加社交互动和日常活动')

  return { patientId, patientName, currentScore, predictedScore6m, predictedScore12m, annualDeclineRate, riskLevel, riskScore, trend, riskFactors, recommendations }
}
