import type { PatientProfile } from '../types'

export const diabetesProfile: PatientProfile = {
  id: 'diabetes',
  name: '糖尿病患者',
  demographics: {
    ageRange: [40, 75],
    gender: 'any',
    weightRange: [55, 100],
  },
  baseline: {
    heartRate: { resting: 72, variability: 7, circadianFactor: 4 },
    respiratoryRate: { resting: 16, variability: 3 },
    temperature: { resting: 36.5, variability: 0.3 },
    spO2: { resting: 97, variability: 1 },
    bloodPressure: { systolic: 130, diastolic: 82, variability: 5 },
    bloodGlucose: { fasting: 5.5, variability: 0.6, postprandialSpike: 5 },
  },
  conditions: ['type2_diabetes', 'neuropathy'],
  schedule: {
    sleep: { start: '22:00', end: '06:00' },
    meals: [{ time: '07:00' }, { time: '12:00' }, { time: '18:00' }],
    events: [
      { type: 'bed_exit', window: ['02:00', '05:00'], probability: 0.15 },
    ],
  },
  devices: ['mattress'],
  alerts: [
    { metric: 'glucose', condition: 'gt', threshold: 11, severity: 'critical', message: '高血糖' },
    { metric: 'glucose', condition: 'lt', threshold: 3.5, severity: 'critical', message: '低血糖' },
    { metric: 'heart_rate', condition: 'gt', threshold: 110, severity: 'warning', message: '心动过速' },
  ],
}
