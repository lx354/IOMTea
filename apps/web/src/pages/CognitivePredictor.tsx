import {
  Badge, Box, Card, Container, Group, Paper, RingProgress,
  ScrollArea, Select, SimpleGrid, Stack, Text, Title,
} from '@mantine/core'
import { IconBrain, IconClock, IconChartLine, IconAlertTriangle } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { http } from '../api/client'
import { useGet } from '../api/hooks'

interface Prediction {
  patientId: string; patientName: string; currentScore: number
  predictedScore6m: number; predictedScore12m: number; annualDeclineRate: number
  riskLevel: string; riskScore: number
  trend: Array<{ date: string; score: number; label: string }>
  riskFactors: Array<{ name: string; impact: string; description: string; score: number }>
  recommendations: string[]
}

export function CognitivePredictor() {
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)
  const { data: patients } = useGet<Array<{ id: string; name: string }>>('/patients', { pageSize: 50 })

  const { data, isLoading } = useQuery<Prediction>({
    queryKey: ['cognitive-prediction', selectedPatient],
    queryFn: async () => {
      if (!selectedPatient) return null
      const { data } = await http.get(`/dashboard/cognitive-prediction/${selectedPatient}`)
      return data as Prediction
    },
    enabled: !!selectedPatient,
  })

  const colors = { low: 'green', moderate: 'yellow', high: 'orange', severe: 'red' }
  const labels = { low: '低风险', moderate: '中等风险', high: '高风险', severe: '极高风险' }

  return (
    <Container py="md" size="xl">
      <Group mb="md"><IconBrain size={24} /><Title order={3}>认知衰退预测引擎</Title></Group>
      <Group mb="md">
        <Select size="xs" placeholder="选择患者" searchable w={220}
          data={(patients || []).map((p) => ({ value: p.id, label: p.name }))}
          value={selectedPatient} onChange={setSelectedPatient} />
      </Group>

      {!selectedPatient ? (
        <Paper p="xl" withBorder ta="center"><IconBrain size={48} stroke={1} opacity={0.2} /><Text c="dimmed" mt="md">选择一个患者查看认知预测</Text></Paper>
      ) : !data ? (
        <Paper p="xl" withBorder ta="center"><Text c="dimmed">加载中...</Text></Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="md">
          {/* 当前状态 */}
          <Card withBorder>
            <Text fw={600} mb="md">当前认知状态</Text>
            <Group justify="center" mb="md">
              <RingProgress size={140} thickness={12}
                sections={[{ value: (data.currentScore / 30) * 100, color: colors[data.riskLevel as keyof typeof colors] || 'gray' }]}
                label={<Text size="lg" fw={700}>{data.currentScore}/30</Text>} />
            </Group>
            <Badge size="lg" variant="filled" fullWidth color={colors[data.riskLevel as keyof typeof colors] || 'gray'}>
              {labels[data.riskLevel as keyof typeof labels] || data.riskLevel}
            </Badge>
            <Text size="xs" c="dimmed" ta="center" mt={4}>风险评分: {data.riskScore}/100</Text>
          </Card>

          {/* 预测 */}
          <Card withBorder>
            <Text fw={600} mb="md">预测趋势</Text>
            <SimpleGrid cols={2} spacing="xs" mb="md">
              <Paper p="sm" withBorder ta="center">
                <Text size="xs" c="dimmed">当前</Text><Text fw={700}>{data.currentScore}</Text>
              </Paper>
              <Paper p="sm" withBorder ta="center" style={{ borderColor: data.predictedScore6m < 18 ? 'var(--mantine-color-red-3)' : undefined }}>
                <Text size="xs" c="dimmed">6个月后</Text><Text fw={700} c={data.predictedScore6m < 18 ? 'red' : undefined}>{data.predictedScore6m}{data.predictedScore6m < 18 ? ' ⚠' : ''}</Text>
              </Paper>
              <Paper p="sm" withBorder ta="center" style={{ borderColor: data.predictedScore12m < 15 ? 'var(--mantine-color-red-3)' : undefined }}>
                <Text size="xs" c="dimmed">12个月后</Text><Text fw={700} c={data.predictedScore12m < 15 ? 'red' : undefined}>{data.predictedScore12m}{data.predictedScore12m < 15 ? ' ⚠' : ''}</Text>
              </Paper>
              <Paper p="sm" withBorder ta="center">
                <Text size="xs" c="dimmed">年衰退速率</Text><Text fw={700} c={data.annualDeclineRate > 5 ? 'red' : 'teal'}>{data.annualDeclineRate.toFixed(1)}分/年</Text>
              </Paper>
            </SimpleGrid>

            {/* 趋势图 */}
            <Box style={{ position: 'relative', width: '100%', paddingTop: '40%' }}>
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 100 40">
                <line x1="5" y1="35" x2="95" y2="35" stroke="rgba(0,0,0,0.08)" strokeWidth={0.5} />
                <line x1="5" y1="20" x2="95" y2="20" stroke="rgba(0,0,0,0.08)" strokeWidth={0.5} />
                <line x1="5" y1="5" x2="95" y2="5" stroke="rgba(0,0,0,0.08)" strokeWidth={0.5} />
                {(data.trend || []).map((t, i, arr) => {
                  const x = 5 + (i / Math.max(arr.length - 1, 1)) * 90
                  const y = 35 - (t.score / 30) * 30
                  const isFuture = t.label === '预测'
                  return (
                    <g key={i}>
                      <circle cx={x} cy={y} r={1} fill={isFuture ? 'var(--mantine-color-orange-5)' : 'var(--mantine-color-teal-5)'} stroke={isFuture ? '#fff' : 'none'} strokeWidth={0.2} />
                      {i > 0 && (
                        <line x1={5 + ((i - 1) / Math.max(arr.length - 1, 1)) * 90} y1={35 - (arr[i - 1].score / 30) * 30}
                          x2={x} y2={y}
                          stroke={isFuture ? 'var(--mantine-color-orange-3)' : 'var(--mantine-color-teal-3)'}
                          strokeWidth={1} strokeDasharray={isFuture ? '2 1' : '0'} />
                      )}
                    </g>
                  )
                })}
                <line x1={40} y1={0} x2={40} y2={40} stroke="rgba(0,0,0,0.1)" strokeWidth={0.3} strokeDasharray="3 3" />
                <text x={41} y={5} fontSize={3} fill="var(--mantine-color-dimmed)">← 实测</text>
                <text x={41} y={10} fontSize={3} fill="var(--mantine-color-dimmed)">  预测 →</text>
              </svg>
            </Box>
          </Card>
        </SimpleGrid>
      )}

      {data && (
        <>
          {/* 风险因子 */}
          <Card withBorder mb="md">
            <Text fw={600} mb="sm">风险因子分析</Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
              {(data.riskFactors || []).map((f, i) => (
                <Paper key={i} p="xs" radius="md" style={{ background: f.impact === 'high' ? 'rgba(224,49,49,0.04)' : f.impact === 'medium' ? 'rgba(240,140,0,0.04)' : 'rgba(0,0,0,0.01)', border: `1px solid ${f.impact === 'high' ? 'rgba(224,49,49,0.2)' : f.impact === 'medium' ? 'rgba(240,140,0,0.2)' : 'rgba(0,0,0,0.06)'}` }}>
                  <Group justify="space-between">
                    <Text size="xs" fw={500}>{f.name}</Text>
                    <Badge size="xs" color={f.impact === 'high' ? 'red' : f.impact === 'medium' ? 'orange' : 'blue'} variant="light">{f.score}分</Badge>
                  </Group>
                  <Text size="xs" c="dimmed">{f.description}</Text>
                </Paper>
              ))}
            </SimpleGrid>
          </Card>

          {/* 建议 */}
          <Card withBorder style={{ borderLeft: '3px solid var(--mantine-color-teal-5)' }}>
            <Text fw={600} mb="sm">干预建议</Text>
            <Stack gap={4}>
              {(data.recommendations || []).map((r, i) => (
                <Text key={i} size="xs">• {r}</Text>
              ))}
            </Stack>
          </Card>
        </>
      )}
    </Container>
  )
}
