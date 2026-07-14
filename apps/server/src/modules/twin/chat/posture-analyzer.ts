// 姿态分析计算引擎 — 基于 17 COCO 关键点的纯数学计算
// 零外部依赖，0ms 额外推理延迟

export interface PostureKeypoints {
  nose?: [number, number]; left_eye?: [number, number]; right_eye?: [number, number]
  left_ear?: [number, number]; right_ear?: [number, number]
  left_shoulder?: [number, number]; right_shoulder?: [number, number]
  left_elbow?: [number, number]; right_elbow?: [number, number]
  left_wrist?: [number, number]; right_wrist?: [number, number]
  left_hip?: [number, number]; right_hip?: [number, number]
  left_knee?: [number, number]; right_knee?: [number, number]
  left_ankle?: [number, number]; right_ankle?: [number, number]
}

export interface PostureMetric {
  label: string
  value: number
  unit: string
  score: number  // 0-100, higher = better
  status: 'normal' | 'watch' | 'warning'
  description: string
}

export interface PostureReport {
  metrics: PostureMetric[]
  overallScore: number
  overallStatus: 'normal' | 'watch' | 'warning'
  risks: string[]
  advice: string[]
}

function get(p: PostureKeypoints, name: string): [number, number] | null {
  const v = (p as any)[name]
  if (!v || (v[0] === 0 && v[1] === 0)) return null
  return v as [number, number]
}

function midpoint(a: [number, number], b: [number, number]): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}

function distance(a: [number, number], b: [number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)
}

function angle(p1: [number, number], p2: [number, number], p3: [number, number]): number {
  const v1 = [p1[0] - p2[0], p1[1] - p2[1]]
  const v2 = [p3[0] - p2[0], p3[1] - p2[1]]
  const dot = v1[0] * v2[0] + v1[1] * v2[1]
  const m1 = Math.sqrt(v1[0] ** 2 + v1[1] ** 2)
  const m2 = Math.sqrt(v2[0] ** 2 + v2[1] ** 2)
  return (Math.acos(dot / (m1 * m2)) * 180) / Math.PI
}

// ── 各指标计算 ──

function calcHunchback(p: PostureKeypoints): PostureMetric | null {
  const nose = get(p, 'nose')
  const lsh = get(p, 'left_shoulder')
  const rsh = get(p, 'right_shoulder')
  if (!nose || !lsh || !rsh) return null
  const shMid = midpoint(lsh, rsh)
  const ratio = nose[1] / shMid[1]
  const normal = 0.35
  const score = Math.max(0, Math.min(100, 100 - Math.abs(ratio - normal) * 200))
  return {
    label: '驼背指数', value: +ratio.toFixed(3), unit: '鼻/肩比',
    score: +score.toFixed(0),
    status: ratio < 0.25 ? 'warning' : ratio < 0.3 ? 'watch' : 'normal',
    description: ratio < 0.25 ? '驼背明显，脊柱弯曲度过大' : ratio < 0.3 ? '轻微驼背，建议进行体态训练' : '姿态正常',
  }
}

function calcShoulderLevel(p: PostureKeypoints): PostureMetric | null {
  const lsh = get(p, 'left_shoulder')
  const rsh = get(p, 'right_shoulder')
  if (!lsh || !rsh) return null
  const diff = Math.abs(lsh[1] - rsh[1])
  const score = Math.max(0, 100 - diff * 1000)
  return {
    label: '肩部水平度', value: +diff.toFixed(4), unit: 'y差',
    score: +score.toFixed(0),
    status: diff > 0.06 ? 'warning' : diff > 0.03 ? 'watch' : 'normal',
    description: diff > 0.06 ? '高低肩明显，可能与脊柱侧弯有关' : diff > 0.03 ? '轻微高低肩' : '肩部水平正常',
  }
}

function calcSpineCurvature(p: PostureKeypoints): PostureMetric | null {
  const lsh = get(p, 'left_shoulder')
  const rsh = get(p, 'right_shoulder')
  const lhip = get(p, 'left_hip')
  const rhip = get(p, 'right_hip')
  const lknee = get(p, 'left_knee')
  const rknee = get(p, 'right_knee')
  if (!lsh || !rsh || !lhip || !rhip || !lknee || !rknee) return null
  const shMid = midpoint(lsh, rsh)
  const hipMid = midpoint(lhip, rhip)
  const kneeMid = midpoint(lknee, rknee)
  const a = angle(shMid, hipMid, kneeMid)
  const normal = 175  // nearly straight
  const score = Math.max(0, 100 - Math.abs(a - normal) * 2)
  return {
    label: '脊柱曲率', value: +a.toFixed(1), unit: '°',
    score: +score.toFixed(0),
    status: a < 140 ? 'warning' : a < 160 ? 'watch' : 'normal',
    description: a < 140 ? '脊柱严重弯曲' : a < 160 ? '脊柱轻微弯曲' : '脊柱直立正常',
  }
}

function calcHeadTilt(p: PostureKeypoints): PostureMetric | null {
  const nose = get(p, 'nose')
  const lsh = get(p, 'left_shoulder')
  const rsh = get(p, 'right_shoulder')
  if (!nose || !lsh || !rsh) return null
  const shMid = midpoint(lsh, rsh)
  const dx = nose[0] - shMid[0]
  const dy = nose[1] - shMid[1]
  const tilt = (Math.atan2(dx, -dy) * 180) / Math.PI
  const score = Math.max(0, 100 - Math.abs(tilt) * 5)
  return {
    label: '头部倾斜', value: +tilt.toFixed(1), unit: '°',
    score: +score.toFixed(0),
    status: Math.abs(tilt) > 15 ? 'warning' : Math.abs(tilt) > 8 ? 'watch' : 'normal',
    description: Math.abs(tilt) > 15 ? '头部严重偏斜' : Math.abs(tilt) > 8 ? '头部轻微偏斜' : '头部位置正常',
  }
}

function calcCOGOffset(p: PostureKeypoints): PostureMetric | null {
  const lhip = get(p, 'left_hip')
  const rhip = get(p, 'right_hip')
  const lank = get(p, 'left_ankle')
  const rank = get(p, 'right_ankle')
  if (!lhip || !rhip || !lank || !rank) return null
  const hipMid = midpoint(lhip, rhip)
  const ankMid = midpoint(lank, rank)
  const offset = Math.abs(hipMid[0] - ankMid[0])
  const score = Math.max(0, 100 - offset * 500)
  return {
    label: '重心偏移', value: +offset.toFixed(4), unit: 'x偏移',
    score: +score.toFixed(0),
    status: offset > 0.15 ? 'warning' : offset > 0.08 ? 'watch' : 'normal',
    description: offset > 0.15 ? '重心严重偏移，跌倒风险高' : offset > 0.08 ? '重心轻微偏移' : '重心平衡正常',
  }
}

// ── 主入口 ──

export function analyzePosture(keypoints: PostureKeypoints): PostureReport {
  const calculators = [calcHunchback, calcShoulderLevel, calcSpineCurvature, calcHeadTilt, calcCOGOffset]
  const metrics: PostureMetric[] = []
  const risks: string[] = []
  const advice: string[] = []

  for (const calc of calculators) {
    const m = calc(keypoints)
    if (m) {
      metrics.push(m)
      if (m.status === 'warning') {
        risks.push(`${m.label}: ${m.description}`)
        if (m.label === '驼背指数') advice.push('建议进行脊柱拉伸训练，佩戴背带辅助纠正')
        if (m.label === '肩部水平度') advice.push('建议物理治疗评估是否有脊柱侧弯')
        if (m.label === '重心偏移') advice.push('⚠ 高跌倒风险！建议使用助行器并移除地面障碍')
        if (m.label === '头部倾斜') advice.push('建议检查颈椎，排除神经压迫')
      }
    }
  }

  if (metrics.length === 0) {
    return { metrics: [], overallScore: 0, overallStatus: 'normal', risks: [], advice: [] }
  }

  const overallScore = Math.round(metrics.reduce((s, m) => s + m.score, 0) / metrics.length)
  const warningCount = metrics.filter((m) => m.status === 'warning').length
  const overallStatus: PostureReport['overallStatus'] =
    warningCount >= 2 ? 'warning' : warningCount >= 1 ? 'watch' : 'normal'

  // 去重 advice
  const uniqueAdvice = [...new Set(advice)]

  return { metrics, overallScore, overallStatus, risks, advice: uniqueAdvice }
}
