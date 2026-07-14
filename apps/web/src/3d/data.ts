export interface SimPatientData {
  patientId: string
  patientName: string
  posture: string
  heartRate: number | null
  spO2: number | null
  systolicBP: number | null
  diastolicBP: number | null
  pressureGrid: number[][] | null
  ecgWaveform?: number[] | null
  alerts: { metric: string; severity: string; message: string }[]
}

export function getLatestValue(events: any[], metric: string): any {
  return events.find((e: any) => e.metric === metric && e.kind === 'observation')
}

export function buildPatientData(
  patients: any[], patientIds: string[], allEvents: any[],
): SimPatientData[] {
  return patientIds.map((pid) => {
    const patient = patients.find((p: any) => p.id === pid)
    const evs = allEvents.filter((e: any) => e.patientId === pid)

    const getLatest = (metric: string) => getLatestValue(evs, metric)

    const patAlerts = evs.filter((e: any) =>
      e.kind === 'alert' || e.kind === 'state_transition',
    ).map((a: any) => ({
      metric: a.metric,
      severity: a.severity || 'info',
      message: a.metric,
    }))

    return {
      patientId: pid,
      patientName: patient?.name || '患者',
      posture: (getLatest('posture')?.value as string) || 'standing',
      heartRate: (getLatest('heart_rate')?.value as number) || null,
      spO2: (getLatest('spo2')?.value as number) || null,
      systolicBP: (getLatest('systolic_bp')?.value as number) || null,
      diastolicBP: (getLatest('diastolic_bp')?.value as number) || null,
      pressureGrid: null,
      alerts: patAlerts,
    }
  })
}
