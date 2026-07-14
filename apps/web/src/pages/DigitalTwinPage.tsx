import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { HomeScene } from '../3d/scenes/HomeScene'
import { Badge, Container, Group, Loader, Paper, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { Component, type ReactNode } from 'react'
import { http } from '../api/client'
import type { SimPatientData } from '../3d/data'
import { buildPatientData } from '../3d/data'

class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) return this.props.fallback || <Text c="red" ta="center" py="xl">3D 场景加载失败，请检查浏览器是否支持 WebGL</Text>
    return this.props.children
  }
}

export function DigitalTwinPage() {
  const { data: patients } = useQuery({
    queryKey: ['digital-twin-patients'],
    queryFn: async () => {
      const { data } = await http.get('/patients', { params: { pageSize: 20 } })
      return ((data as { data?: any[] }).data ?? (data as any[])) || []
    },
    refetchInterval: 10000,
  })

  const patientIds = (patients || []).slice(0, 3).map((p: any) => p.id)

  const { data: allEvents } = useQuery({
    queryKey: ['digital-twin-events', patientIds],
    queryFn: async () => {
      if (patientIds.length === 0) return []
      const { data } = await http.get('/dashboard/recent-events')
      return (data as any[]) || []
    },
    enabled: patientIds.length > 0,
    refetchInterval: 3000,
  })

  const patientData = buildPatientData(patients || [], patientIds, allEvents || [])

  return (
    <div style={{ height: 'calc(100vh - 88px)', position: 'relative' }}>
      <Paper p="xs" style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: 8, pointerEvents: 'none' }}>
        <Group gap="xs">
          <Text size="sm" fw={600}>3D 数字孪生</Text>
          <Badge size="xs" variant="filled" color="teal">{patientData.length} 位患者</Badge>
        </Group>
        {patientData.map((p) => (
          <Text key={p.patientId} size="xs" style={{ color: '#aaa' }}>
            {p.patientName} · {p.posture} · HR:{p.heartRate ?? '-'} · SpO₂:{p.spO2 ?? '-'}%
          </Text>
        ))}
      </Paper>
      <ErrorBoundary>
        <Canvas camera={{ position: [15, 12, 15], fov: 50 }} shadows style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)' }}>
          <HomeScene patientData={patientData} />
          <OrbitControls target={[5, 0, 5]} maxPolarAngle={Math.PI / 2.5} minDistance={5} maxDistance={30} />
        </Canvas>
      </ErrorBoundary>
    </div>
  )
}
