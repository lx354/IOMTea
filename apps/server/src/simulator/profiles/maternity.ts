import type { PatientProfile } from '../types'

export const maternityProfile: PatientProfile = {
  id: 'maternity',
  name: '孕产监护',
  demographics: {
    ageRange: [22, 42],
    gender: 'female',
    weightRange: [55, 90],
  },
  baseline: {
    heartRate: { resting: 90, variability: 10, circadianFactor: 5 },
    respiratoryRate: { resting: 22, variability: 4 },
    temperature: { resting: 36.8, variability: 0.3 },
    spO2: { resting: 97, variability: 1.5 },
    bloodPressure: { systolic: 120, diastolic: 70, variability: 5 },
    bloodGlucose: { fasting: 4.8, variability: 0.3, postprandialSpike: 4 },
  },
  conditions: ['third_trimester', 'gestational_hypertension_risk'],
  schedule: {
    sleep: { start: '22:00', end: '06:30' },
    meals: [{ time: '07:30' }, { time: '12:00' }, { time: '18:30' }],
    events: [
      { type: 'bed_exit', window: ['03:00', '05:00'], probability: 0.4 },
    ],
  },
  devices: ['mattress'],
  alerts: [
    { metric: 'heart_rate', condition: 'gt', threshold: 140, severity: 'critical', message: '心动过速' },
    { metric: 'heart_rate', condition: 'lt', threshold: 50, severity: 'warning', message: '心动过缓' },
    { metric: 'systolic_bp', condition: 'gt', threshold: 140, severity: 'critical', message: '子痫前期风险' },
    { metric: 'spo2', condition: 'lt', threshold: 94, severity: 'warning', message: '低血氧' },
  ],
}
