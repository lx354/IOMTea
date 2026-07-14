import {
  Badge, Box, Button, Card, Collapse, Container, FileInput, Grid, Group,
  Image, Paper, RingProgress, SegmentedControl, Select, SimpleGrid, Stack,
  Tabs, Text, Title,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconAlertTriangle, IconArmchair, IconBed, IconBrain,
  IconChevronDown, IconChevronUp, IconPhoto, IconRotate,
  IconRun, IconSend, IconWalk,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { http } from '../api/client'

const BEHAVIOR_ICONS: Record<string, React.ElementType> = {
  standing: IconWalk, sitting: IconArmchair, lying: IconBed,
  walking: IconRun, falling: IconAlertTriangle, sitting_up: IconRotate, wandering: IconBrain,
}
const BEHAVIOR_COLORS: Record<string, string> = {
  standing: 'blue', sitting: 'teal', lying: 'grape',
  walking: 'green', falling: 'red', sitting_up: 'orange', wandering: 'violet',
}
const BEHAVIOR_LABELS: Record<string, string> = {
  standing: '站立', sitting: '坐', lying: '躺',
  walking: '行走', falling: '跌倒', sitting_up: '起身', wandering: '徘徊',
}

const KEYPOINTS = [
  { name: 'nose', x: 0.50, y: 0.10 },
  { name: 'left_eye', x: 0.47, y: 0.07 }, { name: 'right_eye', x: 0.53, y: 0.07 },
  { name: 'left_ear', x: 0.43, y: 0.075 }, { name: 'right_ear', x: 0.57, y: 0.075 },
  { name: 'left_shoulder', x: 0.40, y: 0.25 }, { name: 'right_shoulder', x: 0.60, y: 0.25 },
  { name: 'left_elbow', x: 0.35, y: 0.40 }, { name: 'right_elbow', x: 0.65, y: 0.40 },
  { name: 'left_wrist', x: 0.30, y: 0.55 }, { name: 'right_wrist', x: 0.70, y: 0.55 },
  { name: 'left_hip', x: 0.42, y: 0.50 }, { name: 'right_hip', x: 0.58, y: 0.50 },
  { name: 'left_knee', x: 0.42, y: 0.70 }, { name: 'right_knee', x: 0.58, y: 0.70 },
  { name: 'left_ankle', x: 0.42, y: 0.90 }, { name: 'right_ankle', x: 0.58, y: 0.90 },
]

const EDGES: [string, string][] = [
  ['nose', 'left_eye'], ['nose', 'right_eye'], ['left_eye', 'right_eye'],
  ['left_eye', 'left_ear'], ['right_eye', 'right_ear'],
  ['nose', 'left_shoulder'], ['nose', 'right_shoulder'], ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'], ['right_shoulder', 'right_elbow'],
  ['left_elbow', 'left_wrist'], ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'], ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'], ['right_hip', 'right_knee'],
  ['left_knee', 'left_ankle'], ['right_knee', 'right_ankle'],
]

interface BehaviorResult { behavior: string; label: string; confidence: number; allScores: Record<string, number> }

const TEMPLATES: Record<string, Record<string, [number, number]>> = {
  standing: Object.fromEntries([
    ['nose', [0.50, 0.10]], ['left_eye', [0.47, 0.07]], ['right_eye', [0.53, 0.07]], ['left_ear', [0.43, 0.075]], ['right_ear', [0.57, 0.075]],
    ['left_shoulder', [0.40, 0.25]], ['right_shoulder', [0.60, 0.25]], ['left_elbow', [0.35, 0.40]], ['right_elbow', [0.65, 0.40]],
    ['left_wrist', [0.30, 0.55]], ['right_wrist', [0.70, 0.55]], ['left_hip', [0.42, 0.50]], ['right_hip', [0.58, 0.50]],
    ['left_knee', [0.42, 0.70]], ['right_knee', [0.58, 0.70]], ['left_ankle', [0.42, 0.90]], ['right_ankle', [0.58, 0.90]],
  ] as [string, [number, number]][]),
  sitting: Object.fromEntries([
    ['nose', [0.50, 0.15]], ['left_eye', [0.47, 0.12]], ['right_eye', [0.53, 0.12]], ['left_ear', [0.43, 0.125]], ['right_ear', [0.57, 0.125]],
    ['left_shoulder', [0.38, 0.30]], ['right_shoulder', [0.62, 0.30]], ['left_elbow', [0.32, 0.48]], ['right_elbow', [0.68, 0.48]],
    ['left_wrist', [0.28, 0.55]], ['right_wrist', [0.72, 0.55]], ['left_hip', [0.42, 0.45]], ['right_hip', [0.58, 0.45]],
    ['left_knee', [0.42, 0.58]], ['right_knee', [0.58, 0.58]], ['left_ankle', [0.42, 0.72]], ['right_ankle', [0.58, 0.72]],
  ] as [string, [number, number]][]),
  lying: Object.fromEntries([
    ['nose', [0.50, 0.80]], ['left_eye', [0.47, 0.79]], ['right_eye', [0.53, 0.79]], ['left_ear', [0.43, 0.795]], ['right_ear', [0.57, 0.795]],
    ['left_shoulder', [0.25, 0.82]], ['right_shoulder', [0.75, 0.82]], ['left_elbow', [0.15, 0.85]], ['right_elbow', [0.85, 0.85]],
    ['left_wrist', [0.05, 0.88]], ['right_wrist', [0.95, 0.88]], ['left_hip', [0.35, 0.90]], ['right_hip', [0.65, 0.90]],
    ['left_knee', [0.35, 0.92]], ['right_knee', [0.65, 0.92]], ['left_ankle', [0.35, 0.95]], ['right_ankle', [0.65, 0.95]],
  ] as [string, [number, number]][]),
  walking: Object.fromEntries([
    ['nose', [0.50, 0.10]], ['left_eye', [0.47, 0.07]], ['right_eye', [0.53, 0.07]], ['left_ear', [0.43, 0.075]], ['right_ear', [0.57, 0.075]],
    ['left_shoulder', [0.40, 0.25]], ['right_shoulder', [0.60, 0.25]], ['left_elbow', [0.33, 0.42]], ['right_elbow', [0.67, 0.42]],
    ['left_wrist', [0.28, 0.58]], ['right_wrist', [0.72, 0.58]], ['left_hip', [0.42, 0.50]], ['right_hip', [0.58, 0.50]],
    ['left_knee', [0.42, 0.70]], ['right_knee', [0.55, 0.65]], ['left_ankle', [0.42, 0.90]], ['right_ankle', [0.50, 0.78]],
  ] as [string, [number, number]][]),
  falling: Object.fromEntries([
    ['nose', [0.50, 0.92]], ['left_eye', [0.47, 0.91]], ['right_eye', [0.52, 0.90]],
    ['left_ear', [0.44, 0.915]], ['right_ear', [0.56, 0.91]],
    ['left_shoulder', [0.22, 0.85]], ['right_shoulder', [0.75, 0.90]],
    ['left_elbow', [0.10, 0.92]], ['right_elbow', [0.78, 0.86]],
    ['left_wrist', [0.03, 0.97]], ['right_wrist', [0.88, 0.82]],
    ['left_hip', [0.38, 0.88]], ['right_hip', [0.62, 0.95]],
    ['left_knee', [0.28, 0.96]], ['right_knee', [0.66, 0.91]],
    ['left_ankle', [0.22, 0.99]], ['right_ankle', [0.72, 0.94]],
  ] as [string, [number, number]][]),
  sitting_up: Object.fromEntries([
    ['nose', [0.50, 0.30]], ['left_eye', [0.47, 0.27]], ['right_eye', [0.53, 0.27]], ['left_ear', [0.43, 0.275]], ['right_ear', [0.57, 0.275]],
    ['left_shoulder', [0.35, 0.40]], ['right_shoulder', [0.65, 0.40]], ['left_elbow', [0.28, 0.55]], ['right_elbow', [0.72, 0.55]],
    ['left_wrist', [0.22, 0.68]], ['right_wrist', [0.78, 0.68]], ['left_hip', [0.42, 0.48]], ['right_hip', [0.58, 0.48]],
    ['left_knee', [0.40, 0.62]], ['right_knee', [0.60, 0.62]], ['left_ankle', [0.38, 0.78]], ['right_ankle', [0.62, 0.78]],
  ] as [string, [number, number]][]),
  wandering: Object.fromEntries([
    ['nose', [0.50, 0.10]], ['left_eye', [0.47, 0.07]], ['right_eye', [0.53, 0.07]], ['left_ear', [0.43, 0.075]], ['right_ear', [0.57, 0.075]],
    ['left_shoulder', [0.38, 0.25]], ['right_shoulder', [0.62, 0.25]], ['left_elbow', [0.30, 0.45]], ['right_elbow', [0.70, 0.42]],
    ['left_wrist', [0.25, 0.62]], ['right_wrist', [0.75, 0.58]], ['left_hip', [0.42, 0.50]], ['right_hip', [0.58, 0.50]],
    ['left_knee', [0.40, 0.70]], ['right_knee', [0.60, 0.68]], ['left_ankle', [0.40, 0.90]], ['right_ankle', [0.56, 0.82]],
  ] as [string, [number, number]][]),
}

function SkeletonCanvas({ keypoints, color }: { keypoints: Record<string, [number, number]>; color?: string }) {
  const c = color || 'gray'
  return (
    <Box style={{ position: 'relative', width: '100%', paddingTop: '120%', background: 'rgba(0,0,0,0.05)', borderRadius: 12, overflow: 'hidden' }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {EDGES.map(([a, b]) => {
          const pa = keypoints[a]; const pb = keypoints[b]
          if (!pa || !pb) return null
          return <line key={`${a}-${b}`} x1={pa[0] * 100 + '%'} y1={pa[1] * 100 + '%'} x2={pb[0] * 100 + '%'} y2={pb[1] * 100 + '%'} stroke={c} strokeWidth={2} opacity={0.6} />
        })}
      </svg>
      {Object.entries(keypoints).map(([name, [x, y]]) => (
        <Box key={name} style={{ position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`, width: 8, height: 8, borderRadius: '50%', background: c, transform: 'translate(-50%, -50%)' }} />
      ))}
    </Box>
  )
}

export function BehaviorMonitor() {
  const [selectedBehavior, setSelectedBehavior] = useState<string>('standing')
  const [keypoints, setKeypoints] = useState<Record<string, [number, number]>>(TEMPLATES.standing)
  const [result, setResult] = useState<BehaviorResult | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [history, setHistory] = useState<Array<{ behavior: string; time: string; confidence: number }>>([])
  const [modelInfo, { toggle: toggleInfo }] = useDisclosure(false)
  const [mode, setMode] = useState<'simulate' | 'image' | 'posture'>('simulate')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageResults, setImageResults] = useState<any[] | null>(null)
  const [imageDetecting, setImageDetecting] = useState(false)
  const [postureResult, setPostureResult] = useState<any>(null)
  const [postureLoading, setPostureLoading] = useState(false)

  const { data: patients } = useQuery({
    queryKey: ['patients-list'], queryFn: async () => {
      const { data } = await http.get('/patients')
      return (data as { data?: { id: string; name: string }[] }).data ?? (data as { id: string; name: string }[])
    },
  })

  const handleFileChange = (file: File | null) => {
    setImageFile(file); setImageResults(null)
    if (file) { const r = new FileReader(); r.onload = () => setImagePreview(r.result as string); r.readAsDataURL(file) }
    else setImagePreview(null)
  }

  const detectImage = async () => {
    if (!imagePreview) return
    setImageDetecting(true)
    try {
      const { data } = await http.post('/twin/behavior/detect-image', {
        patientId: patients?.[0]?.id || '00000000-0000-0000-0000-000000000000',
        image: imagePreview,
      })
      setImageResults((data as any).persons || [])
    } catch { notifications.show({ title: '识别失败', message: 'YOLO 模型暂不可用', color: 'red' })
    } finally { setImageDetecting(false) }
  }

  const analyzePreset = async (preset: string) => {
    const kps = TEMPLATES[preset]
    if (!kps) return
    setKeypoints({ ...kps })
    setPostureLoading(true)
    try {
      const { data } = await http.post('/twin/posture/analyze', { keypoints: kps })
      setPostureResult(data)
    } catch { notifications.show({ title: '分析失败', message: '后端暂不可用', color: 'red' }) }
    finally { setPostureLoading(false) }
  }

  const applyTemplate = (beh: string) => { setSelectedBehavior(beh); setKeypoints({ ...TEMPLATES[beh] }) }
  const addNoise = () => {
    const noisy: Record<string, [number, number]> = {}
    for (const [k, [x, y]] of Object.entries(keypoints)) {
      noisy[k] = [Math.max(0, Math.min(1, x + (Math.random() - 0.5) * 0.04)), Math.max(0, Math.min(1, y + (Math.random() - 0.5) * 0.04))]
    }
    setKeypoints(noisy)
  }

  const detect = async () => {
    setDetecting(true)
    try {
      const { data } = await http.post('/twin/behavior/detect', {
        patientId: patients?.[0]?.id || '00000000-0000-0000-0000-000000000000',
        keypoints,
      })
      const res = data as BehaviorResult
      setResult(res)
      setHistory((p) => [{ behavior: res.label, time: new Date().toLocaleTimeString(), confidence: res.confidence }, ...p].slice(0, 20))
    } catch { notifications.show({ title: '识别失败', message: '后端暂不可用', color: 'red' })
    } finally { setDetecting(false) }
  }

  useEffect(() => { applyTemplate('standing') }, [])

  return (
    <Container py="md" size="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>行为识别监控</Title>
        <Button size="xs" variant="light" onClick={toggleInfo} rightSection={modelInfo ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}>模型信息</Button>
      </Group>

      <Collapse in={modelInfo}>
        <Card mb="md" withBorder>
          <Text size="sm" fw={600}>双模型管道</Text>
          <Text size="xs" c="dimmed">YOLO11n-pose（Ultralytics）→ 17 关键点 → MLP 行为分类 → 7 种行为</Text>
        </Card>
      </Collapse>

      <SegmentedControl value={mode} onChange={(v) => setMode(v as 'simulate' | 'image' | 'posture')}
        data={[{ label: '关键点模拟', value: 'simulate' }, { label: '图片识别', value: 'image' }, { label: '姿态分析', value: 'posture' }]} mb="md"
      />

      {mode === 'simulate' ? (
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card withBorder><Text fw={600} mb="sm">行为模板</Text>
              <Stack gap="xs">
                <Select value={selectedBehavior} onChange={(v) => v && applyTemplate(v)}
                  data={Object.entries(BEHAVIOR_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
                <Button size="xs" variant="light" onClick={addNoise} leftSection={<IconRotate size={14} />}>添加噪声</Button>
              </Stack>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Card withBorder h="100%"><Text fw={600} mb="sm">姿态骨架</Text>
              <SkeletonCanvas keypoints={keypoints} />
            </Card>
           </Grid.Col>
         </Grid>
      ) : mode === 'image' ? (
         <Grid gutter="md">
           <Grid.Col span={{ base: 12, md: 4 }}>
             <Card withBorder>
               <Text fw={600} mb="sm">上传图片</Text>
              <Stack gap="xs">
                <FileInput placeholder="选择图片" accept="image/*" value={imageFile} onChange={handleFileChange} />
                {imagePreview && (
                  <Image src={imagePreview} radius="md" fit="contain" mah={200} />
                )}
                <Button size="xs" onClick={detectImage} loading={imageDetecting} leftSection={<IconSend size={14} />} disabled={!imagePreview}>
                  检测行为
                </Button>
              </Stack>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Card withBorder>
              <Text fw={600} mb="sm">识别结果</Text>
              {!imageResults ? (
                <Text size="xs" c="dimmed">上传图片后点击"检测行为"</Text>
              ) : imageResults.length === 0 ? (
                <Text size="xs" c="dimmed">未检测到人物</Text>
              ) : (
                <Stack gap="md">
                  {imageResults.map((p: any, i: number) => (
                    <Card key={i} withBorder>
                      <Group mb="xs">
                        <Badge color={BEHAVIOR_COLORS[p.behavior?.behavior] || 'gray'}>{p.behavior?.label || '?'}</Badge>
                        <Text size="xs" c="dimmed">姿态置信: {Math.round(p.poseConfidence * 100)}%</Text>
                      </Group>
                      <SkeletonCanvas keypoints={p.keypoints} color={BEHAVIOR_COLORS[p.behavior?.behavior]} />
                    </Card>
                  ))}
                </Stack>
              )}
            </Card>
          </Grid.Col>
        </Grid>
      ) : (
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Card withBorder>
              <Text fw={600} mb="sm">姿态分析</Text>
              <Stack gap="xs">
                <Select value={selectedBehavior} onChange={(v) => v && analyzePreset(v)}
                  data={Object.entries(BEHAVIOR_LABELS).map(([v, l]) => ({ value: v, label: l }))} placeholder="选择姿态模板" />
                <Button size="xs" onClick={() => analyzePreset(selectedBehavior)} loading={postureLoading} leftSection={<IconSend size={14} />}>分析姿态</Button>
              </Stack>
            </Card>
            {postureResult && (
              <Card withBorder mt="md">
                <Text fw={600} mb="sm">分析结果</Text>
                <Group justify="center" mb="md">
                  <RingProgress size={100} thickness={10}
                    sections={[{ value: postureResult.overallScore, color: postureResult.overallStatus === 'warning' ? 'red' : postureResult.overallStatus === 'watch' ? 'orange' : 'green' }]}
                    label={<Text size="lg" fw={700} ta="center">{postureResult.overallScore}</Text>} />
                </Group>
                <Badge size="lg" variant="filled" fullWidth color={postureResult.overallStatus === 'warning' ? 'red' : postureResult.overallStatus === 'watch' ? 'orange' : 'green'}>
                  {postureResult.overallStatus === 'warning' ? '⚠ 警告' : postureResult.overallStatus === 'watch' ? '⚠ 注意' : '✓ 正常'}
                </Badge>
                <Text size="xs" fw={600} mt="md" mb="xs">各项指标</Text>
                <Stack gap={4}>
                  {(postureResult.metrics || []).map((m: any) => (
                    <Group key={m.label} gap="xs" justify="space-between">
                      <Group gap={4}><div style={{ width: 8, height: 8, borderRadius: '50%', background: m.status === 'warning' ? 'red' : m.status === 'watch' ? 'orange' : 'green' }} /><Text size="xs">{m.label}</Text></Group>
                      <Group gap="xs"><Text size="xs">{m.value} {m.unit}</Text><Text size="xs" fw={500} c={m.status === 'warning' ? 'red' : 'dimmed'}>{m.score}分</Text></Group>
                    </Group>
                  ))}
                </Stack>
                {postureResult.risks?.length > 0 && (
                  <>
                    <Text size="xs" fw={600} mt="md" mb="xs" c="red">风险预警</Text>
                    {(postureResult.risks as string[]).map((r: string, i: number) => (
                      <Badge key={i} size="sm" variant="light" color="red" fullWidth mb={2}>{r}</Badge>
                    ))}
                  </>
                )}
                {postureResult.advice?.length > 0 && (
                  <>
                    <Text size="xs" fw={600} mt="md" mb="xs" c="teal">改善建议</Text>
                    {(postureResult.advice as string[]).map((r: string, i: number) => (
                      <Text key={i} size="xs" c="dimmed">• {r}</Text>
                    ))}
                  </>
                )}
              </Card>
            )}
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Card withBorder h="100%"><Text fw={600} mb="sm">姿态骨架</Text>
              <SkeletonCanvas keypoints={keypoints} color={postureResult?.overallStatus === 'warning' ? 'red' : postureResult?.overallStatus === 'watch' ? 'orange' : undefined} />
            </Card>
          </Grid.Col>
        </Grid>
      )}
    </Container>
  )
}
