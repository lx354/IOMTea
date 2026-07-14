import type { PatientProfile } from '../types'

export const elderlyCardiacProfile: PatientProfile = {
  id: 'elderly-cardiac',
  name: '老年心血管患者',
  demographics: {
    ageRange: [65, 85],
    gender: 'any',
    weightRange: [50, 80],
  },
  baseline: {
    heartRate: { resting: 78, variability: 8, circadianFactor: 6 },
    respiratoryRate: { resting: 18, variability: 3 },
    temperature: { resting: 36.5, variability: 0.3 },
    spO2: { resting: 96, variability: 1.5 },
    bloodPressure: { systolic: 135, diastolic: 85, variability: 5 },
    bloodGlucose: { fasting: 5.2, variability: 0.4, postprandialSpike: 3.5 },
  },
  conditions: ['hypertension', 'fall_risk'],
  schedule: {
    sleep: { start: '21:00', end: '06:00' },
    meals: [{ time: '07:00' }, { time: '12:00' }, { time: '18:00' }],
    events: [
      { type: 'bed_exit', window: ['02:00', '04:00'], probability: 0.35 },
    ],
  },
  devices: ['mattress'],
  alerts: [
    { metric: 'heart_rate', condition: 'gt', threshold: 130, severity: 'warning', message: '心动过速' },
    { metric: 'heart_rate', condition: 'lt', threshold: 45, severity: 'critical', message: '心动过缓' },
    { metric: 'spo2', condition: 'lt', threshold: 90, severity: 'critical', message: '低血氧' },
    { metric: 'systolic_bp', condition: 'gt', threshold: 160, severity: 'warning', message: '高血压' },
  ],
}
