import type { PatientProfile } from '../types'

export const postSurgeryProfile: PatientProfile = {
  id: 'post-surgery',
  name: '术后恢复患者',
  demographics: {
    ageRange: [30, 70],
    gender: 'any',
    weightRange: [45, 90],
  },
  baseline: {
    heartRate: { resting: 85, variability: 10, circadianFactor: 5 },
    respiratoryRate: { resting: 20, variability: 4 },
    temperature: { resting: 37.2, variability: 0.5 },
    spO2: { resting: 94, variability: 2 },
    bloodPressure: { systolic: 125, diastolic: 80, variability: 6 },
    bloodGlucose: { fasting: 6.0, variability: 0.5, postprandialSpike: 3 },
  },
  conditions: ['post_op', 'infection_risk'],
  schedule: {
    sleep: { start: '22:00', end: '06:00' },
    meals: [{ time: '07:30' }, { time: '12:30' }, { time: '18:30' }],
    events: [
      { type: 'position_change', window: ['08:00', '18:00'], probability: 0.5 },
      { type: 'bed_exit', window: ['22:00', '02:00'], probability: 0.1 },
    ],
  },
  devices: ['mattress'],
  alerts: [
    { metric: 'heart_rate', condition: 'gt', threshold: 120, severity: 'warning', message: '心动过速' },
    { metric: 'temperature', condition: 'gt', threshold: 38.5, severity: 'critical', message: '术后发热' },
    { metric: 'spo2', condition: 'lt', threshold: 92, severity: 'critical', message: '低血氧' },
    { metric: 'systolic_bp', condition: 'lt', threshold: 90, severity: 'critical', message: '低血压(出血风险)' },
  ],
}
