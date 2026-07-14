import fs from 'node:fs'
import path from 'node:path'
import { createChildLogger } from '../../../core/lib/logger'

let ort: any = null
async function loadOrt() {
  if (ort) return true
  try { ort = await import('onnxruntime-node'); return true }
  catch { return false }
}

const logger = createChildLogger('behavior-predictor')

const N_KEYPOINTS = 17
const BEHAVIORS = ['standing', 'sitting', 'lying', 'walking', 'falling', 'sitting_up', 'wandering']
const BEHAVIOR_LABELS: Record<string, string> = {
  standing: '站立', sitting: '坐', lying: '躺',
  walking: '行走', falling: '跌倒', sitting_up: '起身', wandering: '徘徊',
}

const KEYPOINT_ORDER = [
  'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
  'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
  'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
]

interface ScalerConfig { mean: number[]; scale: number[]; n_keypoints: number }
export interface PoseKeypoints { [name: string]: [number, number] }
export interface BehaviorResult { behavior: string; label: string; confidence: number; allScores: Record<string, number> }

let session: ort.InferenceSession | null = null
let scalerMean: number[]
let scalerScale: number[]
let ready = false

export async function initBehaviorPredictor(): Promise<boolean> {
  try {
    if (!(await loadOrt())) { logger.warn('onnxruntime-node 不可用'); return false }
    const modelDir = path.resolve(import.meta.dirname, '../../../../models')
    const modelPath = path.join(modelDir, 'behavior-classifier.onnx')
    const scalerPath = path.join(modelDir, 'behavior-scaler.json')

    if (!fs.existsSync(modelPath)) {
      logger.warn({ modelPath }, '行为识别模型文件不存在')
      return false
    }

    session = await ort.InferenceSession.create(modelPath)
    const s = JSON.parse(fs.readFileSync(scalerPath, 'utf-8')) as ScalerConfig
    scalerMean = s.mean
    scalerScale = s.scale
    ready = true
    logger.info(`行为识别模型已加载 (${BEHAVIORS.length} classes)` )
    return true
  } catch (err) {
    logger.warn({ err }, '行为识别模型加载失败')
    return false
  }
}

export function isReady(): boolean { return ready }

function vectorizeKeypoints(kps: PoseKeypoints): number[] {
  const flat: number[] = []
  for (const name of KEYPOINT_ORDER) {
    const pt = kps[name] || [0, 0]
    flat.push(pt[0], pt[1])
  }
  return normalizePoseVector(flat)
}

function normalizePoseVector(flat: number[]): number[] {
  // Center on hip midpoint, scale by torso length (matches training)
  const lhx = flat[22] ?? 0, lhy = flat[23] ?? 0
  const rhx = flat[24] ?? 0, rhy = flat[25] ?? 0
  const hipX = (lhx + rhx) / 2 || 0.5
  const hipY = (lhy + rhy) / 2 || 0.5

  const shoulderY = ((flat[10] ?? 0) + (flat[12] ?? 0)) / 2
  const torsoLen = Math.max(0.01, Math.abs(shoulderY - hipY))

  const result: number[] = []
  for (let i = 0; i < N_KEYPOINTS; i++) {
    const x = flat[i * 2] ?? 0, y = flat[i * 2 + 1] ?? 0
    if (x === 0 && y === 0) { result.push(0, 0) }
    else { result.push((x - hipX) / torsoLen, (y - hipY) / torsoLen) }
  }
  return result
}

function softmax(arr: Float32Array): number[] {
  const max = Math.max(...Array.from(arr))
  const exps = Array.from(arr).map((v) => Math.exp(v - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map((e) => e / sum)
}

export async function detectBehavior(kps: PoseKeypoints): Promise<BehaviorResult> {
  if (!ready || !session) {
    return { behavior: 'standing', label: '未知', confidence: 0, allScores: {} }
  }

  const raw = vectorizeKeypoints(kps)
  if (raw.length !== N_KEYPOINTS * 2) {
    return { behavior: 'standing', label: '数据错误', confidence: 0, allScores: {} }
  }

  const normalized = raw.map((v, i) => (v - scalerMean[i]) / scalerScale[i])
  const tensor = new ort.Tensor('float32', new Float32Array(normalized), [1, N_KEYPOINTS * 2])
  const results = await session.run({ input: tensor })
  const logits = results.output.data as Float32Array
  const probs = softmax(logits)

  let maxIdx = 0
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > probs[maxIdx]) maxIdx = i
  }

  const scores: Record<string, number> = {}
  for (let i = 0; i < BEHAVIORS.length; i++) {
    scores[BEHAVIORS[i]] = Math.round(probs[i] * 100) / 100
  }

  return {
    behavior: BEHAVIORS[maxIdx],
    label: BEHAVIOR_LABELS[BEHAVIORS[maxIdx]] || BEHAVIORS[maxIdx],
    confidence: Math.round(probs[maxIdx] * 100) / 100,
    allScores: scores,
  }
}
