import { pgEnum } from 'drizzle-orm/pg-core'

// Existing enums (migrated from schema.ts with new values added)
export const roleEnum = pgEnum('role', ['super_admin', 'admin', 'user'])
export const patientStatusEnum = pgEnum('patient_status', ['active', 'discharged', 'archived'])
export const alertSeverityEnum = pgEnum('alert_severity', ['critical', 'warning', 'info'])
export const alertStatusEnum = pgEnum('alert_status', [
  'active',
  'acknowledged',
  'resolved',
  'expired',
  'new',
  'assigned',
  'handled',
  'closed',
])
export const kindEnum = pgEnum('kind', [
  'observation',
  'alert',
  'behavior',
  'location',
  'ema_response',
  'batch_record',
  'plan_earn',
  'state_transition',
])

export const userStatusEnum = pgEnum('user_status', ['active', 'disabled', 'pending'])
export const genderEnum = pgEnum('gender', ['male', 'female', 'other'])
export const bloodTypeEnum = pgEnum('blood_type', ['A', 'B', 'AB', 'O'])
export const eventSourceEnum = pgEnum('event_source', ['iot', 'cv', 'simulator', 'manual', 'batch'])
export const medicationStatusEnum = pgEnum('medication_status', [
  'active',
  'completed',
  'paused',
  'cancelled',
])
export const medicationRouteEnum = pgEnum('medication_route', [
  'oral',
  'injection',
  'topical',
  'inhalation',
  'other',
])

export const transactionTypeEnum = pgEnum('transaction_type', ['earn', 'spend', 'adjust'])

export const pinTypeEnum = pgEnum('pin_type', ['device', 'virtual', 'user', 'simulator'])

// ── Type exports: single source of truth for strict TypeScript usage ──
export type Role = 'super_admin' | 'admin' | 'user'
export type PatientStatus = 'active' | 'discharged' | 'archived'
export type AlertSeverity = 'critical' | 'warning' | 'info'
export type AlertStatus =
  | 'active'
  | 'acknowledged'
  | 'resolved'
  | 'expired'
  | 'new'
  | 'assigned'
  | 'handled'
  | 'closed'
export type EventKind =
  | 'observation'
  | 'alert'
  | 'behavior'
  | 'location'
  | 'ema_response'
  | 'batch_record'
  | 'plan_earn'
  | 'state_transition'

export type UserStatus = 'active' | 'disabled' | 'pending'
export type Gender = 'male' | 'female' | 'other'
export type BloodType = 'A' | 'B' | 'AB' | 'O'
export type EventSource = 'iot' | 'cv' | 'simulator' | 'manual' | 'batch'
export type MedicationStatus = 'active' | 'completed' | 'paused' | 'cancelled'
export type MedicationRoute = 'oral' | 'injection' | 'topical' | 'inhalation' | 'other'
export type TransactionType = 'earn' | 'spend' | 'adjust'
