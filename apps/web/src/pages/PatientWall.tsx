import {
  ActionIcon, Badge, Button, Card, Container, Group, Modal, MultiSelect,
  NumberInput, Select, SimpleGrid, Stack, Table, Tabs, TagsInput,
  Text, TextInput, Textarea, Title, Tooltip,
} from '@mantine/core'
import { IconEye, IconPlus } from '@tabler/icons-react'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useGet, usePost } from '../api/hooks'
import { BatchImportModal } from '../components/BatchImportModal'
import { StateSkeleton } from '../components/StateComponents'
import { TagFilter } from '../components/TagFilter'

interface Patient {
  id: string
  name: string
  gender: string | null
  status: string
  phone: string | null
  tags?: Record<string, unknown> | null
}

export function PatientWall() {
  const { data: patients, isLoading } = useGet<Patient[]>('/patients', { pageSize: 200 })
  const [search, setSearch] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newPatient, setNewPatient] = useState({
    name: '', gender: '', birthDate: '', phone: '', profileId: '',
    tags: {} as Record<string, unknown>,
  })
  const createPatient = usePost('/patients', ['patients'])

  const { data: profiles } = useGet<Array<{ profileName: string; displayName: string; traits: string[] }>>('/twin/chat/profiles')
  const navigate = useNavigate()
  const { refetch } = useGet<Patient[]>('/patients', { pageSize: 200 })

  const searched = (patients ?? []).filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()),
  )
  const filtered = searched.filter((p) => {
    if (selectedTags.length === 0) return true
    const ptags = p.tags as Record<string, unknown> | null
    if (!ptags) return false
    return selectedTags.some((tag) =>
      Object.values(ptags).some((v) => String(v).toLowerCase().includes(tag.toLowerCase())),
    )
  })

  if (isLoading) return <StateSkeleton lines={5} />

  return (
    <Container py="md">
      <Title order={2} mb="md">
        患者管理
      </Title>
      <Group mb="md" justify="space-between">
        <Group>
          <TextInput
            size="xs"
            placeholder="搜索患者..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={200}
          />
          <TagFilter selected={selectedTags} onChange={setSelectedTags} />
        </Group>
        <Group gap="xs">
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={12} />}
            onClick={() => setCreateOpen(true)}
          >
            新建患者
          </Button>
          <Button
            size="xs"
            leftSection={<IconPlus size={12} />}
            onClick={() => setImportOpen(true)}
          >
            批量导入
          </Button>
        </Group>
      </Group>
      {filtered.length > 50 && (
        <Text size="xs" c="dimmed" mb="xs">
          显示前50条，共{filtered.length}条患者记录
        </Text>
      )}
      {filtered.length <= 50 && (
        <Text size="xs" c="dimmed" mb="xs">
          共{filtered.length}条患者记录
        </Text>
      )}
      <Table striped stickyHeader highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>姓名</Table.Th>
            <Table.Th>性别</Table.Th>
            <Table.Th>标签</Table.Th>
            <Table.Th>状态</Table.Th>
            <Table.Th>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filtered.slice(0, 50).map((p) => {
            const tags = p.tags ? Object.values(p.tags as object) : []
            return (
              <Table.Tr key={p.id}>
                <Table.Td>{p.name}</Table.Td>
                <Table.Td>{p.gender ?? '-'}</Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    {(tags as string[]).slice(0, 3).map((t) => (
                      <Badge key={t} size="xs" variant="light">
                        {String(t)}
                      </Badge>
                    ))}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Badge size="xs">{p.status}</Badge>
                </Table.Td>
                <Table.Td>
                  <Tooltip label="查看患者" withArrow>
                    <ActionIcon
                      variant="light"
                      onClick={() => navigate({ to: `/patients/${p.id}` })}
                    >
                      <IconEye size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            )
          })}
        </Table.Tbody>
      </Table>
      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="新建患者" size="lg" centered>
        <Tabs defaultValue="basic">
          <Tabs.List mb="md">
            <Tabs.Tab value="basic">基本信息</Tabs.Tab>
            <Tabs.Tab value="medical">疾病用药</Tabs.Tab>
            <Tabs.Tab value="family">家属</Tabs.Tab>
            <Tabs.Tab value="cognitive">认知</Tabs.Tab>
            <Tabs.Tab value="exam">检查</Tabs.Tab>
            <Tabs.Tab value="scales">量表</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="basic">
            <SimpleGrid cols={2} spacing="sm">
              <TextInput label="姓名" required value={newPatient.name} onChange={(e) => setNewPatient({ ...newPatient, name: e.currentTarget.value })} />
              <TextInput label="性别" value={newPatient.gender} onChange={(e) => setNewPatient({ ...newPatient, gender: e.currentTarget.value })} />
              <TextInput label="出生日期" type="date" value={newPatient.birthDate} onChange={(e) => setNewPatient({ ...newPatient, birthDate: e.currentTarget.value })} />
              <TextInput label="电话" value={newPatient.phone} onChange={(e) => setNewPatient({ ...newPatient, phone: e.currentTarget.value })} />
              <Select label="认知档案" placeholder="选择认知障碍类型"
                data={(profiles || []).map((p) => ({ value: p.profileName, label: `${p.traits?.[0] || p.profileName} (${p.displayName})` }))}
                value={newPatient.profileId || null} onChange={(v) => v && setNewPatient({ ...newPatient, profileId: v })} clearable searchable />
            </SimpleGrid>
          </Tabs.Panel>
          <Tabs.Panel value="medical">
            <Stack gap="sm">
              <MultiSelect label="基础疾病" searchable
                data={['高血压','糖尿病','冠心病','脑卒中','慢阻肺','关节炎','骨质疏松','帕金森','阿尔茨海默病','抑郁症','焦虑症']}
                value={(newPatient.tags.chronicDiseases as string[]) || []}
                onChange={(v) => setNewPatient({ ...newPatient, tags: { ...newPatient.tags, chronicDiseases: v } })} />
              <TextInput label="其他疾病" value={(newPatient.tags.otherDisease as string) || ''}
                onChange={(e) => setNewPatient({ ...newPatient, tags: { ...newPatient.tags, otherDisease: e.currentTarget.value } })} />
              <TagsInput label="当前用药" placeholder="输入药品名后回车"
                value={(newPatient.tags.currentMeds as string[]) || []}
                onChange={(v) => setNewPatient({ ...newPatient, tags: { ...newPatient.tags, currentMeds: v } })} />
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="family">
            <SimpleGrid cols={2} spacing="sm">
              <TextInput label="紧急联系人" value={(newPatient.tags.emergencyContact as string) || ''}
                onChange={(e) => setNewPatient({ ...newPatient, tags: { ...newPatient.tags, emergencyContact: e.currentTarget.value } })} />
              <TextInput label="紧急电话" value={(newPatient.tags.emergencyPhone as string) || ''}
                onChange={(e) => setNewPatient({ ...newPatient, tags: { ...newPatient.tags, emergencyPhone: e.currentTarget.value } })} />
            </SimpleGrid>
          </Tabs.Panel>
          <Tabs.Panel value="cognitive">
            <Stack gap="sm">
              <Select label="认知水平" data={[{ value: 'normal', label: '正常' },{ value: 'mild', label: '轻度衰退' },{ value: 'moderate', label: '中度衰退' },{ value: 'severe', label: '重度衰退' }]}
                value={(newPatient.tags.cognitiveLevel as string) || null}
                onChange={(v) => setNewPatient({ ...newPatient, tags: { ...newPatient.tags, cognitiveLevel: v || '' } })} />
              <Textarea label="认知功能描述" value={(newPatient.tags.cognitiveNotes as string) || ''} rows={2}
                onChange={(e) => setNewPatient({ ...newPatient, tags: { ...newPatient.tags, cognitiveNotes: e.currentTarget.value } })} />
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="exam">
            <Stack gap="sm">
              <Textarea label="心电图" value={(newPatient.tags.ecg as string) || ''} rows={2}
                onChange={(e) => setNewPatient({ ...newPatient, tags: { ...newPatient.tags, ecg: e.currentTarget.value } })} />
              <Textarea label="脑CT/MRI" value={(newPatient.tags.brainCt as string) || ''} rows={2}
                onChange={(e) => setNewPatient({ ...newPatient, tags: { ...newPatient.tags, brainCt: e.currentTarget.value } })} />
              <Textarea label="血液检查" value={(newPatient.tags.bloodTest as string) || ''} rows={2}
                onChange={(e) => setNewPatient({ ...newPatient, tags: { ...newPatient.tags, bloodTest: e.currentTarget.value } })} />
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="scales">
            <SimpleGrid cols={3} spacing="sm">
              <NumberInput label="MMSE(0-30)" value={(newPatient.tags.mmseScore as number) || ''} min={0} max={30}
                onChange={(v) => setNewPatient({ ...newPatient, tags: { ...newPatient.tags, mmseScore: Number(v) || undefined } })} />
              <NumberInput label="MoCA(0-30)" value={(newPatient.tags.mocaScore as number) || ''} min={0} max={30}
                onChange={(v) => setNewPatient({ ...newPatient, tags: { ...newPatient.tags, mocaScore: Number(v) || undefined } })} />
              <NumberInput label="Barthel(0-100)" value={(newPatient.tags.barthelScore as number) || ''} min={0} max={100}
                onChange={(v) => setNewPatient({ ...newPatient, tags: { ...newPatient.tags, barthelScore: Number(v) || undefined } })} />
              <NumberInput label="NPI(0-144)" value={(newPatient.tags.npiScore as number) || ''} min={0} max={144}
                onChange={(v) => setNewPatient({ ...newPatient, tags: { ...newPatient.tags, npiScore: Number(v) || undefined } })} />
              <NumberInput label="CMAI(14-98)" value={(newPatient.tags.cmaiScore as number) || ''} min={14} max={98}
                onChange={(v) => setNewPatient({ ...newPatient, tags: { ...newPatient.tags, cmaiScore: Number(v) || undefined } })} />
              <NumberInput label="Zarit(0-88)" value={(newPatient.tags.zaritScore as number) || ''} min={0} max={88}
                onChange={(v) => setNewPatient({ ...newPatient, tags: { ...newPatient.tags, zaritScore: Number(v) || undefined } })} />
            </SimpleGrid>
          </Tabs.Panel>
        </Tabs>
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => setCreateOpen(false)}>取消</Button>
          <Button onClick={() => {
            const tags: any = {}
            const t = newPatient.tags
            if (newPatient.profileId) tags.profileId = newPatient.profileId
            for (const k of Object.keys(t)) { if (t[k] != null && t[k] !== '' && (Array.isArray(t[k]) ? t[k].length > 0 : true)) tags[k] = t[k] }
            const payload: any = { name: newPatient.name, gender: newPatient.gender, birthDate: newPatient.birthDate, phone: newPatient.phone, tags }
            createPatient.mutate(payload, { onSuccess: () => {
              setCreateOpen(false)
              setNewPatient({ name: '', gender: '', birthDate: '', phone: '', profileId: '', tags: {} })
              refetch()
            }})
          }} disabled={!newPatient.name}>创建</Button>
        </Group>
      </Modal>
      <BatchImportModal
        opened={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={refetch}
      />
    </Container>
  )
}
