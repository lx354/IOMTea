import {
  Badge, Card, Container, Group, Paper, Select, SimpleGrid, Stack, Text, Title,
} from '@mantine/core'
import { IconHeartbeat, IconMoon, IconLungs, IconDroplet } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { http } from '../api/client'
import { useGet } from '../api/hooks'

const METRICS = ['heart_rate', 'spo2', 'glucose']
const METRIC_CFG: Record<string, { label: string; unit: string; icon: any; low: number; high: number }> = {
  heart_rate: { label: '心率', unit: 'bpm', icon: IconHeartbeat, low: 60, high: 100 },
  spo2: { label: '血氧', unit: '%', icon: IconLungs, low: 94, high: 100 },
  bp: { label: '血压', unit: 'mmHg', icon: IconHeartbeat, low: 90, high: 140 },
  glucose: { label: '血糖', unit: 'mmol/L', icon: IconDroplet, low: 3.5, high: 7.0 },
  sleep: { label: '睡眠', unit: 'min', icon: IconMoon, low: 240, high: 600 },
}

function VitalCard({ label, value, unit, status }: { label: string; value: number; unit: string; status: string }) {
  const c = status === 'normal' ? 'green' : status === 'watch' ? 'orange' : 'red'
  return (
    <Paper p="md" withBorder style={{ borderTop: `3px solid var(--mantine-color-${c}-5)` }}>
      <Group justify="space-between" mb={4}>
        <Text size="xs" c="dimmed">{label}</Text>
        <Badge size="xs" variant="light" color={c}>{status === 'normal' ? '正常' : status === 'watch' ? '注意' : '异常'}</Badge>
      </Group>
      <Text fw={700} fz={28}>{value}<Text span size="sm" c="dimmed" ml={4}>{unit}</Text></Text>
    </Paper>
  )
}

export function VitalMonitor() {
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)
  const { data: patients } = useGet<Array<{ id: string; name: string }>>('/patients', { pageSize: 50 })

  const { data } = useQuery<any>({
    queryKey: ['vital-monitor', selectedPatient],
    queryFn: async () => {
      if (!selectedPatient) return null
      const { data } = await http.get(`/dashboard/patient/${selectedPatient}/overview`)
      return data
    },
    enabled: !!selectedPatient,
    refetchInterval: 5000,
  })

  const vitals = useMemo(() => {
    if (!data?.latestVitals) return []
    const list = data.latestVitals
      .filter((v: any) => METRICS.includes(v.metric))
      .map((v: any) => {
        const cfg = METRIC_CFG[v.metric] || { label: v.metric, low: 0, high: 999 }
        const val = Number(v.value)
        return { ...v, value: val, status: val >= cfg.low && val <= cfg.high ? 'normal' : (Math.abs(val - cfg.high) < 10 ? 'watch' : 'abnormal') }
      })
    // 合并收缩压+舒张压
    const sbp = data.latestVitals.find((v: any) => v.metric === 'systolic_bp')
    const dbp = data.latestVitals.find((v: any) => v.metric === 'diastolic_bp')
    if (sbp && dbp) {
      const sVal = Number(sbp.value); const dVal = Number(dbp.value)
      list.push({ metric: 'bp', value: `${sVal}/${dVal} mmHg`, unit: '', status: sVal >= 90 && sVal <= 140 && dVal >= 60 && dVal <= 90 ? 'normal' : 'watch' })
    }
    return list
  }, [data])

  // 睡眠统计
  const sleepBehaviors = (data?.behaviors || [])
  const lyingCount = sleepBehaviors.filter((b: any) => b.value === 'lying').length
  const sleepMins = Math.min(600, Math.max(0, lyingCount * 3 + 300))
  const sleepStatus = sleepMins >= 240 && sleepMins <= 600 ? 'normal' : sleepMins < 180 ? 'abnormal' : 'watch'

  return (
    <Container py="md" size="xl">
      <Group mb="md"><IconHeartbeat size={24} /><Title order={3}>生命体征监测</Title></Group>
      <Group mb="md">
        <Select size="xs" placeholder="选择患者" searchable w={200}
          data={(patients || []).map((p) => ({ value: p.id, label: p.name }))}
          value={selectedPatient} onChange={setSelectedPatient} />
      </Group>

      {!selectedPatient ? (
        <Paper p="xl" withBorder ta="center"><IconHeartbeat size={48} stroke={1} opacity={0.2} /><Text c="dimmed" mt="md">选择一个患者查看生命体征</Text></Paper>
      ) : (
        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
          {vitals.map((v: any) => (
            <VitalCard key={v.metric} label={METRIC_CFG[v.metric]?.label || v.metric}
              value={v.value} unit={v.unit || ''} status={v.status} />
          ))}
          <VitalCard label="睡眠时长" value={Math.floor(sleepMins / 60)} unit={`h ${sleepMins % 60}m`} status={sleepStatus} />
        </SimpleGrid>
      )}
    </Container>
  )
}
