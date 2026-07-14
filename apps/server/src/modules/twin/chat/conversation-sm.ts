// 对话状态机 — 场景训练回合制引擎

import { type Scene, type SceneSpeech, getActor, getScene } from './scenarios'
import { scoreSpeech, type ScoreResult } from './scoring-engine'
import { generateSceneReply } from './chat-engine'

export interface SessionState {
  sceneId: string
  roleId: string
  turn: number
  emotion: number       // 0-100
  resistance: number    // 1-5
  taskCompleted: boolean
  history: TurnRecord[]
}

export interface TurnInput {
  actionType?: string
  freeText?: string
}

export interface TurnResult {
  characterSpeech: string       // 角色发言
  nextEmotion: number
  nextResistance: number
  warning: string | null        // 安全警告
  taskCompleted: boolean
  score: ScoreResult | null     // 话术评分
  turn: number
  history: TurnRecord[]
}

export interface TurnRecord {
  turn: number
  userInput: string
  userAction: string
  characterResponse: string
  emotionBefore: number
  emotionAfter: number
  resistanceBefore: number
  resistanceAfter: number
  score: ScoreResult | null
}

const sessions = new Map<string, SessionState>()

function sessionKey(sceneId: string, roleId: string, userId: string): string {
  return `scene:${sceneId}:${roleId}:${userId}`
}

export function startSession(sceneId: string, roleId: string, userId: string): { state: SessionState; context: string } | { error: string } {
  const scene = getScene(sceneId)
  if (!scene) return { error: 'Scene not found' }
  if (!scene.applicableRoles.includes(roleId)) return { error: `Scene not applicable for role "${roleId}"` }

  const key = sessionKey(sceneId, roleId, userId)
  sessions.delete(key)

  const state: SessionState = {
    sceneId, roleId, turn: 0,
    emotion: scene.initialEmotion,
    resistance: scene.initialResistance,
    taskCompleted: false,
    history: [],
  }
  sessions.set(key, state)

  return { state, context: scene.initialContext }
}

function getRandomSpeech(speeches: SceneSpeech[]): SceneSpeech {
  const totalWeight = speeches.reduce((s, sp) => s + (sp.weight ?? 1), 0)
  let r = Math.random() * totalWeight
  for (const sp of speeches) {
    r -= (sp.weight ?? 1)
    if (r <= 0) return sp
  }
  return speeches[0]
}

export async function processTurn(
  sceneId: string, roleId: string, userId: string, input: TurnInput,
): Promise<TurnResult | { error: string }> {
  const scene = getScene(sceneId)
  if (!scene) return { error: 'Scene not found' }

  const actor = getActor(scene, roleId)
  if (!actor) return { error: `Actor "${roleId}" not found in scene` }

  const key = sessionKey(sceneId, roleId, userId)
  const state = sessions.get(key)
  if (!state) return { error: 'No active session. Call startSession first.' }

  // Determine action type and score
  let actionType = input.actionType || 'neutral'
  let score: ScoreResult | null = null

  if (input.freeText) {
    score = scoreSpeech(input.freeText)
    actionType = score.matchedAction || 'neutral'
  } else if (input.actionType) {
    const actionConfig: Record<string, { emotion: number; resistance: number }> = {
      empathy: { emotion: -10, resistance: -1 },
      choice: { emotion: -8, resistance: -1 },
      redirect: { emotion: -6, resistance: 0 },
      guide: { emotion: -4, resistance: -1 },
      retreat: { emotion: -5, resistance: -1 },
      boundary: { emotion: 5, resistance: 0 },
      coax: { emotion: -3, resistance: 0 },
      force: { emotion: 20, resistance: 1 },
    }
    const ac = actionConfig[input.actionType] || { emotion: 0, resistance: 0 }
    score = {
      score: input.actionType === 'empathy' ? 95 : input.actionType === 'choice' ? 85 : input.actionType === 'redirect' ? 75 : input.actionType === 'guide' ? 70 : input.actionType === 'retreat' ? 80 : input.actionType === 'boundary' ? 60 : input.actionType === 'coax' ? 50 : input.actionType === 'force' ? 10 : 50,
      rating: input.actionType === 'empathy' ? '卓越' : input.actionType === 'force' ? '危险' : input.actionType === 'boundary' ? '中性' : '有效',
      feedback: '',
      emotionDelta: ac.emotion, resistanceDelta: ac.resistance,
      matchedAction: input.actionType,
    }
  }

  // 累积状态变化（不再每轮从初始值重算）
  const emotionBefore = state.emotion
  const resistanceBefore = state.resistance

  const emotionDelta = score?.emotionDelta ?? 0
  const resistanceDelta = score?.resistanceDelta ?? 0
  state.emotion = Math.max(0, Math.min(100, state.emotion + emotionDelta))
  state.resistance = Math.max(1, Math.min(5, state.resistance + resistanceDelta))

  // LLM 生成角色发言
  const actionLabel = input.actionType
    ? ({ empathy: '共情安抚', choice: '给予选择', redirect: '转移注意', guide: '温柔引导', retreat: '退让一步', boundary: '设定边界', coax: '哄骗诱导', force: '严肃制止' } as Record<string, string>)[input.actionType] || input.actionType
    : '自由文本'
  const sceneName = scene.name
  const characterSpeech = await generateSceneReply(roleId, sceneName, scene.initialContext, state.emotion, state.resistance, actionLabel)

  // 回退：LLM 失败用 speech pool
  const finalSpeech = characterSpeech || (() => {
    const poolMap: Record<string, string> = {
      empathy: 'retreat_redirect', choice: 'retreat_indirect', redirect: 'retreat_redirect',
      guide: 'retreat_indirect', retreat: 'retreat_indirect', boundary: 'force',
      coax: 'retreat_indirect', force: 'force',
    }
    const speechKey = poolMap[actionType] || 'neutral'
    const speeches = actor.speeches[speechKey as 'force' | 'retreat_redirect' | 'retreat_indirect' | 'neutral'] || actor.speeches['neutral'] || [{ text: '……', emotionDelta: 0, resistanceDelta: 0 }]
    return getRandomSpeech(speeches).text
  })()

  // Check if task completed (resistance <= 1 or emotion <= 20)
  const taskCompleted = state.resistance <= 1 || state.emotion <= 20
  if (taskCompleted) state.taskCompleted = true

  state.turn++

  const record: TurnRecord = {
    turn: state.turn,
    userInput: input.freeText || input.actionType || 'neutral',
    userAction: actionType,
    characterResponse: finalSpeech,
    emotionBefore, emotionAfter: state.emotion,
    resistanceBefore, resistanceAfter: state.resistance,
    score,
  }
  state.history.push(record)
  sessions.set(key, state)

  const warning = state.emotion >= 90 ? `⚠ 安全警告：情绪值 ${state.emotion}，已达危险水平` :
    state.resistance >= 5 ? `⚠ 安全警告：抗拒等级 ${state.resistance}，已达最高` : null

  return {
    characterSpeech: finalSpeech,
    nextEmotion: state.emotion,
    nextResistance: state.resistance,
    warning,
    taskCompleted,
    score,
    turn: state.turn,
    history: state.history,
  }
}

export function getSession(sceneId: string, roleId: string, userId: string): SessionState | null {
  return sessions.get(sessionKey(sceneId, roleId, userId)) ?? null
}
