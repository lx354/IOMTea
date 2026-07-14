import { useState } from 'react'
import { Container, Title, Table, Button, Modal, TextInput, Select, Group, Loader, ActionIcon, Badge, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { trpc } from '../trpc'

type DeviceType = 'mattress' | 'vision' | 'imu' | 'generic' | 'simulator' | 'custom'

const typeLabels: Record<string, string> = { mattress: '床垫', vision: '视觉', imu: 'IMU', generic: '通用', simulator: '仿真', custom: '自定义' }
const statusColor: Record<string, string> = { active: 'green', inactive: 'gray', maintenance: 'orange' }

export function DeviceListPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [form, setForm] = useState({ serialNumber: '', deviceType: 'generic' as DeviceType })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const errs: Record<string, string> = {}
    if (!form.serialNumber?.trim()) errs.serialNumber = '序列号为必填项'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const resetForm = () => {
    setForm({ serialNumber: '', deviceType: 'generic' })
    setFormErrors({})
  }

  const handleCreate = () => {
    if (!validateForm()) return
    create.mutate(form)
  }

  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.device.list.useQuery({ pageSize: 100 })
  const create = trpc.device.create.useMutation({
    onSuccess: () => { utils.device.list.invalidate(); setCreateOpen(false); resetForm(); notifications.show({ title: '创建成功', message: '设备已添加', color: 'green' }) },
    onError: (err: any) => notifications.show({ title: '操作失败', message: err.message, color: 'red' }),
  })
  const update = trpc.device.update.useMutation({
    onSuccess: () => { utils.device.list.invalidate(); notifications.show({ title: '更新成功', message: '设备状态已切换', color: 'green' }) },
    onError: (err: any) => notifications.show({ title: '操作失败', message: err.message, color: 'red' }),
  })
  const del = trpc.device.delete.useMutation({
    onSuccess: () => { utils.device.list.invalidate(); setDeleteConfirm(null); notifications.show({ title: '已删除', message: '设备已移除', color: 'orange' }) },
    onError: (err: any) => notifications.show({ title: '操作失败', message: err.message, color: 'red' }),
  })

  if (isLoading) return <Container py="xl"><Loader /></Container>

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>设备管理</Title>
        <Button size="sm" onClick={() => setCreateOpen(true)}>新增设备</Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>序列号</Table.Th><Table.Th>类型</Table.Th><Table.Th>状态</Table.Th><Table.Th>最后在线</Table.Th><Table.Th>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data?.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text ta="center" c="dimmed" py="xl">暂无设备数据</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            data?.map((d: any) => (
              <Table.Tr key={d.id}>
                <Table.Td>{d.serialNumber}</Table.Td>
                <Table.Td><Badge variant="light">{typeLabels[d.deviceType] || d.deviceType}</Badge></Table.Td>
                <Table.Td><Badge color={statusColor[d.status] || 'gray'}>{d.status}</Badge></Table.Td>
                <Table.Td>{d.lastSeen ? new Date(d.lastSeen).toLocaleString() : '-'}</Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <ActionIcon size="sm" variant="subtle" aria-label="切换设备状态" onClick={() => { update.mutate({ id: d.id, data: { status: d.status === 'active' ? 'inactive' : 'active' } }) }}>🔄</ActionIcon>
                    <ActionIcon size="sm" variant="subtle" color="red" aria-label="删除设备" onClick={() => setDeleteConfirm(d.id)}>🗑</ActionIcon>
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

      <Modal opened={createOpen} onClose={() => { setCreateOpen(false); resetForm() }} title="新增设备">
        <TextInput label="序列号" required value={form.serialNumber} error={formErrors.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.currentTarget.value })} mb="sm" />
        <Select label="设备类型" data={['mattress','vision','imu','generic','simulator','custom']} value={form.deviceType} onChange={v => setForm({ ...form, deviceType: (v as DeviceType) || 'generic' })} mb="sm" />
        <Button fullWidth onClick={handleCreate} loading={create.isPending}>创建</Button>
      </Modal>
    </Container>
  )
}
