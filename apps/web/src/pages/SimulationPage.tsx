import {
  ActionIcon, Badge, Button, Card, CloseButton, Collapse, Container,
  Group, Modal, MultiSelect, NumberInput, Paper, Select, Slider,
  Stack, Switch, Text, TextInput, ThemeIcon, Title, Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconAlertTriangle, IconBolt, IconBrain, IconChevronDown, IconChevronUp,
  IconFlask, IconPlus, IconRun, IconSpeedboat, IconTrash, IconUserPlus, IconUsers, IconWalk,
} from '@tabler/icons-react'
import { useGet, usePost } from '../api/hooks'
import { confirmDelete } from '../lib/confirm-delete'
import { useState } from 'react'
import { http } from '../api/client'

interface SimConfig {
  id: string; name: string; profileName: string; running: boolean
  patientCount: number; metrics: { name: string; enabled: boolean; config: { unit?: string } }[]
}

interface ProfileBrief {
  id: string; name: string; displayName: string; description: string; conditions: string[]
}

interface PatientBrief { id: string; name: string }

const SCENARIOS: { type: string; label: string; icon: React.ElementType; color: string; desc: string }[] = [
  { type: 'tachycardia', label: '心动过速', icon: IconRun, color: 'red', desc: '心率骤升至155bpm' },
  { type: 'low_spo2', label: '低血氧', icon: IconAlertTriangle, color: 'orange', desc: '血氧降至88%' },
  { type: 'hypotension', label: '低血压', icon: IconAlertTriangle, color: 'yellow', desc: '收缩压降至85mmHg' },
  { type: 'fall', label: '跌倒', icon: IconWalk, color: 'red', desc: '姿态异常跌倒' },
  { type: 'bed_exit', label: '离床', icon: IconWalk, color: 'blue', desc: '老人离床活动' },
  { type: 'hyperglycemia', label: '高血糖', icon: IconAlertTriangle, color: 'orange', desc: '血糖升至13.5' },
  { type: 'hypoglycemia', label: '低血糖', icon: IconAlertTriangle, color: 'yellow', desc: '血糖降至2.8' },
  { type: 'arrhythmia', label: '心律失常', icon: IconRun, color: 'red', desc: '心率骤升至180bpm' },
  { type: 'respiratory_distress', label: '呼吸窘迫', icon: IconAlertTriangle, color: 'orange', desc: '呼吸率升至35rpm' },
  { type: 'night_wandering', label: '夜间漫游', icon: IconWalk, color: 'violet', desc: '夜间行为异常' },
  { type: 'wandering_escape', label: '走失风险', icon: IconWalk, color: 'grape', desc: '走失风险评分升高' },
]

const METRIC_LABELS: Record<string, string> = {
  heart_rate: '心率', resp_rate: '呼吸', spo2: '血氧', temperature: '体温',
  systolic_bp: '收缩压', diastolic_bp: '舒张压', glucose: '血糖',
  posture: '姿态', bed_status: '离床', motion_index: '活动',
  night_wandering: '夜间漫游', repetitive_behavior: '重复行为', wandering_risk: '走失风险',
}

export function SimulationPage() {
  const { data: sims, isLoading, refetch } = useGet<SimConfig[]>('/twin/simulations')
  const { data: profiles } = useGet<ProfileBrief[]>('/twin/profiles')
  const { data: patients } = useGet<PatientBrief[]>('/patients', { pageSize: 200 })

  const createSim = usePost('/twin/simulations', ['twin'])

  const [openSims, setOpenSims] = useState<Set<string>>(new Set())
  const [globalSpeed, setGlobalSpeed] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [newPROFILE, setNewPROFILE] = useState<string>('elderly-cardiac')
  const [newNAME, setNewNAME] = useState('')
  const [scenarioPatient, setScenarioPatient] = useState<Record<string, string>>({})
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set())

  const toggleOpen = (id: string) => setOpenSims((p) => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const handleDelete = async (sim: SimConfig) => {
    confirmDelete(`删除模拟"${sim.name}"？此操作不可撤销。`, async () => {
      await http.delete(`/twin/simulations/${sim.id}`)
      refetch()
    })
  }

  const handleToggle = async (sim: SimConfig) => {
    await http.post(`/twin/simulations/${sim.id}/toggle`, { running: !sim.running })
    if (!sim.running) setOpenSims((p) => { const n = new Set(p); n.add(sim.id); return n })
    refetch()
  }

  const handleSpeed = async (speed: number) => {
    setGlobalSpeed(speed)
    await http.patch('/twin/speed', { speed }).catch(() => {})
  }

  const handleToggleMetric = async (simId: string, metric: string, enabled: boolean) => {
    await http.post(`/twin/simulations/${simId}/metrics/${metric}/toggle`, { enabled })
    refetch()
  }

  const handleAddPatient = async (simId: string, patientIds: string[]) => {
    for (const pid of patientIds) {
      try { await http.post(`/twin/simulations/${simId}/patients`, { patientId: pid }) } catch {}
    }
    refetch()
    notifications.show({ message: `已添加 ${patientIds.length} 位患者`, color: 'green' })
  }

  const handleRemovePatient = async (simId: string, patientId: string) => {
    await http.delete(`/twin/simulations/${simId}/patients/${patientId}`)
    refetch()
  }

  const handleInjectScenario = async (simId: string, patientId: string, type: string) => {
    await http.post(`/twin/simulations/${simId}/patients/${patientId}/scenario`, { type })
    notifications.show({ message: `场景 "${SCENARIOS.find((s) => s.type === type)?.label || type}" 已注入`, color: 'blue' })
  }

  const handleCreate = () => {
    createSim.mutate({ profile: newPROFILE, name: newNAME || undefined } as any, {
      onSuccess: () => { setShowCreate(false); setNewNAME(''); refetch() },
    })
  }

  const profileOpts = (profiles || []).map((p) => ({ value: p.name || p.id, label: `${p.displayName} — ${p.description.slice(0, 20)}...` }))
  const patientOpts = (patients || []).map((p) => ({ value: p.id, label: p.name }))

  return (
    <Container py="md" size="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>
          <IconFlask size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          模拟工厂
        </Title>
        <Group>
          <Group gap="xs">
            <IconSpeedboat size={16} />
            <Text size="xs" c="dimmed">全局速度</Text>
            <Slider
              value={globalSpeed} onChange={handleSpeed}
              min={0.1} max={10} step={0.1}
              w={120} size="sm"
              marks={[{ value: 1, label: '1x' }, { value: 5, label: '5x' }, { value: 10, label: '10x' }]}
            />
            <Text size="xs" fw={600} w={36}>{globalSpeed}x</Text>
          </Group>
          <Button leftSection={<IconPlus size={14} />} onClick={() => setShowCreate(true)}>新建模拟</Button>
        </Group>
      </Group>

      <Modal opened={showCreate} onClose={() => setShowCreate(false)} title="创建新模拟" centered size="md">
        <Stack>
          <TextInput label="名称" placeholder="可选" value={newNAME} onChange={(e) => setNewNAME(e.currentTarget.value)} />
          <Select label="认知档案" data={profileOpts} value={newPROFILE} onChange={(v) => v && setNewPROFILE(v)} searchable />
          <Button onClick={handleCreate}>创建</Button>
        </Stack>
      </Modal>

      {(sims || []).map((sim) => {
        const isOpen = openSims.has(sim.id)
        return (
          <Card key={sim.id} mb="md" radius="md" withBorder shadow="sm"
            style={{ borderLeft: `4px solid ${sim.running ? '#2f9e44' : '#adb5bd'}` }}>
            {/* ── Header ── */}
            <Group justify="space-between">
              <Group gap="xs">
                <Switch
                  checked={sim.running}
                  onChange={() => handleToggle(sim)}
                  label={sim.running ? '运行中' : '已停止'}
                  color="green"
                />
                <Text fw={600}>{sim.name}</Text>
                <Badge size="sm" variant="light" color="teal" leftSection={<IconBrain size={12} />}>
                  {sim.profileName}
                </Badge>
                <Badge size="sm" variant="outline">{sim.patientCount} 患者</Badge>
                {sim.running && (
                  <Badge size="sm" variant="filled" color="green" leftSection={<IconBolt size={12} />}>
                    RUN
                  </Badge>
                )}
              </Group>
              <Group gap="xs">
                <ActionIcon variant="subtle" onClick={() => toggleOpen(sim.id)}>
                  {isOpen ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                </ActionIcon>
                <Tooltip label="删除模拟">
                  <ActionIcon variant="light" color="red" onClick={() => handleDelete(sim)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>

            {/* ── Expanded Body ── */}
            <Collapse in={isOpen}>
              <Stack mt="md" gap="sm">
                {/* 患者管理 */}
                <div>
                  <Group gap="xs" mb="xs">
                    <IconUsers size={16} />
                    <Text size="sm" fw={600}>患者管理</Text>
                  </Group>
                  {sim.patientCount > 0 ? (
                    <Stack gap="xs">
                      {/* Show patients here - we'd need a patient list endpoint per sim */}
                      <Text size="xs" c="dimmed">
                        {sim.patientCount} 位患者已绑定到此模拟。
                        通过「模拟训练」页面将患者加入/移出。
                      </Text>
                      <MultiSelect
                        size="xs"
                        placeholder="添加患者到此模拟"
                        data={patientOpts}
                        searchable
                        clearable
                        onChange={(vals) => handleAddPatient(sim.id, vals)}
                      />
                    </Stack>
                  ) : (
                    <Group gap="xs">
                      <MultiSelect
                        size="xs" w={300}
                        placeholder="添加患者..."
                        data={patientOpts}
                        searchable clearable
                        onChange={(vals) => handleAddPatient(sim.id, vals)}
                      />
                      <Text size="xs" c="dimmed">暂无患者</Text>
                    </Group>
                  )}
                </div>

                {/* 场景注入 */}
                {sim.patientCount > 0 && (
                  <div>
                    <Group gap="xs" mb="xs">
                      <IconBolt size={16} color="var(--mantine-color-orange-6)" />
                      <Text size="sm" fw={600}>场景注入</Text>
                      <Text size="xs" c="dimmed">选择要触发异常事件的患者</Text>
                    </Group>
                    <Group gap="xs" mb="xs">
                      <Select
                        size="xs" w={180}
                        placeholder="选择患者..."
                        data={patientOpts}
                        value={scenarioPatient[sim.id] || null}
                        onChange={(v) => v && setScenarioPatient((p) => ({ ...p, [sim.id]: v }))}
                        searchable clearable
                      />
                    </Group>
                    {scenarioPatient[sim.id] && (
                      <Group gap="xs" wrap="wrap">
                        {SCENARIOS.map((sc) => (
                          <Tooltip key={sc.type} label={sc.desc}>
                            <Button
                              size="compact-xs"
                              variant="light"
                              color={sc.color}
                              leftSection={<sc.icon size={14} />}
                              onClick={() => handleInjectScenario(sim.id, scenarioPatient[sim.id]!, sc.type)}
                            >
                              {sc.label}
                            </Button>
                          </Tooltip>
                        ))}
                      </Group>
                    )}
                  </div>
                )}

                {/* 指标开关 */}
                <div>
                  <Text size="sm" fw={600} mb="xs">指标开关</Text>
                  <Group gap="xs" wrap="wrap">
                    {(sim.metrics || []).map((m) => (
                      <Badge
                        key={m.name}
                        size="md"
                        variant={m.enabled ? 'filled' : 'outline'}
                        color={m.enabled ? 'teal' : 'gray'}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleToggleMetric(sim.id, m.name, !m.enabled)}
                      >
                        {m.enabled ? '✓' : '○'} {METRIC_LABELS[m.name] || m.name}
                      </Badge>
                    ))}
                  </Group>
                </div>
              </Stack>
            </Collapse>
          </Card>
        )
      })}

      {(!sims || sims.length === 0) && (
        <Card withBorder p="xl" ta="center">
          <IconFlask size={48} stroke={1} opacity={0.3} />
          <Text c="dimmed" mt="md">暂无模拟实例，点击"新建模拟"创建一个</Text>
        </Card>
      )}
    </Container>
  )
}
