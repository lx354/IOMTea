import { useMemo } from 'react'
import { trpc } from '../../trpc'

export interface SimPatientData {
  patientId: string
  patientName: string
  posture: string
  heartRate: number | null
  spO2: number | null
  systolicBP: number | null
  diastolicBP: number | null
  pressureGrid: number[][] | null
  ecgWaveform: number[] | null
  alerts: { metric: string; severity: string; message: string }[]
}

export function useSimData(patientIds: string[]) {
  const enabled = patientIds.length > 0

  const queries = patientIds.map((pid) =>
    trpc.data.latest.useQuery(
      { patientId: pid },
      { enabled, refetchInterval: 2000 },
    ),
  )

  const alertsQuery = trpc.alert.list.useQuery(
    { pageSize: 50, status: 'active' },
    { enabled, refetchInterval: 3000 },
  )

  const patientData: SimPatientData[] = useMemo(() => {
    return queries.map((q, i) => {
      const vitals = q.data || []
      const gv = (m: string) => vitals.find((v: any) => v.metric === m)

      const postureEv = gv('posture')
      const pressureEv = gv('pressure_grid')
      const ecgEv = gv('ecg_waveform')

      const patientId = patientIds[i] || ''
      const patientAlerts = (alertsQuery.data || [])
        .filter((a: any) => a.patientId === patientId)
        .map((a: any) => ({
          metric: a.metric,
          severity: a.severity,
          message: a.tags?.message || a.metric,
        }))

      return {
        patientId,
        patientName: `患者 ${i + 1}`,
        posture: (postureEv?.tags?.posture as string) || 'lying',
        heartRate: gv('heart_rate')?.value ?? null,
        spO2: gv('spo2')?.value ?? null,
        systolicBP: gv('systolic_bp')?.value ?? null,
        diastolicBP: gv('diastolic_bp')?.value ?? null,
        pressureGrid: (pressureEv?.tags?.grid as number[][]) || null,
        ecgWaveform: (ecgEv?.tags?.waveform as number[]) || null,
        alerts: patientAlerts,
      }
    })
  }, [queries.map(q => q.dataUpdatedAt), alertsQuery.dataUpdatedAt, patientIds.length, ...patientIds])

  const isLoading = queries.some((q) => q.isLoading)

  return { patientData, isLoading }
}
