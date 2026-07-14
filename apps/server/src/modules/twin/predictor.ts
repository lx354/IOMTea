import fs from 'node:fs'
import path from 'node:path'
import { createChildLogger } from '../../core/lib/logger'

let ort: any = null
async function loadOrt() {
  if (ort) return true
  try { ort = await import('onnxruntime-node'); return true }
  catch { return false }
}

const logger = createChildLogger('lstm-predictor')

const FEATURE_ORDER = [
  'heart_rate', 'spo2', 'temperature', 'systolic_bp', 'diastolic_bp',
  'glucose', 'motion_index', 'posture', 'night_wandering',
  'repetitive_behavior', 'wandering_risk',
]

const POSTURE_MAP: Record<string, number> = { standing: 0, sitting: 1, lying: 2, walking: 3 }
const CLASSES = ['stable', 'watch', 'alert', 'emergency'] as const
export type RiskLevel = (typeof CLASSES)[number]
const WINDOW_SIZE = 10

interface ScalerConfig {
  mean: number[]
  scale: number[]
  feature_order: string[]
}

let session: ort.InferenceSession | null = null
let scalerMean: number[]
let scalerScale: number[]
let ready = false

export async function initPredictor(): Promise<boolean> {
  try {
    if (!(await loadOrt())) { logger.warn('onnxruntime-node 不可用'); return false }
    const modelDir = path.resolve(import.meta.dirname, '../../../models')
    const modelPath = path.join(modelDir, 'risk-lstm.onnx')
    const scalerPath = path.join(modelDir, 'risk-scaler.json')

    if (!fs.existsSync(modelPath)) {
      logger.warn({ modelPath }, 'ONNX 模型文件不存在，LSTM 预测不可用')
      return false
    }

    session = await ort.InferenceSession.create(modelPath)
    const s = JSON.parse(fs.readFileSync(scalerPath, 'utf-8')) as ScalerConfig
    scalerMean = s.mean
    scalerScale = s.scale
    ready = true
    logger.info('LSTM 风险预测模型已加载 (99.01% accuracy)')
    return true
  } catch (err) {
    logger.warn({ err }, 'LSTM 模型加载失败，回退到阈值评估')
    return false
  }
}

export function isReady(): boolean {
  return ready
}

async function predictAsync(windowRows: number[][]): Promise<RiskLevel> {
  if (!session) throw new Error('Session not ready')

  const normalized = windowRows.map((row) =>
    row.map((val, i) => (val - scalerMean[i]) / scalerScale[i]),
  )

  const rows = Math.min(windowRows.length, WINDOW_SIZE)
  const flat = new Float32Array(WINDOW_SIZE * FEATURE_ORDER.length)
  for (let t = 0; t < rows; t++) {
    for (let f = 0; f < FEATURE_ORDER.length; f++) {
      flat[t * FEATURE_ORDER.length + f] = normalized[t][f] ?? 0
    }
  }

  const tensor = new ort.Tensor('float32', flat, [1, WINDOW_SIZE, FEATURE_ORDER.length])
  const results = await session.run({ input: tensor })
  const output = results.output.data as Float32Array
  let maxIdx = 0
  for (let i = 1; i < output.length; i++) {
    if (output[i] > output[maxIdx]) maxIdx = i
  }
  return CLASSES[maxIdx]
}

export function buildWindowRow(lastValues: Record<string, number>): number[] {
  return FEATURE_ORDER.map((feat) => {
    if (feat === 'posture') {
      return POSTURE_MAP[String(lastValues['posture_raw'])] ?? lastValues[feat] ?? 0
    }
    return lastValues[feat] ?? 0
  })
}

const predictionWindows = new Map<string, number[][]>()

export function pushPredictionRow(patientId: string, row: number[]): void {
  let window = predictionWindows.get(patientId)
  if (!window) { window = []; predictionWindows.set(patientId, window) }
  window.push(row)
  if (window.length > WINDOW_SIZE) window.shift()
}

export async function tryPredict(patientId: string): Promise<RiskLevel | null> {
  if (!ready) return null
  const window = predictionWindows.get(patientId)
  if (!window || window.length < WINDOW_SIZE) return null
  try {
    return await predictAsync(window)
  } catch (err) {
    logger.warn({ err, patientId }, 'LSTM 推理失败')
    return null
  }
}
