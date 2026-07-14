import {
  ActionIcon, Badge, Card, Container, Group, Paper, 
  RingProgress, Select, SimpleGrid, Spoiler, Stack,
  Text, Title,
} from '@mantine/core'
import { IconAlertTriangle, IconAmbulance, IconBell, IconCheck,
  IconEye, IconInfoCircle, IconTimeline } from '@tabler/icons-react'
import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useGet, usePatch, usePost } from '../api/hooks'
import { StateSkeleton } from '../components/StateComponents'

interface Alert {
  id: string; patientId: string; metric: string
  value: unknown; unit: string | null
  severity: string | null; status: string | null
  recordedAt: string; tags?: Record<string, unknown> | null
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType; zh: string }> = {
  critical: { color: '#e03131', bg: 'rgba(224,49,49,0.04)', icon: IconAmbulance, zh: '危急' },
  warning: { color: '#f08c00', bg: 'rgba(240,140,0,0.04)', icon: IconAlertTriangle, zh: '警告' },
  info: { color: '#1c7ed6', bg: 'rgba(28,126,214,0.04)', icon: IconInfoCircle, zh: '提示' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

function timeGroup(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 3600000) return '最近 1 小时'
  if (diff < 86400000) return '今天'
  if (diff < 172800000) return '昨天'
  return '更早'
}

const STATUS_LABELS: Record<string, string> = { new: '新', active: '活跃', acknowledged: '已确认', resolved: '已解决', closed: '已关闭' }
const STATUS_COLORS: Record<string, string> = { new: 'red', active: 'orange', acknowledged: 'blue', resolved: 'green', closed: 'gray' }

export function AlertBoard() {
  const { data: alerts, isLoading } = useGet<Alert[]>('/alerts', { pageSize: 200 })
  const acknowledge = usePost('/alerts/:id')
  const resolveAlert = usePatch('/alerts/:id')
  const closeAlert = usePost('/alerts/:id/close')
  const navigate = useNavigate()
  const [filterPatient, setFilterPatient] = useState<string | null>(null)
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null)
  const { data: patients } = useGet<{ id: string; name: string }[]>('/patients', { pageSize: 200 })

  const patientMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of patients || []) m.set(p.id, p.name)
    return m
  }, [patients])

  const filtered = useMemo(() => (alerts ?? []).filter((a) => {
    if (filterPatient && a.patientId !== filterPatient) return false
    if (filterSeverity && a.severity !== filterSeverity) return false
    return a.status !== 'closed' && a.status !== 'resolved'
  }), [alerts, filterPatient, filterSeverity])

  const stats = useMemo(() => ({
    critical: filtered.filter((a) => a.severity === 'critical').length,
    warning: filtered.filter((a) => a.severity === 'warning').length,
    info: filtered.filter((a) => a.severity === 'info').length,
  }), [filtered])

  const groups = useMemo(() => {
    const g = new Map<string, Alert[]>()
    for (const a of filtered) {
      const tg = timeGroup(a.recordedAt || '')
      if (!g.has(tg)) g.set(tg, [])
      g.get(tg)!.push(a)
    }
    return g
  }, [filtered])

  if (isLoading) return <StateSkeleton lines={4} />

  return (
    <Container py="md" size="xl">
      <Title order={2} mb="md">警告看板</Title>

      {/* ── 统计概览卡片 ── */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="md">
        <Paper p="md" withBorder style={{ background: SEVERITY_CONFIG.critical.bg, borderLeft: `3px solid ${SEVERITY_CONFIG.critical.color}` }}>
          <Group gap="xs"><IconAmbulance size={20} color={SEVERITY_CONFIG.critical.color} />
            <div><Text size="xs" c="dimmed">危急</Text><Text fw={700} fz={24}>{stats.critical}</Text></div>
          </Group>
        </Paper>
        <Paper p="md" withBorder style={{ background: SEVERITY_CONFIG.warning.bg, borderLeft: `3px solid ${SEVERITY_CONFIG.warning.color}` }}>
          <Group gap="xs"><IconAlertTriangle size={20} color={SEVERITY_CONFIG.warning.color} />
            <div><Text size="xs" c="dimmed">警告</Text><Text fw={700} fz={24}>{stats.warning}</Text></div>
          </Group>
        </Paper>
        <Paper p="md" withBorder style={{ background: SEVERITY_CONFIG.info.bg, borderLeft: `3px solid ${SEVERITY_CONFIG.info.color}` }}>
          <Group gap="xs"><IconInfoCircle size={20} color={SEVERITY_CONFIG.info.color} />
            <div><Text size="xs" c="dimmed">提示</Text><Text fw={700} fz={24}>{stats.info}</Text></div>
          </Group>
        </Paper>
        <Paper p="md" withBorder>
          <Group gap="xs"><IconBell size={20} color="gray" />
            <div><Text size="xs" c="dimmed">总计</Text><Text fw={700} fz={24}>{filtered.length}</Text></div>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* ── 筛选 + 列表 ── */}
      <Group mb="md">
        <Select size="xs" placeholder="筛选患者" clearable searchable w={200}
          data={(patients || []).map((p) => ({ value: p.id, label: p.name }))}
          value={filterPatient} onChange={setFilterPatient} />
        <Select size="xs" placeholder="筛选级别" clearable w={120}
          data={[
            { value: 'critical', label: '危急' },
            { value: 'warning', label: '警告' },
            { value: 'info', label: '提示' },
          ]} value={filterSeverity} onChange={setFilterSeverity} />
        <Text size="xs" c="dimmed">{filtered.length} 条警告</Text>
      </Group>

      {filtered.length === 0 ? (
        <Paper p="xl" withBorder ta="center">
          <IconBell size={48} stroke={1} opacity={0.2} />
          <Text c="dimmed" mt="md">暂无活跃警告</Text>
        </Paper>
      ) : (
        <Stack gap="md">
          {Array.from(groups.entries()).map(([tg, items]) => (
            <div key={tg}>
              <Group gap="xs" mb="xs">
                <IconTimeline size={14} />
                <Text size="xs" fw={600} c="dimmed">{tg}</Text>
                <Badge size="xs" variant="light">{items.length}</Badge>
              </Group>
              <Stack gap="sm">
                {items.map((a) => {
                  const sc = SEVERITY_CONFIG[a.severity || 'info'] || SEVERITY_CONFIG.info
                  const Icon = sc.icon
                  const patientName = patientMap.get(a.patientId) || a.patientId.slice(0, 8)
                  const suggestion = (a.tags as any)?.intervention_suggestion as string || undefined
                  return (
                    <Card key={a.id} withBorder style={{ borderLeft: `4px solid ${sc.color}`, background: sc.bg }}>
                      <Group justify="space-between" mb={4}>
                        <Group gap="xs">
                          <Icon size={18} color={sc.color} />
                          <Badge size="sm" variant="filled" color={
                            a.severity === 'critical' ? 'red' : a.severity === 'warning' ? 'orange' : 'blue'
                          }>{sc.zh}</Badge>
                          <Text fw={600} size="sm">{patientName}</Text>
                          <Text size="xs" c="dimmed">
                            {a.metric}: {String(a.value ?? '—')}{a.unit ? ` ${a.unit}` : ''}
                          </Text>
                        </Group>
                        <Group gap="xs">
                          <Badge size="xs" variant="light" color={STATUS_COLORS[a.status || 'new'] || 'gray'}>
                            {STATUS_LABELS[a.status || 'new'] || a.status}
                          </Badge>
                          <Text size="xs" c="dimmed">{timeAgo(a.recordedAt || '')}</Text>
                          <ActionIcon variant="light" size="sm"
                            onClick={() => navigate({ to: `/patients/${a.patientId}/alerts` })}>
                            <IconEye size={14} />
                          </ActionIcon>
                        </Group>
                      </Group>

                      {/* 干预建议 */}
                      {suggestion && (
                        <Spoiler maxHeight={0} showLabel="查看建议" hideLabel="收起">
                          <Text size="xs" c="dimmed" fs="italic" mt={4}>💡 {suggestion}</Text>
                        </Spoiler>
                      )}

                      {/* 操作按钮 */}
                      <Group gap="xs" mt={8}>
                        {(a.status === 'new' || a.status === 'active') && (
                          <Badge size="sm" variant="light" color="green" style={{ cursor: 'pointer' }}
                            leftSection={<IconCheck size={12} />}
                            onClick={() => acknowledge.mutate({ id: a.id, action: 'acknowledge' })}>
                            确认
                          </Badge>
                        )}
                        {a.status === 'acknowledged' && (
                          <>
                            <Badge size="sm" variant="light" color="blue" style={{ cursor: 'pointer' }}
                              onClick={() => resolveAlert.mutate({ id: a.id, action: 'resolve' })}>解决</Badge>
                            <Badge size="sm" variant="light" color="gray" style={{ cursor: 'pointer' }}
                              onClick={() => closeAlert.mutate(a.id)}>关闭</Badge>
                          </>
                        )}
                      </Group>
                    </Card>
                  )
                })}
              </Stack>
            </div>
          ))}
        </Stack>
      )}
    </Container>
  )
}
