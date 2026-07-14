export interface MattressPayload {
  sn: string
  hb?: number
  br?: number
  od?: number
  p?: string
  st?: string
  we?: number
  wt?: string
  fv?: number
  time?: string
}

export interface MattressEvent {
  patientId: string
  deviceId: string
  kind: 'observation' | 'alert'
  metric: string
  value: number | null
  unit: string | null
  severity?: 'critical' | 'warning' | 'info'
  status?: 'active'
  tags: Record<string, unknown>
  recordedAt: Date
}

export function parseMattressPayload(
  payload: MattressPayload,
  patientId: string,
  deviceId: string,
  recordedAt: Date,
): MattressEvent[] {
  const events: MattressEvent[] = []
  const base = { patientId, deviceId, recordedAt }
  const tags: Record<string, unknown> = {
    protocol: 'mattress',
    fv: payload.fv,
    raw_sn: payload.sn,
  }

  // Heart rate
  if (payload.hb !== undefined && payload.hb !== null && payload.hb !== 255 && payload.hb !== -1) {
    events.push({
      ...base, kind: 'observation', metric: 'heart_rate', value: payload.hb, unit: 'bpm', tags: { ...tags, source: 'mattress_piezo' },
    })
  }

  // Breath rate
  if (payload.br !== undefined && payload.br !== null && payload.br !== 255 && payload.br !== -1) {
    events.push({
      ...base, kind: 'observation', metric: 'resp_rate', value: payload.br, unit: 'rpm', tags: { ...tags, source: 'mattress_piezo' },
    })
  }

  // Bed status
  const st = payload.st || 'off'
  const bedStatusValue = st === 'mov' ? 1 : st === 'on' ? 1 : 0
  events.push({
    ...base, kind: 'observation', metric: 'bed_status', value: bedStatusValue, unit: null,
    tags: { ...tags, raw_status: st },
  })

  // Position
  if (payload.p) {
    const match = payload.p.match(/\[(\d+),(\d+)\]/)
    if (match) {
      events.push({
        ...base, kind: 'observation', metric: 'position_x', value: Number(match[1]), unit: null, tags,
      })
      events.push({
        ...base, kind: 'observation', metric: 'position_y', value: Number(match[2]), unit: null, tags,
      })
    }
  }

  // Weight
  if (payload.we !== undefined && payload.we !== 255 && payload.we !== -1) {
    events.push({
      ...base, kind: 'observation', metric: 'weight', value: payload.we, unit: 'kg', tags: { ...tags, source: 'mattress_load_cell' },
    })
  }

  // Wetness
  if (payload.wt !== undefined) {
    events.push({
      ...base, kind: 'observation', metric: 'wetness', value: payload.wt === '1' ? 1 : 0, unit: null, tags,
    })
    if (payload.wt === '1') {
      events.push({
        ...base, kind: 'alert', metric: 'wetness', value: 1, unit: null, severity: 'warning', status: 'active',
        tags: { ...tags, message: '尿湿告警' },
      })
    }
  }

  // OD sensor value
  if (payload.od !== undefined && payload.od !== 255 && payload.od !== -1) {
    events.push({
      ...base, kind: 'observation', metric: 'od_value', value: payload.od, unit: null, tags,
    })
  }

  return events
}
