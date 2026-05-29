import { Badge, Group, Paper, Text } from '@mantine/core'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchPatientTimeseries, fetchPatientStateLabels } from '../api/client'

const STATE_COLORS: Record<string, string> = {
  stable: 'teal',
  watch: 'yellow',
  alert: 'orange',
  emergency: 'red',
}

function deriveTransitions(
  labels: { timestamp: string; state: string; duration: number | null }[],
): { from: string; to: string; timestamp: string }[] {
  const result: { from: string; to: string; timestamp: string }[] = []
  for (let i = 1; i < labels.length; i++) {
    const prev = labels[i - 1]
    const curr = labels[i]
    if (prev.state !== curr.state) {
      result.push({ from: prev.state, to: curr.state, timestamp: curr.timestamp })
    }
  }
  return result
}

export function ExpandedPatientRow({ patientId }: { patientId: string }) {
  const { data: timeseries, isLoading: tsLoading } = useQuery({
    queryKey: ['twin', 'timeseries', patientId],
    queryFn: () => fetchPatientTimeseries(patientId, { metrics: 'heart_rate,spo2', start: '', end: '' }),
    enabled: !!patientId,
  })

  const { data: labels } = useQuery({
    queryKey: ['twin', 'state-labels', patientId],
    queryFn: () => fetchPatientStateLabels(patientId),
    enabled: !!patientId,
  })

  const transitions = useMemo(() => deriveTransitions(labels ?? []), [labels])

  return (
    <Paper p="md" bg="gray.0">
      <Text size="sm" fw={600} mb="xs">生命体征趋势</Text>
      {tsLoading ? (
        <Text size="xs" c="dimmed">加载中...</Text>
      ) : (
        <Group gap={2} mb="md">
          {(timeseries ?? []).slice(-20).map((pt, i) => {
            const hr = Number(pt.heart_rate) || 0
            const h = Math.min(hr / 2, 60)
            return (
              <div
                key={i}
                style={{
                  width: 8, height: 60, background: '#f0f0f0', borderRadius: 2, position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute', bottom: 0, width: '100%', height: `${h}px`,
                    background: hr > 100 ? '#e03131' : hr > 80 ? '#f08c00' : '#2f9e44',
                    borderRadius: 2, transition: 'height 0.2s',
                  }}
                />
              </div>
            )
          })}
        </Group>
      )}
      <Text size="sm" fw={600} mb="xs">状态转换历史</Text>
      {transitions.length === 0 ? (
        <Text size="xs" c="dimmed">暂无转换记录（启动模拟器后自动生成）</Text>
      ) : (
        transitions.map((t, i) => (
          <Group key={i} gap={4} mb={4}>
            <Badge size="sm" color={STATE_COLORS[t.from] ?? 'gray'}>{t.from}</Badge>
            <Text size="xs">→</Text>
            <Badge size="sm" color={STATE_COLORS[t.to] ?? 'gray'}>{t.to}</Badge>
            <Text size="xs" c="dimmed">{new Date(t.timestamp).toLocaleString('zh-CN')}</Text>
          </Group>
        ))
      )}
    </Paper>
  )
}
