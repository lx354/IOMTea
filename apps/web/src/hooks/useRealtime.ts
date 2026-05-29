import { useEffect, useRef } from 'react'

type VitalsCallback = (data: {
  patientId: string
  metrics: { metric: string; value: number; unit: string | null }[]
}) => void
type AlertCallback = (data: {
  patientId: string
  alert: { metric: string; value: unknown; severity: string }
}) => void

interface RealtimeOptions {
  patientId?: string
  onVitals?: VitalsCallback
  onAlert?: AlertCallback
}

export function useRealtime({ patientId, onVitals, onAlert }: RealtimeOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const onVitalsRef = useRef(onVitals)
  const onAlertRef = useRef(onAlert)
  onVitalsRef.current = onVitals
  onAlertRef.current = onAlert

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    const wsBase = import.meta.env.VITE_WS_URL || ''
    const url = `${wsBase || ''}/ws?token=${token}${patientId ? `&patientId=${patientId}` : ''}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (patientId) {
        ws.send(JSON.stringify({ type: 'subscribe_patient', patientId }))
      }
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'vitals') {
          onVitalsRef.current?.(data)
        }
        if (data.type === 'alert') {
          onAlertRef.current?.(data)
        }
      } catch {
        // ignore malformed messages
      }
    }

    ws.onerror = () => {}

    return () => {
      ws.close()
    }
  }, [patientId])

  return wsRef
}
