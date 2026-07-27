// 虚拟镜像 — 实时姿态同步引擎

import type { DbClient } from '../../core/db'
import { events } from '../../core/db/schema'
import { createChildLogger } from '../../core/lib/logger'
import type { PostureKeypoints, PostureReport } from './chat/posture-analyzer'
import { analyzePosture } from './chat/posture-analyzer'

const logger = createChildLogger('virtual-mirror')

export interface MirrorSnapshot {
  patientId: string
  timestamp: string
  keypoints: PostureKeypoints
  posture: PostureReport
  activity: string
  behavior: string | null  // standing/sitting/lying etc.
  position: { x: number; y: number; room: string }
  source: string
}

const mirrors = new Map<string, MirrorSnapshot>()

export function updateMirror(
  db: DbClient,
  patientId: string,
  keypoints: PostureKeypoints,
  source: string = 'yolo-pose',
  room: string = 'bedroom',
): MirrorSnapshot {
  const posture = analyzePosture(keypoints)
  const snapshot: MirrorSnapshot = {
    patientId,
    timestamp: new Date().toISOString(),
    keypoints,
    posture,
    activity: posture.metrics.slice(3, 5).map((m: { label: string }) => m.label).join(','),
    behavior: null,
    position: { x: keypoints.left_hip?.[0] ?? 0.5, y: keypoints.left_hip?.[1] ?? 0.5, room },
    source,
  }
  mirrors.set(patientId, snapshot)

  // 异步写入 events 表
  db.insert(events).values({
    patientId,
    kind: 'observation',
    metric: 'posture',
    value: JSON.stringify({
      overallScore: posture.overallScore,
      overallStatus: posture.overallStatus,
      risks: posture.risks,
      activity: snapshot.activity,
      position: snapshot.position,
    }),
    source: 'simulator',
    recordedAt: new Date(),
    tags: {
      mirror: true,
      source,
      metrics: posture.metrics.map((m: { label: string; score: number; status: string }) => ({ label: m.label, score: m.score, status: m.status })),
    },
  }).execute().catch((err: Error) => {
    logger.warn({ err, patientId }, '虚拟镜像写入失败')
  })

  logger.info({ patientId, score: posture.overallScore, status: posture.overallStatus }, '虚拟镜像更新')
  return snapshot
}

export function getMirror(patientId: string): MirrorSnapshot | null {
  return mirrors.get(patientId) ?? null
}

export function getAllMirrors(): MirrorSnapshot[] {
  return [...mirrors.values()]
}
