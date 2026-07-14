import {
  Badge, Box, Button, Card, Center, Container, Grid, Group,
  Loader, Paper, RingProgress, ScrollArea, SegmentedControl,
  SimpleGrid, Stack, Text, Title, Tooltip,
} from '@mantine/core'
import { IconActivity, IconRefresh, IconUser, IconWalk } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { http } from '../api/client'
import { useGet } from '../api/hooks'
import { buildPatientData } from '../3d/data'

interface MirrorSnapshot {
  patientId: string; timestamp: string; posture: {
    overallScore: number; overallStatus: string; metrics: Array<{ label: string; value: number; unit: string; score: number; status: string; description: string }>;
    risks: string[]; advice: string[]
  };
  activity: string; position: { x: number; y: number; room: string }
  keypoints: Record<string, [number, number]>
}

const EDGES: [string, string][] = [
  ['nose', 'left_eye'], ['nose', 'right_eye'],
  ['nose', 'left_shoulder'], ['nose', 'right_shoulder'], ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'], ['right_shoulder', 'right_elbow'],
  ['left_elbow', 'left_wrist'], ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'], ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'], ['right_hip', 'right_knee'],
  ['left_knee', 'left_ankle'], ['right_knee', 'right_ankle'],
]

function SkeletonOverlay({ kps, color }: { kps: Record<string, [number, number]>; color: string }) {
  return (
    <svg style={{ width: '100%', height: '100%' }} viewBox="0 0 1 1" preserveAspectRatio="none">
      {EDGES.map(([a, b]) => {
        const pa = kps[a]; const pb = kps[b]
        if (!pa || !pb) return null
        return <line key={`${a}-${b}`} x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} stroke={color} strokeWidth={0.005} opacity={0.6} />
      })}
      {Object.entries(kps).map(([name, [x, y]]) => (
        <circle key={name} cx={x} cy={y} r={0.01} fill={color} />
      ))}
    </svg>
  )
}

export function MirrorPage() {
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)
  const { data: patients } = useGet<Array<{ id: string; name: string }>>('/patients', { pageSize: 20 })

  const { data: snapshot, isLoading, refetch } = useQuery<MirrorSnapshot>({
    queryKey: ['mirror', selectedPatient],
    queryFn: async () => {
      if (!selectedPatient) return null
      const { data } = await http.get(`/twin/mirror/${selectedPatient}`)
      return data as MirrorSnapshot
    },
    enabled: !!selectedPatient,
    refetchInterval: 3000,
  })

  const { data: allSnapshots } = useQuery<MirrorSnapshot[]>({
    queryKey: ['mirror-all'],
    queryFn: async () => {
      const { data } = await http.get('/twin/mirror')
      return (data as MirrorSnapshot[]) || []
    },
    refetchInterval: 5000,
  })

  const statusColor = snapshot?.posture.overallStatus === 'warning' ? 'red' : snapshot?.posture.overallStatus === 'watch' ? 'orange' : 'green'

  return (
    <Container py="md" size="xl">
      <Group justify="space-between" mb="md">
        <Title order={3}>虚拟镜像</Title>
        <Group gap="xs">
          <IconRefresh size={14} style={{ cursor: 'pointer' }} onClick={() => refetch()} />
        </Group>
      </Group>

      <Group mb="md" gap="xs">
        <Text size="xs" fw={600} c="dimmed">同步患者：</Text>
        {(patients || []).slice(0, 8).map((p) => (
          <Badge key={p.id} size="lg" variant={selectedPatient === p.id ? 'filled' : 'light'}
            color="teal" style={{ cursor: 'pointer' }}
            onClick={() => { setSelectedPatient(p.id); refetch() }}>
            {p.name}
          </Badge>
        ))}
        {!selectedPatient && (
          <Text size="xs" c="dimmed">（选择一个患者查看实时镜像）</Text>
        )}
      </Group>

      {!selectedPatient ? (
        <Paper p="xl" withBorder ta="center">
          <IconUser size={48} stroke={1} opacity={0.2} />
          <Text c="dimmed" mt="md">选择一个患者开始监控虚拟镜像</Text>
        </Paper>
      ) : !snapshot ? (
        <Paper p="xl" withBorder ta="center">
          <Loader mb="md" />
          <Text c="dimmed">等待姿态数据输入… 3秒自动轮询</Text>
        </Paper>
      ) : (
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Card withBorder mb="md" style={{ paddingTop: '100%', position: 'relative' }}>
              <Box style={{ position: 'absolute', inset: 0, padding: 16 }}>
                <Text fw={600} mb={4}>姿态骨架</Text>
                <Box style={{ flex: 1, height: 'calc(100% - 30px)' }}>
                  <SkeletonOverlay kps={snapshot.keypoints} color={statusColor} />
                </Box>
              </Box>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 7 }}>
            <Group mb="md" grow>
              <Card withBorder>
                <Center><RingProgress size={80} thickness={8}
                  sections={[{ value: snapshot.posture.overallScore, color: statusColor }]}
                  label={<Text size="sm" fw={700}>{snapshot.posture.overallScore}</Text>} />
                </Center>
                <Text ta="center" size="xs" mt={4}>综合评分</Text>
              </Card>
              <Card withBorder>
                <Center><Badge size="lg" variant="filled" color={statusColor}>
                  {snapshot.posture.overallStatus === 'warning' ? '⚠ 警告' : snapshot.posture.overallStatus === 'watch' ? '⚠ 注意' : '✓ 正常'}
                </Badge></Center>
                <Text ta="center" size="xs" mt={8} c="dimmed">
                  {new Date(snapshot.timestamp).toLocaleTimeString('zh-CN')}
                </Text>
              </Card>
              <Card withBorder>
                <Center><IconWalk size={28} color="var(--mantine-color-teal-5)" /></Center>
                <Text ta="center" size="xs" mt={4}>{snapshot.activity || '静立'}</Text>
              </Card>
            </Group>

            <ScrollArea h={300}>
              <Stack gap="xs">
                {(snapshot.posture.metrics || []).map((m) => (
                  <Paper key={m.label} p="xs" radius="md" style={{ background: 'rgba(0,0,0,0.01)', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <Group justify="space-between">
                      <Group gap="xs">
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.status === 'warning' ? 'red' : m.status === 'watch' ? 'orange' : 'green' }} />
                        <Text size="xs" fw={500}>{m.label}</Text>
                      </Group>
                      <Group gap="xs">
                        <Text size="xs">{m.value} {m.unit}</Text>
                        <Badge size="xs" variant="light" color={m.status === 'warning' ? 'red' : m.status === 'watch' ? 'orange' : 'green'}>{m.score}分</Badge>
                      </Group>
                    </Group>
                    <Text size="xs" c="dimmed" mt={2}>{m.description}</Text>
                  </Paper>
                ))}
              </Stack>
            </ScrollArea>

            {snapshot.posture.risks?.length > 0 && (
              <Card withBorder mt="md" style={{ borderLeft: '3px solid var(--mantine-color-red-5)' }}>
                <Text size="xs" fw={600} c="red" mb={4}>风险预警</Text>
                {snapshot.posture.risks.map((r, i) => (
                  <Text key={i} size="xs" c="red">• {r}</Text>
                ))}
              </Card>
            )}
          </Grid.Col>
        </Grid>
      )}
    </Container>
  )
}
