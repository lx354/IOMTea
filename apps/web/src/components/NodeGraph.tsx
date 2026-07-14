import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconActivity, IconBrain, IconDeviceWatch, IconFilter, IconFocus2,
  IconHeart, IconKey, IconLayoutGrid, IconMaximize, IconUser,
  IconUserHeart, IconUsersGroup, IconUserShield, IconUserStar,
} from '@tabler/icons-react'
import { useNavigate } from '@tanstack/react-router'
import type { Node, Edge, FitViewOptions } from '@xyflow/react'
import {
  Background, BackgroundVariant, Controls, MarkerType, MiniMap,
  Panel, ReactFlow, useEdgesState, useNodesState,
} from '@xyflow/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { http } from '../api/client'
import { useGet } from '../api/hooks'

interface PatientNode {
  id: string; name: string; gender: string | null; status: string
  tags?: Record<string, unknown> | null
}
interface UserNode {
  id: string; username: string; displayName: string | null; role: string
}
interface Relation {
  patientId: string; userId: string; relation: string | null
}
interface PinNode {
  pin: string; userId: string; type: string; label: string
}

const ROLE_CONFIG: Record<string, { color: string; icon: React.ElementType; zh: string; tier: number }> = {
  super_admin: { color: '#fab005', icon: IconUserShield, zh: '超管', tier: 0 },
  admin: { color: '#4c6ef5', icon: IconUserStar, zh: '管理员', tier: 1 },
  user: { color: '#868e96', icon: IconUser, zh: '用户', tier: 2 },
}

const REL_CONFIG: Record<string, { color: string; zh: string; group: 'family' | 'medical' | 'care' | 'other' }> = {
  primary: { color: '#e03131', zh: '主要照护', group: 'family' },
  spouse: { color: '#e8590c', zh: '配偶', group: 'family' },
  child: { color: '#f76707', zh: '子女', group: 'family' },
  parent: { color: '#f08c00', zh: '父母', group: 'family' },
  sibling: { color: '#e8590c', zh: '兄弟姐妹', group: 'family' },
  caregiver: { color: '#2f9e44', zh: '护工', group: 'care' },
  doctor: { color: '#1c7ed6', zh: '医生', group: 'medical' },
  nurse: { color: '#339af0', zh: '护士', group: 'medical' },
  admin: { color: '#7950f2', zh: '管理', group: 'other' },
  other: { color: '#868e96', zh: '其他', group: 'other' },
}

interface GraphNodeData {
  label: string; role?: string; status?: string; pinType?: string
  relationCount?: number; alertCount?: number
}

export function NodeGraph() {
  const navigate = useNavigate()
  const { data: patientsRaw } = useGet<PatientNode[]>('/patients', { pageSize: 200 })
  const { data: usersRaw } = useGet<UserNode[]>('/users')
  const { data: pinsRaw } = useGet<PinNode[]>('/pins')
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selected, setSelected] = useState<Node | null>(null)
  const [focusPatient, setFocusPatient] = useState<string | null>(null)
  const [showLegend, setShowLegend] = useState(true)
  const [relationMap, setRelationMap] = useState<Record<string, { userId: string; relation: string | null }[]>>({})
  const [kgData, setKgData] = useState<{ symptoms: Array<{ id: string; label: string; description: string }>; triggers: Array<{ id: string; label: string; description: string }>; interventions: Array<{ id: string; label: string; description: string }> } | null>(null)
  const [kgLoading, setKgLoading] = useState(false)
  const rfRef = useRef<{ fitView: (opts?: FitViewOptions) => void } | null>(null)

  const patients = useMemo(() => patientsRaw || [], [patientsRaw])
  const users = useMemo(() => usersRaw || [], [usersRaw])
  const pins = useMemo(() => pinsRaw || [], [pinsRaw])

  const userNodeMap = useMemo(() => {
    const m = new Map<string, UserNode>()
    for (const u of users) m.set(u.id, u)
    return m
  }, [users])

  useEffect(() => {
    if (!patients.length || !users.length) return
    const pn: Node[] = patients.map((p, i) => ({
      id: `pat-${p.id}`,
      type: 'patient',
      position: { x: i * 220 + 60, y: 0 },
      data: { label: p.name, status: p.status },
    }))
    const un: Node[] = users.map((u, i) => {
      const rc = ROLE_CONFIG[u.role] || { color: '#868e96' }
      return {
        id: `usr-${u.id}`,
        type: 'user',
        position: { x: i * 140 + 40, y: 200 + Math.random() * 60 },
        data: { label: u.displayName || u.username, role: u.role },
        style: { borderColor: rc.color, borderWidth: 3 },
      }
    })
    const devn: Node[] = (pins || []).map((p, i) => ({
      id: `pin-${p.pin}`,
      type: 'device',
      position: { x: i * 160 + 60, y: 500 },
      data: { label: p.label || p.pin, pinType: p.type },
    }))
    setNodes([...pn, ...un, ...devn])

    Promise.all(patients.map((p) =>
      http.get(`/patients/${p.id}/users`).then((r) => [p.id, (r.data as Relation[]) || []] as const),
    )).then((results) => {
      const map: Record<string, Relation[]> = {}
      const newEdges: Edge[] = []
      for (const [pid, rels] of results) {
        map[pid] = rels
        for (const r of rels) {
          const rc = REL_CONFIG[r.relation || 'other'] || REL_CONFIG.other
          newEdges.push({
            id: `e-${pid}-${r.userId}`,
            source: `usr-${r.userId}`,
            target: `pat-${pid}`,
            label: rc.zh,
            style: { stroke: rc.color, strokeWidth: rc.group === 'family' ? 2.5 : 1.5, strokeDasharray: rc.group === 'other' ? '6 3' : undefined },
            markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: rc.color },
            animated: rc.group === 'medical',
          })
        }
      }
      setRelationMap(map)
      setEdges(newEdges)
    })
  }, [patients, users, pins, setNodes, setEdges])

  const autoLayout = useCallback(() => {
    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 120, marginx: 40, marginy: 40 })
    for (const n of nodes) g.setNode(n.id, { width: n.type === 'patient' ? 180 : n.type === 'user' ? 120 : 100, height: n.type === 'patient' ? 90 : n.type === 'user' ? 80 : 60 })
    for (const e of edges) g.setEdge(e.source, e.target)
    dagre.layout(g)
    setNodes(nodes.map((n) => { const p = g.node(n.id); return { ...n, position: { x: p.x - (n.type === 'patient' ? 90 : n.type === 'user' ? 60 : 50), y: p.y - (n.type === 'patient' ? 45 : 40) } } }))
  }, [nodes, edges, setNodes])

  const filtered = useMemo(() => {
    if (!focusPatient) return nodes
    const connected = new Set<string>()
    connected.add(`pat-${focusPatient}`)
    for (const e of edges) {
      if (e.target === `pat-${focusPatient}`) connected.add(e.source)
    }
    return nodes.filter((n) => connected.has(n.id))
  }, [nodes, edges, focusPatient])

  const filteredEdges = useMemo(() => {
    if (!focusPatient) return edges
    return edges.filter((e) => e.target === `pat-${focusPatient}`)
  }, [edges, focusPatient])

  const patientOptions = patients.map((p) => ({ value: p.id, label: `${p.name}` }))

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 130px)', gap: 0 }}>
      <div style={{ flex: 1, border: '1px solid #dee2e6', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
        <ReactFlow
          nodes={filtered}
          edges={filteredEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_e, node) => setSelected(node)}
          onInit={(inst) => { rfRef.current = inst }}
          fitView
          nodeTypes={{ patient: PatientComp, user: UserComp, device: DeviceComp }}
        >
          <Controls />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <MiniMap nodeStrokeWidth={2} pannable zoomable />
          <Panel position="top-left">
            <Paper p="xs" radius="md" shadow="sm" style={{ background: 'rgba(255,255,255,0.95)' }}>
              <Group gap="xs">
                <Select
                  size="xs" w={160} placeholder="聚焦患者..."
                  data={patientOptions}
                  value={focusPatient}
                  onChange={setFocusPatient}
                  clearable
                  searchable
                  leftSection={<IconFocus2 size={14} />}
                />
                {focusPatient && (
                  <Button size="compact-xs" variant="light" onClick={() => setFocusPatient(null)}>全部</Button>
                )}
                <ActionIcon size="sm" variant="light" onClick={autoLayout} title="自动布局">
                  <IconLayoutGrid size={14} />
                </ActionIcon>
                <ActionIcon size="sm" variant="light" onClick={() => rfRef.current?.fitView()} title="适应画面">
                  <IconMaximize size={14} />
                </ActionIcon>
                <ActionIcon size="sm" variant={showLegend ? 'filled' : 'light'} onClick={() => setShowLegend(!showLegend)} title="图例">
                  <IconFilter size={14} />
                </ActionIcon>
              </Group>
            </Paper>
          </Panel>
          {showLegend && (
            <Panel position="bottom-left">
              <Paper p="xs" radius="md" shadow="sm" style={{ background: 'rgba(255,255,255,0.95)', fontSize: 12 }}>
                <Text size="xs" fw={600} mb={4}>图例</Text>
                <Group gap="xs" wrap="wrap">
                  <Group gap={4}><ThemeIcon size="xs" color="red"><IconHeart size={10} /></ThemeIcon><Text size="xs">家属</Text></Group>
                  <Group gap={4}><ThemeIcon size="xs" color="blue"><IconBrain size={10} /></ThemeIcon><Text size="xs">医护</Text></Group>
                  <Group gap={4}><ThemeIcon size="xs" color="green"><IconUserHeart size={10} /></ThemeIcon><Text size="xs">护工</Text></Group>
                  <Group gap={4}><ThemeIcon size="xs" color="violet"><IconUserShield size={10} /></ThemeIcon><Text size="xs">管理员</Text></Group>
                  <Group gap={4}><ThemeIcon size="xs" color="gray"><IconDeviceWatch size={10} /></ThemeIcon><Text size="xs">设备</Text></Group>
                  <Group gap={4}><Badge size="xs" color="yellow" variant="light">超管</Badge><Text size="xs">全权限</Text></Group>
                  <Group gap={4}><Badge size="xs" color="blue" variant="light">管理员</Badge><Text size="xs">管理</Text></Group>
                  <Group gap={4}><Badge size="xs" color="gray" variant="light">用户</Badge><Text size="xs">受限</Text></Group>
                </Group>
              </Paper>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {/* ── 详情面板 ── */}
      {selected && (
        <Paper p="sm" withBorder style={{ width: 260, overflow: 'auto', background: 'rgba(255,255,255,0.98)' }}>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600} size="sm">{String(selected.data?.label || '')}</Text>
              <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setSelected(null)}>×</Button>
            </Group>

            {selected.type === 'patient' && (
              <>
                <Badge color={selected.data?.status === 'active' ? 'green' : 'gray'} variant="light">
                  {String(selected.data?.status || '')}
                </Badge>
                <Button size="xs" variant="light" fullWidth
                  onClick={() => navigate({ to: `/patients/${selected.id.replace('pat-', '')}` })}>
                  查看患者详情
                </Button>
                <Divider my={4} />
                <Text size="xs" fw={600} c="dimmed">可访问该患者数据的人员:</Text>
                {(relationMap[selected.id.replace('pat-', '')] || []).map((r) => {
                  const u = userNodeMap.get(r.userId)
                  const rc = REL_CONFIG[r.relation || 'other'] || REL_CONFIG.other
                  return (
                    <Group key={r.userId} gap={6}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: rc.color }} />
                      <Text size="xs" fw={500}>{u?.displayName || u?.username || r.userId.slice(0, 8)}</Text>
                      <Badge size="xs" variant="light" color={ROLE_CONFIG[u?.role || 'user']?.color || 'gray'}>
                        {ROLE_CONFIG[u?.role || 'user']?.zh || '用户'}
                      </Badge>
                      <Text size="xs" c="dimmed">({rc.zh})</Text>
                    </Group>
                  )
                })}
                {(!relationMap[selected.id.replace('pat-', '')] || relationMap[selected.id.replace('pat-', '')].length === 0) && (
                  <Text size="xs" c="dimmed">暂无关联系用户 (仅超管可访问)</Text>
                )}
                <Divider my={4} />
                <Button size="xs" variant="light" color="grape" fullWidth loading={kgLoading}
                  onClick={async () => {
                    if (kgData) { setKgData(null); return }
                    setKgLoading(true)
                    try {
                      const pid = selected.id.replace('pat-', '')
                      const { data: r } = await http.get(`/patients/${pid}`)
                      const tags = (r.data as any)?.tags || {}
                      const profileId = tags.profileId || tags.profile_id as string
                      if (profileId) {
                        const { data: kg } = await http.get(`/dashboard/knowledge-graph/${profileId}`)
                        setKgData(kg as any)
                      } else {
                        notifications.show({ title: '未关联认知档案', message: '该患者未绑定认知障碍类型', color: 'gray' })
                      }
                    } catch { notifications.show({ title: '加载失败', color: 'red' }) }
                    finally { setKgLoading(false) }
                  }}>
                  {kgData ? '收起症状网络' : '查看症状网络'}
                </Button>
                {kgData && (
                  <Stack gap={4}>
                    {kgData.symptoms.length > 0 && <Text size="xs" fw={600} c="red" mt={4}>⚠ 症状 ({kgData.symptoms.length})</Text>}
                    {kgData.symptoms.map((s) => (
                      <Text key={s.id} size="xs" c="red">• {s.label}</Text>
                    ))}
                    {kgData.triggers.length > 0 && <Text size="xs" fw={600} c="orange" mt={4}>🎯 诱因 ({kgData.triggers.length})</Text>}
                    {kgData.triggers.map((t) => (
                      <Text key={t.id} size="xs" c="orange">• {t.label}</Text>
                    ))}
                    {kgData.interventions.length > 0 && <Text size="xs" fw={600} c="teal" mt={4}>💡 建议干预 ({kgData.interventions.length})</Text>}
                    {kgData.interventions.map((iv) => (
                      <Text key={iv.id} size="xs" c="teal">• {iv.label}</Text>
                    ))}
                  </Stack>
                )}
              </>
            )}

            {selected.type === 'user' && (
              <>
                <Badge color={ROLE_CONFIG[String(selected.data?.role || 'user')]?.color || 'gray'} variant="light">
                  {ROLE_CONFIG[String(selected.data?.role || 'user')]?.zh || '用户'}
                </Badge>
                <Text size="xs" c="dimmed">数据访问权限:</Text>
                {String(selected.data?.role || '') === 'super_admin'
                  ? <Badge size="sm" color="yellow">全部患者数据</Badge>
                  : String(selected.data?.role || '') === 'admin'
                  ? <Badge size="sm" color="blue">管理范围患者</Badge>
                  : <>
                    {Object.entries(relationMap)
                      .filter(([, rels]) => rels.some((r) => r.userId === selected.id.replace('usr-', '')))
                      .map(([pid, rels]) => {
                        const p = patients.find((pp) => pp.id === pid)
                        const rel = rels.find((r) => r.userId === selected.id.replace('usr-', ''))
                        return (
                          <Group key={pid} gap={6}>
                            <IconUser size={12} />
                            <Text size="xs">{p?.name || pid.slice(0, 8)}</Text>
                            <Text size="xs" c="dimmed">({REL_CONFIG[rel?.relation || 'other']?.zh || '—'})</Text>
                          </Group>
                        )
                      })}
                    {!Object.values(relationMap).some((rels) => rels.some((r) => r.userId === selected.id.replace('usr-', ''))) && (
                      <Text size="xs" c="dimmed">暂无关联系患者</Text>
                    )}
                  </>}
                <Button size="xs" variant="light" fullWidth onClick={() => navigate({ to: '/settings/users' })}>
                  查看用户列表
                </Button>
              </>
            )}

            {selected.type === 'device' && (
              <>
                <Group gap={4}>
                  <IconKey size={14} />
                  <Text size="xs" fw={500}>{String(selected.data?.label || '')}</Text>
                </Group>
                <Badge size="sm" variant="light" color="gray">
                  {String(selected.data?.pinType || 'device')}
                </Badge>
                <Text size="xs" c="dimmed">PIN: {selected.id.replace('pin-', '')}</Text>
              </>
            )}
          </Stack>
        </Paper>
      )}
    </div>
  )
}

// ── 自定义节点组件 ──

function PatientComp({ data }: { data: Record<string, unknown> }) {
  const status = String(data.status || '')
  const color = status === 'active' ? 'teal' : 'gray'
  return (
    <div style={{
      background: color === 'teal' ? 'linear-gradient(135deg, #e6fcf5, #c3fae8)' : '#f1f3f5',
      border: `2px solid ${color === 'teal' ? '#38b2ac' : '#adb5bd'}`, borderRadius: 12,
      padding: '10px 14px', minWidth: 140, textAlign: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}>
      <IconActivity size={18} color={color === 'teal' ? '#0c8599' : '#adb5bd'} />
      <Text size="sm" fw={600} mt={4} style={{ color: '#0c8599' }}>{String(data.label || '')}</Text>
      <Badge size="xs" variant="light" color={color} mt={4}>{status}</Badge>
    </div>
  )
}

function UserComp({ data }: { data: Record<string, unknown> }) {
  const role = String(data.role || 'user')
  const rc = ROLE_CONFIG[role] || { color: '#868e96', icon: IconUser, zh: role }
  const Icon = rc.icon
  return (
    <div style={{
      background: 'white', borderRadius: '50%', width: 90, height: 90,
      border: `3px solid ${rc.color}`, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 2,
      boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
    }}>
      <Icon size={20} color={rc.color} stroke={1.5} />
      <Text size="xs" fw={600} style={{ lineHeight: 1.2 }}>{String(data.label || '')}</Text>
      <Badge size="xs" variant="light" color={rc.color === '#fab005' ? 'yellow' : rc.color === '#4c6ef5' ? 'blue' : 'gray'}>
        {rc.zh}
      </Badge>
    </div>
  )
}

function DeviceComp({ data }: { data: Record<string, unknown> }) {
  return (
    <div style={{
      background: '#f8f9fa', border: '1px dashed #adb5bd', borderRadius: 8,
      padding: '6px 10px', minWidth: 80, textAlign: 'center',
    }}>
      <IconDeviceWatch size={16} color="#868e96" />
      <Text size="xs" fw={500} mt={2}>{String(data.label || '')}</Text>
      <Badge size="xs" variant="outline" color="gray">{String(data.pinType || 'device')}</Badge>
    </div>
  )
}

function Divider({ my }: { my?: number }) {
  return <div style={{ height: 1, background: '#dee2e6', margin: `${my ?? 8}px 0` }} />
}
