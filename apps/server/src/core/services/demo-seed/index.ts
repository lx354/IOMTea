import type { DbClient } from '../../db'
import { events, medications, patients, users } from '../../db'
import { formDefinitions } from '../../db/schema/ema'
import { plans } from '../../db/schema/plan'
import { usersPin } from '../../db/schema/pin'
import { userPatientLinks } from '../../db/schema/user-patient'
import { hashPassword } from '../../lib/password'
import {
  HOUR_MS,
  PATIENTS,
  buildHomeGraph,
  generatePin,
  generateVitals,
  recentAlertTime,
} from './data'

export async function seedDemoData(db: DbClient): Promise<void> {
  const createdUsers: Map<string, string> = new Map()
  const createdPatients: Map<string, string> = new Map()
  const createdPins: Map<string, string[]> = new Map()

  for (const p of PATIENTS) {
    const [user] = await db
      .insert(users)
      .values({
        username: p.username,
        passwordHash: await hashPassword(p.password),
        displayName: p.name,
        role: 'user',
      })
      .returning({ id: users.id })
    createdUsers.set(p.username, user.id)

    const tags: Record<string, unknown> = {
      profileId: p.profileId,
      conditions: p.conditions,
    }
    if (p.hasHomeGraph) {
      tags.homeGraph = buildHomeGraph(p.graphPrefix)
    }

    const [patient] = await db
      .insert(patients)
      .values({
        name: p.name,
        birthDate: p.birthDate,
        gender: p.gender,
        heightCm: p.heightCm,
        weightKg: p.weightKg,
        status: 'active',
        tags,
      })
      .returning({ id: patients.id })
    createdPatients.set(p.username, patient.id)

    await db
      .insert(userPatientLinks)
      .values({ userId: user.id, patientId: patient.id, relation: 'primary' })
      .onConflictDoNothing()

    const pins: string[] = []
    for (const label of p.pinLabels) {
      const pin = generatePin()
      await db.insert(usersPin).values({
        pin,
        userId: user.id,
        label,
        nickname: p.name,
      })
      pins.push(pin)
    }
    createdPins.set(p.username, pins)
  }

  const observationRows: (typeof events.$inferInsert)[] = []

  for (const p of PATIENTS) {
    const patientId = createdPatients.get(p.username)!
    for (let hourOffset = 48; hourOffset >= 0; hourOffset--) {
      const ts = new Date(Date.now() - hourOffset * HOUR_MS)
      const hour = ts.getHours()
      const vitals = generateVitals(p.baselines, hour)

      const metrics = [
        { metric: 'heart_rate', value: vitals.hr, unit: 'bpm' },
        { metric: 'spo2', value: vitals.spo2, unit: '%' },
        { metric: 'systolic_bp', value: vitals.bpSys, unit: 'mmHg' },
        { metric: 'diastolic_bp', value: vitals.bpDia, unit: 'mmHg' },
        { metric: 'temperature', value: vitals.temp, unit: '°C' },
        { metric: 'glucose', value: vitals.glucose, unit: 'mmol/L' },
        { metric: 'resp_rate', value: vitals.respRate, unit: 'rpm' },
      ]

      for (const m of metrics) {
        observationRows.push({
          patientId,
          kind: 'observation',
          metric: m.metric,
          value: m.value,
          unit: m.unit,
          source: 'simulator',
          recordedAt: ts,
          tags: { simulated: true },
        })
      }

      const isNight = hour >= 22 || hour <= 6
      if (isNight) {
        const nw = Math.random() < 0.3 ? Math.floor(Math.random() * 4) + 1 : 0
        observationRows.push({
          patientId,
          kind: 'observation',
          metric: 'night_wandering',
          value: nw,
          unit: '次/夜',
          source: 'simulator',
          recordedAt: ts,
          tags: { simulated: true },
        })
      }
      if (hour >= 8 && hour <= 20 && Math.random() < 0.15) {
        observationRows.push({
          patientId,
          kind: 'observation',
          metric: 'repetitive_behavior',
          value: Math.floor(Math.random() * 5) + 1,
          unit: 'score',
          source: 'simulator',
          recordedAt: ts,
          tags: { simulated: true },
        })
      }
      if (Math.random() < 0.1) {
        observationRows.push({
          patientId,
          kind: 'observation',
          metric: 'wandering_risk',
          value: Math.floor(Math.random() * 6) + 1,
          unit: 'score',
          source: 'simulator',
          recordedAt: ts,
          tags: { simulated: true },
        })
      }
    }
  }

  const CHUNK = 200
  for (let i = 0; i < observationRows.length; i += CHUNK) {
    await db.insert(events).values(observationRows.slice(i, i + CHUNK))
  }

  const alertRows: (typeof events.$inferInsert)[] = []
  for (const p of PATIENTS) {
    const patientId = createdPatients.get(p.username)!
    for (let i = 0; i < p.alertScenarios.length; i++) {
      const s = p.alertScenarios[i]
      const ts = recentAlertTime(2 + i * 4)
      alertRows.push({
        patientId,
        kind: 'alert',
        metric: s.metric,
        value: s.value,
        unit: s.unit,
        severity: s.severity,
        status: 'active',
        source: 'simulator',
        recordedAt: ts,
        tags: { simulated: true, ...(s.tags || {}) },
      })
    }
  }
  if (alertRows.length > 0) {
    await db.insert(events).values(alertRows)
  }

  for (const p of PATIENTS) {
    const patientId = createdPatients.get(p.username)!
    const user = createdUsers.get(p.username)!

    for (const med of p.meds) {
      await db
        .insert(medications)
        .values({
          patientId,
          drugName: med.drugName,
          genericName: med.genericName,
          dosage: med.dosage,
          dosageUnit: med.dosageUnit,
          frequency: med.frequency,
          route: med.route as 'oral' | 'injection' | 'topical' | 'inhalation' | 'other',
          startDate: new Date(Date.now() - 14 * 24 * HOUR_MS).toISOString().slice(0, 10),
          status: 'active',
          instructions: med.instructions,
          prescribedById: user,
        })
        .returning({ id: medications.id })
    }
  }

  const DEMO_FORMS = [
    {
      code: 'daily-health',
      title: '每日健康评估',
      description: '每日自我评估健康状况',
      fields: [
        { id: 'mood', type: 'choice', label: '今日心情', required: true, options: [{ value: 'good', label: '好' }, { value: 'fair', label: '一般' }, { value: 'poor', label: '差' }] },
        { id: 'pain', type: 'vas', label: '疼痛程度 (0=无痛, 100=剧痛)', required: true, min_label: '无痛', max_label: '剧痛' },
        { id: 'sleep', type: 'number', label: '昨日睡眠时长', required: true, min: 0, max: 24, unit: '小时' },
        { id: 'symptom', type: 'choice', label: '是否有新症状', required: true, options: [{ value: 'none', label: '无' }, { value: 'mild', label: '轻微' }, { value: 'severe', label: '严重' }] },
        { id: 'note', type: 'text', label: '备注', required: false, placeholder: '其他需要说明的情况', rows: 3 },
      ],
    },
    {
      code: 'medication-adherence',
      title: '用药依从性调查',
      description: '评估用药依从性',
      fields: [
        { id: 'took_meds', type: 'choice', label: '今日是否按时用药', required: true, options: [{ value: 'yes', label: '是' }, { value: 'partial', label: '部分' }, { value: 'no', label: '否' }] },
        { id: 'reasons', type: 'multi', label: '未按时用药的原因（可多选）', required: false, options: [{ value: 'forgot', label: '忘记' }, { value: 'side_effect', label: '副作用' }, { value: 'busy', label: '太忙' }, { value: 'other', label: '其他' }] },
        { id: 'discomfort', type: 'choice', label: '是否有不适感', required: true, options: [{ value: 'none', label: '无' }, { value: 'mild', label: '轻微' }, { value: 'moderate', label: '中度' }, { value: 'severe', label: '严重' }] },
        { id: 'feedback', type: 'text', label: '用药反馈', required: false, placeholder: '请描述用药后的感受', rows: 3 },
      ],
    },
    {
      code: 'weekly-wellness',
      title: '周度健康自评',
      description: '每周一次的综合健康评估',
      fields: [
        { id: 'appetite', type: 'likert', label: '食欲', required: true, labels: ['很差', '较差', '一般', '较好', '很好'] },
        { id: 'energy', type: 'likert', label: '精力', required: true, labels: ['很差', '较差', '一般', '较好', '很好'] },
        { id: 'weight', type: 'number', label: '体重', required: true, min: 20, max: 200, unit: 'kg' },
        { id: 'exercise_days', type: 'number', label: '本周运动天数', required: true, min: 0, max: 7, unit: '天' },
        { id: 'mood_avg', type: 'choice', label: '本周整体心情', required: true, options: [{ value: 'happy', label: '愉快' }, { value: 'normal', label: '平稳' }, { value: 'down', label: '低落' }] },
      ],
    },
  ]

  for (const form of DEMO_FORMS) {
    await db
      .insert(formDefinitions)
      .values({
        code: form.code,
        title: form.title,
        description: form.description,
        fields: form.fields as any,
        status: 'published',
      })
      .onConflictDoNothing()
  }

  const DEMO_PLANS = [
    {
      code: 'daily-bp',
      title: '每日血压测量',
      description: '每天早晚各测量一次血压并记录',
      fields: [
        { id: 'morning_sbp', type: 'number', label: '晨起收缩压', required: true, min: 60, max: 250, unit: 'mmHg' },
        { id: 'morning_dbp', type: 'number', label: '晨起舒张压', required: true, min: 30, max: 150, unit: 'mmHg' },
        { id: 'evening_sbp', type: 'number', label: '晚间收缩压', required: true, min: 60, max: 250, unit: 'mmHg' },
        { id: 'evening_dbp', type: 'number', label: '晚间舒张压', required: true, min: 30, max: 150, unit: 'mmHg' },
        { id: 'note', type: 'text', label: '备注', required: false, rows: 2 },
      ],
      rewardCredits: 10,
    },
    {
      code: 'weekly-weight',
      title: '每周体重记录',
      description: '每周一记录当前体重',
      fields: [
        { id: 'weight', type: 'number', label: '体重', required: true, min: 20, max: 200, unit: 'kg' },
        { id: 'body_fat', type: 'number', label: '体脂率（如有测量）', required: false, min: 5, max: 50, unit: '%' },
        { id: 'note', type: 'text', label: '备注', required: false, rows: 2 },
      ],
      rewardCredits: 5,
    },
  ]

  for (const plan of DEMO_PLANS) {
    await db
      .insert(plans)
      .values({
        code: plan.code,
        title: plan.title,
        description: plan.description,
        fields: plan.fields as any,
        rewardCredits: plan.rewardCredits,
        status: 'active',
      })
      .onConflictDoNothing()
  }
}
