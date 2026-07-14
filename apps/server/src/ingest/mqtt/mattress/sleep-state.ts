interface SleepRecord {
  sn: string
  st: string
  sleepState: string
  time: string
}

export class SleepStateManager {
  private records: SleepRecord[] = []

  update(sn: string, st: string, time: string): string {
    const existing = this.records.find((r) => r.sn === sn)

    if (!existing) {
      this.records.push({ sn, st, sleepState: '0', time })
      return '0'
    }

    if (existing.time === time) {
      existing.st = st
      return existing.sleepState
    }

    if (existing.st !== st) {
      existing.st = st
      existing.time = time
    }

    const timeRecord = new Date(existing.time).getTime()
    const timeNow = new Date(time).getTime()
    const diff = (timeNow - timeRecord) / 1000

    if (st === 'on') {
      if (existing.sleepState === '0' && diff >= 240) {
        existing.sleepState = '1'
      } else if (existing.sleepState === '1' && diff > 420) {
        existing.sleepState = '2'
      } else if (existing.sleepState === '2' && diff > 840) {
        existing.sleepState = '3'
      }
    } else if (st === 'mov') {
      if (existing.sleepState === '2' && diff >= 40) {
        existing.sleepState = '0'
      } else if (existing.sleepState === '3') {
        existing.sleepState = '2'
        if (diff >= 40) {
          existing.sleepState = '0'
        }
      }
    } else if (st === 'off') {
      existing.sleepState = '0'
      existing.time = time
    }

    return existing.sleepState
  }

  getState(sn: string): string {
    return this.records.find((r) => r.sn === sn)?.sleepState ?? '0'
  }
}
