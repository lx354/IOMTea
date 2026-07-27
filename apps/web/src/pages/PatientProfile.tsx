import {
  Button, Card, Container, Divider, Grid, Group, MultiSelect,
  NumberInput, Select, Stack, Tabs, TagsInput, Text, Textarea, TextInput, Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useEffect, useState } from 'react'
import { useGet, usePatch } from '../api/hooks'
import { StateSkeleton } from '../components/StateComponents'
import { parsePatientId } from '../lib/path'

interface ClinicalTags {
  // 基础疾病
  chronicDiseases?: string[]
  otherDisease?: string
  // 用药史
  currentMeds?: string[]
  medNotes?: string
  // 家属
  emergencyContact?: string
  emergencyPhone?: string
  familyNotes?: string
  // 认知功能
  cognitiveLevel?: string
  cognitiveNotes?: string
  // 检查结果
  ecg?: string; brainCt?: string; bloodTest?: string
  otherExam?: string
  // 量表分数
  mmseScore?: number; mocaScore?: number; barthelScore?: number
  npiScore?: number; cmaiScore?: number; zaritScore?: number
  scaleNotes?: string
}

const COGNITIVE_LEVELS = [
  { value: 'normal', label: '正常' },
  { value: 'mild', label: '轻度衰退' },
  { value: 'moderate', label: '中度衰退' },
  { value: 'severe', label: '重度衰退' },
]

const CHRONIC_DISEASES = [
  '高血压', '糖尿病', '冠心病', '脑卒中', '慢阻肺', '关节炎',
  '骨质疏松', '帕金森病', '阿尔茨海默病', '抑郁症', '焦虑症',
]

export function PatientProfile() {
  const pid = parsePatientId()
  const { data: patient, isLoading } = useGet<{
    id: string; name: string; gender: string | null; birthDate: string | null
    heightCm: number | null; weightKg: number | null; bloodType: string | null
    phone: string | null; address: string | null; tags: Record<string, unknown> | null
  }>(`/patients/${pid}`)
  const updatePatient = usePatch('/patients/:id', ['patients'])

  const [form, setForm] = useState({
    name: '', gender: '', birthDate: '', heightCm: '', weightKg: '',
    bloodType: '', phone: '', address: '',
  })
  const [tags, setTags] = useState<ClinicalTags>({})

  useEffect(() => {
    if (!patient) return
    setForm({
      name: patient.name || '', gender: patient.gender || '',
      birthDate: patient.birthDate?.split('T')[0] || '',
      heightCm: patient.heightCm?.toString() || '',
      weightKg: patient.weightKg?.toString() || '',
      bloodType: patient.bloodType || '',
      phone: patient.phone || '', address: patient.address || '',
    })
    setTags((patient.tags || {}) as ClinicalTags)
  }, [patient])

  const save = () => {
    const body: any = { ...form, heightCm: form.heightCm ? Number(form.heightCm) : null, weightKg: form.weightKg ? Number(form.weightKg) : null, tags }
    if (!form.gender) body.gender = null
    updatePatient.mutate({ id: pid, ...body } as any)
    notifications.show({ title: '已保存', message: '患者档案已更新', color: 'green' })
  }

  if (isLoading) return <StateSkeleton lines={6} />

  return (
    <Container py="md">
      <Title order={4} mb="md">患者档案</Title>
      <Tabs defaultValue="basic">
        <Tabs.List mb="md">
          <Tabs.Tab value="basic">基本信息</Tabs.Tab>
          <Tabs.Tab value="medical">疾病用药</Tabs.Tab>
          <Tabs.Tab value="family">家属信息</Tabs.Tab>
          <Tabs.Tab value="cognitive">认知评估</Tabs.Tab>
          <Tabs.Tab value="exam">检查结果</Tabs.Tab>
          <Tabs.Tab value="scales">量表分数</Tabs.Tab>
        </Tabs.List>

        {/* 基本信息 */}
        <Tabs.Panel value="basic">
          <Card withBorder>
            <SimpleGrid cols={3} spacing="sm">
              <TextInput label="姓名" value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
              <Select label="性别" data={['男', '女']} value={form.gender || null} onChange={(v) => v && setForm({ ...form, gender: v })} />
              <TextInput label="出生日期" type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.currentTarget.value })} />
              <NumberInput label="身高(cm)" value={form.heightCm} onChange={(v) => setForm({ ...form, heightCm: String(v || '') })} />
              <NumberInput label="体重(kg)" value={form.weightKg} onChange={(v) => setForm({ ...form, weightKg: String(v || '') })} />
              <Select label="血型" data={['A','B','AB','O']} value={form.bloodType || null} onChange={(v) => setForm({ ...form, bloodType: v || '' })} />
              <TextInput label="电话" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.currentTarget.value })} />
              <TextInput label="地址" value={form.address} onChange={(e) => setForm({ ...form, address: e.currentTarget.value })} style={{ gridColumn: '1 / -1' }} />
            </SimpleGrid>
          </Card>
        </Tabs.Panel>

        {/* 疾病用药 */}
        <Tabs.Panel value="medical">
          <Card withBorder>
            <Stack gap="sm">
              <MultiSelect label="基础疾病" data={CHRONIC_DISEASES} value={tags.chronicDiseases || []} onChange={(v) => setTags({ ...tags, chronicDiseases: v })} searchable />
              <TextInput label="其他疾病" value={tags.otherDisease || ''} onChange={(e) => setTags({ ...tags, otherDisease: e.currentTarget.value })} />
              <TagsInput label="当前用药" value={tags.currentMeds || []} onChange={(v) => setTags({ ...tags, currentMeds: v })} placeholder="输入药品名后回车" />
              <Textarea label="用药备注" value={tags.medNotes || ''} onChange={(e) => setTags({ ...tags, medNotes: e.currentTarget.value })} rows={2} />
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* 家属信息 */}
        <Tabs.Panel value="family">
          <Card withBorder>
            <SimpleGrid cols={2} spacing="sm">
              <TextInput label="紧急联系人" value={tags.emergencyContact || ''} onChange={(e) => setTags({ ...tags, emergencyContact: e.currentTarget.value })} />
              <TextInput label="紧急联系电话" value={tags.emergencyPhone || ''} onChange={(e) => setTags({ ...tags, emergencyPhone: e.currentTarget.value })} />
              <Textarea label="家属备注" value={tags.familyNotes || ''} onChange={(e) => setTags({ ...tags, familyNotes: e.currentTarget.value })} rows={3} style={{ gridColumn: '1 / -1' }} />
            </SimpleGrid>
          </Card>
        </Tabs.Panel>

        {/* 认知评估 */}
        <Tabs.Panel value="cognitive">
          <Card withBorder>
            <Stack gap="sm">
              <Select label="认知水平" data={COGNITIVE_LEVELS} value={tags.cognitiveLevel || null} onChange={(v) => setTags({ ...tags, cognitiveLevel: v || '' })} />
              <Textarea label="认知功能描述" value={tags.cognitiveNotes || ''} onChange={(e) => setTags({ ...tags, cognitiveNotes: e.currentTarget.value })} rows={3}
                placeholder="如：轻度记忆障碍、语言能力正常、定向力减弱..." />
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* 检查结果 */}
        <Tabs.Panel value="exam">
          <Card withBorder>
            <Stack gap="sm">
              <Textarea label="心电图" value={tags.ecg || ''} onChange={(e) => setTags({ ...tags, ecg: e.currentTarget.value })} rows={2} />
              <Textarea label="脑CT/MRI" value={tags.brainCt || ''} onChange={(e) => setTags({ ...tags, brainCt: e.currentTarget.value })} rows={2} />
              <Textarea label="血液检查" value={tags.bloodTest || ''} onChange={(e) => setTags({ ...tags, bloodTest: e.currentTarget.value })} rows={2} />
              <Textarea label="其他检查" value={tags.otherExam || ''} onChange={(e) => setTags({ ...tags, otherExam: e.currentTarget.value })} rows={2} />
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* 量表分数 */}
        <Tabs.Panel value="scales">
          <Card withBorder>
            <SimpleGrid cols={3} spacing="sm">
              <NumberInput label="MMSE (0-30)" value={tags.mmseScore || ''} onChange={(v) => setTags({ ...tags, mmseScore: Number(v) || undefined })} min={0} max={30} />
              <NumberInput label="MoCA (0-30)" value={tags.mocaScore || ''} onChange={(v) => setTags({ ...tags, mocaScore: Number(v) || undefined })} min={0} max={30} />
              <NumberInput label="Barthel (0-100)" value={tags.barthelScore || ''} onChange={(v) => setTags({ ...tags, barthelScore: Number(v) || undefined })} min={0} max={100} />
              <NumberInput label="NPI (0-144)" value={tags.npiScore || ''} onChange={(v) => setTags({ ...tags, npiScore: Number(v) || undefined })} min={0} max={144} />
              <NumberInput label="CMAI (14-98)" value={tags.cmaiScore || ''} onChange={(v) => setTags({ ...tags, cmaiScore: Number(v) || undefined })} min={14} max={98} />
              <NumberInput label="Zarit (0-88)" value={tags.zaritScore || ''} onChange={(v) => setTags({ ...tags, zaritScore: Number(v) || undefined })} min={0} max={88} />
            </SimpleGrid>
            <Textarea label="量表备注" value={tags.scaleNotes || ''} onChange={(e) => setTags({ ...tags, scaleNotes: e.currentTarget.value })} mt="sm" rows={2} />
          </Card>
        </Tabs.Panel>
      </Tabs>

      <Group justify="flex-end" mt="md">
        <Button onClick={save}>保存</Button>
      </Group>
    </Container>
  )
}
