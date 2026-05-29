import { eq } from 'drizzle-orm'
import type { DbClient } from '../../core/db'
import { events } from '../../core/db/schema.js'
import { simConfigs } from '../../core/db/schema/twin.js'
import { createChildLogger } from '../../core/lib/logger'
import * as phys from '../../core/pipeline/physiology.js'
import { listProfiles, profiles } from './profiles.js'
import type { MetricConfig, UnifiedProfile } from './profiles.js'
import { MetricScheduler } from './scheduler.js'
import { evaluatePatientState } from './state-machine.js'

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

      const result = evaluatePatientState(patientId, r.lastValues)
      if (result.overallState !== r.lastState && r.lastState !== null) {
        dbc.insert(events).values({
          patientId,
          kind: 'state_transition',
          metric: r.lastState,
          value: result.overallState,
          source: 'simulator',
          recordedAt: new Date(),
          tags: { sim: true, from: r.lastState, to: result.overallState },
        }).catch((err: Error) => {
          logger.warn({ err }, '状态转换写入失败')
        })
      }
      r.lastState = result.overallState
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

export function createSimulation(db: DbClient, config: { profileName: string; name?: string }) {
  const profile = profiles[config.profileName]
  if (!profile) return null
  const id = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
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
