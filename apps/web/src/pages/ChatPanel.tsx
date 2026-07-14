import {
  Avatar, Badge, Box, Button, Card, Center, Collapse, Divider, Grid,
  Group, Loader, Paper, Progress, ScrollArea, Select, SimpleGrid,
  Stack, Text, TextInput, ThemeIcon, UnstyledButton,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconBrain, IconCheck, IconChevronRight, IconClipboardList,
  IconHeart, IconMessageCircle, IconRefresh, IconSchool,
  IconSend, IconSettings, IconShield, IconStethoscope, IconUser, IconX,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useRef, useState, useMemo, type FormEvent } from 'react'
import { http } from '../api/client'

interface SceneBrief { id: string; name: string; description: string; applicableRoles: string[] }
interface SceneStartResult { state: { sceneId: string; roleId: string; turn: number; emotion: number; resistance: number }; context: string }
interface TurnResult { characterSpeech: string; nextEmotion: number; nextResistance: number; warning: string | null; taskCompleted: boolean; score: { score: number; rating: string; feedback: string; } | null; turn: number }

const GLASS = { bg: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)' }

const traitColors: Record<string, string> = {
  暴躁攻击型: 'red', 内向退缩型: 'gray', 焦虑依赖型: 'pink',
  欢乐无厘头型: 'green', 游走迷失型: 'blue', 拒绝照护型: 'orange',
  焦虑游走混合型: 'violet', 暴躁拒绝混合型: 'dark',
}

const ROLE_LABELS: Record<string, string> = {
  aggressive: '暴躁攻击型', withdrawn: '内向退缩型', 'anxious-dependent': '焦虑依赖型',
  cheerful_chaotic: '欢乐无厘头型', wandering: '游走迷失型', resistant: '拒绝照护型',
  anxious_wandering: '焦虑游走混合型', aggressive_resistant: '暴躁拒绝混合型',
}

interface ChatProfileBrief { profileName: string; displayName: string; age: number; gender: string; traits: string[] }
interface PatientBrief { id: string; name: string; tags?: Record<string, unknown> }
interface Message { role: 'user' | 'assistant'; content: string; assessment?: null }

type ChatMode = 'patient' | 'train' | 'scene'

export function ChatPanel() {
  const [mode, setMode] = useState<ChatMode | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null)
  const [autoDetected, setAutoDetected] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showAssessment, setShowAssessment] = useState<'show' | 'hide'>('show')
  const [adminSettingsOpen, setAdminSettingsOpen] = useState(false)
  const [adminProfile, setAdminProfile] = useState<string | null>(null)
  const [adminEmotion, setAdminEmotion] = useState(70)
  const [adminResistance, setAdminResistance] = useState(4)
  const [adminTrust, setAdminTrust] = useState(20)
  const [adminTriggers, setAdminTriggers] = useState<string[]>([])
  const [showContext, setShowContext] = useState(false)
  const [lastUserMsg, setLastUserMsg] = useState('')
  const [chatEmotion, setChatEmotion] = useState(50)
  const [chatResistance, setChatResistance] = useState(3)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── 场景训练状态 ──
  const [sceneStep, setSceneStep] = useState<'pick-scene' | 'pick-role' | 'training'>('pick-scene')
  const [selectedScene, setSelectedScene] = useState<SceneBrief | null>(null)
  const [selectedSceneRole, setSelectedSceneRole] = useState<string | null>(null)
  const [sceneContext, setSceneContext] = useState('')
  const [sceneEmotion, setSceneEmotion] = useState(50)
  const [sceneResistance, setSceneResistance] = useState(3)
  const [sceneTurn, setSceneTurn] = useState(0)
  const [sceneWarning, setSceneWarning] = useState<string | null>(null)
  const [sceneCompleted, setSceneCompleted] = useState(false)
  const [lastScore, setLastScore] = useState<{ score: number; rating: string; feedback: string } | null>(null)
  const [lastCharacterSpeech, setLastCharacterSpeech] = useState('')
  const [turnHistory, setTurnHistory] = useState<TurnResult[]>([])
  const [sceneLoading, setSceneLoading] = useState(false)

  const { data: patients } = useQuery<PatientBrief[]>({
    queryKey: ['patients-list'], queryFn: () => http.get('/patients').then((r) => (r.data as { data?: PatientBrief[] }).data ?? (r.data as PatientBrief[])),
    enabled: mode === 'patient',
  })
  const { data: allProfiles } = useQuery<ChatProfileBrief[]>({
    queryKey: ['chat-profiles-full'], queryFn: () => http.get('/twin/chat/profiles').then((r) => r.data as ChatProfileBrief[]), staleTime: 60000,
  })
  const { data: scenes } = useQuery<SceneBrief[]>({
    queryKey: ['training-scenes'], queryFn: () => http.get('/twin/training/scenes').then((r) => r.data as SceneBrief[]),
    enabled: mode === 'scene',
  })

  const profile = allProfiles?.find((p) => p.profileName === selectedProfile)
  const patientName = patients?.find((p) => p.id === selectedPatient)?.name ?? ''
  const displayName = mode === 'patient' ? patientName : (profile?.displayName ?? '')

  const patientTraitMap = useMemo(() => {
    const m = new Map<string, string>()
    if (!patients || !allProfiles) return m
    for (const p of patients) {
      const pid = (p.tags?.profileId ?? p.tags?.profile_id) as string | undefined
      const prof = pid ? allProfiles.find((ap) => (ap as any).profileName === pid) : undefined
      if (prof) m.set(p.id, prof.traits[0])
    }
    return m
  }, [patients, allProfiles])

  const handleSelectPatient = async (id: string) => {
    setSelectedPatient(id); setMessages([])
    try { const { data } = await http.get(`/twin/patient-profile/${id}`); const res = data as { profileName: string | null }; if (res.profileName) { setSelectedProfile(res.profileName); setAutoDetected(true) } else { setSelectedProfile(null); setAutoDetected(false) } } catch { setSelectedProfile(null); setAutoDetected(false) }
  }
  const handleSelectProfile = (name: string) => { setSelectedProfile(name); setAutoDetected(false); setMessages([]) }

  const handleBack = () => {
    setMode(null); setSelectedPatient(null); setSelectedProfile(null); setMessages([]); setAutoDetected(false)
    setSceneStep('pick-scene'); setSelectedScene(null); setSelectedSceneRole(null); setSceneTurn(0)
    setTurnHistory([]); setLastScore(null); setSceneCompleted(false); setSceneWarning(null)
  }

  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || !selectedProfile || sending) return
    const userMsg: Message = { role: 'user', content: input.trim() }
    setMessages((prev) => [...prev, userMsg]); setInput(''); setSending(true); setLastUserMsg(input.trim())
    try {
      const endpoint = mode === 'patient' ? `/twin/chat/${selectedProfile}/${selectedPatient}` : `/twin/chat/train/${selectedProfile}`
      const body: any = { message: userMsg.content }
      if (mode === 'patient' && adminSettingsOpen) {
        body.emotion = adminEmotion
        body.resistance = adminResistance
        body.trust = adminTrust
        body.triggers = adminTriggers
      }
      const { data } = await http.post(endpoint, body)
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
      if (data.emotion != null) setChatEmotion(data.emotion)
      if (data.resistance != null) setChatResistance(data.resistance)
    } catch { notifications.show({ title: '发送失败', message: '对话服务暂不可用', color: 'red' }) }
    finally { setSending(false); setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100) }
  }

  const startScene = async (scene: SceneBrief, roleId: string) => {
    setSceneLoading(true)
    try {
      const { data } = await http.post(`/twin/training/scenes/${scene.id}/start`, { roleId })
      const r = data as SceneStartResult
      setSceneContext(r.context); setSceneEmotion(r.state.emotion); setSceneResistance(r.state.resistance)
      setSceneTurn(0); setTurnHistory([]); setLastScore(null); setSceneCompleted(false); setSceneWarning(null)
      setLastCharacterSpeech('')
      setSceneStep('training')
    } catch { notifications.show({ title: '启动失败', message: '无法启动场景训练', color: 'red' }) }
    finally { setSceneLoading(false) }
  }

  const submitTurn = async (actionType?: string, freeText?: string) => {
    if (!selectedScene || !selectedSceneRole) return
    setSceneLoading(true)
    try {
      const { data } = await http.post(`/twin/training/scenes/${selectedScene.id}/turn`, { roleId: selectedSceneRole, actionType, freeText })
      const r = data as TurnResult
      setSceneEmotion(r.nextEmotion); setSceneResistance(r.nextResistance)
      setSceneTurn(r.turn); setLastScore(r.score); setSceneWarning(r.warning)
      setSceneCompleted(r.taskCompleted); setLastCharacterSpeech(r.characterSpeech)
      setTurnHistory((p) => [...p, r])
      if (freeText) setInput('')
    } catch { notifications.show({ title: '操作失败', message: '无法提交操作', color: 'red' }) }
    finally { setSceneLoading(false) }
  }

  // ── 入口页 ──
  if (!mode) {
    return (
      <Center h="calc(100vh - 200px)">
        <Stack align="center" gap="xl">
          <IconMessageCircle size={56} stroke={1} opacity={0.3} />
          <Text fz={24} fw={700}>对话孪生</Text>
          <Text c="dimmed" size="sm" mb="lg">选择一种模式开始</Text>
          <Group gap="lg">
            <CardEntry icon={IconStethoscope} color="blue" label="患者对话" desc="选择真实患者 / 查看健康状态 / 进行监护对话" onClick={() => setMode('patient')} />

            <CardEntry icon={IconBrain} color="teal" label="模拟训练" desc="选择认知障碍类型 / 模拟老人对话 / 练习沟通技巧" onClick={() => setMode('train')} />

            <CardEntry icon={IconSchool} color="orange" label="场景训练" desc="选择照护场景 / 按任务目标行动 / 获取实时评分" onClick={() => { setMode('scene'); setSceneStep('pick-scene') }} />
          </Group>
        </Stack>
      </Center>
    )
  }

  // ── 患者对话：选患者 ──
  if (mode === 'patient' && !selectedProfile) {
    return <SelectPatient patients={patients || []} traitMap={patientTraitMap} onSelect={handleSelectPatient} onBack={handleBack} />
  }
  // ── 模拟训练：选档案 ──
  if (mode === 'train' && !selectedProfile) {
    return <SelectProfile profiles={allProfiles || []} onSelect={handleSelectProfile} onBack={handleBack} />
  }

  // ── 场景训练 ──
  if (mode === 'scene' && sceneStep === 'pick-scene') {
    return <SelectScene scenes={scenes || []} onSelect={(s) => { setSelectedScene(s); setSceneStep('pick-role') }} onBack={handleBack} />
  }
  if (mode === 'scene' && sceneStep === 'pick-role') {
    if (!selectedScene) return null
    return (
      <SelectSceneRole
        scene={selectedScene}
        profiles={allProfiles || []}
        onSelect={(roleId) => { setSelectedSceneRole(roleId); startScene(selectedScene!, roleId) }}
        onBack={() => setSceneStep('pick-scene')}
        sceneLoading={sceneLoading}
      />
    )
  }
  if (mode === 'scene' && sceneStep === 'training') {
    return <SceneTrainingUI
      scene={selectedScene!} roleId={selectedSceneRole!} context={sceneContext}
      emotion={sceneEmotion} resistance={sceneResistance}
      turn={sceneTurn} warning={sceneWarning} completed={sceneCompleted}
      lastScore={lastScore} lastSpeech={lastCharacterSpeech}
      turnHistory={turnHistory} loading={sceneLoading}
      onAction={submitTurn} onFreeText={submitTurn}
      onBack={handleBack}
    />
  }

  // ── 自由对话界面（患者/模拟训练共用） ──
  return (
    <Box style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
      <Group mb="xs" justify="space-between">
        <Group gap="xs">
          <Button variant="subtle" size="compact-xs" onClick={handleBack}>&larr; 返回</Button>
          {mode === 'patient' && <Badge size="lg" variant="filled" color="blue" leftSection={<IconUser size={14} />}>{patientName}</Badge>}
          <Badge size="lg" variant="filled" color="teal" leftSection={<IconBrain size={14} />}>{profile?.displayName ?? selectedProfile}</Badge>
          <Group gap={4}>{(profile?.traits || []).map((t) => (<Badge key={t} size="sm" variant="light" color={traitColors[t] || 'gray'}>{t}</Badge>))}</Group>
          {mode === 'patient' && autoDetected && <Badge size="xs" variant="dot" color="green">已绑定</Badge>}
          {mode === 'train' && <Badge size="xs" variant="dot" color="orange">训练</Badge>}
        </Group>
        <Group gap="xs">
          {mode === 'patient' && (
            <Button variant="subtle" color="orange" size="compact-xs" leftSection={<IconSettings size={14} />}
              onClick={() => setAdminSettingsOpen(!adminSettingsOpen)}>
              管理员设置
            </Button>
          )}
          {messages.length > 0 && <Button variant="subtle" color="gray" size="xs" onClick={async () => {
            try { await http.post(mode === 'patient' ? `/twin/chat/${selectedProfile}/${selectedPatient}/reset` : `/twin/chat/train/${selectedProfile}/reset`); setMessages([]); notifications.show({ message: '对话已重置', color: 'blue' }) } catch {}
          }}><IconRefresh size={14} /> 重置</Button>}
        </Group>
      </Group>

      {mode === 'patient' && (
        <Collapse in={adminSettingsOpen}>
          <Paper mb="sm" p="md" radius="md" style={{ background: 'rgba(255,169,77,0.04)', border: '1px solid rgba(255,169,77,0.3)' }}>
            <Group justify="space-between" mb="sm">
              <Group gap="xs"><IconShield size={14} color="var(--mantine-color-orange-5)" /><Text size="xs" fw={600} c="orange">管理员设置</Text></Group>
              <Button size="compact-xs" variant="light" color="gray" onClick={() => setAdminSettingsOpen(false)}>收起</Button>
            </Group>

            <Select size="xs" w={260} mb="sm"
              value={adminProfile || selectedProfile}
              onChange={(v) => v && setAdminProfile(v)}
              data={(allProfiles || []).map((p) => ({ value: p.profileName, label: `${p.traits?.[0] || p.displayName} (${p.displayName})` }))}
              placeholder="选择性格..."
            />

            <Text size="xs" fw={600} mb={4}>快速预设</Text>
            <Group gap="xs" mb="sm">
              {[
                { l: '平静', e: 20, r: 1, t: 80, c: 'green' },
                { l: '轻度焦躁', e: 50, r: 2, t: 50, c: 'yellow' },
                { l: '中度抗拒', e: 70, r: 3, t: 30, c: 'orange' },
                { l: '攻击性高峰', e: 90, r: 5, t: 5, c: 'red' },
              ].map((p) => (
                <Badge key={p.l} size="sm" variant="light" color={p.c} style={{ cursor: 'pointer' }}
                  onClick={() => { setAdminEmotion(p.e); setAdminResistance(p.r); setAdminTrust(p.t) }}>
                  {p.l}
                </Badge>
              ))}
            </Group>

            <SimpleGrid cols={3} spacing="xs" mb="sm">
              <Stack gap={2}>
                <Text size="xs">情绪 {adminEmotion}</Text>
                <input type="range" min={0} max={100} value={adminEmotion} onChange={(e) => setAdminEmotion(Number(e.target.value))} style={{ width: '100%' }} />
              </Stack>
              <Stack gap={2}>
                <Text size="xs">抗拒 {adminResistance}/5</Text>
                <input type="range" min={1} max={5} value={adminResistance} onChange={(e) => setAdminResistance(Number(e.target.value))} style={{ width: '100%' }} />
              </Stack>
              <Stack gap={2}>
                <Text size="xs">信任 {adminTrust}</Text>
                <input type="range" min={0} max={100} value={adminTrust} onChange={(e) => setAdminTrust(Number(e.target.value))} style={{ width: '100%' }} />
              </Stack>
            </SimpleGrid>

            <Text size="xs" fw={600} mb={4}>触发因素</Text>
            <Group gap="xs" mb="sm">
              {['催促','身体接触','陌生人靠近','黄昏5点后','关门声','天黑','被命令'].map((t) => (
                <Badge key={t} size="sm" variant={adminTriggers.includes(t) ? 'filled' : 'outline'}
                  color={adminTriggers.includes(t) ? 'orange' : 'gray'} style={{ cursor: 'pointer' }}
                  onClick={() => setAdminTriggers((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t])}>
                  {t}
                </Badge>
              ))}
            </Group>

            <Group gap="xs">
              <Button size="compact-xs" color="orange" onClick={() => {
                if (adminProfile) { setSelectedProfile(adminProfile); setAutoDetected(false) }
                setAdminSettingsOpen(false)
                notifications.show({ title: '配置已保存', message: `已应用新设置`, color: 'orange', autoClose: 2000 })
              }}>保存并应用</Button>
              <Button size="compact-xs" variant="light" color="gray" onClick={() => setAdminEmotion(70)}>← 重置</Button>
            </Group>
          </Paper>
        </Collapse>
      )}

      {profile && (
        <Paper mb="sm" p="sm" radius="md" style={{ background: GLASS.bg, border: GLASS.border }}>
          <Group gap="sm" mb={4}>
            <Avatar radius="xl" size="md" color="teal" variant="filled">{profile.displayName.charAt(0)}</Avatar>
            <div>
              <Text size="sm" fw={500}>{profile.displayName} · {profile.age}岁 · {profile.gender}</Text>
            </div>
          </Group>
        </Paper>
      )}
      <Divider mb="sm" />

      {messages.length > 0 && (
        <Group mb="sm" grow>
          <Stack gap={2}>
            <Group justify="space-between"><Text size="xs">情绪值</Text><Text size="xs" fw={600} c={chatEmotion >= 90 ? 'red' : chatEmotion >= 70 ? 'orange' : 'green'}>{chatEmotion}</Text></Group>
            <Progress value={chatEmotion} color={chatEmotion >= 90 ? 'red' : chatEmotion >= 70 ? 'orange' : 'green'} size="sm" animated />
          </Stack>
          <Stack gap={2}>
            <Group justify="space-between"><Text size="xs">抗拒等级</Text><Text size="xs" fw={600} c={chatResistance >= 5 ? 'red' : 'orange'}>{chatResistance}/5</Text></Group>
            <Progress value={chatResistance * 20} color={chatResistance >= 5 ? 'red' : 'orange'} size="sm" />
          </Stack>
          {chatEmotion >= 90 && <Badge size="sm" variant="filled" color="red">⚠ 情绪告急</Badge>}
          {chatResistance >= 5 && <Badge size="sm" variant="filled" color="red">⚠ 极度抗拒</Badge>}
        </Group>
      )}

      {messages.length > 0 && (
        <Group mb="xs" gap="xs">
          <Button variant="subtle" size="compact-xs" color="violet" leftSection={showContext ? <IconCheck size={12} /> : <IconBrain size={12} />}
            onClick={() => setShowContext(!showContext)}>
            {showContext ? '隐藏上下文' : '查看上下文'}
          </Button>
        </Group>
      )}

      {showContext && lastUserMsg && (
        <Paper mb="sm" p="xs" radius="md" style={{ background: 'rgba(121,80,242,0.04)', border: '1px solid rgba(121,80,242,0.2)', fontSize: 12 }}>
          <Group gap="xs" mb={4}>
            <Text size="xs" fw={600} c="violet">对话上下文</Text>
            <Badge size="xs" variant="light" color="violet">
              {(() => {
                const h = new Date().getHours()
                if (h >= 6 && h < 8) return '晨起'
                if (h >= 8 && h < 11) return '早餐'
                if (h >= 11 && h < 13) return '午餐'
                if (h >= 13 && h < 15) return '午休'
                if (h >= 15 && h < 17) return '活动'
                if (h >= 17 && h < 19) return '傍晚'
                if (h >= 19 && h < 21) return '晚餐'
                return '就寝'
              })()}
            </Badge>
            <Badge size="xs" variant="light" color="gray">t=0.2</Badge>
            <Badge size="xs" variant="light" color="gray">max=60</Badge>
          </Group>
          <Text size="xs" c="dimmed">原始输入：{lastUserMsg}</Text>
          <Text size="xs" c="dimmed">回复格式：你问我：【{lastUserMsg}】。我的回答：...</Text>
        </Paper>
      )}

      <Box style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
        {messages.length === 0 && <Center h="100%"><Text c="dimmed" size="sm">{mode === 'patient' ? `开始和 ${patientName} 对话吧` : `开始练习与"${profile?.displayName ?? ''}"类型沟通`}</Text></Center>}
        {messages.map((msg, i) => (
          <Box key={`${msg.role}-${i}`} mb="md">
            <Group gap="xs" mb={4}>
              <Avatar size="sm" radius="xl" color={msg.role === 'user' ? 'blue' : 'teal'}>{msg.role === 'user' ? '你' : displayName.charAt(0)}</Avatar>
              <Text size="xs" fw={600}>{msg.role === 'user' ? '你' : `${displayName} (${profile?.displayName ?? ''})`}</Text>
            </Group>
            <Paper p="sm" radius="md" style={{ background: msg.role === 'user' ? 'rgba(66,153,225,0.12)' : GLASS.bg, border: GLASS.border, marginLeft: msg.role === 'user' ? 40 : 0, marginRight: msg.role === 'assistant' ? 40 : 0 }}>
              <Text size="sm">{msg.content}</Text>
            </Paper>
          </Box>
        ))}
        {sending && <Loader size="sm" type="dots" />}
        <div ref={chatEndRef} />
      </Box>
      <Divider mt="sm" />
      <form onSubmit={handleSend}>
        <Group mt="sm" gap="sm" wrap="nowrap">
          <TextInput ref={inputRef} value={input} onChange={(e) => setInput(e.currentTarget.value)}
            placeholder={mode === 'patient' ? `对 ${patientName} 说点什么...` : `练习与"${profile?.displayName ?? ''}"沟通...`}
            style={{ flex: 1 }} disabled={sending}
            rightSection={<Button size="xs" variant="subtle" disabled={!input.trim() || sending} onClick={() => handleSend()} p={4}><IconSend size={18} /></Button>}
          />
        </Group>
      </form>
    </Box>
  )
}

// ── 入口卡片 ──
function CardEntry({ icon: Icon, color, label, desc, onClick }: { icon: any; color: string; label: string; desc: string; onClick: () => void }) {
  return (
    <UnstyledButton onClick={onClick}>
      <Paper w={220} h={170} p="xl" radius="lg" style={{ background: `linear-gradient(135deg, rgba(var(--mantine-color-${color}-rgb),0.08), rgba(var(--mantine-color-${color}-rgb),0.02))`, border: `1px solid rgba(var(--mantine-color-${color}-rgb),0.2)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <Icon size={40} stroke={1.5} color={`var(--mantine-color-${color}-5)`} />
        <Text fw={600} mt="md" ta="center">{label}</Text>
        <Text size="xs" c="dimmed" ta="center" mt={4} style={{ whiteSpace: 'pre-line' }}>{desc}</Text>
      </Paper>
    </UnstyledButton>
  )
}

// ── 选患者 ──
function SelectPatient({ patients, traitMap, onSelect, onBack }: { patients: PatientBrief[]; traitMap: Map<string, string>; onSelect: (id: string) => void; onBack: () => void }) {
  return (
    <Box style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
      <Group mb="md"><Button variant="subtle" onClick={onBack}>&larr; 返回</Button><Text fw={600} size="lg">选择患者</Text></Group>
      <ScrollArea style={{ flex: 1 }}>
        <Stack gap="xs">
          {patients.map((p) => (<UnstyledButton key={p.id} onClick={() => onSelect(p.id)} style={{ width: '100%' }}>
            <Paper p="md" radius="md" style={{ background: GLASS.bg, border: GLASS.border, cursor: 'pointer' }}>
              <Group justify="space-between">
                <Group gap="sm"><Avatar radius="xl" size="lg" color="blue" variant="light">{p.name.charAt(0)}</Avatar><Text fw={500}>{p.name}</Text></Group>
                {traitMap.get(p.id) && <Badge size="sm" variant="light" color={traitColors[traitMap.get(p.id)!] || 'gray'}>{traitMap.get(p.id)}</Badge>}
              </Group>
            </Paper>
          </UnstyledButton>))}
        </Stack>
      </ScrollArea>
    </Box>
  )
}

// ── 选档案 ──
function SelectProfile({ profiles, onSelect, onBack }: { profiles: ChatProfileBrief[]; onSelect: (name: string) => void; onBack: () => void }) {
  return (
    <Box style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
      <Group mb="md"><Button variant="subtle" onClick={onBack}>&larr; 返回</Button><Text fw={600} size="lg">选择认知障碍类型</Text></Group>
      <ScrollArea style={{ flex: 1 }}>
        <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }} spacing="sm">
          {profiles.map((p) => (<UnstyledButton key={p.profileName} onClick={() => onSelect(p.profileName)}>
            <Paper p="md" radius="md" style={{ background: GLASS.bg, border: GLASS.border, cursor: 'pointer' }}>
              <Group mb="xs"><Avatar radius="xl" size="lg" variant="filled" color={(p.traits?.[0] || '').includes('暴躁') ? 'red' : (p.traits?.[0] || '').includes('退缩') ? 'gray' : (p.traits?.[0] || '').includes('焦虑') ? 'pink' : (p.traits?.[0] || '').includes('欢乐') ? 'green' : (p.traits?.[0] || '').includes('游走') ? 'blue' : (p.traits?.[0] || '').includes('拒绝') ? 'orange' : 'teal'} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>{p.traits?.[0]?.charAt(0) || '?'}</Avatar><Text fw={600}>{p.traits?.[0] || p.displayName}</Text></Group>
              <Group gap="xs">{(p.traits || []).map((t) => (<Badge key={t} size="sm" variant="filled" color={traitColors[t] || 'gray'}>{t}</Badge>))}</Group>
            </Paper>
          </UnstyledButton>))}
        </SimpleGrid>
      </ScrollArea>
    </Box>
  )
}

// ── 选场景 ──
function SelectScene({ scenes, onSelect, onBack }: { scenes: SceneBrief[]; onSelect: (s: SceneBrief) => void; onBack: () => void }) {
  return (
    <Box style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
      <Group mb="md"><Button variant="subtle" onClick={onBack}>&larr; 返回</Button><Text fw={600} size="lg">选择照护场景</Text></Group>
      <ScrollArea style={{ flex: 1 }}>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {scenes.map((s) => (<UnstyledButton key={s.id} onClick={() => onSelect(s)} style={{ width: '100%' }}>
            <Paper p="lg" radius="md" style={{ background: GLASS.bg, border: GLASS.border, cursor: 'pointer' }}>
              <Group mb="xs"><IconClipboardList size={20} color="var(--mantine-color-orange-5)" /><Text fw={600}>{s.name}</Text></Group>
              <Text size="xs" c="dimmed" mb="xs">{s.description}</Text>
              <Group gap="xs">{(s.applicableRoles || []).map((r) => (<Badge key={r} size="xs" variant="light">{ROLE_LABELS[r] || r}</Badge>))}</Group>
            </Paper>
          </UnstyledButton>))}
        </SimpleGrid>
      </ScrollArea>
    </Box>
  )
}

// ── 选场景角色 ──
function SelectSceneRole({ scene, profiles, onSelect, onBack, sceneLoading }: { scene: SceneBrief; profiles: ChatProfileBrief[]; onSelect: (roleId: string) => void; onBack: () => void; sceneLoading: boolean }) {
  const applicable = profiles.filter((p) => scene.applicableRoles.includes(p.profileName))
  return (
    <Box style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
      <Group mb="md"><Button variant="subtle" onClick={onBack}>&larr; 返回</Button><Text fw={600} size="lg">{scene.name} — 选择角色</Text></Group>
      <ScrollArea style={{ flex: 1 }}>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {applicable.map((p) => (<UnstyledButton key={p.profileName} onClick={() => onSelect(p.profileName)} style={{ width: '100%' }}>
            <Paper p="lg" radius="md" style={{ background: GLASS.bg, border: GLASS.border, cursor: 'pointer' }}>
              <Group justify="space-between">
                <Group gap="sm"><Avatar radius="xl" size="lg" variant="filled" color={(p.traits?.[0] || '').includes('暴躁') ? 'red' : (p.traits?.[0] || '').includes('退缩') ? 'gray' : (p.traits?.[0] || '').includes('焦虑') ? 'pink' : (p.traits?.[0] || '').includes('欢乐') ? 'green' : (p.traits?.[0] || '').includes('游走') ? 'blue' : 'orange'}>{p.traits?.[0]?.charAt(0) || '?'}</Avatar><div><Text fw={600}>{p.traits?.[0] || p.displayName}</Text><Text size="xs" c="dimmed">{p.displayName} · {p.age}岁</Text></div></Group>
                <IconChevronRight size={18} opacity={0.5} />
              </Group>
              <Group gap="xs" mt="xs">{(p.traits || []).slice(0, 3).map((t) => (<Badge key={t} size="xs" variant="light" color={traitColors[t] || 'gray'}>{t}</Badge>))}</Group>
            </Paper>
          </UnstyledButton>))}
        </SimpleGrid>
      </ScrollArea>
      {sceneLoading && <Center mt="md"><Loader size="sm" /></Center>}
    </Box>
  )
}

// ── 场景训练 UI ──
function getScenePhrase(sceneId: string, action: string): string {
  const map: Record<string, Record<string, string>> = {
    'changing-clothes': {
      empathy: '我理解您的感受', choice: '先换上衣还是裤子？', redirect: '您看窗外那朵云！',
      guide: '来，我帮您展开袖子', retreat: '好，不换了，先吃水果', boundary: '请别推我，这样不行',
      coax: '换了这件我给您看手机', force: '你必须换！别闹了！',
    },
    feeding: {
      empathy: '我知道您怀疑饭有问题', choice: '先吃菜还是先喝汤？', redirect: '您看今天天气多好！',
      guide: '来，我帮您热一下饭菜', retreat: '好，不吃先放这儿', boundary: '请别摔碗，很危险',
      coax: '吃了这口我给您讲个笑话', force: '必须吃！不然没力气！',
    },
    bathing: {
      empathy: '我知道您不想洗', choice: '先洗头发还是先擦身体？', redirect: '您闻闻这香皂，茉莉味！',
      guide: '我帮您试试水温', retreat: '好，今天不洗，擦擦脸', boundary: '请别泼水，这样不行',
      coax: '洗完我给您看照片', force: '不洗不行！四天没洗了！',
    },
    'toilet-reminder': {
      empathy: '我理解您不想去', choice: '走到门口看看？走不动就回来',
      redirect: '您看走廊那盆花', guide: '我扶着您，慢慢走', retreat: '好，不去就不去',
      boundary: '您不能在这儿解决', coax: '去了我给您吃颗糖', force: '必须去！憋着不行！',
    },
    bedtime: {
      empathy: '我知道您睡不着', choice: '关灯还是留一盏小灯？', redirect: '您听外面的蛐蛐叫',
      guide: '我帮您把枕头放好', retreat: '好，不关灯，就开着', boundary: '请别大喊，别人在睡觉',
      coax: '躺下我给您讲故事', force: '快躺下！九点半了！',
    },
    'night-wandering': {
      empathy: '我知道您在找老伴', choice: '先喝杯水好吗？', redirect: '您听——外面下雨了',
      guide: '来，我陪您去走廊看看', retreat: '好，我们再走一圈就回去',
      boundary: '您不能出去，外面冷', coax: '回去我给您看您老伴的照片', force: '回去！不许出门！',
    },
    'medication-refusal': {
      empathy: '我知道您不爱吃药', choice: '先吃白的还是粉的？', redirect: '您先喝口水润润喉咙',
      guide: '我帮您把药片掰小点', retreat: '好，等会儿再吃', boundary: '您不能把药扔了，这是治病的',
      coax: '吃了药给您吃粒糖', force: '必须吃！血压高了怎么办！',
    },
    'family-visit': {
      empathy: '我知道您心里别扭', choice: '见五分钟还是一杯茶的时间？', redirect: '儿子给您带了点心',
      guide: '我帮您整理一下领口', retreat: '好，不想见就不见', boundary: '您不能骂儿子，他专门请假来的',
      coax: '见了面我给您讲他家的事', force: '必须见！他来都来了！',
    },
  }
  return map[sceneId]?.[action] || ({ empathy: '共情安抚', choice: '给予选择', redirect: '转移注意', guide: '温柔引导', retreat: '退让一步', boundary: '设定边界', coax: '哄骗诱导', force: '严肃制止' } as Record<string, string>)[action] || action
}

function SceneTrainingUI({ scene, roleId, context, emotion, resistance, turn, warning, completed, lastScore, lastSpeech, turnHistory, loading, onAction, onFreeText, onBack }: {
  scene: SceneBrief; roleId: string; context: string; emotion: number; resistance: number; turn: number;
  warning: string | null; completed: boolean; lastScore: { score: number; rating: string; feedback: string } | null;
  lastSpeech: string; turnHistory: TurnResult[]; loading: boolean;
  onAction: (actionType: string) => void; onFreeText: (a: undefined, freeText: string) => void; onBack: () => void;
}) {
  const [freeInput, setFreeInput] = useState('')
  const emotionColor = emotion >= 90 ? 'red' : emotion >= 70 ? 'orange' : emotion >= 40 ? 'yellow' : 'green'
  const scoreColor = lastScore ? (lastScore.score >= 70 ? 'green' : lastScore.score >= 50 ? 'yellow' : lastScore.score >= 30 ? 'orange' : 'red') : 'gray'

  return (
    <Box style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
      <Group mb="xs" justify="space-between">
        <Group gap="xs">
          <Button variant="subtle" size="compact-xs" onClick={onBack}>&larr; 返回</Button>
          <Badge size="lg" variant="filled" color="orange">{scene.name}</Badge>
          <Badge size="lg" variant="light">{ROLE_LABELS[roleId] || roleId}</Badge>
          <Badge size="sm" variant="outline">回合 {turn}</Badge>
        </Group>
      </Group>

      {/* 状态条 */}
      <Group mb="sm" grow>
        <Stack gap={2}>
          <Group justify="space-between"><Text size="xs">情绪值</Text><Text size="xs" fw={600} c={emotionColor}>{emotion}</Text></Group>
          <Progress value={emotion} color={emotionColor} size="sm" animated />
        </Stack>
        <Stack gap={2}>
          <Group justify="space-between"><Text size="xs">抗拒等级</Text><Text size="xs" fw={600} c={resistance >= 5 ? 'red' : 'orange'}>{resistance}/5</Text></Group>
          <Progress value={resistance * 20} color={resistance >= 5 ? 'red' : 'orange'} size="sm" />
        </Stack>
        {completed && <Badge size="md" color="green" leftSection={<IconCheck size={14} />}>任务完成</Badge>}
      </Group>

      {turnHistory.length > 1 && (
        <Card withBorder mb="sm" p="xs">
          <Text size="xs" fw={600} mb={4}>评分趋势</Text>
          <Group gap={3} align="flex-end" h={40}>
            {turnHistory.map((t, i) => {
              const val = t.score?.score ?? 0
              const color = val >= 70 ? 'green' : val >= 30 ? 'orange' : 'red'
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <Text size="xs" c="dimmed">{val}</Text>
                  <div style={{ width: '100%', height: `${Math.max(4, val * 0.35)}px`, background: `var(--mantine-color-${color}-5)`, borderRadius: '2px 2px 0 0' }} />
                  <Text size="xs" c="dimmed">{t.turn}</Text>
                </div>
              )
            })}
          </Group>
        </Card>
      )}

      {warning && <Paper p="xs" mb="sm" radius="md" style={{ background: 'rgba(224,49,49,0.1)', border: '1px solid rgba(224,49,49,0.3)' }}><Text size="xs" c="red" fw={600}>{warning}</Text></Paper>}

      <Grid gutter="md" style={{ flex: 1 }}>
        <Grid.Col span={{ base: 12, md: 5 }}>
          {/* 场景信息 + 动作按钮 */}
          <Card withBorder mb="md">
            <Text size="xs" c="dimmed" mb={4}>场景情境</Text>
            <Text size="sm">{context}</Text>
          </Card>

          {lastSpeech && (
            <Card withBorder mb="md" style={{ borderLeft: '3px solid var(--mantine-color-teal-5)' }}>
              <Text size="xs" c="dimmed" mb={4}>老人回应</Text>
              <Text size="sm" fs="italic">"{lastSpeech}"</Text>
            </Card>
          )}

          {lastScore && (
            <Card withBorder mb="md" style={{ background: lastScore.score >= 70 ? 'rgba(47,158,68,0.05)' : lastScore.score >= 30 ? 'rgba(240,140,0,0.05)' : 'rgba(224,49,49,0.05)' }}>
              <Group mb={4}><ThemeIcon size="sm" radius="xl" color={scoreColor}>{lastScore.score >= 70 ? <IconCheck size={12} /> : <IconX size={12} />}</ThemeIcon><Text fw={600} size="sm">{lastScore.rating}</Text><Badge size="sm" color={scoreColor}>{lastScore.score} 分</Badge></Group>
              <Text size="xs" c="dimmed">{lastScore.feedback}</Text>
            </Card>
          )}

          <Text size="xs" fw={600} mb={4}>照护者动作</Text>
          <Group gap="xs" wrap="wrap" mb="md">
            <ActionBtn label={getScenePhrase(scene.id, 'empathy')} color="teal" onClick={() => onAction('empathy')} loading={loading} />
            <ActionBtn label={getScenePhrase(scene.id, 'choice')} color="blue" onClick={() => onAction('choice')} loading={loading} />
            <ActionBtn label={getScenePhrase(scene.id, 'redirect')} color="grape" onClick={() => onAction('redirect')} loading={loading} />
            <ActionBtn label={getScenePhrase(scene.id, 'guide')} color="green" onClick={() => onAction('guide')} loading={loading} />
            <ActionBtn label={getScenePhrase(scene.id, 'retreat')} color="cyan" onClick={() => onAction('retreat')} loading={loading} />
            <ActionBtn label={getScenePhrase(scene.id, 'boundary')} color="orange" onClick={() => onAction('boundary')} loading={loading} />
            <ActionBtn label={getScenePhrase(scene.id, 'coax')} color="yellow" onClick={() => onAction('coax')} loading={loading} />
            <ActionBtn label={getScenePhrase(scene.id, 'force')} color="red" onClick={() => onAction('force')} loading={loading} />
          </Group>

          <form onSubmit={(e) => { e.preventDefault(); if (freeInput.trim()) { onFreeText(undefined, freeInput.trim()); setFreeInput('') } }}>
            <Text size="xs" fw={600} mb={4}>或输入自由文本</Text>
            <Group gap="xs" wrap="nowrap">
              <TextInput size="xs" value={freeInput} onChange={(e) => setFreeInput(e.currentTarget.value)} placeholder="输入你的话术..." style={{ flex: 1 }} disabled={loading} />
              <Button size="xs" onClick={() => { if (freeInput.trim()) { onFreeText(undefined, freeInput.trim()); setFreeInput('') } }} disabled={!freeInput.trim() || loading}><IconSend size={14} /></Button>
            </Group>
          </form>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card withBorder h="100%">
            <Text fw={600} mb="sm">回合记录</Text>
            <ScrollArea h="calc(100vh - 380px)">
              {turnHistory.length === 0 ? <Text size="xs" c="dimmed">选择一个动作开始训练</Text> : (
                <Stack gap="xs">
                  {turnHistory.map((t, i) => (
                    <Paper key={i} p="xs" radius="md" style={{ background: GLASS.bg, border: GLASS.border }}>
                      <Group gap="xs" mb={2}><Badge size="xs" variant="light" color="blue">回合 {t.turn}</Badge>
                        {t.score && <Badge size="xs" color={t.score.score >= 70 ? 'green' : t.score.score >= 30 ? 'orange' : 'red'}>{t.score.score}分 {t.score.rating}</Badge>}
                      </Group>
                      <Text size="xs" c="dimmed" mb={4}>老人："{t.characterSpeech}"</Text>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed">情绪 {t.nextEmotion}</Text>
                        <Text size="xs" c="dimmed">| 抗拒 {t.nextResistance}/5</Text>
                        {t.warning && <Text size="xs" c="red">{t.warning}</Text>}
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
            </ScrollArea>
          </Card>
        </Grid.Col>
      </Grid>
    </Box>
  )
}

function ActionBtn({ label, color, onClick, loading }: { label: string; color: string; onClick: () => void; loading: boolean }) {
  return <Button size="compact-xs" variant="light" color={color} onClick={onClick} disabled={loading} style={{ minWidth: 80 }}>{label}</Button>
}
