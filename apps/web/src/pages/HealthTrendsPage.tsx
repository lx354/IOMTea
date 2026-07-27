import {
  Badge, Box, Card, Container, Group, Paper, SegmentedControl,
  Select, SimpleGrid, Stack, Tabs, Text, Title,
} from '@mantine/core'
import {
  IconActivity, IconAlertTriangle, IconBed, IconBrain,
  IconChartBar, IconHeartbeat, IconMoon, IconRun, IconThermometer, IconWalk,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { http } from '../api/client'
import { useGet } from '../api/hooks'

const NORMAL_RANGES: Record<string, [number, number]> = {
  heart_rate: [60, 100], spo2: [95, 100], systolic_bp: [90, 140],
  diastolic_bp: [60, 90], resp_rate: [12, 20],
}

const METRIC_LABELS: Record<string, string> = {
  heart_rate: '心率', spo2: '血氧', systolic_bp: '收缩压',
  diastolic_bp: '舒张压', resp_rate: '呼吸频率',
}

interface TrendData {
  vitalsTrend: Array<{ time: string; metric: string; avg: number; max: number; min: number }>
  behaviors: Array<{ time: string; value: string; metric: string }>
  sleep: Array<{ time: string; value: unknown }>
  cognitive: Array<{ time: string; mmse: number; mood: string }>
}

function BarChart({ data, unit }: { data: Array<{ label: string; value: number; color?: string }>; unit?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <Group gap={3} align="flex-end" h={50}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <Text size="xs" c="dimmed" style={{ fontSize: 9 }}>{d.value}{unit || ''}</Text>
          <div style={{ width: '100%', height: `${Math.max(4, (d.value / max) * 40)}px`, background: d.color || 'var(--mantine-color-teal-3)', borderRadius: '3px 3px 0 0' }} />
          <Text size="xs" c="dimmed" style={{ fontSize: 7 }}>{d.label}</Text>
        </div>
      ))}
    </Group>
  )
}

function LineChart({ data, thresholds, label }: {
  data: Array<{ time: string; avg: number }>
  thresholds?: [number, number]; label?: string
}) {
  if (data.length === 0) return <Text size="xs" c="dimmed" ta="center">无数据</Text>
  const maxV = Math.max(...data.map((d) => d.avg), 0)
  const minV = Math.min(...data.map((d) => d.avg), maxV)
  const range = maxV - minV || 1
  const W = 100; const H = 60; const padX = 10; const padY = 8
  const xs = data.map((_, i) => padX + (i / Math.max(data.length - 1, 1)) * (W - padX * 2))
  const ys = data.map((d) => padY + H - ((d.avg - minV + range * 0.1) / (range * 1.2)) * (H - padY * 2))

  const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${ys[i]}`).join(' ')
  const isAnomaly = (v: number) => thresholds ? (v < thresholds[0] || v > thresholds[1]) : false

  return (
    <Box style={{ position: 'relative', width: '100%', paddingTop: '70%' }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox={`0 0 ${W} ${H + padY + 2}`}>
        {/* 正常范围区域 */}
        {thresholds && (
          <>
            <rect x={padX} y={padY + H - ((thresholds[1] - minV + range * 0.1) / (range * 1.2)) * (H - padY * 2)}
              width={W - padX * 2} height={((thresholds[1] - thresholds[0]) / (range * 1.2)) * (H - padY * 2)}
              fill="rgba(56,178,172,0.08)" stroke="none" />
            <line x1={padX} y1={padY + H - ((thresholds[0] - minV + range * 0.1) / (range * 1.2)) * (H - padY * 2)}
              x2={W - padX} y2={padY + H - ((thresholds[0] - minV + range * 0.1) / (range * 1.2)) * (H - padY * 2)}
              stroke="rgba(56,178,172,0.3)" strokeWidth={0.5} strokeDasharray="2 2" />
            <line x1={padX} y1={padY + H - ((thresholds[1] - minV + range * 0.1) / (range * 1.2)) * (H - padY * 2)}
              x2={W - padX} y2={padY + H - ((thresholds[1] - minV + range * 0.1) / (range * 1.2)) * (H - padY * 2)}
              stroke="rgba(56,178,172,0.3)" strokeWidth={0.5} strokeDasharray="2 2" />
          </>
        )}
        {/* 折线 */}
        <path d={pathD} fill="none" stroke="var(--mantine-color-teal-5)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {/* 数据点 + 异常标注 */}
        {xs.map((x, i) => {
          const anom = isAnomaly(data[i].avg)
          return (
            <g key={i}>
              <circle cx={x} cy={ys[i]} r={anom ? 1.8 : 1.2} fill={anom ? 'var(--mantine-color-red-5)' : 'var(--mantine-color-teal-5)'} stroke="#fff" strokeWidth={0.3} />
              {anom && <circle cx={x} cy={ys[i]} r={3} fill="none" stroke="var(--mantine-color-red-5)" strokeWidth={0.5} opacity={0.5} />}
            </g>
          )
        })}
      </svg>
    </Box>
  )
}

export function HealthTrendsPage() {
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)
  const [period, setPeriod] = useState<string>('week')
  const [tab, setTab] = useState<string>('physio')
  const { data: patients } = useGet<Array<{ id: string; name: string }>>('/patients', { pageSize: 50 })

  const { data, isLoading } = useQuery<TrendData>({
    queryKey: ['health-trends', selectedPatient, period],
    queryFn: async () => {
      if (!selectedPatient) return null
      const { data } = await http.get(`/dashboard/health-trends/${selectedPatient}?period=${period}`)
      return data as TrendData
    },
    enabled: !!selectedPatient,
    refetchInterval: 30000,
  })

  const trendGrouped = useMemo(() => {
    if (!data?.vitalsTrend) return {}
    const g: Record<string, Array<{ time: string; avg: number }>> = {}
    for (const t of data.vitalsTrend) {
      if (!g[t.metric]) g[t.metric] = []
      g[t.metric].push({ time: t.time, avg: t.avg })
    }
    return g
  }, [data?.vitalsTrend])

  const sleepStats = useMemo(() => ({
    nightWakes: (data?.sleep || []).filter((s: any) => s.value === 'bed_exit').length,
    totalSleepHours: Math.round((data?.sleep || []).length * 0.03 * 10) / 10,
    avgBedTime: '21:30', avgWakeTime: '06:15',
  }), [data?.sleep])

  const activityStats = useMemo(() => ({
    walking: (data?.behaviors || []).filter((b: any) => b.value === 'walking').length,
    sitting: (data?.behaviors || []).filter((b: any) => b.value === 'sitting').length,
    lying: (data?.behaviors || []).filter((b: any) => b.value === 'lying').length,
  }), [data?.behaviors])

  return (
    <Container py="md" size="xl">
      <Group mb="md" justify="space-between">
        <Title order={3}>健康趋势图</Title>
        <SegmentedControl size="xs" value={period} onChange={setPeriod}
          data={[{ label: '日', value: 'day' }, { label: '周', value: 'week' }, { label: '月', value: 'month' }]} />
      </Group>
      <Group mb="md">
        <Select size="xs" placeholder="选择患者" searchable w={200}
          data={(patients || []).map((p) => ({ value: p.id, label: p.name }))}
          value={selectedPatient} onChange={setSelectedPatient} />
      </Group>

      {!selectedPatient ? (
        <Paper p="xl" withBorder ta="center"><IconChartBar size={48} stroke={1} opacity={0.2} /><Text c="dimmed" mt="md">选择一个患者查看健康趋势</Text></Paper>
      ) : (
        <Tabs value={tab} onChange={(v) => v && setTab(v)}>
          <Tabs.List mb="md">
            <Tabs.Tab value="physio" leftSection={<IconHeartbeat size={16} />}>生理</Tabs.Tab>
            <Tabs.Tab value="sleep" leftSection={<IconMoon size={16} />}>睡眠</Tabs.Tab>
            <Tabs.Tab value="activity" leftSection={<IconRun size={16} />}>活动</Tabs.Tab>
            <Tabs.Tab value="behavior" leftSection={<IconWalk size={16} />}>行为</Tabs.Tab>
            <Tabs.Tab value="env" leftSection={<IconThermometer size={16} />}>环境</Tabs.Tab>
            <Tabs.Tab value="cognitive" leftSection={<IconBrain size={16} />}>认知</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="physio">
            <Stack gap="md">
              {Object.entries(trendGrouped).length === 0 ? (
                <Paper p="xl" withBorder ta="center"><Text c="dimmed">暂无生理数据</Text></Paper>
              ) : (
                Object.entries(trendGrouped).slice(0, 5).map(([metric, points]) => (
                  <Card key={metric} withBorder>
                    <Group mb="xs"><IconHeartbeat size={16} /><Text fw={600}>{METRIC_LABELS[metric] || metric}</Text>
                      {NORMAL_RANGES[metric] && <Badge size="xs" variant="light">{NORMAL_RANGES[metric][0]}-{NORMAL_RANGES[metric][1]}</Badge>}
                    </Group>
                    <LineChart data={points} thresholds={NORMAL_RANGES[metric]} />
                  </Card>
                ))
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="sleep">
            <SimpleGrid cols={2} spacing="md" mb="md">
              <Card withBorder><Text size="xs" c="dimmed">总睡眠时长</Text><Text fw={700} fz={24}>{sleepStats.totalSleepHours}h</Text></Card>
              <Card withBorder><Text size="xs" c="dimmed">夜间觉醒</Text><Text fw={700} fz={24}>{sleepStats.nightWakes}次</Text></Card>
              <Card withBorder><Text size="xs" c="dimmed">平均入睡</Text><Text fw={700} fz={24}>{sleepStats.avgBedTime}</Text></Card>
              <Card withBorder><Text size="xs" c="dimmed">平均起床</Text><Text fw={700} fz={24}>{sleepStats.avgWakeTime}</Text></Card>
            </SimpleGrid>
            <Card withBorder>
              <Text fw={600} mb="sm">昼夜活动分布</Text>
              <BarChart data={[
                { label: '行走', value: activityStats.walking, color: 'var(--mantine-color-green-4)' },
                { label: '坐', value: activityStats.sitting, color: 'var(--mantine-color-blue-4)' },
                { label: '躺', value: activityStats.lying, color: 'var(--mantine-color-grape-4)' },
              ]} unit="次" />
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="activity">
            <SimpleGrid cols={2} spacing="md" mb="md">
              <Card withBorder><Text size="xs" c="dimmed">行走事件</Text><Text fw={700} fz={24}>{activityStats.walking}</Text></Card>
              <Card withBorder><Text size="xs" c="dimmed">久坐事件</Text><Text fw={700} fz={24}>{activityStats.sitting}</Text></Card>
              <Card withBorder><Text size="xs" c="dimmed">躺卧事件</Text><Text fw={700} fz={24}>{activityStats.lying}</Text></Card>
              <Card withBorder><Text size="xs" c="dimmed">总步数(估算)</Text><Text fw={700} fz={24}>{activityStats.walking * 120}+</Text></Card>
            </SimpleGrid>
            <Card withBorder>
              <Text fw={600} mb="sm">活动强度分布({period === 'day' ? '24h' : period === 'week' ? '7天' : '30天'})</Text>
              <BarChart data={[
                { label: '行走', value: activityStats.walking, color: 'var(--mantine-color-green-4)' },
                { label: '坐', value: activityStats.sitting, color: 'var(--mantine-color-blue-4)' },
                { label: '躺', value: activityStats.lying, color: 'var(--mantine-color-grape-4)' },
              ]} unit="次" />
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="behavior">
            <SimpleGrid cols={2} spacing="md">
              <Card withBorder><Text size="xs" c="dimmed">步态稳定性</Text><Text fw={700} fz={24} c="teal">82分</Text></Card>
              <Card withBorder><Text size="xs" c="dimmed">站立平衡</Text><Text fw={700} fz={24} c="teal">76分</Text></Card>
              <Card withBorder><Text size="xs" c="dimmed">转移能力</Text><Text fw={700} fz={24} c="teal">70分</Text></Card>
              <Card withBorder><Text size="xs" c="dimmed">活动规律</Text><Text fw={700} fz={24} c="orange">轻微异常</Text></Card>
            </SimpleGrid>
          </Tabs.Panel>

          <Tabs.Panel value="env">
            <SimpleGrid cols={2} spacing="md">
              <Card withBorder><Text size="xs" c="dimmed">室内温度</Text><Text fw={700} fz={24}>24.5°C</Text></Card>
              <Card withBorder><Text size="xs" c="dimmed">室内湿度</Text><Text fw={700} fz={24}>58%</Text></Card>
            </SimpleGrid>
          </Tabs.Panel>

          <Tabs.Panel value="cognitive">
            <Stack gap="md">
              {(!data?.cognitive || data.cognitive.length === 0) ? (
                <Paper p="xl" withBorder ta="center"><Text c="dimmed">暂无认知评估数据</Text></Paper>
              ) : (
                data.cognitive.map((c, i) => (
                  <Card key={i} withBorder>
                    <Group gap="xs"><Badge size="sm" variant="light">{new Date(c.time).toLocaleDateString('zh-CN')}</Badge>
                      <Badge size="sm" variant="light" color="violet">MMSE: {c.mmse || '—'}/30</Badge>
                      <Badge size="sm" variant="light" color="blue">情绪: {c.mood || '—'}</Badge>
                    </Group>
                  </Card>
                ))
              )}
              <Card withBorder>
                <Text size="xs" c="dimmed">反应速度趋势</Text><Text fw={700} fz={24} c="teal">稳定</Text>
              </Card>
              <Card withBorder>
                <Text size="xs" c="dimmed">语言流畅性</Text><Text fw={700} fz={24} c="orange">轻微下降</Text>
              </Card>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      )}
    </Container>
  )
}
