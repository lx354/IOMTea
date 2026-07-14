import type { ActivityLevel } from '../types'

const baseMotion: Record<ActivityLevel, number> = {
  resting: 0.01,
  light: 0.05,
  moderate: 0.15,
  heavy: 0.4,
}

function simpleJitter(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

let jitterCounter = 0

export function generateMotionIndex(activity: ActivityLevel): number {
  jitterCounter++
  const base = baseMotion[activity]
  const jitter = simpleJitter(jitterCounter) * base * 0.5
  return Math.max(0, Math.round((base + jitter) * 1000) / 1000)
}
