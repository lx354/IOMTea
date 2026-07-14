import {
  Badge, Button, Card, Container, Group, Loader, Paper, ScrollArea,
  SimpleGrid, Stack, Text, ThemeIcon, Timeline, Title,
} from '@mantine/core'
import {
  IconAlertTriangle, IconBrain, IconCheck, IconHeart,
  IconPill, IconRun, IconWalk, IconX,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { http } from '../api/client'
import { useGet } from '../api/hooks'

interface Suggestion {
  id: string; patientId: string; timestamp: string
  category: string; priority: string; summary: string; detail: string
  basis: string[]; validityHours: number; expectedEffect: string
  targetRoles: string[]; status: string
}

const CAT_ICONS: Record<string, React.ElementType> = {
  safety: IconAlertTriangle, health: IconHeart, cognitive: IconBrain,
  daily: IconRun, emotional: IconWalk,
}
const CAT_COLORS: Record<string, string> = { safety: 'red', health: 'orange', cognitive: 'grape', daily: 'blue', emotional: 'pink' }
const CAT_LABELS: Record<string, string> = { safety: '安全', health: '健康', cognitive: '认知', daily: '日常', emotional: '情感' }
const PRI_COLORS: Record<string, string> = { emergency: 'red', important: 'orange', normal: 'blue', reference: 'gray' }
const PRI_LABELS: Record<string, string> = { emergency: '紧急', important: '重要', normal: '一般', reference: '参考' }

export function SuggestionsPanel({ patientId }: { patientId: string }) {
  const { data: patients } = useGet<Array<{ id: string; name: string }>>('/patients', { pageSize: 50 })
  const [selectedPatient, setSelectedPatient] = useState<string>(patientId || '')

  const { data: suggestions, isLoading, refetch } = useQuery<Suggestion[]>({
    queryKey: ['suggestions', selectedPatient],
    queryFn: async () => {
      if (!selectedPatient) return []
      const { data } = await http.get(`/dashboard/suggestions/${selectedPatient}`)
      return (data as Suggestion[]) || []
    },
    enabled: !!selectedPatient,
    refetchInterval: 60000,
  })

  const handleFeedback = async (id: string, action: string) => {
    await http.post(`/dashboard/suggestions/${id}/feedback`, { action })
    refetch()
  }

  const patientOpts = (patients || []).map((p) => ({ value: p.id, label: p.name }))

  return (
    <Container py="md" size="xl">
      <Title order={3} mb="md">智慧建议</Title>

      <ScrollArea w={300} mb="md">
        <Group gap="xs" wrap="nowrap">
          {(patients || []).slice(0, 10).map((p) => (
            <Badge key={p.id} size="lg" variant={selectedPatient === p.id ? 'filled' : 'light'}
              color="teal" style={{ cursor: 'pointer' }}
              onClick={() => setSelectedPatient(p.id)}>
              {p.name}
            </Badge>
          ))}
        </Group>
      </ScrollArea>

      {!selectedPatient ? (
        <Paper p="xl" withBorder ta="center"><Text c="dimmed">选择一个患者查看智能建议</Text></Paper>
      ) : isLoading ? (
        <Loader />
      ) : (!suggestions || suggestions.length === 0) ? (
        <Paper p="xl" withBorder ta="center">
          <IconBrain size={48} stroke={1} opacity={0.2} />
          <Text c="dimmed" mt="md">暂无建议 — 该患者目前状态良好</Text>
        </Paper>
      ) : (
        <Stack gap="md">
          {suggestions.sort((a, b) =>
            (['emergency', 'important', 'normal', 'reference'].indexOf(a.priority) -
             ['emergency', 'important', 'normal', 'reference'].indexOf(b.priority))
          ).map((s) => {
            const CIcon = CAT_ICONS[s.category] || IconBrain
            return (
              <Card key={s.id} withBorder style={{ borderLeft: `4px solid var(--mantine-color-${PRI_COLORS[s.priority] || 'gray'}-5)` }}>
                <Group justify="space-between" mb="xs">
                  <Group gap="xs">
                    <ThemeIcon size="sm" radius="xl" color={PRI_COLORS[s.priority] || 'gray'}>
                      <CIcon size={14} />
                    </ThemeIcon>
                    <Badge size="sm" variant="light" color={CAT_COLORS[s.category] || 'gray'}>{CAT_LABELS[s.category] || s.category}</Badge>
                    <Badge size="sm" color={PRI_COLORS[s.priority] || 'gray'}>{PRI_LABELS[s.priority] || s.priority}</Badge>
                    <Text size="xs" c="dimmed">有效期 {s.validityHours}h</Text>
                  </Group>
                  <Group gap="xs">
                    {s.status === 'active' && (
                      <>
                        <Badge size="sm" variant="light" color="green" style={{ cursor: 'pointer' }}
                          leftSection={<IconCheck size={12} />}
                          onClick={() => handleFeedback(s.id, 'adopted')}>采纳</Badge>
                        <Badge size="sm" variant="light" color="gray" style={{ cursor: 'pointer' }}
                          leftSection={<IconX size={12} />}
                          onClick={() => handleFeedback(s.id, 'dismissed')}>忽略</Badge>
                      </>
                    )}
                    {s.status !== 'active' && <Badge size="sm" variant="outline" color="gray">{s.status}</Badge>}
                  </Group>
                </Group>
                <Text fw={600} mb={4}>{s.summary}</Text>
                <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-line' }}>{s.detail}</Text>
                <Group gap="xs" mt="sm">
                  {s.basis.map((b, i) => (
                    <Badge key={i} size="xs" variant="outline" color="gray">{b}</Badge>
                  ))}
                  <Badge size="xs" variant="dot" color="green">{s.expectedEffect}</Badge>
                </Group>
              </Card>
            )
          })}
        </Stack>
      )}
    </Container>
  )
}
