import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createChildLogger } from '../../../core/lib/logger'
import type { PoseKeypoints } from './behavior-predictor'
import { detectBehavior } from './behavior-predictor'

const logger = createChildLogger('pose-detector')

const SCRIPT = path.resolve(import.meta.dirname, '../../../../../ml/detect_pose.py')

interface PosePerson {
  id: number
  keypoints: PoseKeypoints
  confidence: number
  bbox: { x: number; y: number; w: number; h: number }
}

interface PoseResult {
  persons: PosePerson[]
  count: number
  imageSize: [number, number]
  error?: string
}

interface BehaviorResult {
  behavior: string
  label: string
  confidence: number
  allScores: Record<string, number>
}

export interface ImageBehaviorResult {
  persons: Array<{
    id: number
    bbox: { x: number; y: number; w: number; h: number }
    keypoints: PoseKeypoints
    poseConfidence: number
    behavior: BehaviorResult
  }>
  count: number
}

function detectPoses(imagePath: string): Promise<PoseResult> {
  return new Promise((resolve, reject) => {
    execFile('python', [SCRIPT, imagePath], { timeout: 30000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        logger.warn({ err: stderr || err.message }, 'YOLO 姿态检测失败')
        return resolve({ persons: [], count: 0, imageSize: [0, 0], error: err.message })
      }
      try {
        resolve(JSON.parse(stdout.trim()))
      } catch {
        resolve({ persons: [], count: 0, imageSize: [0, 0], error: 'JSON parse error' })
      }
    })
  })
}

export async function detectFromImage(imagePath: string): Promise<ImageBehaviorResult> {
  const poseResult = await detectPoses(imagePath)
  const persons: ImageBehaviorResult['persons'] = []

  for (const person of poseResult.persons) {
    let behavior: BehaviorResult
    try {
      behavior = await detectBehavior(person.keypoints)
    } catch {
      behavior = { behavior: 'standing', label: '未知', confidence: 0, allScores: {} }
    }
    persons.push({
      id: person.id,
      bbox: person.bbox,
      keypoints: person.keypoints,
      poseConfidence: person.confidence,
      behavior,
    })
  }

  return { persons, count: persons.length }
}

export async function detectFromBase64(base64Image: string): Promise<ImageBehaviorResult> {
  const match = base64Image.match(/^data:image\/(\w+);base64,(.+)$/)
  const data = match ? match[2] : base64Image
  const ext = match ? match[1] : 'jpg'

  const tmpPath = path.join(os.tmpdir(), `iomtea-pose-${Date.now()}.${ext}`)
  fs.writeFileSync(tmpPath, Buffer.from(data, 'base64'))

  try {
    return await detectFromImage(tmpPath)
  } finally {
    try { fs.unlinkSync(tmpPath) } catch { /**/ }
  }
}
