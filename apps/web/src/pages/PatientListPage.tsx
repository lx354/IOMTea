import { useState } from 'react'
import { Container, Title, Table, Button, Modal, TextInput, Select, Group, Loader, ActionIcon, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { trpc } from '../trpc'

type Gender = 'male' | 'female' | 'other'

export function PatientListPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', gender: '' as Gender | '', room: '', bedNumber: '' })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const errs: Record<string, string> = {}
    if (!form.name?.trim()) errs.name = '姓名为必填项'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const resetForm = () => {
    setForm({ name: '', gender: '', room: '', bedNumber: '' })
    setFormErrors({})
  }

  const handleCreate = () => {
    if (!validateForm()) return
    create.mutate({ name: form.name, gender: form.gender || undefined, room: form.room || undefined, bedNumber: form.bedNumber || undefined })
  }

  const handleUpdate = () => {
    if (!validateForm()) return
    update.mutate({ id: editId!, data: { name: form.name, gender: form.gender || undefined, room: form.room || undefined, bedNumber: form.bedNumber || undefined } })
  }

  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.patient.list.useQuery({ pageSize: 100 })
  const create = trpc.patient.create.useMutation({
    onSuccess: () => { utils.patient.list.invalidate(); setCreateOpen(false); resetForm(); notifications.show({ title: '创建成功', message: '患者已添加', color: 'green' }) },
    onError: (err: any) => notifications.show({ title: '操作失败', message: err.message, color: 'red' }),
  })
  const update = trpc.patient.update.useMutation({
    onSuccess: () => { utils.patient.list.invalidate(); setEditId(null); notifications.show({ title: '更新成功', message: '患者信息已更新', color: 'green' }) },
    onError: (err: any) => notifications.show({ title: '操作失败', message: err.message, color: 'red' }),
  })
  const del = trpc.patient.delete.useMutation({
    onSuccess: () => { utils.patient.list.invalidate(); setDeleteConfirm(null); notifications.show({ title: '已删除', message: '患者已移除', color: 'orange' }) },
    onError: (err: any) => notifications.show({ title: '操作失败', message: err.message, color: 'red' }),
  })

  if (isLoading) return <Container py="xl"><Loader /></Container>

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>患者管理</Title>
        <Button size="sm" onClick={() => setCreateOpen(true)}>新增患者</Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>姓名</Table.Th><Table.Th>性别</Table.Th><Table.Th>房间</Table.Th><Table.Th>床位</Table.Th><Table.Th>状态</Table.Th><Table.Th>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data?.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text ta="center" c="dimmed" py="xl">暂无患者数据</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            data?.map((p: any) => (
              <Table.Tr key={p.id}>
                <Table.Td>{p.name}</Table.Td>
                <Table.Td>{p.gender || '-'}</Table.Td>
                <Table.Td>{p.room || '-'}</Table.Td>
                <Table.Td>{p.bedNumber || '-'}</Table.Td>
                <Table.Td>{p.status}</Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <ActionIcon size="sm" variant="subtle" aria-label="编辑患者" onClick={() => { setEditId(p.id); setForm({ name: p.name, gender: p.gender || '', room: p.room || '', bedNumber: p.bedNumber || '' }); setFormErrors({}) }}>✏️</ActionIcon>
                    <ActionIcon size="sm" variant="subtle" color="red" aria-label="删除患者" onClick={() => setDeleteConfirm(p.id)}>🗑</ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>

      {/* Delete Confirmation Modal */}
      <Modal opened={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="确认删除" size="sm">
        <Text mb="lg">确定要删除吗？此操作不可撤销。</Text>
        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => setDeleteConfirm(null)}>取消</Button>
          <Button color="red" onClick={() => { del.mutate({ id: deleteConfirm! }) }}>删除</Button>
        </Group>
      </Modal>

      {/* Create Modal */}
      <Modal opened={createOpen} onClose={() => { setCreateOpen(false); resetForm() }} title="新增患者">
        <TextInput label="姓名" required value={form.name} error={formErrors.name} onChange={e => setForm({ ...form, name: e.currentTarget.value })} mb="sm" />
        <Select label="性别" data={['male', 'female', 'other']} value={form.gender || null} onChange={v => setForm({ ...form, gender: (v as Gender | '') || '' })} mb="sm" />
        <TextInput label="房间" value={form.room} onChange={e => setForm({ ...form, room: e.currentTarget.value })} mb="sm" />
        <TextInput label="床位" value={form.bedNumber} onChange={e => setForm({ ...form, bedNumber: e.currentTarget.value })} mb="sm" />
        <Button fullWidth onClick={handleCreate} loading={create.isPending}>创建</Button>
      </Modal>

      {/* Edit Modal */}
      <Modal opened={!!editId} onClose={() => { setEditId(null); resetForm() }} title="编辑患者">
        <TextInput label="姓名" required value={form.name} error={formErrors.name} onChange={e => setForm({ ...form, name: e.currentTarget.value })} mb="sm" />
        <Select label="性别" data={['male', 'female', 'other']} value={form.gender || null} onChange={v => setForm({ ...form, gender: (v as Gender | '') || '' })} mb="sm" />
        <TextInput label="房间" value={form.room} onChange={e => setForm({ ...form, room: e.currentTarget.value })} mb="sm" />
        <TextInput label="床位" value={form.bedNumber} onChange={e => setForm({ ...form, bedNumber: e.currentTarget.value })} mb="sm" />
        <Button fullWidth onClick={handleUpdate} loading={update.isPending}>保存</Button>
      </Modal>
    </Container>
  )
}
