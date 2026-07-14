import { Badge, Container, Group, Paper, SimpleGrid, Tabs, Text, Title } from '@mantine/core'
import {
  IconActivity,
  IconAlertTriangle,
  IconChartLine,
  IconClipboardText,
  IconLink,
  IconSettings,
  IconUser,
} from '@tabler/icons-react'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { useGet } from '../api/hooks'
import { StateSkeleton } from '../components/StateComponents'
import { useRealtime } from '../hooks/useRealtime'
import { parsePatientId } from '../lib/path'
import { PatientOverview } from './PatientOverview'

interface Patient {
  id: string
  name: string
  gender: string | null
  birthDate: string | null
  heightCm: number | null
  weightKg: number | null
  bloodType: string | null
  phone: string | null
  address: string | null
  status: string
}
interface LatestItem {
  metric: string
  value: unknown
  unit: string | null
  recordedAt: number | null
}

export function PatientDetailShell() {
  const pid = parsePatientId()
  const { data: patient, isLoading: pLoading } = useGet<Patient>(`/patients/${pid}`)
  const { data: latest } = useGet<LatestItem[]>('/data/latest', { patientId: pid })
  const [liveLatest, setLiveLatest] = useState<
    Record<string, { value: unknown; unit: string | null }>
  >({})

  useRealtime({
    patientId: pid,
    onVitals: (data) => {
      setLiveLatest((prev) => {
        const next = { ...prev }
        for (const m of data.metrics) next[m.metric] = { value: m.value, unit: m.unit }
        return next
      })
    },
  })

  const mergedLatest: LatestItem[] = (latest ?? []).map((item) => {
    const live = liveLatest[item.metric]
    if (live) {
      return { ...item, value: live.value, unit: live.unit ?? item.unit }
    }
    return item
  })
  for (const [metric, live] of Object.entries(liveLatest)) {
    if (!mergedLatest.some((m) => m.metric === metric)) {
      mergedLatest.push({ metric, value: live.value, unit: live.unit, recordedAt: null })
    }
  }
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const tab = pathname.includes('/profile')
    ? 'profile'
    : pathname.includes('/alerts')
      ? 'alerts'
      : pathname.includes('/alert-rules')
        ? 'rules'
        : pathname.includes('/users')
          ? 'users'
          : pathname.includes('/health-timeline')
            ? 'timeline'
            : pathname.includes('/forms')
              ? 'forms'
              : 'overview'

  if (pLoading || !patient) return <StateSkeleton lines={5} />

  return (
    <Container py="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>{patient.name}</Title>
        <Badge size="lg">{patient.status}</Badge>
      </Group>
      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="md">
        <Paper p="xs" withBorder>
          <Text size="xs" c="dimmed">
            性别
          </Text>
          <Text>{patient.gender ?? '-'}</Text>
        </Paper>
        <Paper p="xs" withBorder>
          <Text size="xs" c="dimmed">
            出生日期
          </Text>
          <Text>{patient.birthDate ?? '-'}</Text>
        </Paper>
        <Paper p="xs" withBorder>
          <Text size="xs" c="dimmed">
            血型
          </Text>
          <Text>{patient.bloodType ?? '-'}</Text>
        </Paper>
        <Paper p="xs" withBorder>
          <Text size="xs" c="dimmed">
            电话
          </Text>
          <Text>{patient.phone ?? '-'}</Text>
        </Paper>
      </SimpleGrid>
      <Tabs
        value={tab}
        onChange={(v) => {
          if (!v) return
          const map: Record<string, string> = {
            overview: `/patients/${pid}`,
            profile: `/patients/${pid}/profile`,
            alerts: `/patients/${pid}/alerts`,
            rules: `/patients/${pid}/alert-rules`,
            timeline: `/patients/${pid}/health-timeline`,
            users: `/patients/${pid}/users`,
            forms: `/patients/${pid}/forms`,
          }
          navigate({ to: map[v] || `/patients/${pid}` })
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconActivity size={14} />}>
            概览
          </Tabs.Tab>
          <Tabs.Tab value="profile" leftSection={<IconUser size={14} />}>
            档案
          </Tabs.Tab>
          <Tabs.Tab value="alerts" leftSection={<IconAlertTriangle size={14} />}>
            警告
          </Tabs.Tab>
          <Tabs.Tab value="rules" leftSection={<IconSettings size={14} />}>
            阈值
          </Tabs.Tab>
          <Tabs.Tab value="timeline" leftSection={<IconChartLine size={14} />}>
            时间线
          </Tabs.Tab>
          <Tabs.Tab value="users" leftSection={<IconLink size={14} />}>
             关联用户
           </Tabs.Tab>
           <Tabs.Tab value="forms" leftSection={<IconClipboardText size={14} />}>
             健康表单
           </Tabs.Tab>
         </Tabs.List>
      </Tabs>
      {tab === 'overview' ? <PatientOverview patientId={pid} latest={mergedLatest} /> : <Outlet />}
    </Container>
  )
}
