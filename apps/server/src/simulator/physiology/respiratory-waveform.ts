function simplePerlin(seed: number): number {
  const x = Math.sin(seed * 6.283) * 0.5 + 0.5
  return x * 2 - 1
}

export function generateRespiratoryWaveform(rr: number): number[] {
  const samples: number[] = []
  const sampleCount = 50
  const duration = 5
  const dt = duration / sampleCount
  const freq = rr / 60
  let noiseIdx = Math.random() * 1000

  for (let i = 0; i < sampleCount; i++) {
    const t = i * dt
    const fundamental = Math.sin(2 * Math.PI * freq * t)
    const harmonic = Math.sin(4 * Math.PI * freq * t + 0.5) * 0.3
    const variability = simplePerlin(noiseIdx + i * 0.1) * 0.05
    const raw = (fundamental + harmonic) / 1.3
    samples.push(Math.round((raw + variability) * 1000) / 1000)
  }

  return samples
}
