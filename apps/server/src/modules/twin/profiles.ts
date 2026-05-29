export interface MetricConfig {
  metric: string
  unit: string
  interval: { min: number; max: number }
  jitter: number
  generator: string
}

export interface ProfileBaselines {
  heartRate: { mean: number; std: number }
  spo2: { mean: number; std: number }
  temperature: { mean: number; std: number }
  systolicBp: { mean: number; std: number }
  diastolicBp: { mean: number; std: number }
  glucose: { mean: number; std: number }
  respiratoryRate: { mean: number; std: number }
}

export interface UnifiedProfile {
  name: string
  displayName: string
  description: string
  baselines: ProfileBaselines
  metrics: MetricConfig[]
  conditions: string[]
}

const defaultMetrics: MetricConfig[] = [
  {
    metric: 'heart_rate',
    unit: 'bpm',
    interval: { min: 3000, max: 5000 },
    jitter: 0.2,
    generator: 'heartRate',
  },
  {
    metric: 'resp_rate',
    unit: 'rpm',
    interval: { min: 3000, max: 5000 },
    jitter: 0.2,
    generator: 'respiratoryRate',
  },
  {
    metric: 'spo2',
    unit: '%',
    interval: { min: 3000, max: 5000 },
    jitter: 0.15,
    generator: 'spo2',
  },
  {
    metric: 'temperature',
    unit: '°C',
    interval: { min: 60000, max: 120000 },
    jitter: 0.1,
    generator: 'temperature',
  },
  {
    metric: 'systolic_bp',
    unit: 'mmHg',
    interval: { min: 30000, max: 60000 },
    jitter: 0.15,
    generator: 'systolicBp',
  },
  {
    metric: 'diastolic_bp',
    unit: 'mmHg',
    interval: { min: 30000, max: 60000 },
    jitter: 0.15,
    generator: 'diastolicBp',
  },
  {
    metric: 'glucose',
    unit: 'mmol/L',
    interval: { min: 300000, max: 600000 },
    jitter: 0.2,
    generator: 'glucose',
  },
  {
    metric: 'posture',
    unit: '',
    interval: { min: 5000, max: 30000 },
    jitter: 0.5,
    generator: 'posture',
  },
  {
    metric: 'bed_status',
    unit: '',
    interval: { min: 5000, max: 30000 },
    jitter: 0.3,
    generator: 'bedStatus',
  },
  {
    metric: 'motion_index',
    unit: '',
    interval: { min: 10000, max: 30000 },
    jitter: 0.3,
    generator: 'motionIndex',
  },
  {
    metric: 'night_wandering',
    unit: '次/夜',
    interval: { min: 60000, max: 180000 },
    jitter: 0.3,
    generator: 'nightWandering',
  },
  {
    metric: 'repetitive_behavior',
    unit: 'score',
    interval: { min: 120000, max: 300000 },
    jitter: 0.2,
    generator: 'repetitiveBehavior',
  },
  {
    metric: 'wandering_risk',
    unit: 'score',
    interval: { min: 120000, max: 300000 },
    jitter: 0.2,
    generator: 'wanderingRisk',
  },
]

const profiles: Record<string, UnifiedProfile> = {
  'elderly-cardiac': {
    name: 'elderly-cardiac',
    displayName: '中度认知障碍—心血管型',
    description: '78岁女性，中度认知障碍合并高血压，夜间离床频发，需重点监测夜间行为与心血管状态',
    baselines: {
      heartRate: { mean: 78, std: 8 },
      spo2: { mean: 96, std: 2 },
      temperature: { mean: 36.5, std: 0.3 },
      systolicBp: { mean: 135, std: 10 },
      diastolicBp: { mean: 85, std: 6 },
      glucose: { mean: 5.8, std: 1.2 },
      respiratoryRate: { mean: 16, std: 3 },
    },
    metrics: defaultMetrics,
    conditions: ['moderate_cognitive_impairment', 'hypertension', 'night_wandering'],
  },
  diabetes: {
    name: 'diabetes',
    displayName: '中度认知障碍—代谢型',
    description: '82岁男性，中度认知障碍合并2型糖尿病，重复行为倾向显著，需监测血糖与行为节律',
    baselines: {
      heartRate: { mean: 72, std: 7 },
      spo2: { mean: 97, std: 1.5 },
      temperature: { mean: 36.5, std: 0.3 },
      systolicBp: { mean: 130, std: 8 },
      diastolicBp: { mean: 82, std: 5 },
      glucose: { mean: 6.5, std: 1.5 },
      respiratoryRate: { mean: 16, std: 3 },
    },
    metrics: defaultMetrics,
    conditions: ['moderate_cognitive_impairment', 'type2_diabetes', 'repetitive_behavior'],
  },
  'post-surgery': {
    name: 'post-surgery',
    displayName: '中度认知障碍—走失风险型',
    description: '75岁女性，中度认知障碍合并跌倒史，走失倾向高，需重点监测活动轨迹与走失风险',
    baselines: {
      heartRate: { mean: 82, std: 10 },
      spo2: { mean: 95, std: 2 },
      temperature: { mean: 36.6, std: 0.4 },
      systolicBp: { mean: 125, std: 12 },
      diastolicBp: { mean: 80, std: 7 },
      glucose: { mean: 5.5, std: 0.8 },
      respiratoryRate: { mean: 18, std: 4 },
    },
    metrics: defaultMetrics,
    conditions: ['moderate_cognitive_impairment', 'wandering_tendency', 'fall_risk'],
  },
  'copd-respiratory': {
    name: 'copd-respiratory',
    displayName: '中度认知障碍—呼吸型',
    description: '80岁男性，中度认知障碍合并COPD，活动能力受限，监护重点为呼吸与活动耐受',
    baselines: {
      heartRate: { mean: 85, std: 10 },
      spo2: { mean: 93, std: 3 },
      temperature: { mean: 36.6, std: 0.4 },
      systolicBp: { mean: 128, std: 10 },
      diastolicBp: { mean: 78, std: 6 },
      glucose: { mean: 5.6, std: 0.8 },
      respiratoryRate: { mean: 22, std: 5 },
    },
    metrics: defaultMetrics,
    conditions: ['moderate_cognitive_impairment', 'copd', 'limited_mobility'],
  },
  maternity: {
    name: 'maternity',
    displayName: '中度认知障碍—高关怀型',
    description: '认知障碍特殊案例，需综合监测多维度生理与行为参数，适用于综合性监护评估',
    baselines: {
      heartRate: { mean: 75, std: 9 },
      spo2: { mean: 98, std: 1.5 },
      temperature: { mean: 36.7, std: 0.3 },
      systolicBp: { mean: 110, std: 8 },
      diastolicBp: { mean: 70, std: 5 },
      glucose: { mean: 4.8, std: 0.5 },
      respiratoryRate: { mean: 17, std: 3 },
    },
    metrics: defaultMetrics,
    conditions: ['moderate_cognitive_impairment', 'comprehensive_monitoring'],
  },
}

export function getProfile(name: string): UnifiedProfile {
  const p = profiles[name]
  if (!p) throw new Error(`Profile not found: ${name}`)
  return p
}

export function listProfiles() {
  return Object.entries(profiles).map(([id, p]) => ({
    id,
    name: p.name,
    displayName: p.displayName,
    description: p.description,
    conditions: p.conditions,
    metrics: p.metrics.map((m) => ({ metric: m.metric, unit: m.unit })),
  }))
}

export { profiles }
