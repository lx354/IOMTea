import {
  Avatar, Badge, Box, Card, Container, Grid, Group, Paper,
  RingProgress, ScrollArea, SimpleGrid, Stack, Text, ThemeIcon, Timeline, Title,
} from '@mantine/core'
import {
  IconActivity, IconAlertTriangle, IconAmbulance, IconBrain,
  IconCalendarEvent, IconFlask, IconHeartbeat, IconMessageCircle,
  IconMoon, IconUser, IconUsers, IconWalk,
} from '@tabler/icons-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { http } from '../api/client'
import { useRealtime } from '../hooks/useRealtime'

const EVENT_ICONS: Record<string, React.ElementType> = {
  alert: IconAlertTriangle, observation: IconActivity,
  state_transition: IconHeartbeat, behavior: IconBrain,
  chat_assessment: IconMessageCircle,
}
const EVENT_COLORS: Record<string, string> = {
  alert: 'red', observation: 'blue', state_transition: 'teal',
  behavior: 'grape', chat_assessment: 'green',
}
const EVENT_LABELS: Record<string, string> = {
  alert: '警告', observation: '体征', state_transition: '状态变更',
  behavior: '行为', chat_assessment: '评估',
}

interface DashboardSummary { patientCount: number; activeAlerts24h: number; criticalAlerts: number }
interface SimConfig { id: string; name: string; profileName: string; running: boolean; patientCount: number }
interface TrendRow { day: string; count: number }
interface EventRow {
  id: string; kind: string; metric: string; value: unknown
  patientName: string; recordedAt: string; source: string
}
interface PatientRow { id: string; name: string; tags?: Record<string, unknown> }

function StatCard({ label, value, color, icon, to }: {
  label: string; value: number | string; color: string; icon: React.ReactNode; to?: string
}) {
  const content = (
    <Paper p="md" withBorder className="card-hover">
      <Group gap="xs" mb={4}>
        <ThemeIcon size="sm" color={color} variant="light">{icon}</ThemeIcon>
        <Text size="xs" c="dimmed">{label}</Text>
      </Group>
      <Text fw={700} fz={28}>{value}</Text>
    </Paper>
  )
  return to ? <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }}>{content}</Link> : content
}

function TrendBars({ data }: { data: TrendRow[] }) {
  if (!data.length) return <Text size="xs" c="dimmed" ta="center">暂无数据</Text>
  const maxCount = Math.max(...data.map((d) => d.count), 1)
  return (
    <Group gap={6} align="flex-end" h={80}>
      {data.map((d) => (
        <Stack key={d.day} align="center" gap={2} style={{ flex: 1 }}>
          <Text size="xs" fw={500}>{d.count}</Text>
          <Box style={{
            width: '100%', maxWidth: 24,
            height: `${Math.max(4, (d.count / maxCount) * 60)}px`,
            background: d.count > 0 ? 'var(--mantine-color-red-5)' : 'var(--mantine-color-gray-3)',
            borderRadius: '4px 4px 0 0', transition: 'height .2s',
          }} />
          <Text size="xs" c="dimmed">{new Date(d.day).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}</Text>
        </Stack>
      ))}
    </Group>
  )
}

function BehaviorsBar({ behaviors }: { behaviors: Record<string, number> }) {
  const all = Object.entries(behaviors).sort(([, a], [, b]) => b - a).slice(0, 7)
  const maxVal = Math.max(...all.map(([, v]) => v), 1)
  if (all.length === 0) return <Text size="xs" c="dimmed" ta="center">暂无行为数据</Text>
  return (
    <Stack gap={4}>
      {all.map(([b, v]) => (
        <Group key={b} gap="xs" wrap="nowrap">
          <Text size="xs" w={40} ta="right" truncate>{b}</Text>
          <Box style={{ flex: 1, height: 14, background: 'var(--mantine-color-gray-2)', borderRadius: 4, overflow: 'hidden' }}>
            <Box style={{ width: `${(v / maxVal) * 100}%`, height: '100%', background: 'var(--mantine-color-teal-5)', borderRadius: 4 }} />
          </Box>
          <Text size="xs" w={24}>{v}</Text>
        </Group>
      ))}
    </Stack>
  )
}

const GLASS = { bg: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)' }

export function DashboardPage() {
  const navigate = useNavigate()
  const { data: summary } = useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary'], queryFn: () => http.get('/dashboard/summary').then((r) => r.data as DashboardSummary),
  })
  const { data: sims } = useQuery<SimConfig[]>({
    queryKey: ['dashboard-sims'], queryFn: () => http.get('/twin/simulations').then((r) => r.data as SimConfig[]),
  })
  const { data: trends } = useQuery<TrendRow[]>({
    queryKey: ['dashboard-trends'], queryFn: () => http.get('/dashboard/trends?days=7').then((r) => r.data as TrendRow[]),
  })
  const { data: events } = useQuery<EventRow[]>({
    queryKey: ['dashboard-events'], queryFn: () => http.get('/dashboard/recent-events').then((r) => r.data as EventRow[]), refetchInterval: 15000,
  })
  const { data: patients } = useQuery<PatientRow[]>({
    queryKey: ['dashboard-patients'], queryFn: () => http.get('/patients?pageSize=6').then((r) => (r.data as { data?: PatientRow[] }).data ?? (r.data as PatientRow[])),
  })

  const [liveVitals, setLiveVitals] = useState<Record<string, { metric: string; value: number }>>({})
  useRealtime({
    onVitals: (data) => {
      setLiveVitals((prev) => { const next = { ...prev }; for (const m of data.metrics) next[m.metric] = { metric: m.metric, value: m.value }; return next })
    },
  })

  const activeSims = (sims || []).filter((s) => s.running).length
  const totalSimPatients = (sims || []).reduce((s, si) => s + si.patientCount, 0)
  const behaviorCounts: Record<string, number> = {}
  for (const e of (events || [])) {
    if (e.kind === 'observation' && e.metric === 'behavior' && typeof e.value === 'string') {
      behaviorCounts[e.value] = (behaviorCounts[e.value] || 0) + 1
    }
  }

  return (
    <Container py="md" size="xl">
      <Title order={3} mb="xs">工作台</Title>
      <Text size="xs" c="dimmed" mb="md">
        {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
      </Text>

      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="md">
        <StatCard label="在管患者" value={summary?.patientCount ?? 0} color="teal" icon={<IconUsers size={14} />} to="/patients" />
        <StatCard label="24h 警告" value={summary?.activeAlerts24h ?? 0} color="orange" icon={<IconAlertTriangle size={14} />} to="/alerts" />
        <StatCard label="活跃仿真" value={`${activeSims} / ${(sims || []).length}`} color="blue" icon={<IconFlask size={14} />} to="/simulation" />
        <StatCard label="严重警告" value={summary?.criticalAlerts ?? 0} color="red" icon={<IconAmbulance size={14} />} to="/alerts" />
      </SimpleGrid>

      {patients && patients.length > 0 && (
        <Card withBorder mb="md">
          <Text fw={600} mb="sm">老人安全指数</Text>
          <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="xs">
            {(patients as any[]).slice(0, 6).map((p: any) => (
              <SafetyIndexBadge key={p.id} patientId={p.id} patientName={p.name} />
            ))}
          </SimpleGrid>
        </Card>
      )}

      <Grid gutter="md">
        {/* ── 左侧：警告趋势 + 事件时间线 ── */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card withBorder mb="md">
            <Text fw={600} mb="sm">最近 7 天警告趋势</Text>
            <TrendBars data={trends || []} />
          </Card>

          <Card withBorder>
            <Text fw={600} mb="sm">最近事件</Text>
            <ScrollArea h={340} offsetScrollbars>
              {(!events || events.length === 0) ? (
                <Text size="xs" c="dimmed">暂无事件</Text>
              ) : (
                <Stack gap={0}>
                  {events.slice(0, 15).map((e) => {
                    const Icon = EVENT_ICONS[e.kind] || IconCalendarEvent
                    const color = EVENT_COLORS[e.kind] || 'gray'
                    const kindLabel = EVENT_LABELS[e.kind] || e.kind
                    const timeStr = new Date(e.recordedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                    const valStr = typeof e.value === 'string' ? e.value : (e.value != null ? String(e.value) : '—')
                    return (
                      <Group key={e.id} gap="xs" py={6} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                        <ThemeIcon size="xs" variant="light" color={color}><Icon size={10} /></ThemeIcon>
                        <Badge size="xs" variant="light" color={color}>{kindLabel}</Badge>
                        <Text size="xs" fw={500}>{e.patientName}</Text>
                        <Text size="xs" c="dimmed" style={{ flex: 1 }} truncate>{valStr}</Text>
                        <Text size="xs" c="dimmed">{timeStr}</Text>
                      </Group>
                    )
                  })}
                </Stack>
              )}
            </ScrollArea>
          </Card>
        </Grid.Col>

        {/* ── 右侧：患者概览 + 行为统计 + 实时体征 ── */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card withBorder mb="md">
            <Group justify="space-between" mb="sm">
              <Text fw={600}>患者概览</Text>
              <Link to="/patients" style={{ fontSize: 12, color: 'var(--mantine-color-blue-5)' }}>全部 →</Link>
            </Group>
            {(patients || []).slice(0, 5).map((p) => (
              <Group key={p.id} gap="xs" py={6} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', cursor: 'pointer' }}
                onClick={() => navigate({ to: `/patients/${p.id}` })}>
                <Avatar radius="xl" size="sm" color="teal">{p.name.charAt(0)}</Avatar>
                <Text size="sm" fw={500}>{p.name}</Text>
              </Group>
            ))}
            {(!patients || patients.length === 0) && (
              <Text size="xs" c="dimmed">暂无患者</Text>
            )}
          </Card>

          {Object.keys(behaviorCounts).length > 0 && (
            <Card withBorder mb="md">
              <Text fw={600} mb="sm">行为统计</Text>
              <BehaviorsBar behaviors={behaviorCounts} />
            </Card>
          )}

          <Card withBorder>
            <Text fw={600} mb="sm">实时体征</Text>
            {Object.keys(liveVitals).length === 0 ? (
              <Text size="xs" c="dimmed">等待实时数据或启动仿真...</Text>
            ) : (
              <Group gap="xs" wrap="wrap">
                {Object.entries(liveVitals).slice(0, 12).map(([k, v]) => (
                  <Badge key={k} size="sm" variant="light" color="blue">
                    {k}: {Math.round(v.value * 10) / 10}
                  </Badge>
                ))}
              </Group>
            )}
          </Card>
        </Grid.Col>
      </Grid>
    </Container>
  )
}

function SafetyIndexBadge({ patientId, patientName }: { patientId: string; patientName: string }) {
  const { data } = useQuery<any>({
    queryKey: ['fusion-score', patientId],
    queryFn: () => http.get(`/dashboard/fusion-score/${patientId}`).then((r) => r.data),
    refetchInterval: 30000,
  })
  const score = data?.overallIndex ?? 0
  const status = data?.overallStatus ?? ''
  const color = status === '安全' ? 'green' : status === '注意' ? 'orange' : 'red'
  return (
    <Paper p="xs" withBorder>
      <Group gap="xs" wrap="nowrap">
        <RingProgress size={44} thickness={4}
          sections={[{ value: score, color }]}
          label={<Text size="xs" fw={700} ta="center">{score}</Text>} />
        <div style={{ flex: 1 }}>
          <Text size="xs" fw={500} truncate>{patientName}</Text>
          <Text size="xs" c={color}>{status}</Text>
        </div>
      </Group>
    </Paper>
  )
}
