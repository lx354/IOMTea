function gaussian(mean: number, std: number): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function generateGlucose(
  fastingBaseline: number,
  variability: number,
  postprandialSpike: number,
  hourOfDay: number,
  mealTimes: { time: string }[],
  simMinutes: number,
): number {
  let postprandialEffect = 0
  for (const meal of mealTimes) {
    const [h, m] = meal.time.split(':').map(Number)
    const mealMin = h * 60 + m
    const elapsed = simMinutes - mealMin
    if (elapsed >= 0 && elapsed < 180) {
      const peak = fastingBaseline + postprandialSpike
      const decay = peak - fastingBaseline
      const factor = elapsed < 30
        ? elapsed / 30
        : Math.exp(-(elapsed - 30) / 60)
      postprandialEffect += decay * factor
    }
  }
  const hour = Math.floor(hourOfDay)
  const nocturnalDrift = (hour >= 23 || hour < 5)
    ? -0.5 - Math.random() * 1.0
    : 0
  const noise = gaussian(0, variability)
  return Math.round((fastingBaseline + postprandialEffect + nocturnalDrift + noise) * 10) / 10
}
