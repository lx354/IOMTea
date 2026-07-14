import type { PatientProfile } from '../types'

export const copdRespiratoryProfile: PatientProfile = {
  id: 'copd-respiratory',
  name: 'COPD呼吸疾病患者',
  demographics: {
    ageRange: [55, 85],
    gender: 'any',
    weightRange: [40, 70],
  },
  baseline: {
    heartRate: { resting: 95, variability: 12, circadianFactor: 7 },
    respiratoryRate: { resting: 25, variability: 5 },
    temperature: { resting: 36.8, variability: 0.4 },
    spO2: { resting: 92, variability: 2.5 },
    bloodPressure: { systolic: 120, diastolic: 75, variability: 4 },
    bloodGlucose: { fasting: 5.0, variability: 0.3, postprandialSpike: 2.5 },
  },
  conditions: ['copd', 'hypoxemia_risk'],
  schedule: {
    sleep: { start: '22:00', end: '05:00' },
    meals: [{ time: '08:00' }, { time: '12:00' }, { time: '17:30' }],
    events: [
      { type: 'bed_exit', window: ['01:00', '05:00'], probability: 0.25 },
    ],
  },
  devices: ['mattress'],
  alerts: [
    { metric: 'spo2', condition: 'lt', threshold: 88, severity: 'critical', message: '严重低血氧' },
    { metric: 'resp_rate', condition: 'gt', threshold: 35, severity: 'critical', message: '呼吸窘迫' },
    { metric: 'heart_rate', condition: 'gt', threshold: 120, severity: 'warning', message: '心动过速' },
  ],
}
