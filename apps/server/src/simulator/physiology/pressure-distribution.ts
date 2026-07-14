import type { Posture, PressureGrid } from '../types'

export function generatePressureDistribution(
  posture: Posture,
  weight: number,
): PressureGrid {
  const grid: PressureGrid = Array.from({ length: 4 }, () => Array(4).fill(0))
  const weightFactor = weight / 70

  if (posture === 'walking' || posture === 'standing') {
    return grid.map(row => row.map(() => Math.round(Math.random() * 3)))
  }

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let basePressure = 0

      if (posture === 'lying') {
        const distToCenter = Math.sqrt((r - 1.5) ** 2 + (c - 1.5) ** 2)
        basePressure = 60 * Math.exp(-distToCenter * 0.6)
        basePressure += 10 * (1 - Math.abs(r - 1.5) / 2)
      } else if (posture === 'sitting') {
        const distToBack = Math.abs(c - 0)
        const distToCenter = Math.abs(r - 1.5)
        basePressure = 90 * Math.exp(-distToBack * 0.5) * Math.exp(-distToCenter * 0.3)
      } else {
        const distToLeft = Math.abs(c - 0)
        basePressure = 80 * Math.exp(-distToLeft * 0.4) * Math.exp(-Math.abs(r - 1.5) * 0.3)
      }

      const noise = (Math.random() - 0.5) * 10
      grid[r][c] = Math.max(0, Math.round(basePressure * weightFactor + noise))
    }
  }

  return grid
}
