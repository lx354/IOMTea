import { eq } from 'drizzle-orm'
import type { DbClient } from '../../../core/db'
import { devices, events } from '../../../core/db/schema'
import { parseMattressPayload, type MattressPayload } from './parser'
import { SleepStateManager } from './sleep-state'
import { AlertEngine } from './alerts'

export class MattressModule {
  private sleepManager = new SleepStateManager()
  private alertEngine = new AlertEngine()

  async process(db: DbClient, payload: MattressPayload): Promise<void> {
    const now = new Date()
    const sn = payload.sn

    // Auto-register device
    let device = await db.select().from(devices).where(eq(devices.serialNumber, sn)).limit(1)
    if (device.length === 0) {
      const [created] = await db.insert(devices).values({
        serialNumber: sn,
        deviceType: 'mattress',
        tags: { protocol: 'mattress', auto_registered: true },
      }).returning()
      device = [created]
    }

    const deviceId = device[0].id
    const patientId = device[0].patientId

    // Update lastSeen
    await db.update(devices).set({ lastSeen: now }).where(eq(devices.id, deviceId))

    // Skip event insertion when no patient is assigned
    if (!patientId) {
      console.warn(`[mattress] device ${sn} has no assigned patient, skipping event insert`)
      return
    }

    // Parse observations
    const obsEvents = parseMattressPayload(payload, patientId, deviceId, now)

    // Sleep state
    const sleepState = this.sleepManager.update(sn, payload.st || 'off', payload.time || now.toISOString())

    // Alerts
    const alertEvents = this.alertEngine.process(payload, now)

    const allEvents = [
      ...obsEvents,
      ...alertEvents.map((a) => ({ ...a, patientId: patientId || '', deviceId })),
      {
        patientId: patientId || '', deviceId, kind: 'observation' as const,
        metric: 'sleep_state', value: Number(sleepState), unit: null,
        tags: { protocol: 'mattress', raw_status: payload.st, sn },
        recordedAt: now,
      },
    ]

    const rows = allEvents.map((e) => ({
      patientId: e.patientId,
      deviceId: e.deviceId,
      kind: e.kind,
      metric: e.metric,
      value: e.value,
      unit: e.unit,
      severity: e.severity,
      status: e.status,
      tags: e.tags as Record<string, unknown>,
      recordedAt: e.recordedAt,
    }))

    if (rows.length > 0) {
      await db.insert(events).values(rows)
    }
  }
}
