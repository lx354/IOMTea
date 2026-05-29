import { eq } from 'drizzle-orm'
import type { DbClient } from '../../core/db'
import { events } from '../../core/db/schema.js'
import { simConfigs, simPatients } from '../../core/db/schema/twin'
import { createChildLogger } from '../../core/lib/logger'
import { patientSimMap, simulations, startPatientRunner, stopPatientRunner } from './engine'

const logger = createChildLogger('twin-ops')

export function setSpeed(speed: number) {
  for (const sim of simulations.values()) {
    for (const runner of sim.patients.values()) runner.scheduler.setSpeed(speed * sim.speed)
  }
}

export function addPatient(
  db: DbClient,
  simId: string,
  patient: { id: string; name: string },
): number {
  const sim = simulations.get(simId)
  if (!sim) return 0
  if (patientSimMap.has(patient.id)) return 0
  startPatientRunner(db, sim, patient.id, patient.name)
  db.insert(simPatients)
    .values({ simId, patientId: patient.id })
    .execute()
    .catch((err: Error) => {
      logger.error({ err, simId, patientId: patient.id }, 'sim addPatient failed')
    })
  return 1
}

export function removePatient(db: DbClient, simId: string, patientId: string): number {
  if (patientSimMap.get(patientId) !== simId) return 0
  stopPatientRunner(patientId)
  db.delete(simPatients)
    .where(eq(simPatients.patientId, patientId))
    .execute()
    .catch((err: Error) => {
      logger.error({ err, simId, patientId }, 'sim removePatient failed')
    })
  return 1
}

export function toggleMetric(
  _db: DbClient,
  simId: string,
  metric: string,
  enabled: boolean,
): boolean {
  const sim = simulations.get(simId)
  if (!sim) return false
  const m = sim.metrics.find((x) => x.name === metric)
  if (!m) return false
  m.enabled = enabled
  if (!enabled) for (const [, r] of sim.patients) r.scheduler.cancel(r.patientId, m.name)
  return true
}

export function updateMetric(
  _db: DbClient,
  simId: string,
  metric: string,
  config: { intervalMin?: number; intervalMax?: number; jitter?: number },
): boolean {
  const sim = simulations.get(simId)
  if (!sim) return false
  const m = sim.metrics.find((x) => x.name === metric)
  if (!m) return false
  if (config.intervalMin !== undefined) m.config.interval.min = config.intervalMin
  if (config.intervalMax !== undefined) m.config.interval.max = config.intervalMax
  if (config.jitter !== undefined) m.config.jitter = config.jitter
  return true
}

export function renameSim(db: DbClient, simId: string, name: string): boolean {
  const sim = simulations.get(simId)
  if (!sim) return false
  sim.name = name
  db.update(simConfigs)
    .set({ name })
    .where(eq(simConfigs.id, simId))
    .execute()
    .catch((err: Error) => {
      logger.error({ err, simId, name }, 'sim rename failed')
    })
  return true
}

const SCENARIOS: Record<
  string,
  { observation?: Record<string, unknown>; alert?: Record<string, unknown> }
> = {
  tachycardia: {
    observation: { metric: 'heart_rate', value: 155, unit: 'bpm' },
    alert: {
      metric: 'heart_rate',
      value: 155,
      unit: 'bpm',
      kind: 'alert',
      severity: 'critical',
      status: 'active',
    },
  },
  low_spo2: {
    observation: { metric: 'spo2', value: 88, unit: '%' },
    alert: {
      metric: 'spo2',
      value: 88,
      unit: '%',
      kind: 'alert',
      severity: 'critical',
      status: 'active',
    },
  },
  hypotension: {
    observation: { metric: 'systolic_bp', value: 85, unit: 'mmHg' },
    alert: {
      metric: 'systolic_bp',
      value: 85,
      unit: 'mmHg',
      kind: 'alert',
      severity: 'warning',
      status: 'active',
    },
  },
  fall: {
    observation: { metric: 'posture', value: null, unit: null },
    alert: {
      metric: 'fall_detected',
      value: null,
      unit: null,
      kind: 'alert',
      severity: 'critical',
      status: 'active',
      tags: { scenario: 'fall' },
    },
  },
  bed_exit: {
    observation: { metric: 'bed_status', value: 0, unit: null },
    alert: {
      metric: 'bed_exit',
      value: null,
      unit: null,
      kind: 'alert',
      severity: 'warning',
      status: 'active',
    },
  },
  hyperglycemia: {
    observation: { metric: 'glucose', value: 13.5, unit: 'mmol/L' },
    alert: {
      metric: 'glucose',
      value: 13.5,
      unit: 'mmol/L',
      kind: 'alert',
      severity: 'critical',
      status: 'active',
    },
  },
  hypoglycemia: {
    observation: { metric: 'glucose', value: 2.8, unit: 'mmol/L' },
    alert: {
      metric: 'glucose',
      value: 2.8,
      unit: 'mmol/L',
      kind: 'alert',
      severity: 'critical',
      status: 'active',
    },
  },
  arrhythmia: {
    observation: { metric: 'heart_rate', value: 180, unit: 'bpm' },
    alert: {
      metric: 'arrhythmia',
      value: null,
      unit: null,
      kind: 'alert',
      severity: 'critical',
      status: 'active',
    },
  },
  respiratory_distress: {
    observation: { metric: 'resp_rate', value: 35, unit: 'rpm' },
    alert: {
      metric: 'resp_rate',
      value: 35,
      unit: 'rpm',
      kind: 'alert',
      severity: 'critical',
      status: 'active',
    },
  },
  night_wandering: {
    observation: { metric: 'night_wandering', value: 4, unit: '次/夜' },
    alert: {
      metric: 'night_wandering',
      value: 4,
      unit: '次/夜',
      kind: 'alert',
      severity: 'warning',
      status: 'active',
      tags: { behavior_type: 'night_wandering' },
    },
  },
  wandering_escape: {
    observation: { metric: 'wandering_risk', value: 8, unit: 'score' },
    alert: {
      metric: 'wandering_risk',
      value: 8,
      unit: 'score',
      kind: 'alert',
      severity: 'critical',
      status: 'active',
      tags: { behavior_type: 'wandering' },
    },
  },
}

export function injectScenario(
  db: DbClient,
  simId: string,
  patientId: string,
  type: string,
): boolean {
  const sim = simulations.get(simId)
  if (!sim) return false

  const scenario = SCENARIOS[type]
  if (!scenario) return false

  const now = new Date()

  if (scenario.observation) {
    db.insert(events)
      .values({
        patientId,
        kind: 'observation',
        metric: (scenario.observation.metric as string) || 'unknown',
        value: scenario.observation.value ?? null,
        unit: (scenario.observation.unit as string) || null,
        source: 'manual',
        tags: { scenario: type, injected: true },
        recordedAt: now,
      } as any)
      .execute()
      .catch((err: Error) => {
        logger.error(
          { err, simId, patientId, type, event: 'observation' },
          'injectScenario observation failed',
        )
      })
  }

  if (scenario.alert) {
    db.insert(events)
      .values({
        patientId,
        kind: 'alert',
        metric: (scenario.alert.metric as string) || 'unknown',
        value: scenario.alert.value ?? null,
        unit: (scenario.alert.unit as string) || null,
        severity: (scenario.alert.severity as string) || 'warning',
        status: (scenario.alert.status as string) || 'active',
        source: 'manual',
        tags: {
          scenario: type,
          injected: true,
          ...((scenario.alert.tags as Record<string, unknown>) || {}),
        },
        recordedAt: now,
      } as any)
      .execute()
      .catch((err: Error) => {
        logger.error({ err, simId, patientId, type, event: 'alert' }, 'injectScenario alert failed')
      })
  }

  return true
}
