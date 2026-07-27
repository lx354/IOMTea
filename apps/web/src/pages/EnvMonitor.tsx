import { Badge, Card, Container, Group, Paper, SimpleGrid, Text, Title } from '@mantine/core'
import { IconFlame, IconDoor, IconDroplet, IconTemperature } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { http } from '../api/client'

export function EnvMonitor() {
  const { data } = useQuery<any[]>({
    queryKey: ['env-monitor'], refetchInterval: 10000,
    queryFn: async () => {
      const { data } = await http.get('/dashboard/device-status')
      return ((data as any[]) || []).filter((d) =>
        ['smoke','gas','door_sensor','water_leak','temp_humidity'].includes(d.type))
    },
  })

  const icons: Record<string,any> = {
    smoke: IconFlame, gas: IconFlame, door_sensor: IconDoor,
    water_leak: IconDroplet, temp_humidity: IconTemperature,
  }
  const labels: Record<string,string> = {
    smoke: '烟感', gas: '燃气', door_sensor: '门窗',
    water_leak: '水浸', temp_humidity: '温湿度',
  }

  return (
    <Container py="md" size="xl">
      <Group mb="md"><IconTemperature size={24}/><Title order={3}>环境安全监测</Title></Group>
      <SimpleGrid cols={{base:2,sm:3}} spacing="md">
        {(data||[]).map((d:any) => {
          const Icon = icons[d.type] || IconTemperature
          const ok = d.status === 'online'
          return <Card key={d.id} withBorder radius="md" style={{borderLeft:`4px solid var(--mantine-color-${ok?'green':'red'}-5)`}}>
            <Group justify="space-between" mb={4}>
              <Group gap="xs"><Icon size={20}/><Text fw={600} size="sm">{d.name}</Text></Group>
              <Badge size="sm" color={ok?'green':'red'}>{ok?'在线':'离线'}</Badge>
            </Group>
            <Text size="xs" c="dimmed">{labels[d.type]||d.type}</Text>
            <Text size="sm" mt={4}>{ok?'正常监测中':'设备离线'}</Text>
          </Card>
        })}
      </SimpleGrid>
    </Container>
  )
}