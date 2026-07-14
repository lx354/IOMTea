import { v4 as uuid } from 'uuid'
import type { PatientProfile, PatientInstance } from './types'

export interface FactoryDeps {
  db: any
}

export async function createPatientInstance(
  deps: FactoryDeps,
  profile: PatientProfile,
  name: string,
): Promise<PatientInstance> {
  const db = deps.db
  const { patients, devices } = await import('../core/db/schema')

  const deviceType = profile.devices[0] || 'simulator'
  const serial = `sim-${name.replace(/\s/g, '-').toLowerCase()}-${Date.now()}`

  const result = await db.transaction(async (tx: any) => {
    const [patient] = await tx
      .insert(patients)
      .values({
        name,
        status: 'active',
        tags: { profileId: profile.id, conditions: profile.conditions, simulated: true },
      })
      .returning()

    const [device] = await tx
      .insert(devices)
      .values({
        serialNumber: serial,
        deviceType,
        patientId: patient.id,
        tags: { simulated: true, profileId: profile.id },
      })
      .returning()

    return { patient, device }
  })

  return {
    id: uuid(),
    name,
    profileId: profile.id,
    patientDbId: result.patient.id,
    deviceDbId: result.device.id,
    activity: 'resting',
    baselines: profile.baseline,
    conditions: profile.conditions,
    alerts: profile.alerts,
  }
}
