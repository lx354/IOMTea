import { Badge, Card, Container, Group, Paper, Select, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { IconWalk, IconRun, IconMoon, IconAlertTriangle } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { http } from '../api/client'
import { useGet } from '../api/hooks'

const BEHAVIOR_COLORS: Record<string, string> = {
  standing: 'blue', sitting: 'teal', lying: 'grape', walking: 'green',
  falling: 'red', sitting_up: 'orange', wandering: 'violet',
}

export function ActivityMonitor() {
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)
  const { data: patients } = useGet<Array<{ id: string; name: string }>>('/patients', { pageSize: 50 })

  const { data } = useQuery<any[]>({
    queryKey: ['activity-monitor', selectedPatient],
    queryFn: async () => {
      if (!selectedPatient) return null
      const { data } = await http.get(`/dashboard/patient/${selectedPatient}/overview`)
      return (data as any)?.behaviors || []
    },
    enabled: !!selectedPatient,
    refetchInterval: 5000,
  })

  const stats = useMemo(() => {
    if (!data) return { walking: 0, sitting: 0, lying: 0, standing: 0, falling: 0, wandering: 0 }
    const c: Record<string, number> = {}
    for (const b of data) { c[b.value] = (c[b.value] || 0) + 1 }
    return c
  }, [data])

  return (
    <Container py="md" size="xl">
      <Group mb="md"><IconRun size={24}/><Title order={3}>行为与活动监测</Title></Group>
      <Group mb="md"><Select size="xs" placeholder="选择患者" searchable w={200}
        data={(patients||[]).map((p:any)=>({value:p.id,label:p.name}))}
        value={selectedPatient} onChange={setSelectedPatient}/></Group>

      {!selectedPatient?(
        <Paper p="xl" withBorder ta="center"><IconWalk size={48} stroke={1} opacity={0.2}/><Text c="dimmed" mt="md">选择一个患者</Text></Paper>
      ):(
        <Stack gap="md">
          <SimpleGrid cols={{base:2,sm:3}} spacing="md">
            {[{k:'walking',l:'行走',i:IconWalk},{k:'standing',l:'站立',i:IconRun},{k:'sitting',l:'久坐',i:IconWalk},
              {k:'lying',l:'躺卧',i:IconMoon},{k:'falling',l:'跌倒',i:IconAlertTriangle},{k:'wandering',l:'徘徊',i:IconWalk}].map(({k,l,i:I})=>(
              <Card key={k} withBorder style={{borderLeft:`3px solid var(--mantine-color-${k==='falling'?'red':BEHAVIOR_COLORS[k]||'gray'}-5)`}}>
                <Group gap="xs"><I size={18}/><Text size="xs" c="dimmed">{l}</Text></Group>
                <Text fw={700} fz={28} c={k==='falling'&&stats[k]>0?'red':undefined}>{stats[k]||0}<Text span size="sm">次</Text></Text>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>
      )}
    </Container>
  )
}