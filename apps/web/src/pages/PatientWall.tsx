import {
  ActionIcon, Badge, Button, Container, Group, Modal,
  Select, Stack, Table, Text, TextInput, Title, Tooltip,
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
  const [newPatient, setNewPatient] = useState({ name: '', gender: '', birthDate: '', phone: '', profileId: '' })
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
      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="新建患者" size="sm">
        <Stack>
          <TextInput
            label="姓名"
            required
            value={newPatient.name}
            onChange={(e) => setNewPatient({ ...newPatient, name: e.currentTarget.value })}
          />
          <TextInput
            label="性别"
            value={newPatient.gender}
            onChange={(e) => setNewPatient({ ...newPatient, gender: e.currentTarget.value })}
          />
          <TextInput
            label="出生日期"
            type="date"
            value={newPatient.birthDate}
            onChange={(e) => setNewPatient({ ...newPatient, birthDate: e.currentTarget.value })}
          />
          <TextInput
            label="电话"
            value={newPatient.phone}
            onChange={(e) => setNewPatient({ ...newPatient, phone: e.currentTarget.value })}
          />
          <Select
            label="认知档案"
            placeholder="选择认知障碍类型"
            data={(profiles || []).map((p) => ({ value: p.profileName, label: `${p.traits?.[0] || p.profileName} (${p.displayName})` }))}
            value={newPatient.profileId || null}
            onChange={(v) => v && setNewPatient({ ...newPatient, profileId: v })}
            clearable
            searchable
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                const payload: any = { ...newPatient }
                if (newPatient.profileId) payload.tags = { profileId: newPatient.profileId }
                delete payload.profileId
                createPatient.mutate(payload, {
                  onSuccess: () => {
                    setCreateOpen(false)
                    setNewPatient({ name: '', gender: '', birthDate: '', phone: '', profileId: '' })
                    refetch()
                  },
                })
              }}
              disabled={!newPatient.name}
            >
              创建
            </Button>
          </Group>
        </Stack>
      </Modal>
      <BatchImportModal
        opened={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={refetch}
      />
    </Container>
  )
}
