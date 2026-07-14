export const USER_ROLES = ['super_admin', 'admin', 'user'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const ALERT_SEVERITIES = ['critical', 'warning', 'info'] as const
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number]

export const ALERT_STATUSES = [
  'active',
  'acknowledged',
  'resolved',
  'expired',
  'new',
  'assigned',
  'handled',
  'closed',
] as const
export type AlertStatus = (typeof ALERT_STATUSES)[number]

export const PATIENT_STATUSES = ['active', 'discharged', 'archived'] as const
export type PatientStatus = (typeof PATIENT_STATUSES)[number]

export const GENDERS = ['male', 'female', 'other'] as const
export type Gender = (typeof GENDERS)[number]

export const HEALTH_MODULE_KEYS = [
  'blood_glucose',
  'blood_pressure',
  'weight',
  'heart_rate',
  'temperature',
  'spo2',
  'medication',
  'period',
] as const

export type HealthModuleKey = (typeof HEALTH_MODULE_KEYS)[number]

export const HEALTH_MODULE_META: Record<
  HealthModuleKey,
  { label: string; unit: string; icon: string }
> = {
  blood_glucose: { label: '血糖', unit: 'mmol/L', icon: '🩸' },
  blood_pressure: { label: '血压', unit: 'mmHg', icon: '❤️' },
  weight: { label: '体重', unit: 'kg', icon: '⚖️' },
  heart_rate: { label: '心率', unit: 'bpm', icon: '💓' },
  temperature: { label: '体温', unit: '°C', icon: '🌡️' },
  spo2: { label: '血氧', unit: '%', icon: '🫁' },
  medication: { label: '用药', unit: '', icon: '💊' },
  period: { label: '生理期', unit: '', icon: '🌸' },
}

export const PATIENT_RELATIONS = [
  'primary', 'spouse', 'child', 'parent', 'sibling',
  'caregiver', 'doctor', 'nurse', 'admin', 'other',
] as const
export type PatientRelation = (typeof PATIENT_RELATIONS)[number]

export const DEVICE_TYPES = ['wearable', 'sensor', 'camera', 'other'] as const
export type DeviceType = (typeof DEVICE_TYPES)[number]

export const DEVICE_STATUSES = ['online', 'offline', 'maintenance'] as const
export type DeviceStatus = (typeof DEVICE_STATUSES)[number]
