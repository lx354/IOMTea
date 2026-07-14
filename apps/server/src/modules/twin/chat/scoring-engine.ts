// 话术评分器 — 对用户输入输出 0-100 分 + 等级 + 反馈

export type ScoreRating = '卓越' | '有效' | '中性' | '低效' | '危险'

export interface ScoreResult {
  score: number
  rating: ScoreRating
  feedback: string
  emotionDelta: number
  resistanceDelta: number
  matchedAction: string
}

interface Rule {
  keywords: string[]         // 匹配关键词（任一命中）
  antiKeywords?: string[]    // 排除关键词（命中则跳过）
  score: number              // 0-100
  rating: ScoreRating
  feedback: string
  action: string             // 对应的动作类型
  emotionDelta: number
  resistanceDelta: number
}

const RULES: Rule[] = [
  // ── 卓越 (90-100) ──
  { keywords: ['不换了', '先吃', '先喝', '回头再'], score: 95, rating: '卓越', feedback: '退让+自然转移，给出替代方案，非常专业', action: 'retreat_redirect', emotionDelta: -12, resistanceDelta: -2 },
  { keywords: ['你喜欢', '你自己选', '你想先', '你决定'], score: 92, rating: '卓越', feedback: '赋予选择权，维护老人尊严，策略精准', action: 'retreat_indirect', emotionDelta: -8, resistanceDelta: -2 },
  { keywords: ['好，不', '那就不', '听你的'], antiKeywords: ['随你便','不管了'], score: 90, rating: '卓越', feedback: '迅速止步不硬顶，先建立信任再找机会', action: 'retreat_redirect', emotionDelta: -10, resistanceDelta: -1 },

  // ── 有效 (70-89) ──
  { keywords: ['帮您','帮个线头','剪个', '只是', '就一点点'], score: 85, rating: '有效', feedback: '化整为零——以小事为由间接完成任务', action: 'retreat_indirect', emotionDelta: -5, resistanceDelta: -1 },
  { keywords: ['放在这里', '放这儿', '您想换的时候'], score: 80, rating: '有效', feedback: '给老人控制权，不强迫，好策略', action: 'retreat_indirect', emotionDelta: -4, resistanceDelta: -1 },
  { keywords: ['说好了', '等十分钟', '再五分钟', '过一会儿'], score: 78, rating: '有效', feedback: '设定明确但不紧迫的时间边界，减少对抗', action: 'retreat_redirect', emotionDelta: -3, resistanceDelta: -1 },
  { keywords: ['陪您', '我陪你', '跟您一起', '我们一块'], score: 76, rating: '有效', feedback: '陪伴式邀约降低了对抗感', action: 'retreat_redirect', emotionDelta: -4, resistanceDelta: -1 },
  { keywords: ['您看', '您觉得', '您怎么看', '您觉得呢'], score: 74, rating: '有效', feedback: '把决定权交给老人，降低权威压迫感', action: 'retreat_indirect', emotionDelta: -3, resistanceDelta: -1 },
  { keywords: ['先试试', '试一下', '尝一口', '看一眼'], score: 72, rating: '有效', feedback: '降低门槛，先让老人迈出一小步', action: 'retreat_indirect', emotionDelta: -3, resistanceDelta: -1 },

  // ── 中性 (50-69) ──
  { keywords: ['放这里', '自己', '随便', '您想'], score: 65, rating: '中性', feedback: '未主动对抗，提供自主权——但不主动引导', action: 'neutral', emotionDelta: 0, resistanceDelta: 0 },
  { keywords: ['好吧', '懂了', '好，我', '知道了'], score: 60, rating: '中性', feedback: '被动接受，没有推进任务，但没激化矛盾', action: 'neutral', emotionDelta: 0, resistanceDelta: 0 },
  { keywords: ['医生', '血压', '身体', '不健康'], score: 55, rating: '中性', feedback: '讲道理—对认知正常者有效，对认知障碍者效果有限', action: 'neutral', emotionDelta: 0, resistanceDelta: 0 },
  { keywords: ['吃饭了', '该吃了', '该睡了', '该洗了','时间到了'], score: 50, rating: '中性', feedback: '陈述事实，不带感情，不激化也不改善', action: 'neutral', emotionDelta: 0, resistanceDelta: 0 },

  // ── 低效 (30-49) ──
  { keywords: ['不够', '怎么这么', '为什么', '还要我说'], antiKeywords: ['为什么不', '怎么不吃'], score: 40, rating: '低效', feedback: '含有评判语气的追问，容易触发防卫心理', action: 'taboo', emotionDelta: 5, resistanceDelta: 0 },
  { keywords: ['讲道理', '你该', '你应该', '你必须', '规定'], score: 35, rating: '低效', feedback: '命令式表达，对认知障碍者是高危话术', action: 'taboo', emotionDelta: 7, resistanceDelta: 0 },
  { keywords: ['其他人', '别人','别的老人','你看那个'], score: 30, rating: '低效', feedback: '横向比较会伤害老人自尊', action: 'taboo', emotionDelta: 5, resistanceDelta: 0 },

  // ── 危险 (0-29) ──
  { keywords: ['不管你了', '随便你'], score: 20, rating: '危险', feedback: '放弃式话术，触发分离恐惧——最危险的回应之一', action: 'force', emotionDelta: 18, resistanceDelta: 2 },
  { keywords: ['疯', '傻', '有病', '不正常','神经病','精神病', '痴呆', '老年痴呆'], score: 10, rating: '危险', feedback: '侮辱性话术，摧毁信任，瞬间触发极限对抗', action: 'force', emotionDelta: 25, resistanceDelta: 3 },
  { keywords: ['再闹', '再叫', '你试试'], score: 8, rating: '危险', feedback: '威胁/挑衅性语言，加速攻击行为爆发', action: 'force', emotionDelta: 22, resistanceDelta: 2 },
  { keywords: ['叫你别', '不准', '不许动', '别碰', '别动'], score: 5, rating: '危险', feedback: '禁止式话术剥夺控制感，强制权力对抗', action: 'force', emotionDelta: 20, resistanceDelta: 2 },
  { keywords: ['你清醒点', '你现实点', '你想想清楚'], score: 3, rating: '危险', feedback: '否定老人的主观认知，对认知障碍者最具伤害性的语言', action: 'taboo', emotionDelta: 18, resistanceDelta: 1 },
  { keywords: ['骗你', '骗你的', '骗老人','欺骗', '骗'], score: 2, rating: '危险', feedback: '欺骗被揭穿时信任崩塌不可修复', action: 'force', emotionDelta: 28, resistanceDelta: 3 },
]

export function scoreSpeech(speech: string): ScoreResult {
  const lower = speech.toLowerCase()

  for (const rule of RULES) {
    if (rule.antiKeywords?.some((k) => lower.includes(k))) continue
    if (rule.keywords.some((k) => lower.includes(k))) {
      return {
        score: rule.score,
        rating: rule.rating,
        feedback: rule.feedback,
        emotionDelta: rule.emotionDelta,
        resistanceDelta: rule.resistanceDelta,
        matchedAction: rule.action,
      }
    }
  }

  return {
    score: 50, rating: '中性',
    feedback: '未识别特定话术—按中性处理',
    emotionDelta: 0, resistanceDelta: 0,
    matchedAction: 'neutral',
  }
}
