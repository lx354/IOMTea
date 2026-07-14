import {
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Table,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react'
import { useState } from 'react'
import { StateEmpty, StateSkeleton } from '../components/StateComponents'
import { useTwinStatus } from '../hooks/useTwinStatus'
import { ExpandedPatientRow } from './ExpandedPatientRow'

type OverallState = 'stable' | 'watch' | 'alert' | 'emergency'
type DimensionStatus = 'normal' | 'warning' | 'critical' | 'no_data'

interface DimConfig {
  key: string
  label: string
  unit: string
}

const DIMS: DimConfig[] = [
  { key: 'heart_rate', label: '心率', unit: 'bpm' },
  { key: 'spo2', label: '血氧', unit: '%' },
  { key: 'systolic_bp', label: '收缩压', unit: 'mmHg' },
  { key: 'diastolic_bp', label: '舒张压', unit: 'mmHg' },
  { key: 'glucose', label: '血糖', unit: 'mmol/L' },
  { key: 'temperature', label: '体温', unit: '°C' },
  { key: 'motion_index', label: '活动', unit: '' },
  { key: 'posture', label: '姿态', unit: '' },
  { key: 'night_wandering', label: '夜间离床', unit: '次/夜' },
  { key: 'repetitive_behavior', label: '重复行为', unit: '分' },
  { key: 'wandering_risk', label: '走失风险', unit: '分' },
]

const STATE_COLORS: Record<OverallState, string> = {
  stable: 'teal',
  watch: 'yellow',
  alert: 'orange',
  emergency: 'red',
}

const STATUS_COLORS: Record<DimensionStatus, string> = {
  normal: 'teal',
  warning: 'yellow',
  critical: 'red',
  no_data: 'gray',
}

const STATUS_TREND: Record<DimensionStatus, string> = {
  normal: '→',
  warning: '↗',
  critical: '↑',
  no_data: '—',
}

const POSTURE_LABELS: Record<number, string> = {
  0: '无',
  1: '站立',
  2: '坐',
  3: '躺',
  [-1]: '未知',
}

const STATE_LABELS: Record<OverallState, string> = {
  stable: '低风险',
  watch: '关注',
  alert: '警告',
  emergency: '紧急',
}

function formatValue(dim: DimConfig, value: unknown): string {
  if (value === null || value === undefined) return '--'
  if (dim.key === 'posture' && typeof value === 'number') return POSTURE_LABELS[value] ?? String(value)
  if (dim.key === 'posture' && typeof value === 'string') return value
  return String(value)
}

function MetricCell({
  dim,
  status,
  value,
}: {
  dim: DimConfig
  status: DimensionStatus
  value: unknown
}) {
  const display = formatValue(dim, value)
  return (
    <Tooltip
      label={`${dim.label}: ${display} ${dim.unit} ${STATUS_TREND[status]}`}
      withArrow
      openDelay={300}
    >
      <Badge
        variant="light"
        color={STATUS_COLORS[status]}
        size="lg"
        styles={{ label: { fontFamily: 'monospace' } }}
      >
        {display}
      </Badge>
    </Tooltip>
  )
}

export function TwinStatusMatrix() {
  const { data, isLoading, error, refetch } = useTwinStatus()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (isLoading) return <StateSkeleton lines={5} />

  if (error) {
    return (
      <Container py="md">
        <Alert icon={<IconAlertCircle size={16} />} title="加载失败" color="red">
          <Group>
            <Text size="sm">无法获取状态矩阵数据</Text>
            <Button size="xs" leftSection={<IconRefresh size={12} />} onClick={() => refetch()}>
              重试
            </Button>
          </Group>
        </Alert>
      </Container>
    )
  }

  if (!data || data.length === 0) {
    return <StateEmpty message="暂无患者状态数据" />
  }

  const counts: Record<OverallState, number> = { stable: 0, watch: 0, alert: 0, emergency: 0 }
  for (const p of data) counts[p.overallState]++

  return (
    <Container py="md" fluid>
      <Title order={2} mb="md">认知障碍风险行为监测看板</Title>

      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="md">
        {(Object.entries(STATE_COLORS) as [OverallState, string][]).map(([state, color]) => (
          <Paper key={state} p="md" withBorder>
            <Group gap="xs" mb={4}>
              <ThemeIcon size="sm" color={color} variant="light">
                <Text size={10} fw={700}>
                  {counts[state]}
                </Text>
              </ThemeIcon>
              <Text size="xs" c="dimmed">{STATE_LABELS[state]}</Text>
            </Group>
            <Text fw={700} fz={28}>{counts[state]}</Text>
          </Paper>
        ))}
      </SimpleGrid>

      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>患者</Table.Th>
            {DIMS.map((d) => (
              <Table.Th key={d.key}>{d.label}</Table.Th>
            ))}
            <Table.Th>综合风险</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.map((p) => (
            <>
              <Table.Tr
                key={p.patientId}
                style={{ cursor: 'pointer' }}
                onClick={() => setExpandedId(expandedId === p.patientId ? null : p.patientId)}
              >
                <Table.Td>
                  <Text fw={500}>{p.patientName}</Text>
                </Table.Td>
                {DIMS.map((d) => {
                  const dim = p.dimensions[d.key]
                  return (
                    <Table.Td key={d.key}>
                      <MetricCell
                        dim={d}
                        status={(dim?.status as DimensionStatus) ?? 'no_data'}
                        value={dim?.value ?? null}
                      />
                    </Table.Td>
                  )
                })}
                <Table.Td>
                  <Badge color={STATE_COLORS[p.overallState]} size="lg">
                    {STATE_LABELS[p.overallState]}
                  </Badge>
                </Table.Td>
              </Table.Tr>
              {expandedId === p.patientId && (
                <Table.Tr key={`${p.patientId}-expanded`}>
                  <Table.Td colSpan={DIMS.length + 2}>
                    <ExpandedPatientRow patientId={p.patientId} />
                  </Table.Td>
                </Table.Tr>
              )}
            </>
          ))}
        </Table.Tbody>
      </Table>
    </Container>
  )
}
