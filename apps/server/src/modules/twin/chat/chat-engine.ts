import { createChildLogger } from '../../../core/lib/logger'
import { type ChatProfile, getChatProfile } from './chat-profiles'

const logger = createChildLogger('chat-engine')

interface ChatMessage { role: 'user' | 'assistant' | 'system'; content: string }
interface ChatResponse { reply: string; emotion: number; resistance: number; assessment: null }
interface SessionCtx { phase: string; phaseEmotion: number; turn: number; topics: string[]; emotion: number; resistance: number }

const sessions = new Map<string, SessionCtx>()

// ── 时间感知 ──

function getPhase(hour: number): { id: string; label: string; category: string; desc: string } {
  if (hour >= 6 && hour < 8) return { id: 'morning_wake', label: '晨起', category: 'R-01', desc: '刚醒来，正在起床穿衣，照护者帮忙洗漱' }
  if (hour >= 8 && hour < 11) return { id: 'morning_meal', label: '早餐时间', category: 'R-02', desc: '正在吃早餐或早餐刚结束，照护者提醒服药' }
  if (hour >= 11 && hour < 13) return { id: 'lunch', label: '午餐时间', category: 'R-02', desc: '午餐时间，照护者端来饭菜，需要老人进食' }
  if (hour >= 13 && hour < 15) return { id: 'afternoon_rest', label: '午休', category: 'R-04', desc: '午休时间，老人应该小睡或安静休息' }
  if (hour >= 15 && hour < 17) return { id: 'afternoon_act', label: '活动时间', category: 'L-01', desc: '下午活动时间，可以做简单活动或在走廊散步' }
  if (hour >= 17 && hour < 19) return { id: 'dusk', label: '傍晚', category: 'C-03', desc: '日落时分，认知障碍症状常加重——日落综合征高发时段' }
  if (hour >= 19 && hour < 21) return { id: 'evening', label: '晚餐', category: 'R-02', desc: '晚餐时间，饭后需要吃药' }
  if (hour >= 21) return { id: 'bedtime', label: '就寝', category: 'R-04', desc: '该睡觉了，照护者帮助老人上床、关灯' }
  return { id: 'night', label: '深夜', category: 'R-04', desc: '深夜，老人不应起床，如果有游走行为需要安抚回到床上' }
}

function getPhaseEmotionBoost(phase: string, circadian: string): number {
  if (circadian.includes('日落加重') && phase === 'dusk') return 15
  if (circadian.includes('夜间最重') && phase === 'bedtime') return 10
  if (circadian.includes('午后开始焦躁') && phase === 'afternoon_act') return 8
  if (circadian.includes('白天兴奋') && phase === 'afternoon_act') return -5
  return 0
}

// ── 系统提示构建 ──

function pickRelevantCorpus(profile: ChatProfile, userMessage: string, phaseCategory: string): string[] {
  const corpus = profile.dailyCorpus
  if (!corpus?.length) return []

  const lower = userMessage
  const scored = corpus.map((e) => {
    let score = 0
    if (e.category === phaseCategory) score += 10  // 匹配当前时段
    for (const ch of e.contextHint) { if (lower.includes(ch)) score++ }  // 上下文关键词命中
    for (const ch of e.text) { if (lower.includes(ch)) score++ }  // 语料文本关键词命中
    return { text: e.text, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const seen = new Set<string>()
  const top: string[] = []
  for (const s of scored) {
    if (s.score < 3 || top.length >= 3) break
    if (seen.has(s.text.slice(0, 20))) continue
    seen.add(s.text.slice(0, 20))
    top.push(s.text)
  }
  return top
}

function buildSystemPrompt(profile: ChatProfile, sessionId: string, _userMessage: string, vitals: Record<string, unknown>): string {
  const now = new Date()
  const hour = now.getHours()
  const phase = getPhase(hour)

  const ctx = getSessionCtx(sessionId)
  ctx.phase = phase.id

  const emotionBoost = getPhaseEmotionBoost(phase.id, profile.circadian)
  const emotionHint = emotionBoost > 10 ? '症状明显加重。' : emotionBoost > 0 ? '症状轻度加重。' : ''

  const triggerText = (vitals.triggers as string[])?.length
    ? `当前被触发的因素：${(vitals.triggers as string[]).join('、')}。对这些话题特别敏感。` : ''
  const stateText = vitals.emotion != null
    ? `你目前情绪值${vitals.emotion}/100，抗拒等级${vitals.resistance}/5。${(vitals.emotion as number) >= 80 ? '你现在非常暴躁。' : (vitals.emotion as number) >= 50 ? '你心情不太好。' : '你目前还算平静。'}${triggerText}`
    : ''

  return `你是${profile.displayName}，${profile.age}岁${profile.gender}，${profile.primaryType}。
${profile.backgroundTrait.slice(0, 60)}。
${stateText ? stateText + '\n' : ''}你经常说的话：${profile.commonPhrases.join('、')}。
现在是${now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}，${phase.label}。${emotionHint}
你现在就是${profile.displayName}本人。请以他/她的口吻直接回答用户的问题。不要介绍自己，不要解释，直接说话。`
}

// ── 会话上下文 ──

function getSessionCtx(sessionId: string): SessionCtx {
  if (!sessions.has(sessionId)) sessions.set(sessionId, { phase: '', phaseEmotion: 0, turn: 0, topics: [], emotion: 50, resistance: 3 })
  return sessions.get(sessionId)!
}

function trackContext(sessionId: string, userMsg: string, reply: string) {
  const ctx = getSessionCtx(sessionId)
  ctx.turn++
  const topicWords = userMsg.slice(0, 10)
  if (!ctx.topics.includes(topicWords)) {
    ctx.topics.push(topicWords)
    if (ctx.topics.length > 20) ctx.topics.shift()
  }
  updateEmotion(ctx, userMsg, reply)
}

function updateEmotion(ctx: SessionCtx, userMsg: string, reply: string) {
  // 触发词 → 情绪上升
  for (const t of ['洗澡','换衣服','吃药','吃饭','睡觉','厕所','出去','别动','快来','不行']) {
    if (userMsg.includes(t)) ctx.emotion = Math.min(100, ctx.emotion + 3)
  }
  // 威胁/命令 → 抗拒上升
  for (const t of ['必须','快点','不准','不许','别动','马上']) {
    if (userMsg.includes(t)) ctx.resistance = Math.min(5, ctx.resistance + 1)
  }
  // 温和/退让 → 抗拒下降
  for (const t of ['不急','慢慢','你喜欢','随便','等会儿']) {
    if (userMsg.includes(t)) ctx.resistance = Math.max(1, ctx.resistance - 1)
  }
  // LLM 回复中的抵抗语言 → 抗拒反映
  for (const t of ['不吃','不喝','不洗','不去','不要','滚','走开']) {
    if (reply.includes(t)) ctx.emotion = Math.min(100, ctx.emotion + 2)
  }
  // 时间自然消退
  ctx.emotion = Math.max(0, ctx.emotion - 1)
}

// ── LLM 调用 ──

async function callLLM(messages: ChatMessage[]): Promise<string | null> {
  const apiKey = process.env.LLM_API_KEY || ''
  if (!apiKey) { logger.warn('LLM_API_KEY 未配置（仍为占位符），使用内置语料库回复'); return null }
  const baseUrl = process.env.LLM_BASE_URL || 'https://api.openai.com/v1'
  const model = process.env.LLM_MODEL || 'gpt-4o-mini'
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 200 }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const data = await res.json() as { choices: Array<{ message: { content: string } }> }
    return data.choices?.[0]?.message?.content || null
  } catch { return null }
}

// ── 主入口 ──

export async function sendChatMessage(
  patientId: string, _patientName: string, caseId: string,
  vitals: Record<string, unknown>,
  history: ChatMessage[], userMessage: string,
): Promise<ChatResponse> {
  const profile = getChatProfile(caseId)
  if (!profile) return { reply: '（认知档案不可用）', emotion: 50, resistance: 3, assessment: null }

  const sessionId = `${caseId}:${patientId}`
  const ctx = getSessionCtx(sessionId)
  if (ctx.turn === 0) {
    ctx.emotion = (vitals.emotion as number) ?? profile.simulation.initialMood
    ctx.resistance = (vitals.resistance as number) ?? profile.simulation.initialResistance
    ctx.phaseEmotion = (vitals.trust as number) ?? profile.simulation.initialTrust
  }
  // 每轮更新状态
  if (vitals.emotion != null) ctx.emotion = vitals.emotion as number
  if (vitals.resistance != null) ctx.resistance = vitals.resistance as number
  if (vitals.triggers) {
    ctx.topics = [...(vitals.triggers as string[])]
  }

  // 直接调用 LLM
  const sysPrompt = buildSystemPrompt(profile, sessionId, userMessage, vitals)
  const messages: ChatMessage[] = [
    { role: 'system', content: sysPrompt },
    { role: 'user', content: userMessage },
  ]
  const llmReply = await callLLM(messages)
  const reply = llmReply || pickRandom(profile.commonPhrases) || '嗯。'
  if (llmReply) logger.info({ userMessage, reply: reply.slice(0, 80) }, 'DeepSeek 回复')

  trackContext(sessionId, userMessage, reply)
  return { reply, emotion: ctx.emotion, resistance: ctx.resistance, assessment: null }
}

// ── 场景训练回复生成 ──

export async function generateSceneReply(
  caseId: string, sceneName: string, context: string,
  emotion: number, resistance: number, actionLabel: string,
): Promise<string> {
  const profile = getChatProfile(caseId)
  if (!profile) return '……'

  const prompt = `你是${profile.displayName}，${profile.age}岁${profile.gender}，${profile.primaryType}。
${profile.backgroundTrait.slice(0, 80)}。
当前场景：${sceneName}。${context}
你目前情绪值${emotion}/100，抗拒等级${resistance}/5。
照护者对你采取了【${actionLabel}】。
请以${profile.displayName}的口吻直接回答1-2句话。不要介绍自己，不要解释。`

  const messages: ChatMessage[] = [
    { role: 'system', content: prompt },
    { role: 'user', content: '请回答' },
  ]
  const reply = await callLLM(messages)
  return reply || pickRandom(profile.commonPhrases) || '……'
}

// ── 上下文感知语料匹配 ──

function matchCorpus(profile: ChatProfile, msg: string, sessionId: string): string | null {
  const corpus = profile.dailyCorpus
  if (!corpus?.length) return null

  const hour = new Date().getHours()
  const phase = getPhase(hour)
  const lower = msg

  // 1. 精确匹配（用户消息包含上下文提示词）
  const phaseMatch = (corpus as Array<{ text: string; contextHint: string; category: string }>).filter((e) => e.category === phase.category)
  for (const e of corpus as Array<{ text: string; contextHint: string; category: string }>) {
    const hint = e.contextHint.replace(/[（）：]/g, '').slice(0, 4)
    if (hint.length >= 2 && lower.includes(hint)) return e.text
  }

  // 2. 主题分类匹配
  if (/吃|饭|饿|菜|粥|喂|用餐/.test(lower)) {
    const r = pickRand((corpus as Array<{ text: string; category: string }>).filter((e) => e.category === 'R-02'))
    if (r) return r.text
  }
  if (/起|床|晨|醒/.test(lower)) {
    const r = pickRand((corpus as Array<{ text: string; category: string }>).filter((e) => e.category === 'R-01'))
    if (r) return r.text
  }
  if (/睡|关灯|夜|就寝/.test(lower)) {
    const r = pickRand((corpus as Array<{ text: string; category: string }>).filter((e) => e.category === 'R-04'))
    if (r) return r.text
  }
  if (/药|片|服/.test(lower)) {
    const cats = ['M-01', 'M-02', 'M-03']
    const r = pickRand((corpus as Array<{ text: string; category: string }>).filter((e) => cats.includes(e.category)))
    if (r) return r.text
  }
  if (/洗|澡|浴/.test(lower)) {
    const r = pickRand((corpus as Array<{ text: string; category: string }>).filter((e) => e.category === 'P-01' || e.category === 'P-02'))
    if (r) return r.text
  }
  if (/衣服|穿|换|外套/.test(lower)) {
    const r = pickRand((corpus as Array<{ text: string; category: string }>).filter((e) => e.category === 'C-01'))
    if (r) return r.text
  }

  // 3. 返回当前时段的随机语料
  if (phaseMatch.length > 0) {
    return phaseMatch[Math.floor(Math.random() * phaseMatch.length)].text
  }

  return pickRand(corpus as Array<{ text: string }>)?.text || null
}

function pickRand<T extends { text: string }>(arr: T[]): T | undefined {
  if (!arr?.length) return undefined
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickRandom(arr: string[]): string | undefined {
  if (!arr?.length) return undefined
  return arr[Math.floor(Math.random() * arr.length)]
}
