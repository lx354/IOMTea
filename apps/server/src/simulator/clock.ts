export class SimulationClock {
  speed = 1
  tick = 0
  startedAt: Date | null = null
  private _running = false
  seed: number

  constructor(seed?: number) {
    this.seed = seed ?? Date.now()
  }

  get simulatedTime(): Date {
    if (!this.startedAt) return new Date()
    const elapsed = (Date.now() - this.startedAt.getTime()) * this.speed
    return new Date(this.startedAt.getTime() + elapsed)
  }

  get hourOfDay(): number {
    return this.simulatedTime.getHours() + this.simulatedTime.getMinutes() / 60
  }

  get isNightTime(): boolean {
    const h = this.hourOfDay
    return h < 6 || h > 21
  }

  get running(): boolean {
    return this._running
  }

  start(): void {
    this.startedAt = new Date()
    this._running = true
  }

  pause(): void {
    this._running = false
  }

  advance(): void {
    if (this._running) this.tick++
  }
}
