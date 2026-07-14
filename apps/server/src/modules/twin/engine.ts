import crypto from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import type { DbClient } from '../../core/db'
import { events, patients } from '../../core/db/schema.js'
import { simConfigs, simPatients } from '../../core/db/schema/twin.js'
import { createChildLogger } from '../../core/lib/logger'
import * as phys from '../../core/pipeline/physiology.js'
import { profiles } from './profiles.js'
import type { MetricConfig, UnifiedProfile } from './profiles.js'
import { MetricScheduler } from './scheduler.js'
import { evaluatePatientState } from './state-machine.js'
import { computeFusionScore } from '../suggestions/fusion-score.js'

let initPredictor: (() => Promise<boolean>) | null = null
let initBehaviorPredictor: (() => Promise<boolean>) | null = null
let tryPredict: ((patientId: string) => Promise<string | null>) | null = null
let pushPredictionRow: ((patientId: string, row: number[]) => void) | null = null
let buildWindowRow: ((lastValues: Record<string, number>) => number[]) | null = null

const logger = createChildLogger('twin-engine')

interface PatientRunner {
  patientId: string
  patientName: string
  scheduler: MetricScheduler
  lastValues: Record<string, number>
  lastState: string | null
  tickCount: number
}

interface Simulation {
  id: string
  name: string
  profileName: string
  profile: UnifiedProfile
  metrics: { name: string; config: MetricConfig; enabled: boolean }[]
  patients: Map<string, PatientRunner>
  running: boolean
  speed: number
}

export type { Simulation }

const simulations = new Map<string, Simulation>()
const patientSimMap = new Map<string, string>()

type GeneratorFn = (baseline: { mean: number; std: number }, hour: number) => number | string

const generatorMap: Record<string, GeneratorFn> = {
  heartRate: phys.generateHeartRate,
  spo2: phys.generateSpO2,
  temperature: phys.generateTemperature,
  systolicBp: phys.generateSystolicBp,
  diastolicBp: phys.generateDiastolicBp,
  glucose: phys.generateGlucose,
  respiratoryRate: phys.generateRespiratoryRate,
  posture: (_baseline, _hour) => phys.generatePosture(),
  bedStatus: (_baseline, _hour) => phys.generateBedStatus(),
  motionIndex: (_baseline, _hour) => phys.generateMotionIndex(),
  nightWandering: phys.generateNightWandering,
  repetitiveBehavior: phys.generateRepetitiveBehavior,
  wanderingRisk: phys.generateWanderingRisk,
}

// 将 metrics API 名称映射到 profile 的 baseline 字段
// 例如 heart_rate → heartRate, systolic_bp → systolicBp
function baselineKey(
  metric: string,
): keyof (typeof profiles)['elderly-cardiac']['baselines'] | null {
  const map: Record<string, keyof (typeof profiles)['elderly-cardiac']['baselines']> = {
    heart_rate: 'heartRate',
    spo2: 'spo2',
    temperature: 'temperature',
    systolic_bp: 'systolicBp',
    diastolic_bp: 'diastolicBp',
    glucose: 'glucose',
    resp_rate: 'respiratoryRate',
  }
  return map[metric] ?? null
}

// 启动一个患者跑者的 tick 循环
// 为 sim 配置的每个指标注册一个定时器，定时生成观测值并写入 events 表
// 每次生成后评估患者综合状态，若状态变化则记录 state_transition 事件
function startPatientRunner(
  dbc: DbClient,
  sim: Simulation,
  patientId: string,
  patientName: string,
) {
  const scheduler = new MetricScheduler()
  const simSpeed = sim.speed
  const globalSpeed = 1
  scheduler.setSpeed(simSpeed * globalSpeed)
  const runner: PatientRunner = { patientId, patientName, scheduler, lastValues: {}, lastState: null, tickCount: 0 }
  sim.patients.set(patientId, runner)
  patientSimMap.set(patientId, sim.id)

  for (const m of sim.metrics) {
    if (!m.enabled) continue
    const generator = generatorMap[m.config.generator]
    if (!generator) continue
    scheduler.schedule(patientId, m.config, async () => {
      const s = simulations.get(sim.id)
      const r = s?.patients.get(patientId)
      if (!s || !r || !s.running) return
      const bk = baselineKey(m.name)
      if (!bk) return
      const baseline = sim.profile.baselines[bk]
      if (!baseline) return
      const hour = new Date().getHours()
      const value = generator(baseline, hour)
      r.lastValues[m.name] = typeof value === 'number' ? value : 0
      if (m.name === 'posture') (r.lastValues as Record<string, unknown>)['posture_raw'] = value
      r.tickCount++
      await dbc.insert(events).values({
        patientId,
        kind: 'observation',
        metric: m.name,
        value: typeof value === 'number' ? value : null,
        unit: m.config.unit || null,
        source: 'simulator',
        recordedAt: new Date(),
        tags: { sim: true, simId: sim.id, profile: sim.profileName },
      })

      // LSTM 可选
      if (buildWindowRow && pushPredictionRow && tryPredict) {
        const wr = buildWindowRow(r.lastValues); pushPredictionRow(patientId, wr)
        const p = await tryPredict(patientId); const st = p ?? evaluatePatientState(patientId, r.lastValues).overallState
        if (st !== r.lastState && r.lastState !== null) {
          dbc.insert(events).values({ patientId, kind: 'state_transition', metric: r.lastState, value: st, source: 'simulator', recordedAt: new Date(), tags: { sim: true, from: r.lastState, to: st, method: p ? 'lstm' : 'threshold' } }).catch((err: Error) => { logger.warn({ err }, '状态转换写入失败') })
        }
        r.lastState = st
      } else {
        const st = evaluatePatientState(patientId, r.lastValues).overallState
        if (st !== r.lastState && r.lastState !== null) {
          dbc.insert(events).values({ patientId, kind: 'state_transition', metric: r.lastState, value: st, source: 'simulator', recordedAt: new Date(), tags: { sim: true, from: r.lastState, to: st, method: 'threshold' } }).catch((err: Error) => { logger.warn({ err }, '状态转换写入失败') })
        }
        r.lastState = st
      }

      // 多模态融合：每5个tick计算一次
      if (r.tickCount % 5 === 0) {
        computeFusionScoreAsync(dbc, patientId, r.lastValues, sim.profileName, r.lastState)
      }
    })
  }
}

function stopPatientRunner(patientId: string) {
  const simId = patientSimMap.get(patientId)
  if (!simId) return
  const sim = simulations.get(simId)
  if (!sim) return
  const runner = sim.patients.get(patientId)
  if (runner) {
    runner.scheduler.destroy()
    sim.patients.delete(patientId)
  }
  patientSimMap.delete(patientId)
}

export { simulations, patientSimMap, startPatientRunner, stopPatientRunner }

export async function recoverSimulations(db: DbClient) {
  try {
    const mod = await import('./predictor.js')
    initPredictor = mod.initPredictor
    tryPredict = mod.tryPredict
    pushPredictionRow = mod.pushPredictionRow
    buildWindowRow = mod.buildWindowRow
  } catch (err) { logger.warn({ err }, 'LSTM 预测模块加载失败（ONNX 不兼容），跳过') }

  try {
    const mod = await import('./chat/behavior-predictor.js')
    initBehaviorPredictor = mod.initBehaviorPredictor
  } catch (err) { logger.warn({ err }, '行为识别模块加载失败（ONNX 不兼容），跳过') }

  if (initPredictor) await initPredictor()
  if (initBehaviorPredictor) await initBehaviorPredictor()

  const rows = await db.select().from(simConfigs).where(eq(simConfigs.running, true))

  if (rows.length === 0) {
    logger.info('无待恢复的仿真')
    return
  }

  let recovered = 0
  let patientsTotal = 0

  for (const row of rows) {
    const profile = profiles[row.profileName]
    if (!profile) {
      logger.warn({ simId: row.id, profileName: row.profileName }, '恢复跳过: 未知配置档案')
      continue
    }

    const savedMetrics = (row.metrics as any[]) || []
    const hydratedMetrics = savedMetrics.length > 0
      ? savedMetrics.map((m: any) => ({
          name: m.name,
          config: { metric: m.name, ...m.config, unit: m.config?.unit ?? '', interval: m.config?.interval ?? { min: 3000, max: 5000 }, jitter: m.config?.jitter ?? 0.2, generator: m.config?.generator ?? '' },
          enabled: m.enabled ?? true,
        }))
      : profile.metrics.map((m) => ({
          name: m.metric,
          config: { ...m },
          enabled: true,
        }))

    const sim: Simulation = {
      id: row.id,
      name: row.name,
      profileName: row.profileName,
      profile,
      metrics: hydratedMetrics,
      patients: new Map(),
      running: false,
      speed: row.speed ?? 1,
    }
    simulations.set(row.id, sim)

    const patientRows = await db
      .select({ patientId: simPatients.patientId })
      .from(simPatients)
      .where(eq(simPatients.simId, row.id))

    if (patientRows.length > 0) {
      const pids = patientRows.map((p) => p.patientId)
      const pRecords = await db
        .select({ id: patients.id, name: patients.name })
        .from(patients)
        .where(inArray(patients.id, pids))

      const nameMap = new Map(pRecords.map((p) => [p.id, p.name]))

      for (const pid of pids) {
        const pname = nameMap.get(pid) ?? pid
        startPatientRunner(db, sim, pid, pname)
      }
      sim.running = true
      patientsTotal += pids.length
    }

    recovered++
    logger.info({ simId: row.id, simName: row.name, patients: patientRows.length }, '仿真已恢复')
  }

  logger.info(`数字孪生引擎恢复完成: ${recovered} 个仿真, ${patientsTotal} 位患者`)
}

async function computeFusionScoreAsync(dbc: DbClient, patientId: string, lastValues: Record<string, number>, profileName: string, overallState: string) {
  try {
    const mood = overallState === 'emergency' ? 'anxious' : overallState === 'alert' ? 'anxious' : 'calm'
    const report = computeFusionScore({
      patientId, patientName: patientId.slice(0, 8),
      profileId: profileName,
      vitals: lastValues,
      behaviors24h: overallState === 'emergency' ? ['falling'] : [],
      postureScore: null,
      cognitiveScore: null,
      moodStatus: mood,
      recentAlerts: overallState === 'emergency' ? 3 : overallState === 'alert' ? 1 : 0,
    })
    await dbc.insert(events).values({
      patientId,
      kind: 'observation',
      metric: 'fusion_score',
      value: JSON.stringify(report),
      source: 'simulator',
      recordedAt: new Date(),
      tags: { index: report.overallIndex, status: report.overallStatus },
    })
  } catch (err) { /* silent */ }
}

export function createSimulation(db: DbClient, config: { profileName: string; name?: string }) {
  const profile = profiles[config.profileName]
  if (!profile) return null
  const id = crypto.randomUUID()
  const metrics = profile.metrics.map((m) => ({
    name: m.metric,
    config: { ...m },
    enabled: true,
  }))
  const simName = config.name || profile.displayName
  const sim: Simulation = {
    id,
    name: simName,
    profileName: config.profileName,
    profile,
    metrics,
    patients: new Map(),
    running: false,
    speed: 1,
  }
  simulations.set(id, sim)
  db.insert(simConfigs)
    .values({
      id,
      name: simName,
      profileName: config.profileName,
      running: false,
      speed: 1,
      metrics,
    })
    .execute()
    .catch((err: Error) => {
      logger.error({ err }, 'sim save failed')
    })
  return {
    id,
    metrics: sim.metrics.map((m) => ({ name: m.name, enabled: m.enabled, config: m.config })),
  }
}

export function deleteSimulation(db: DbClient, id: string): boolean {
  const sim = simulations.get(id)
  if (!sim) return false
  for (const pid of sim.patients.keys()) stopPatientRunner(pid)
  simulations.delete(id)
  db.delete(simConfigs)
    .where(eq(simConfigs.id, id))
    .execute()
    .catch((err: Error) => {
      logger.error({ err, simId: id }, 'sim delete failed')
    })
  return true
}

export function toggleSimulation(db: DbClient, id: string, running: boolean): boolean {
  const sim = simulations.get(id)
  if (!sim) return false
  sim.running = running
  if (!running) for (const [, r] of sim.patients) r.scheduler.destroy()
  db.update(simConfigs)
    .set({ running })
    .where(eq(simConfigs.id, id))
    .execute()
    .catch((err: Error) => {
      logger.error({ err, simId: id, running }, 'sim toggle failed')
    })
  return true
}

export function getSimulations() {
  return Array.from(simulations.values()).map((s) => ({
    id: s.id,
    name: s.name,
    profileName: s.profileName,
    running: s.running,
    patientCount: s.patients.size,
    metrics: s.metrics.map((m) => ({ name: m.name, enabled: m.enabled, config: m.config })),
  }))
}

export function getSimulation(id: string) {
  const s = simulations.get(id)
  if (!s) return null
  return {
    id: s.id,
    name: s.name,
    profileName: s.profileName,
    running: s.running,
    patientCount: s.patients.size,
    metrics: s.metrics.map((m) => ({ name: m.name, enabled: m.enabled, config: m.config })),
  }
}
