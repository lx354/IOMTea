const now = new Date()
const HOUR_MS = 60 * 60 * 1000

interface VitalBaseline {
  hr: number
  hrVar: number
  spo2: number
  spo2Var: number
  bpSys: number
  bpDia: number
  bpVar: number
  temp: number
  tempVar: number
  glucoseFast: number
  glucoseVar: number
  glucosePost: number
}

interface SeedPatient {
  username: string
  password: string
  name: string
  gender: 'male' | 'female'
  birthDate: string
  heightCm: number
  weightKg: number
  profileId: string
  conditions: string[]
  hasHomeGraph: boolean
  graphPrefix: string
  baselines: VitalBaseline
  meds: {
    drugName: string
    genericName?: string
    dosage: string
    dosageUnit: string
    frequency: string
    route: string
    instructions?: string
  }[]
  pinLabels: string[]
  alertScenarios: {
    metric: string
    value: number | null
    unit: string | null
    severity: 'critical' | 'warning' | 'info'
    tags?: Record<string, unknown>
  }[]
}

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function jitter(base: number, range: number): number {
  return base + (Math.random() - 0.5) * range * 2
}

function round(v: number, d = 1): number {
  const m = Math.pow(10, d)
  return Math.round(v * m) / m
}

function roomId(prefix: string, type: string): string {
  return `${prefix}-${type}`
}

function activityLevel(hour: number): 'resting' | 'light' | 'moderate' {
  if (hour >= 23 || hour < 6) return 'resting'
  if ((hour >= 6 && hour < 8) || (hour >= 11 && hour < 13) || (hour >= 17 && hour < 19))
    return 'moderate'
  return 'light'
}

function generateVitals(b: VitalBaseline, hour: number) {
  const a = activityLevel(hour)
  const actMultiplier = a === 'resting' ? 0.88 : a === 'moderate' ? 1.08 : 1.0
  const afterMeal =
    (hour >= 8 && hour < 10) || (hour >= 13 && hour < 15) || (hour >= 19 && hour < 21)
  const isNight = hour >= 23 || hour < 6
  const isMorning = hour >= 6 && hour < 9

  const hr = round(jitter(b.hr * actMultiplier, b.hrVar), 0)
  const spo2 = round(jitter(b.spo2, b.spo2Var), 0)
  const bpSys = round(
    jitter(
      b.bpSys + (isMorning ? 5 : 0) + (a === 'resting' ? -8 : a === 'moderate' ? 5 : 0),
      b.bpVar,
    ),
    0,
  )
  const bpDia = round(
    jitter(b.bpDia + (a === 'resting' ? -3 : a === 'moderate' ? 3 : 0), b.bpVar * 0.6),
    0,
  )
  const temp = round(jitter(b.temp + (isNight ? -0.4 : a === 'moderate' ? 0.2 : 0), b.tempVar), 1)
  const glucose = round(jitter(b.glucoseFast + (afterMeal ? b.glucosePost : 0), b.glucoseVar), 1)
  const respRate = round(jitter(16 + (a === 'resting' ? -2 : a === 'moderate' ? 3 : 0), 3), 0)

  return { hr, spo2, bpSys, bpDia, temp, glucose, respRate }
}

function recentAlertTime(offsetHours: number): Date {
  return new Date(now.getTime() - offsetHours * HOUR_MS)
}

function buildHomeGraph(prefix: string): Record<string, unknown> {
  const rooms = [
    {
      id: roomId(prefix, 'livingroom'),
      name: '客厅',
      type: 'livingroom' as const,
      x: 300,
      y: 300,
      connections: [
        roomId(prefix, 'bedroom'),
        roomId(prefix, 'kitchen'),
        roomId(prefix, 'bathroom'),
      ],
      hasCamera: true,
    },
    {
      id: roomId(prefix, 'bedroom'),
      name: '主卧',
      type: 'bedroom' as const,
      x: 100,
      y: 300,
      connections: [roomId(prefix, 'livingroom')],
      hasCamera: false,
    },
    {
      id: roomId(prefix, 'kitchen'),
      name: '厨房',
      type: 'kitchen' as const,
      x: 500,
      y: 300,
      connections: [roomId(prefix, 'livingroom')],
      hasCamera: false,
    },
    {
      id: roomId(prefix, 'bathroom'),
      name: '浴室',
      type: 'bathroom' as const,
      x: 300,
      y: 100,
      connections: [roomId(prefix, 'livingroom')],
      hasCamera: false,
    },
  ]
  return { rooms, entryRoomId: roomId(prefix, 'livingroom'), personLocation: null }
}

const PATIENTS: SeedPatient[] = [
  {
    username: 'wangxiuying',
    password: 'password123',
    name: '王秀英',
    gender: 'female',
    birthDate: '1948-03-15',
    heightCm: 160,
    weightKg: 55,
    profileId: 'elderly-cardiac',
    conditions: ['moderate_cognitive_impairment', 'night_wandering', 'hypertension'],
    hasHomeGraph: true,
    graphPrefix: 'wxy',
    baselines: {
      hr: 78,
      hrVar: 8,
      spo2: 96,
      spo2Var: 1.5,
      bpSys: 145,
      bpDia: 88,
      bpVar: 6,
      temp: 36.4,
      tempVar: 0.3,
      glucoseFast: 5.2,
      glucoseVar: 0.4,
      glucosePost: 3,
    },
    meds: [
      {
        drugName: '盐酸多奈哌齐片',
        genericName: 'Donepezil',
        dosage: '5',
        dosageUnit: 'mg',
        frequency: '每日1次',
        route: 'oral',
        instructions: '睡前服用',
      },
      {
        drugName: '硝苯地平缓释片',
        genericName: 'Nifedipine',
        dosage: '30',
        dosageUnit: 'mg',
        frequency: '每日1次',
        route: 'oral',
        instructions: '早餐后服用',
      },
    ],
    pinLabels: ['客厅传感器', '卧室床垫'],
    alertScenarios: [
      {
        metric: 'night_wandering',
        value: 4,
        unit: '次/夜',
        severity: 'warning',
        tags: { scenario: 'night_wandering', behavior_type: 'night_wandering', intervention_suggestion: '检查卧室安全：移除绊脚物，打开夜灯；记录离床时间规律，调整下午小睡时长' },
      },
      {
        metric: 'heart_rate',
        value: 145,
        unit: 'bpm',
        severity: 'critical',
        tags: { scenario: 'tachycardia' },
      },
    ],
  },
  {
    username: 'chenguodong',
    password: 'password123',
    name: '陈国栋',
    gender: 'male',
    birthDate: '1944-08-22',
    heightCm: 168,
    weightKg: 65,
    profileId: 'diabetes',
    conditions: ['moderate_cognitive_impairment', 'repetitive_behavior', 'type2_diabetes'],
    hasHomeGraph: true,
    graphPrefix: 'cgd',
    baselines: {
      hr: 72,
      hrVar: 7,
      spo2: 97,
      spo2Var: 1,
      bpSys: 135,
      bpDia: 82,
      bpVar: 5,
      temp: 36.5,
      tempVar: 0.3,
      glucoseFast: 5.5,
      glucoseVar: 0.6,
      glucosePost: 5,
    },
    meds: [
      {
        drugName: '盐酸多奈哌齐片',
        genericName: 'Donepezil',
        dosage: '10',
        dosageUnit: 'mg',
        frequency: '每日1次',
        route: 'oral',
        instructions: '睡前服用',
      },
      {
        drugName: '盐酸二甲双胍片',
        genericName: 'Metformin',
        dosage: '500',
        dosageUnit: 'mg',
        frequency: '每日2次',
        route: 'oral',
        instructions: '早晚餐后服用',
      },
    ],
    pinLabels: ['客厅传感器', '厨房传感器'],
    alertScenarios: [
      {
        metric: 'repetitive_behavior',
        value: 5,
        unit: 'score',
        severity: 'warning',
        tags: { scenario: 'repetitive_behavior', behavior_type: 'repetitive', intervention_suggestion: '提供替代活动：整理衣物、简单拼图；保持环境安静，减少刺激源；观察触发模式并记录' },
      },
      {
        metric: 'glucose',
        value: 13.2,
        unit: 'mmol/L',
        severity: 'critical',
        tags: { scenario: 'hyperglycemia' },
      },
    ],
  },
  {
    username: 'liuxiulan',
    password: 'password123',
    name: '刘秀兰',
    gender: 'female',
    birthDate: '1951-11-08',
    heightCm: 155,
    weightKg: 52,
    profileId: 'post-surgery',
    conditions: ['moderate_cognitive_impairment', 'wandering_tendency', 'fall_risk'],
    hasHomeGraph: false,
    graphPrefix: 'lxl',
    baselines: {
      hr: 82,
      hrVar: 10,
      spo2: 95,
      spo2Var: 2,
      bpSys: 140,
      bpDia: 85,
      bpVar: 6,
      temp: 36.6,
      tempVar: 0.4,
      glucoseFast: 5.8,
      glucoseVar: 0.5,
      glucosePost: 3,
    },
    meds: [
      {
        drugName: '盐酸美金刚片',
        genericName: 'Memantine',
        dosage: '10',
        dosageUnit: 'mg',
        frequency: '每日2次',
        route: 'oral',
        instructions: '早晚各一次',
      },
      {
        drugName: '碳酸钙D3片',
        genericName: 'Calcium Carbonate',
        dosage: '600',
        dosageUnit: 'mg',
        frequency: '每日1次',
        route: 'oral',
        instructions: '晚餐后服用',
      },
    ],
    pinLabels: ['主卧传感器'],
    alertScenarios: [
      {
        metric: 'wandering_risk',
        value: 8,
        unit: 'score',
        severity: 'critical',
        tags: { scenario: 'wandering_escape', behavior_type: 'wandering', intervention_suggestion: '检查门窗安全锁；确保老人佩戴定位设备；安排定时回访或电话确认；如频繁尝试外出，考虑加装门磁报警' },
      },
      {
        metric: 'motion_index',
        value: 0,
        unit: '',
        severity: 'warning',
        tags: { scenario: 'prolonged_inactivity', intervention_suggestion: '检查老人状态；确认未发生跌倒；如长时间无活动，建议上门查看' },
      },
    ],
  },
]

export { PATIENTS, generatePin, generateVitals, recentAlertTime, buildHomeGraph, HOUR_MS }
export type { SeedPatient, VitalBaseline }
