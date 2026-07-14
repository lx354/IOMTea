import type { ActivityLevel } from '../types'

function gaussian(mean: number, std: number): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

const activitySystolicMod: Record<ActivityLevel, number> = {
  resting: 0, light: 3, moderate: 10, heavy: 20,
}

export function generateBloodPressure(
  systolicBaseline: number,
  diastolicBaseline: number,
  variability: number,
  hourOfDay: number,
  activity: ActivityLevel,
  hr: number,
): { systolic: number; diastolic: number } {
  const circadian = Math.sin((hourOfDay - 3) * Math.PI / 12) * 3
  const activityVal = activitySystolicMod[activity]
  const hrCoupling = (hr - 70) * 0.15
  const noise = gaussian(0, variability)
  const systolic = clamp(systolicBaseline + circadian + activityVal + hrCoupling + noise, 70, 220)
  const diastolic = clamp(diastolicBaseline + (circadian + hrCoupling) * 0.6 + gaussian(0, variability * 0.7), 40, 130)
  return {
    systolic: Math.round(systolic),
    diastolic: Math.round(diastolic),
  }
}
