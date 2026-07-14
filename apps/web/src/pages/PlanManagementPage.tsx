import {
  ActionIcon, Badge, Button, Card, Collapse, Container,
  Group, Modal, NumberInput, SimpleGrid, Spoiler, Stack,
  Switch, Text, TextInput, Textarea, ThemeIcon, Title, Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconCalendarCheck, IconChevronDown, IconChevronUp,
  IconClock, IconEdit, IconForms,
  IconPlus, IconTrash,
} from '@tabler/icons-react'
import { useState } from 'react'
import { http } from '../api/client'
import { useDelete, useGet, usePatch, usePost } from '../api/hooks'
import { CronInput, describeCron } from '../components/CronInput'
import { confirmDelete } from '../lib/confirm-delete'

interface Plan {
  id: string; code: string; title: string; rewardCredits: number
  status: string; fields: Record<string, unknown>[]
  cron: string | null; description: string | null
}

interface Completion {
  id: string; planId: string; patientId: string; userId: string | null
  creditsEarned: number; completedAt: string | null
}

const FIELD_TYPE_ICONS: Record<string, string> = {
  choice: '选', multi: '多', likert: '星', vas: '滑',
  number: '数', text: '文',
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  choice: '单选', multi: '多选', likert: '量表', vas: 'VAS',
  number: '数值', text: '文本',
}

export function PlanManagementPage() {
  const { data: plans, isLoading, refetch } = useGet<Plan[]>('/plans')
  const [search, setSearch] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [completions, setCompletions] = useState<Completion[]>([])
  const [loadingCompletions, setLoadingCompletions] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [form, setForm] = useState({ code: '', title: '', description: '', fields: '', rewardCredits: 10, cron: '' })
  const createPlan = usePost('/plans', ['plans'])
  const updatePlan = usePatch('/plans/:id', ['plans'])
  const deletePlan = useDelete('/plans/:id', ['plans'])

  const toggleStatus = async (plan: Plan) => {
    const newStatus = plan.status === 'active' ? 'archived' : 'active'
    await http.patch(`/plans/${plan.id}`, { status: newStatus })
    refetch()
  }

  const loadCompletions = async (planId: string) => {
    if (selectedPlan === planId) { setSelectedPlan(null); return }
    setSelectedPlan(planId)
    setLoadingCompletions(true)
    try {
      const { data } = await http.get(`/plans/${planId}/completions`)
      setCompletions(data as Completion[])
    } catch { setCompletions([]) }
    finally { setLoadingCompletions(false) }
  }

  const openEdit = (p: Plan) => {
    setEditing(p)
    setForm({ code: p.code, title: p.title, description: p.description || '', fields: JSON.stringify(p.fields || [], null, 2), rewardCredits: p.rewardCredits, cron: p.cron || '' })
    setModalOpen(true)
  }
  const openCreate = () => {
    setEditing(null)
    setForm({ code: '', title: '', description: '', fields: '[]', rewardCredits: 10, cron: '' })
    setModalOpen(true)
  }
  const save = () => {
    const data = { ...form, fields: JSON.parse(form.fields || '[]') }
    if (editing) updatePlan.mutate({ id: editing.id, ...data } as any, { onSuccess: () => setModalOpen(false) })
    else createPlan.mutate(data as any, { onSuccess: () => setModalOpen(false) })
  }

  const filtered = (plans ?? []).filter((p) =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <Container py="md" size="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>计划管理</Title>
        <Group>
          <TextInput size="xs" placeholder="搜索..." value={search} onChange={(e) => setSearch(e.currentTarget.value)} w={180} />
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreate}>新建计划</Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {filtered.map((p) => {
          const isExpanded = selectedPlan === p.id
          const fields = (p.fields || []) as Record<string, unknown>[]
          return (
            <Card key={p.id} radius="md" withBorder shadow="sm"
              style={{ borderTop: `3px solid ${p.status === 'active' ? '#2f9e44' : '#adb5bd'}` }}>
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <Badge size="sm" variant="filled" color="blue">{p.code}</Badge>
                  <Switch
                    size="xs"
                    checked={p.status === 'active'}
                    onChange={() => toggleStatus(p)}
                    label={p.status === 'active' ? '启用' : '停用'}
                    color="green"
                  />
                </Group>
                <Group gap={4}>
                  <Tooltip label="编辑">
                    <ActionIcon size="sm" variant="light" onClick={() => openEdit(p)}><IconEdit size={14} /></ActionIcon>
                  </Tooltip>
                  <Tooltip label="删除">
                    <ActionIcon size="sm" variant="light" color="red"
                      onClick={() => confirmDelete(`删除"${p.title}"？`, () => deletePlan.mutate(p.id))}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>

              <Text fw={600} mb={4}>{p.title}</Text>
              {p.description && (
                <Spoiler maxHeight={40} showLabel="展开" hideLabel="收起">
                  <Text size="xs" c="dimmed" mb="xs">{p.description}</Text>
                </Spoiler>
              )}

              <Group gap="xs" mb="xs">
                {p.cron && (
                  <Badge size="sm" variant="light" color="violet" leftSection={<IconClock size={12} />}>
                    {describeCron(p.cron)}
                  </Badge>
                )}
                <Badge size="sm" variant="light" leftSection={<IconForms size={12} />}>
                  {fields.length} 字段
                </Badge>
              </Group>

              {fields.length > 0 && (
                <Group gap={4} mb="xs">
                  {fields.slice(0, 5).map((f, i) => (
                    <Tooltip key={i} label={String(f.label || '')}>
                      <Badge size="xs" variant="outline" color="gray">
                        {FIELD_TYPE_ICONS[String(f.type || '')] || '?'}{String(f.label || '').slice(0, 4)}
                      </Badge>
                    </Tooltip>
                  ))}
                  {fields.length > 5 && <Text size="xs" c="dimmed">+{fields.length - 5}...</Text>}
                </Group>
              )}

              <Button
                size="compact-xs" variant="subtle" fullWidth
                rightSection={isExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                onClick={() => loadCompletions(p.id)}
                loading={loadingCompletions && isExpanded}
              >
                {isExpanded ? '收起' : '查看完成记录'}
              </Button>

              <Collapse in={isExpanded}>
                <Stack mt="xs" gap={4}>
                  {completions.length === 0 ? (
                    <Text size="xs" c="dimmed">暂无完成记录</Text>
                  ) : (
                    completions.slice(0, 10).map((c) => (
                      <Group key={c.id} gap={6} justify="space-between">
                        <Group gap={4}>
                          <IconCalendarCheck size={12} opacity={0.5} />
                          <Text size="xs">
                            {c.completedAt ? new Date(c.completedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                          </Text>
                        </Group>
                      </Group>
                    ))
                  )}
                </Stack>
              </Collapse>
            </Card>
          )
        })}
      </SimpleGrid>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editing ? '编辑计划' : '新建计划'} size="lg">
        <Stack gap="sm">
          <TextInput label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.currentTarget.value })} placeholder="daily-mood" disabled={!!editing} />
          <TextInput label="标题" value={form.title} onChange={(e) => setForm({ ...form, title: e.currentTarget.value })} placeholder="每日情绪量表" />
          <Textarea label="描述" value={form.description} onChange={(e) => setForm({ ...form, description: e.currentTarget.value })} rows={2} />
          <Textarea label="Fields (JSON)" value={form.fields} onChange={(e) => setForm({ ...form, fields: e.currentTarget.value })} minRows={4}
            placeholder='[{"id":"mood","type":"likert","label":"心情","labels":["差","一般","好"]}]' />
          <CronInput value={form.cron} onChange={(v) => setForm({ ...form, cron: v })} />
          <Group justify="flex-end"><Button onClick={save}>保存</Button></Group>
        </Stack>
      </Modal>
    </Container>
  )
}
