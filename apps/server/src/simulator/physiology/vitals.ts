import type { ActivityLevel } from '../types'
export type { ActivityLevel }

const activityMod: Record<ActivityLevel, number> = {
  resting: 0, light: 8, moderate: 20, heavy: 40,
}

function gaussian(mean: number, std: number): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export function generateHeartRate(
  baseline: number,
  variability: number,
  circadianFactor: number,
  hourOfDay: number,
  activity: ActivityLevel,
  tick: number,
): number {
  const circadian = Math.sin((hourOfDay - 3) * Math.PI / 12) * circadianFactor
  const activityModVal = activityMod[activity]
  const respCoupling = Math.sin(tick * 0.3) * 3
  const noise = gaussian(0, variability)
  return clamp(baseline + circadian + activityModVal + respCoupling + noise, 30, 220)
}

export function generateRespiratoryRate(
  baseline: number,
  variability: number,
  activity: ActivityLevel,
  hr: number,
): number {
  const activityModVal = activity === 'heavy' ? 8 : activity === 'moderate' ? 4 : 0
  const hrCoupling = (hr - baseline) * 0.05
  const noise = gaussian(0, variability)
  return clamp(baseline + activityModVal + hrCoupling + noise, 6, 40)
}

export function generateTemperature(
  baseline: number,
  variability: number,
  hourOfDay: number,
): number {
  const circadian = Math.sin((hourOfDay - 4) * Math.PI / 12) * 0.4
  const noise = gaussian(0, variability)
  return clamp(baseline + circadian + noise, 35.5, 42)
}

export function generateSpO2(
  baseline: number,
  variability: number,
): number {
  const noise = gaussian(0, variability)
  return clamp(baseline + noise, 85, 100)
}

export function generateBedStatus(
  activity: ActivityLevel,
  hourOfDay: number,
  scheduleEvents: { type: string; window: [string, string]; probability: number }[],
): number {
  const hour = Math.floor(hourOfDay)
  const minute = Math.floor((hourOfDay - hour) * 60)
  const currentMinutes = hour * 60 + minute

  for (const ev of scheduleEvents) {
    if (ev.type === 'bed_exit') {
      const [start, end] = ev.window
      const [sh, sm] = start.split(':').map(Number)
      const [eh, em] = end.split(':').map(Number)
      const startMin = sh * 60 + sm
      const endMin = eh * 60 + em

      if (currentMinutes >= startMin && currentMinutes <= endMin) {
        if (Math.random() < ev.probability) return 0
      }
    }
  }

  return activity === 'resting' ? 1 : 0
}
