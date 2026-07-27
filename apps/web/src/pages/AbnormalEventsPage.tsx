import {
  Badge, Button, Card, Container, Group, Paper, ScrollArea,
  SegmentedControl, Select, Stack, Text, Title,
} from '@mantine/core'
import {
  IconAlertTriangle, IconAmbulance, IconBell, IconCheck,
  IconClock, IconEye, IconInfoCircle, IconMapPin,
  IconPlayerPlay, IconX,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { http } from '../api/client'
import { useGet } from '../api/hooks'

interface AbnormalEvent {
  id: string; time: string; type: string; category: string
  level: string; location: string; status: string
  relatedData: string; suggestion: string; duration: string
  patientName: string
}

const LEVEL_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  critical: { color: 'red', icon: IconAmbulance, label: '紧急' },
  warning: { color: 'orange', icon: IconAlertTriangle, label: '警告' },
  info: { color: 'blue', icon: IconInfoCircle, label: '提示' },
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: 'red', label: '待处理' },
  confirmed: { color: 'blue', label: '已确认' },
  ignored: { color: 'gray', label: '已忽略' },
  processing: { color: 'orange', label: '处理中' },
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000); if (mins < 1) return '刚刚'; if (mins < 60) return `${mins}分钟前`
  const hrs = Math.floor(mins / 60); if (hrs < 24) return `${hrs}小时前`; return `${Math.floor(hrs / 24)}天前`
}

export function AbnormalEventsPage() {
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)
  const [filterLevel, setFilterLevel] = useState<string>('all')
  const { data: patients } = useGet<Array<{ id: string; name: string }>>('/patients', { pageSize: 50 })

  const { data: events, isLoading } = useQuery<AbnormalEvent[]>({
    queryKey: ['abnormal-events-detail', selectedPatient],
    queryFn: async () => {
      if (!selectedPatient) return []
      const { data } = await http.get(`/dashboard/abnormal-events/${selectedPatient}`)
      return (data as AbnormalEvent[]) || []
    },
    enabled: !!selectedPatient,
    refetchInterval: 15000,
  })

  const filtered = (events || []).filter((e) => filterLevel === 'all' || e.level === filterLevel)

  return (
    <Container py="md" size="xl">
      <Title order={3} mb="md">异常事件列表</Title>
      <Group mb="md">
        <Select size="xs" placeholder="选择患者" searchable w={200}
          data={(patients || []).map((p) => ({ value: p.id, label: p.name }))}
          value={selectedPatient} onChange={setSelectedPatient} />
        <SegmentedControl size="xs" value={filterLevel} onChange={setFilterLevel}
          data={[{ label: '全部', value: 'all' }, { label: '紧急', value: 'critical' }, { label: '警告', value: 'warning' }, { label: '提示', value: 'info' }]} />
        <Badge size="sm" variant="light">{filtered.length} 条事件</Badge>
      </Group>

      {!selectedPatient ? (
        <Paper p="xl" withBorder ta="center"><IconBell size={48} stroke={1} opacity={0.2} /><Text c="dimmed" mt="md">选择一个患者查看异常事件</Text></Paper>
      ) : (
        <ScrollArea h="calc(100vh - 200px)">
          <Stack gap="md">
            {filtered.length === 0 ? (
              <Paper p="xl" withBorder ta="center"><Text c="dimmed">暂无异常事件</Text></Paper>
            ) : (
              filtered.map((e) => {
                const lc = LEVEL_CONFIG[e.level] || LEVEL_CONFIG.info
                const sc = STATUS_CONFIG[e.status] || STATUS_CONFIG.pending
                const LevelIcon = lc.icon
                return (
                  <Card key={e.id} withBorder radius="md" style={{ borderLeft: `4px solid var(--mantine-color-${lc.color}-5)` }}>
                    {/* 顶部：等级 + 类型 + 时间 */}
                    <Group justify="space-between" mb="xs">
                      <Group gap="xs">
                        <LevelIcon size={18} color={`var(--mantine-color-${lc.color}-5)`} />
                        <Badge size="sm" color={lc.color}>{lc.label}</Badge>
                        <Badge size="sm" variant="light">{e.category || e.type}</Badge>
                      </Group>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed">{new Date(e.time).toLocaleString('zh-CN')}</Text>
                        <Text size="xs" c="dimmed">({timeAgo(e.time)})</Text>
                      </Group>
                    </Group>

                    {/* 中间：位置 + 状态 + 持续 */}
                    <Group mb="xs" gap="lg">
                      <Group gap={4}><IconMapPin size={14} opacity={0.5} /><Text size="xs">{e.location || '—'}</Text></Group>
                      <Badge size="xs" variant="light" color={sc.color}>{sc.label}</Badge>
                      <Group gap={4}><IconClock size={14} opacity={0.5} /><Text size="xs">{e.duration}</Text></Group>
                    </Group>

                    {/* 关联数据 */}
                    <Paper p="xs" radius="md" mb="xs" style={{ background: 'rgba(0,0,0,0.02)' }}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed">📊 关联数据：</Text>
                        <Text size="xs" fw={500}>{e.relatedData}</Text>
                      </Group>
                    </Paper>

                    {/* AI 建议 */}
                    <Paper p="xs" radius="md" mb="xs" style={{ background: 'rgba(56,178,172,0.04)', border: '1px solid rgba(56,178,172,0.15)' }}>
                      <Text size="xs" c="teal" fw={500}>💡 AI建议：{e.suggestion}</Text>
                    </Paper>

                    {/* 操作按钮 */}
                    <Group gap="xs">
                      {e.status === 'pending' && (
                        <>
                          <Button size="compact-xs" variant="light" color="blue" leftSection={<IconCheck size={12} />}>确认</Button>
                          <Button size="compact-xs" variant="light" color="gray" leftSection={<IconX size={12} />}>忽略</Button>
                          <Button size="compact-xs" variant="light" color="orange" leftSection={<IconPlayerPlay size={12} />}>处理中</Button>
                        </>
                      )}
                      {e.status === 'confirmed' && (
                        <Button size="compact-xs" variant="light" color="orange" leftSection={<IconPlayerPlay size={12} />}>开始处理</Button>
                      )}
                    </Group>
                  </Card>
                )
              })
            )}
          </Stack>
        </ScrollArea>
      )}
    </Container>
  )
}
