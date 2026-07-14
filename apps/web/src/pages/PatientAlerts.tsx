import { Badge, Container, Group, Paper, Text, Title } from '@mantine/core'
import { useGet } from '../api/hooks'
import { StateSkeleton } from '../components/StateComponents'
import { parsePatientId } from '../lib/path'

interface A {
  id: string
  metric: string
  value: unknown
  unit: string | null
  severity: string | null
  status: string | null
}

export function PatientAlerts() {
  const pid = parsePatientId()
  const { data: alerts, isLoading } = useGet<A[]>('/alerts', { patientId: pid, pageSize: 100 })

  if (isLoading) return <StateSkeleton lines={4} />

  const activeAlerts = (alerts ?? []).filter((a) => a.status !== 'closed')

  return (
    <Container py="md">
      <Title order={4} mb="xs">
        患者警告
      </Title>
      <Text size="xs" c="dimmed" mb="md">
        共 {activeAlerts.length} 条活跃警告
      </Text>
      {activeAlerts.map((a) => (
        <Paper key={a.id} p="sm" mb="xs" withBorder>
          <Group justify="space-between">
            <Group gap="xs">
              <Badge color={a.severity === 'critical' ? 'red' : 'yellow'} size="xs">
                {a.severity}
              </Badge>
              <Text size="sm">
                {a.metric}: {String(a.value ?? '-')} {a.unit}
              </Text>
            </Group>
            <Badge size="xs" variant="light">
              {a.status}
            </Badge>
          </Group>
        </Paper>
      ))}
    </Container>
  )
}
