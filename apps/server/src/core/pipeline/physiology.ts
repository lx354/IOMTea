// apps/server/src/core/pipeline/physiology.ts

let hasSpare = false
let spare = 0

export function gaussian(mean: number, std: number): number {
  if (hasSpare) {
    hasSpare = false
    return mean + std * spare
  }
  let u: number, v: number, s: number
  do {
    u = Math.random() * 2 - 1
    v = Math.random() * 2 - 1
    s = u * u + v * v
  } while (s >= 1 || s === 0)
  s = Math.sqrt((-2 * Math.log(s)) / s)
  spare = v * s
  hasSpare = true
  return mean + std * u * s
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

export function clampFloat(value: number, min: number, max: number, decimals = 1): number {
  const clamped = Math.max(min, Math.min(max, value))
  return Number(clamped.toFixed(decimals))
}

export function circadianFactor(hour: number): number {
  const h = ((hour % 24) + 24) % 24
  return Math.sin(((h - 6) / 24) * 2 * Math.PI) * 0.15
}

export function generateHeartRate(
  baseline: { mean: number; std: number },
  hour: number,
  activityMultiplier = 1.0,
): number {
  const circadian = circadianFactor(hour) * 10 * activityMultiplier
  const raw = gaussian(baseline.mean + circadian, baseline.std * activityMultiplier)
  return clamp(raw, 30, 220)
}

export function generateSpO2(baseline: { mean: number; std: number }, _hour: number): number {
  const raw = gaussian(baseline.mean, baseline.std)
  return clamp(raw, 70, 100)
}

export function generateTemperature(baseline: { mean: number; std: number }, hour: number): number {
  const circadian = circadianFactor(hour) * 0.5
  const raw = gaussian(baseline.mean + circadian, baseline.std)
  return clampFloat(raw, 34, 42)
}

export function generateSystolicBp(baseline: { mean: number; std: number }, hour: number): number {
  const circadian = circadianFactor(hour) * 5
  const raw = gaussian(baseline.mean + circadian, baseline.std)
  return clamp(raw, 70, 220)
}

export function generateDiastolicBp(baseline: { mean: number; std: number }, hour: number): number {
  const circadian = circadianFactor(hour) * 3
  const raw = gaussian(baseline.mean + circadian, baseline.std)
  return clamp(raw, 40, 130)
}

export function generateGlucose(baseline: { mean: number; std: number }, _hour: number): number {
  const raw = gaussian(baseline.mean, baseline.std)
  return clampFloat(raw, 2.0, 25.0)
}

export function generateRespiratoryRate(
  baseline: { mean: number; std: number },
  _hour: number,
  activityMultiplier = 1.0,
): number {
  const raw = gaussian(baseline.mean * activityMultiplier, baseline.std)
  return clamp(raw, 8, 40)
}

export function generateMotionIndex(): number {
  return clampFloat(Math.random() * 0.8 + 0.05, 0, 1, 2)
}

const POSTURES = ['standing', 'sitting', 'lying', 'walking'] as const

export function generatePosture(): string {
  return POSTURES[Math.floor(Math.random() * POSTURES.length)]
}

const BED_STATUSES = ['in_bed', 'out_of_bed', 'edge_of_bed'] as const

export function generateBedStatus(): string {
  return BED_STATUSES[Math.floor(Math.random() * BED_STATUSES.length)]
}

const HOUR = () => new Date().getHours()

export function generateNightWandering(_baseline: { mean: number; std: number }, _hour: number): number {
  const h = HOUR()
  const isNight = h >= 22 || h <= 6
  if (!isNight) return 0
  const raw = gaussian(1.5, 1.2)
  return clamp(Math.round(raw), 0, 8)
}

export function generateRepetitiveBehavior(_baseline: { mean: number; std: number }, _hour: number): number {
  const raw = gaussian(2, 1.5)
  return clamp(Math.round(raw), 0, 10)
}

export function generateWanderingRisk(_baseline: { mean: number; std: number }, _hour: number): number {
  const h = HOUR()
  const base = h >= 10 && h <= 16 ? 3 : 1.5
  const raw = gaussian(base, 1.5)
  return clamp(Math.round(raw), 0, 10)
}
