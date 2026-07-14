export function generateECGSamples(hr: number): number[] {
  const samples: number[] = []
  const sampleCount = 50
  const rrInterval = 60 / hr
  const totalDuration = rrInterval
  const dt = totalDuration / sampleCount

  for (let i = 0; i < sampleCount; i++) {
    let t = i * dt

    const phase = t / totalDuration

    const pCenter = 0.20
    const pWidth = 0.04
    const pAmplitude = 0.15
    const pWave = pAmplitude * Math.exp(-Math.pow((phase - pCenter) / pWidth, 2))

    const qrsCenter = 0.35
    const qrsWidth = 0.015
    const qrsAmplitude = 1.0
    const qrsWave = qrsAmplitude * Math.exp(-Math.pow((phase - qrsCenter) / qrsWidth, 2))
    const qDip = -0.2 * Math.exp(-Math.pow((phase - 0.32) / 0.008, 2))
    const sDip = -0.3 * Math.exp(-Math.pow((phase - 0.38) / 0.008, 2))

    const tCenter = 0.60
    const tWidth = 0.06
    const tAmplitude = 0.3
    const tWave = tAmplitude * Math.exp(-Math.pow((phase - tCenter) / tWidth, 2))

    const value = pWave + qDip + qrsWave + sDip + tWave
    samples.push(Math.round(value * 1000) / 1000)
  }

  return samples
}
