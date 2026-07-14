import { getChatProfile } from '../twin/chat/chat-profiles'

export type SuggestionCategory = 'safety' | 'health' | 'cognitive' | 'daily' | 'emotional'
export type SuggestionPriority = 'emergency' | 'important' | 'normal' | 'reference'

export interface PatientData {
  patientId: string; patientName: string; profileId?: string
  latestVitals: Record<string, number>
  recentBehaviors: string[]
  lastChatMmse?: number; lastChatMood?: string
  fallEvents24h: number
  timeSinceLastActivity: number
  emotionTrend: 'rising' | 'stable' | 'falling'
}

export interface Suggestion {
  id: string; patientId: string; timestamp: string
  category: SuggestionCategory; priority: SuggestionPriority
  summary: string; detail: string; basis: string[]
  validityHours: number; expectedEffect: string
  targetRoles: string[]; status: 'active' | 'expired' | 'adopted' | 'dismissed'
}

interface Rule {
  id: string; category: SuggestionCategory; priority: SuggestionPriority
  condition: (d: PatientData) => boolean
  summary: (d: PatientData) => string; detail: (d: PatientData) => string
  basis: (d: PatientData) => string[]
  validityHours: number; expectedEffect: string; targetRoles: string[]
}

const RULES: Rule[] = [
  { id: 'fall_risk', category: 'safety', priority: 'emergency',
    condition: (d) => d.fallEvents24h >= 1 || d.recentBehaviors.includes('falling'),
    summary: () => '⚠跌倒高风险—建议立即检查居住环境',
    detail: (d) => `${d.patientName}有跌倒风险。建议: ①移除地面杂物 ②加装扶手 ③留夜灯 ④穿防滑袜。`,
    basis: (d) => [`跌倒24h: ${d.fallEvents24h}次`, `行为: ${d.recentBehaviors.join(',')}`],
    validityHours: 24, expectedEffect: '降低70%复发跌倒风险', targetRoles: ['家属', '护工'],
  },
  { id: 'wandering_risk', category: 'safety', priority: 'emergency',
    condition: (d) => d.recentBehaviors.includes('wandering') || d.timeSinceLastActivity > 180,
    summary: () => '⚠游走风险—老人可能试图离开安全区域',
    detail: (d) => `${d.patientName}出现游走迹象。建议: ①确认门禁激活 ②佩戴GPS ③定时走廊陪伴散步 ④挂提醒牌。`,
    basis: (d) => [`行为: ${d.recentBehaviors.join(',')}`, `距活动: ${Math.floor(d.timeSinceLastActivity / 60)}h`],
    validityHours: 12, expectedEffect: '防止走失确保安全', targetRoles: ['家属', '护工'],
  },
  { id: 'vital_alert', category: 'health', priority: 'important',
    condition: (d) => { const hr = d.latestVitals['heart_rate']; const sp = d.latestVitals['spo2']; return (hr != null && (hr > 120 || hr < 50)) || (sp != null && sp < 92) },
    summary: (d) => { const hr = d.latestVitals['heart_rate']; if (hr && hr > 120) return `🔴心率过高${hr}bpm—建议通知医生`; if (hr && hr < 50) return `🔴心率过低${hr}bpm—立即检查`; return `🟠血氧偏低—建议吸氧` },
    detail: (d) => `${d.patientName}生命体征异常。建议: ①记录1h活动 ②持续异常联系医生 ③保持平卧。`,
    basis: (d) => [`心率: ${d.latestVitals['heart_rate']}`, `血氧: ${d.latestVitals['spo2']}`],
    validityHours: 4, expectedEffect: '早期发现心肺问题', targetRoles: ['护工', '医生'],
  },
  { id: 'cognitive_decline', category: 'cognitive', priority: 'important',
    condition: (d) => (d.lastChatMmse ?? 30) < 18,
    summary: () => '🧠认知评估下降—建议安排专业筛查',
    detail: (d) => `${d.patientName}MMSE等效分${d.lastChatMmse}/30。建议: ①预约神经内科 ②增加认知训练 ③记录行为日志。`,
    basis: (d) => [`MMSE: ${d.lastChatMmse}/30`],
    validityHours: 72, expectedEffect: '及时干预延缓衰退', targetRoles: ['家属', '医生'],
  },
  { id: 'mood_support', category: 'emotional', priority: 'normal',
    condition: (d) => d.lastChatMood === 'depressed' || d.lastChatMood === 'anxious',
    summary: (d) => d.lastChatMood === 'depressed' ? '💙情绪低落—建议增加陪伴' : '💛焦虑情绪—建议安抚',
    detail: (d) => `${d.patientName}${d.lastChatMood === 'depressed' ? '情绪低落' : '焦虑'}。建议: ①每日30min陪伴 ②播放喜爱音乐 ③简单社交 ④避免触发话题。`,
    basis: (d) => [`情绪: ${d.lastChatMood}`],
    validityHours: 24, expectedEffect: '改善情绪减少焦躁', targetRoles: ['家属', '护工'],
  },
  { id: 'medication', category: 'daily', priority: 'normal',
    condition: (d) => d.timeSinceLastActivity > 180,
    summary: () => '💊用药提醒—该服药了',
    detail: (d) => `${d.patientName}距上次活动超3h。建议按时服药并记录。`,
    basis: (d) => [`距活动: ${Math.floor(d.timeSinceLastActivity / 60)}h`],
    validityHours: 2, expectedEffect: '保证用药依从性', targetRoles: ['护工'],
  },
  { id: 'activity', category: 'daily', priority: 'reference',
    condition: (d) => d.timeSinceLastActivity > 120,
    summary: () => '🚶活动建议—适当轻度运动',
    detail: (d) => `${d.patientName}已静坐超2h。建议室内慢走5-10min或晒太阳。`,
    basis: (d) => [`距活动: ${Math.floor(d.timeSinceLastActivity / 60)}h`],
    validityHours: 4, expectedEffect: '促进循环改善心情', targetRoles: ['护工'],
  },
]

export function generateSuggestions(data: PatientData): Suggestion[] {
  const suggestions: Suggestion[] = []
  const profile = data.profileId ? getChatProfile(data.profileId) : null

  for (const rule of RULES) {
    if (rule.condition(data)) {
      const ts = new Date().toISOString()
      suggestions.push({
        id: `sug-${rule.id}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        patientId: data.patientId, timestamp: ts,
        category: rule.category, priority: rule.priority,
        summary: rule.summary(data), detail: rule.detail(data),
        basis: rule.basis(data), validityHours: rule.validityHours,
        expectedEffect: rule.expectedEffect, targetRoles: rule.targetRoles,
        status: 'active',
      })
    }
  }

  if (profile && suggestions.length > 0) {
    for (const s of suggestions) {
      s.detail += `\n个性提示: ${profile.displayName}${profile.triggers?.[0] ? `对"${profile.triggers[0]}"敏感` : ''}。`
    }
  }

  return suggestions
}
