import {
  Badge, Box, Button, Card, Container, Group, Loader, Modal, Paper, Progress,
  ScrollArea, SegmentedControl, Select, SimpleGrid, Stack, Tabs, Text, TextInput, Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertTriangle, IconBattery, IconBell,
  IconClock, IconDevices, IconPlus, IconSignal4g,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { http } from '../api/client'
import { getDeviceTypeInfo, type DeviceStatus } from '../components/DeviceStatusTypes'

function timeAgo(d: string | null): string {
  if (!d) return '无数据'
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}小时前`
  return `${Math.floor(hrs / 24)}天前`
}

function DeviceCard({ d }: { d: DeviceStatus }) {
  const info = getDeviceTypeInfo(d.type)
  const statusColor = d.status === 'online' ? 'green' : d.status === 'fault' ? 'orange' : d.status === 'offline' ? 'red' : 'gray'
  const statusLabel = d.status === 'online' ? '在线' : d.status === 'fault' ? '故障' : d.status === 'offline' ? '离线' : '未知'
  return (
    <Card withBorder shadow="sm" radius="md">
      <Group justify="space-between" mb={4}><Group gap={8}><Text size="lg">{info.icon}</Text><div><Text fw={600} size="sm">{d.name}</Text><Text size="xs" c="dimmed">{info.label}</Text></div></Group><Badge size="sm" variant="filled" color={statusColor}>{statusLabel}</Badge></Group>
      <Group gap="xs" mt="xs"><Text size="xs" c="dimmed"><IconClock size={12} style={{ verticalAlign: -2 }} /> {timeAgo(d.lastSeen)}</Text></Group>
    </Card>
  )
}

export function DeviceMonitor() {
  const [category, setCategory] = useState<string>('all')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [detailPin, setDetailPin] = useState<string | null>(null)
  const [form, setForm] = useState({ label: '', type: 'emergency_button', room: '' })
  const [adding, setAdding] = useState(false)

  const { data: devices, isLoading, refetch } = useQuery<DeviceStatus[]>({
    queryKey: ['device-monitor'],
    queryFn: async () => {
      const { data } = await http.get('/dashboard/device-status')
      return (data as DeviceStatus[]) || []
    },
    refetchInterval: 10000,
  })

  const { data: deviceDetail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ['device-detail', detailPin],
    queryFn: async () => {
      if (!detailPin) return null
      const { data } = await http.get(`/dashboard/device/${detailPin}`)
      return data
    },
    enabled: !!detailPin, refetchInterval: 5000,
  })

  const handleAdd = async () => {
    if (!form.label) return
    setAdding(true)
    const pin = String(Math.floor(100000 + Math.random() * 900000))
    try {
      const token = localStorage.getItem('token') || ''
      const payload = JSON.parse(atob(token.split('.')[1]))
      await http.post('/pins', { pin, userId: payload.sub, type: 'device', label: `${form.label} (${form.room})` })
      setAddModalOpen(false); setForm({ label: '', type: 'emergency_button', room: '' }); refetch()
      notifications.show({ title: '已添加', message: `${form.label} PIN: ${pin}`, color: 'green' })
    } catch { notifications.show({ title: '添加失败', color: 'red' }) }
    finally { setAdding(false) }
  }

  const filtered = category === 'all' ? (devices || []) : (devices || []).filter((d) => {
    const info = getDeviceTypeInfo(d.type); return info.category === category
  })

  const online = (devices || []).filter((d) => d.status === 'online').length
  const offline = (devices || []).filter((d) => d.status === 'offline').length
  const fault = (devices || []).filter((d) => d.status === 'fault').length

  return (
    <Container py="md" size="xl">
      <Title order={3} mb="md">设备监控</Title>
      <Group mb="md" justify="space-between">
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setAddModalOpen(true)}>添加设备</Button>
      </Group>

      <Modal opened={addModalOpen} onClose={() => setAddModalOpen(false)} title="添加设备" centered size="sm">
        <Stack gap="sm">
          <TextInput label="设备名称" placeholder="如：卧室紧急按钮" value={form.label} onChange={(e) => setForm({ ...form, label: e.currentTarget.value })} />
          <Select label="设备类型" value={form.type} onChange={(v) => v && setForm({ ...form, type: v })}
            data={['emergency_button','pull_cord','call_terminal','smoke','gas','door_sensor','water_leak','temp_humidity','smart_meter','vibration','depth_camera','mattress'].map((v) => ({ value: v, label: `${getDeviceTypeInfo(v).icon} ${getDeviceTypeInfo(v).label}` }))} searchable />
          <TextInput label="所在房间" placeholder="如：主卧/卫生间/厨房" value={form.room} onChange={(e) => setForm({ ...form, room: e.currentTarget.value })} />
          <Group justify="flex-end"><Button variant="subtle" onClick={() => setAddModalOpen(false)}>取消</Button><Button onClick={handleAdd} loading={adding} disabled={!form.label}>添加</Button></Group>
        </Stack>
      </Modal>

      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="md">
        {[{ label: '在线', val: online, c: 'green' }, { label: '离线', val: offline, c: 'red' }, { label: '故障', val: fault, c: 'orange' }, { label: '总计', val: (devices||[]).length, c: 'blue' }].map((s) => (
          <Paper key={s.label} p="sm" withBorder ta="center"><Text size="xs" c="dimmed">{s.label}</Text><Text fw={700} fz={28} c={s.c}>{s.val}</Text></Paper>
        ))}
      </SimpleGrid>

      <Group mb="md"><SegmentedControl size="xs" value={category} onChange={setCategory} data={[{ label: '全部', value: 'all' },{ label: '紧急', value: 'emergency' },{ label: '安全', value: 'safety' },{ label: '生活', value: 'life' }]} /><Text size="xs" c="dimmed">{filtered.length} 台设备</Text></Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {filtered.map((d) => (<Box key={d.id} style={{ cursor: 'pointer' }} onClick={() => setDetailPin(d.pin)}><DeviceCard d={d} /></Box>))}
      </SimpleGrid>

      {(!devices || devices.length === 0) && <Paper p="xl" withBorder ta="center"><IconDevices size={48} stroke={1} opacity={0.2} /><Text c="dimmed" mt="md">暂无设备 — 在 PIN 管理中添加设备并接入数据</Text></Paper>}

      <Modal opened={!!detailPin} onClose={() => setDetailPin(null)} title="设备详情" size="lg" centered>
        {detailLoading ? <Loader /> : !deviceDetail ? <Text c="dimmed">无数据</Text> : (
          <Tabs defaultValue="status">
            <Tabs.List>
              <Tabs.Tab value="status">运行状态</Tabs.Tab>
              <Tabs.Tab value="realtime">实时数据</Tabs.Tab>
              <Tabs.Tab value="triggers">触发记录</Tabs.Tab>
              <Tabs.Tab value="trend">历史趋势</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="status" pt="md"><Stack gap="xs">
              <Paper p="sm" withBorder><Text size="xs" fw={600} mb={4}>基础状态</Text><Group gap="xl"><div><Text size="xs" c="dimmed">PIN</Text><Text size="sm" fw={500}>{deviceDetail.pin}</Text></div><div><Text size="xs" c="dimmed">类型</Text><Text size="sm" fw={500}>{deviceDetail.type}</Text></div><div><Text size="xs" c="dimmed">名称</Text><Text size="sm" fw={500}>{deviceDetail.label}</Text></div></Group></Paper>
              <Paper p="sm" withBorder><Text size="xs" fw={600} mb={4}>电量/信号</Text><Group gap="xl">{deviceDetail.latestBattery != null && <div><Text size="xs" c="dimmed">电量</Text><Progress value={deviceDetail.latestBattery} size="sm" w={120} color={deviceDetail.latestBattery > 50 ? 'green' : 'orange'} /><Text size="xs">{deviceDetail.latestBattery}%</Text></div>}{deviceDetail.latestSignal != null && <div><Text size="xs" c="dimmed">信号强度</Text><Text size="sm" fw={500}>{deviceDetail.latestSignal} dBm</Text></div>}</Group></Paper>
            </Stack></Tabs.Panel>
            <Tabs.Panel value="realtime" pt="md"><Paper p="sm" withBorder><Text size="xs" fw={600} mb={4}>环境数据</Text><Group gap="xl">{Object.entries(deviceDetail.realtime || {}).filter(([,v]) => v != null).map(([k,v]) => <div key={k}><Text size="xs" c="dimmed">{k}</Text><Text size="sm" fw={500}>{String(v)}</Text></div>)}{Object.values(deviceDetail.realtime||{}).every((v:unknown)=>v==null) && <Text size="xs" c="dimmed">暂无实时数据</Text>}</Group></Paper></Tabs.Panel>
            <Tabs.Panel value="triggers" pt="md"><ScrollArea h={200}>{(deviceDetail.triggers||[]).length===0?<Text size="xs" c="dimmed">无触发记录</Text>:<Stack gap={4}>{(deviceDetail.triggers||[]).map((t:any,i:number)=><Group key={i} gap="xs" py={2} style={{borderBottom:'1px solid rgba(0,0,0,0.04)'}}><IconBell size={12} opacity={0.5}/><Text size="xs">{String(t.metric||t.value)}</Text><Text size="xs" c="dimmed">{new Date(t.time).toLocaleString('zh-CN')}</Text></Group>)}</Stack>}</ScrollArea></Tabs.Panel>
            <Tabs.Panel value="trend" pt="md"><Text size="xs" fw={600} mb={4}>24h 事件趋势</Text>{(deviceDetail.trend||[]).length===0?<Text size="xs" c="dimmed">暂无数据</Text>:<Group gap={2} align="flex-end" h={60}>{(deviceDetail.trend||[]).map((t:any,i:number)=>{const max=Math.max(...(deviceDetail.trend||[]).map((x:any)=>x.count),1);return <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center'}}><div style={{width:'100%',height:`${Math.max(3,(t.count/max)*50)}px`,background:'var(--mantine-color-teal-3)',borderRadius:'2px 2px 0 0'}}/><Text size="xs" c="dimmed" style={{fontSize:8}}>{new Date(t.hour).getHours()}h</Text></div>})}</Group>}{(deviceDetail.alerts||[]).length>0&&<><Text size="xs" fw={600} mt="md" mb={4} c="red">24h 告警</Text>{(deviceDetail.alerts||[]).map((a:any,i:number)=><Group key={i} gap="xs"><IconAlertTriangle size={12} color="red"/><Text size="xs" c="red">{String(a.value)} — {new Date(a.time).toLocaleString()}</Text></Group>)}</>}</Tabs.Panel>
          </Tabs>
        )}
      </Modal>
    </Container>
  )
}
