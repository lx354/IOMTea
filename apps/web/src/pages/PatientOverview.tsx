import {
  Badge, Card, Grid, Group, Loader, Paper, ScrollArea,
  SimpleGrid, Stack, Text, ThemeIcon, Timeline, Title,
} from '@mantine/core'
import {
  IconAlertTriangle, IconAmbulance, IconBrain,
  IconCalendarEvent, IconChartBar, IconHeartbeat,
  IconMessageCircle, IconMoon, IconTimeline, IconWalk,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { http } from '../api/client'

const ALERT_COLORS: Record<string, string> = { critical: 'red', warning: 'orange', info: 'blue' }
const ALERT_LABELS: Record<string, string> = { critical: '危急', warning: '警告', info: '提示' }
const BEHAVIOR_LABELS: Record<string, string> = {
  standing: '站立', sitting: '坐', lying: '躺', walking: '行走',
  falling: '跌倒', sitting_up: '起身', wandering: '徘徊',
}
const BEHAVIOR_COLORS: Record<string, string> = {
  standing: 'blue', sitting: 'teal', lying: 'grape',
  walking: 'green', falling: 'red', sitting_up: 'orange', wandering: 'violet',
}
const METRIC_LABELS: Record<string, string> = { heart_rate: '心率', spo2: '血氧', systolic_bp: '血压' }

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}小时前`
  return `${Math.floor(hrs / 24)}天前`
}

export function PatientOverview({ patientId }: { patientId: string; latest?: any[] | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ['patient-overview', patientId],
    queryFn: async () => {
      const { data } = await http.get(`/dashboard/patient/${patientId}/overview`)
      return data as {
        latestVitals: Array<{ metric: string; value: unknown; unit: string | null; recorded_at: string }>
        trends: Array<{ day: string; metric: string; avg_value: number }>
        behaviors: Array<{ value: string; tags: any; recorded_at: string }>
        alerts: Array<{ id: string; metric: string; value: unknown; severity: string | null; source: string | null; recorded_at: string; tags: any }>
        chats: Array<{ tags: { profileName?: string; mmse?: number; mood?: string; memory?: string; orientation?: string }; recorded_at: string }>
      }
    },
    refetchInterval: 30000,
  })

  const trendGrouped = useMemo(() => {
    if (!data?.trends) return {}
    const g: Record<string, Array<{ day: string; value: number }>> = {}
    for (const t of data.trends) {
      if (!g[t.metric]) g[t.metric] = []
      g[t.metric].push({ day: t.day, value: t.avg_value })
    }
    return g
  }, [data?.trends])

  if (isLoading) return <Loader size="sm" />

  return (
    <Grid gutter="md">
      {/* 最近体征 + 趋势 */}
      <Grid.Col span={{ base: 12, md: 5 }}>
        <Card withBorder>
          <Group mb="xs"><IconHeartbeat size={16} /><Text fw={600}>最近体征</Text></Group>
          <SimpleGrid cols={3} mb="md">
            {(data?.latestVitals || []).slice(0, 9).map((v) => (
              <Paper key={v.metric} p="xs" withBorder style={{ background: 'rgba(0,0,0,0.01)' }}>
                <Text size="xs" c="dimmed">{v.metric}</Text>
                <Text fw={600} size="sm">{String(v.value ?? '-')}{v.unit ? ` ${v.unit}` : ''}</Text>
              </Paper>
            ))}
          </SimpleGrid>

          {Object.keys(trendGrouped).length > 0 && (
            <>
              <Text size="xs" fw={600} mb="xs">7 天趋势</Text>
              {Object.entries(trendGrouped).slice(0, 3).map(([metric, points]) => {
                const maxV = Math.max(...points.map((p: any) => p.value), 1)
                return (
                  <Stack key={metric} gap={2} mb="md">
                    <Group gap="xs"><IconChartBar size={14} opacity={0.5} /><Text size="xs" c="dimmed">{METRIC_LABELS[metric] || metric}</Text></Group>
                    <Group gap={2} align="flex-end" h={40}>
                      {points.map((p: any, i: number) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: '100%', maxWidth: 20, height: `${Math.max(3, (p.value / maxV) * 32)}px`, background: 'var(--mantine-color-teal-3)', borderRadius: '2px 2px 0 0' }} />
                        </div>
                      ))}
                    </Group>
                  </Stack>
                )
              })}
            </>
          )}
        </Card>
      </Grid.Col>

      {/* 警告时间线 */}
      <Grid.Col span={{ base: 12, md: 7 }}>
        <Card withBorder mb="md">
          <Group mb="xs"><IconAlertTriangle size={16} /><Text fw={600}>警告时间线</Text></Group>
          {(data?.alerts || []).length === 0 ? <Text size="xs" c="dimmed">暂无告警</Text> : (
            <ScrollArea h={180}>
              <Stack gap={4}>
                {(data?.alerts || []).map((a) => (
                  <Group key={a.id} gap="xs" py={4} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <Badge size="sm" variant="filled" color={ALERT_COLORS[a.severity || 'info'] || 'blue'}>{ALERT_LABELS[a.severity || 'info'] || a.severity}</Badge>
                    <Text size="xs" fw={500}>{a.metric}: {String(a.value ?? '-')}</Text>
                    <Text size="xs" c="dimmed" style={{ flex: 1 }}>{a.source || ''}</Text>
                    <Text size="xs" c="dimmed">{timeAgo(a.recorded_at)}</Text>
                  </Group>
                ))}
              </Stack>
            </ScrollArea>
          )}
        </Card>

        {/* 行为日志 */}
        <Card withBorder mb="md">
          <Group mb="xs"><IconBrain size={16} /><Text fw={600}>行为日志</Text></Group>
          {(data?.behaviors || []).length === 0 ? <Text size="xs" c="dimmed">暂无行为记录</Text> : (
            <ScrollArea h={100}>
              <Group gap="xs" wrap="wrap">
                {(data?.behaviors || []).map((b, i) => (
                  <Badge key={i} size="md" variant="light" color={BEHAVIOR_COLORS[String(b.value)] || 'gray'}>
                    {BEHAVIOR_LABELS[String(b.value)] || String(b.value)} · {timeAgo(b.recorded_at)}
                  </Badge>
                ))}
              </Group>
            </ScrollArea>
          )}
        </Card>

        {/* 对话记录 */}
        <Card withBorder>
          <Group mb="xs"><IconMessageCircle size={16} /><Text fw={600}>对话记录</Text></Group>
          {(data?.chats || []).length === 0 ? <Text size="xs" c="dimmed">暂无对话</Text> : (
            <Stack gap="xs">
              {(data?.chats || []).map((c, i) => (
                <Paper key={i} p="xs" radius="md" style={{ background: 'rgba(0,0,0,0.01)', border: '1px solid rgba(0,0,0,0.04)' }}>
                  <Group gap="xs">
                    <Badge size="xs" variant="light" color="teal">{c.tags?.profileName || '对话'}</Badge>
                    {c.tags?.mmse && <Badge size="xs" variant="dot" color="violet">MMSE~{c.tags.mmse}</Badge>}
                    {c.tags?.mood && <Badge size="xs" variant="light" color="blue">{c.tags.mood}</Badge>}
                    <Text size="xs" c="dimmed">{timeAgo(c.recorded_at)}</Text>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </Card>
      </Grid.Col>
    </Grid>
  )
}
