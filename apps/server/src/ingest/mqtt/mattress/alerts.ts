import type { MattressPayload, MattressEvent } from './parser'

interface ThresholdCounter {
  sn: string
  metric: string
  count: number
}

export class AlertEngine {
  private heartbeatCounts: ThresholdCounter[] = []
  private breathCounts: ThresholdCounter[] = []
  private lastPosition: Map<string, string> = new Map()
  private positionUnchangedSince: Map<string, Date> = new Map()
  private offSince: Map<string, Date> = new Map()
  private abnormalCount: Map<string, number> = new Map()

  private readonly HEART_MAX = 130
  private readonly HEART_MIN = 45
  private readonly BREATH_MAX = 30
  private readonly BREATH_MIN = 8
  private readonly THRESHOLD_COUNT = 3  // consecutive hits before alert
  private readonly BEDSORE_MINUTES = 120
  private readonly POSITION_THRESHOLD = 2  // Manhattan distance

  process(payload: MattressPayload, now: Date): MattressEvent[] {
    const sn = payload.sn
    const alerts: MattressEvent[] = []

    // Heart rate alerts
    if (payload.hb !== undefined && payload.hb !== 255 && payload.hb !== -1) {
      const hbAbnormal = payload.hb > this.HEART_MAX || payload.hb < this.HEART_MIN
      this.tickCounter(this.heartbeatCounts, sn, 'heart_rate', hbAbnormal)
      if (this.getCount(this.heartbeatCounts, sn) >= this.THRESHOLD_COUNT) {
        alerts.push(this.makeAlert(sn, 'heart_rate', 'heart_rate_abnormal', payload.hb, payload.hb > this.HEART_MAX ? 'warning' : 'critical',
          payload.hb > this.HEART_MAX ? '心动过速' : '心动过缓', now))
        this.resetCounter(this.heartbeatCounts, sn)
      }
    }

    // Breath rate alerts
    if (payload.br !== undefined && payload.br !== 255 && payload.br !== -1) {
      const brAbnormal = payload.br > this.BREATH_MAX || payload.br < this.BREATH_MIN
      this.tickCounter(this.breathCounts, sn, 'resp_rate', brAbnormal)
      if (this.getCount(this.breathCounts, sn) >= this.THRESHOLD_COUNT) {
        alerts.push(this.makeAlert(sn, 'resp_rate', 'resp_rate_abnormal', payload.br, 'warning', '呼吸异常', now))
        this.resetCounter(this.breathCounts, sn)
      }
    }

    // Bed exit alert
    if (payload.st === 'off') {
      if (!this.offSince.has(sn)) {
        this.offSince.set(sn, now)
      }
    } else {
      this.offSince.delete(sn)
    }

    // Pressure ulcer alert (position unchanged > BEDSORE_MINUTES)
    if (payload.p) {
      const prevPos = this.lastPosition.get(sn)
      if (prevPos) {
        const prev = this.parsePosition(prevPos)
        const curr = this.parsePosition(payload.p)
        const dist = Math.abs(prev.x - curr.x) + Math.abs(prev.y - curr.y)
        if (dist < this.POSITION_THRESHOLD) {
          const since = this.positionUnchangedSince.get(sn)
          if (since) {
            const minutes = (now.getTime() - since.getTime()) / 60000
            if (minutes >= this.BEDSORE_MINUTES) {
              alerts.push(this.makeAlert(sn, 'position', 'pressure_ulcer_risk', null, 'warning', '褥疮风险：超过120分钟未翻身', now))
              this.positionUnchangedSince.set(sn, now) // reset timer after alert
            }
          } else {
            this.positionUnchangedSince.set(sn, now)
          }
        } else {
          this.positionUnchangedSince.set(sn, now)
        }
      }
      this.lastPosition.set(sn, payload.p)
    }

    // Abnormal detection (we > 17 && st === 'off')
    if (payload.we !== undefined && payload.we > 17 && payload.st === 'off') {
      const count = (this.abnormalCount.get(sn) || 0) + 1
      this.abnormalCount.set(sn, count)
      if (count >= 10) {
        alerts.push(this.makeAlert(sn, 'status', 'device_abnormal', null, 'warning', '设备异常：离床但承重偏高', now))
        this.abnormalCount.set(sn, 0)
      }
    } else {
      this.abnormalCount.set(sn, 0)
    }

    return alerts
  }

  private tickCounter(counters: ThresholdCounter[], sn: string, metric: string, abnormal: boolean): void {
    const existing = counters.find((c) => c.sn === sn)
    if (existing) {
      if (abnormal) existing.count++
      else existing.count = 0
    } else if (abnormal) {
      counters.push({ sn, metric, count: 1 })
    }
  }

  private getCount(counters: ThresholdCounter[], sn: string): number {
    return counters.find((c) => c.sn === sn)?.count ?? 0
  }

  private resetCounter(counters: ThresholdCounter[], sn: string): void {
    const c = counters.find((c2) => c2.sn === sn)
    if (c) c.count = 0
  }

  private makeAlert(
    sn: string, metric: string, type: string, value: number | null,
    severity: 'critical' | 'warning' | 'info', message: string, now: Date,
  ): MattressEvent {
    return {
      patientId: '', deviceId: '', // filled by caller
      kind: 'alert', metric, value, unit: null, severity, status: 'active',
      tags: { sn, alert_type: type, message, protocol: 'mattress' },
      recordedAt: now,
    }
  }

  private parsePosition(p: string): { x: number; y: number } {
    const match = p.match(/\[(\d+),(\d+)\]/)
    if (match) return { x: Number(match[1]), y: Number(match[2]) }
    return { x: 0, y: 0 }
  }
}
