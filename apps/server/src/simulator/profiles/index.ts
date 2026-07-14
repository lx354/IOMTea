import type { PatientProfile } from '../types'
import { elderlyCardiacProfile } from './elderly-cardiac'
import { postSurgeryProfile } from './post-surgery'
import { diabetesProfile } from './diabetes'
import { copdRespiratoryProfile } from './copd-respiratory'
import { maternityProfile } from './maternity'

export const profiles: Record<string, PatientProfile> = {
  'elderly-cardiac': elderlyCardiacProfile,
  'post-surgery': postSurgeryProfile,
  'diabetes': diabetesProfile,
  'copd-respiratory': copdRespiratoryProfile,
  'maternity': maternityProfile,
}

export function getProfile(id: string): PatientProfile {
  const p = profiles[id]
  if (!p) throw new Error(`Profile not found: ${id}`)
  return p
}
