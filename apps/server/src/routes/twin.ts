import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import {
  profileResponseSchema,
  simulationResponseSchema,
  successSchema,
} from '@iomtea/shared-types'
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { db } from '../core/db'
import { events, patients } from '../core/db/schema'
import type { AppEnv } from '../core/http/types'
import { createChildLogger } from '../core/lib/logger'
import { jwtAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'
import { evaluatePatientState } from '../modules/twin/state-machine'
import type { PatientStatusResult } from '../modules/twin/state-machine'
import {
  addPatient,
  createSimulation,
  deleteSimulation,
  getProfile,
  getSimulation,
  getSimulations,
  injectScenario,
  listProfiles,
  removePatient,
  renameSim,
  setSpeed,
  toggleMetric,
  toggleSimulation,
  updateMetric,
} from '../modules/twin'

const routeLogger = createChildLogger('twin-routes')

const twinRouter = new OpenAPIHono<AppEnv>()

const profListRoute = createRoute({
  method: 'get',
  path: '/profiles',
  tags: ['Twin'],
  middleware: [jwtAuth, requirePermission('/twin', 'read')] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(profileResponseSchema) } },
      description: 'Profile list',
    },
  },
})
twinRouter.openapi(profListRoute, async (c) => c.json(listProfiles()))

const profDetailRoute = createRoute({
  method: 'get',
  path: '/profiles/:name',
  tags: ['Twin'],
  middleware: [jwtAuth, requirePermission('/twin', 'read')] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: profileResponseSchema } },
      description: 'Profile config',
    },
    404: { description: 'Not found' },
  },
})
twinRouter.openapi(profDetailRoute, async (c) => {
  const config = getProfile(c.req.param('name'))
  if (!config) throw new HTTPException(404)
  return c.json(config)
})

const simListRoute = createRoute({
  method: 'get',
  path: '/simulations',
  tags: ['Twin'],
  middleware: [jwtAuth, requirePermission('/twin', 'read')] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(simulationResponseSchema) } },
      description: 'Simulation list',
    },
  },
})
twinRouter.openapi(simListRoute, async (c) => c.json(getSimulations()))

const simDetailRoute = createRoute({
  method: 'get',
  path: '/simulations/:id',
  tags: ['Twin'],
  middleware: [jwtAuth, requirePermission('/twin', 'read')] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: simulationResponseSchema } },
      description: 'Simulation detail',
    },
    404: { description: 'Not found' },
  },
})
twinRouter.openapi(simDetailRoute, async (c) => {
  const sim = getSimulation(c.req.param('id'))
  if (!sim) throw new HTTPException(404)
  return c.json(sim)
})

const simCreateRoute = createRoute({
  method: 'post',
  path: '/simulations',
  tags: ['Twin'],
  middleware: [jwtAuth, requirePermission('/twin', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            profile: z.string().openapi({ example: 'elderly-cardiac' }),
            name: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: simulationResponseSchema } },
      description: 'Created',
    },
    500: { description: 'Creation failed' },
  },
})
twinRouter.openapi(simCreateRoute, async (c) => {
  const body = c.req.valid('json')
  const sim = await createSimulation(db, {
    profileName: body.profile,
    name: body.name ?? body.profile,
  })
  if (!sim) return c.json({ error: 'Failed to create simulation' }, 500)
  return c.json(sim, 201)
})

const simDeleteRoute = createRoute({
  method: 'delete',
  path: '/simulations/:id',
  tags: ['Twin'],
  middleware: [jwtAuth, requirePermission('/twin', 'write')] as const,
  responses: {
    200: { content: { 'application/json': { schema: successSchema } }, description: 'Deleted' },
  },
})
twinRouter.openapi(simDeleteRoute, async (c) => {
  await deleteSimulation(db, c.req.param('id'))
  return c.json({ success: true })
})

const simToggleRoute = createRoute({
  method: 'post',
  path: '/simulations/:id/toggle',
  tags: ['Twin'],
  middleware: [jwtAuth, requirePermission('/twin', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            running: z.boolean(),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: successSchema } }, description: 'Toggled' },
  },
})
twinRouter.openapi(simToggleRoute, async (c) => {
  const body = c.req.valid('json')
  await toggleSimulation(db, c.req.param('id'), body.running)
  return c.json({ success: true })
})

const simRenameRoute = createRoute({
  method: 'patch',
  path: '/simulations/:id/rename',
  tags: ['Twin'],
  middleware: [jwtAuth, requirePermission('/twin', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: successSchema } }, description: 'Renamed' },
  },
})
twinRouter.openapi(simRenameRoute, async (c) => {
  const body = c.req.valid('json')
  await renameSim(db, c.req.param('id'), body.name)
  return c.json({ success: true })
})

const simMetricToggleRoute = createRoute({
  method: 'post',
  path: '/simulations/:id/metrics/:metricName/toggle',
  tags: ['Twin'],
  middleware: [jwtAuth, requirePermission('/twin', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            enabled: z.boolean(),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: successSchema } }, description: 'Toggled' },
  },
})
twinRouter.openapi(simMetricToggleRoute, async (c) => {
  const body = c.req.valid('json')
  await toggleMetric(db, c.req.param('id'), c.req.param('metricName'), body.enabled)
  return c.json({ success: true })
})

const simMetricUpdateRoute = createRoute({
  method: 'patch',
  path: '/simulations/:id/metrics/:metricName',
  tags: ['Twin'],
  middleware: [jwtAuth, requirePermission('/twin', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            intervalMin: z.number().optional(),
            intervalMax: z.number().optional(),
            jitter: z.number().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: successSchema } }, description: 'Updated' },
  },
})
twinRouter.openapi(simMetricUpdateRoute, async (c) => {
  const body = c.req.valid('json')
  await updateMetric(db, c.req.param('id'), c.req.param('metricName'), body)
  return c.json({ success: true })
})

const simAddPatientRoute = createRoute({
  method: 'post',
  path: '/simulations/:id/patients',
  tags: ['Twin'],
  middleware: [jwtAuth, requirePermission('/twin', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            patientId: z.string().uuid(),
          }),
        },
      },
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: successSchema } }, description: 'Added' },
  },
})
twinRouter.openapi(simAddPatientRoute, async (c) => {
  const body = c.req.valid('json')
  const patientId = body.patientId
  const patientName =
    (await db.select().from(patients).where(eq(patients.id, patientId)).limit(1))[0]?.name ??
    patientId
  await addPatient(db, c.req.param('id'), { id: patientId, name: patientName })
  return c.json({ success: true }, 201)
})

const simRemovePatientRoute = createRoute({
  method: 'delete',
  path: '/simulations/:id/patients/:patientId',
  tags: ['Twin'],
  middleware: [jwtAuth, requirePermission('/twin', 'write')] as const,
  responses: {
    200: { content: { 'application/json': { schema: successSchema } }, description: 'Removed' },
  },
})
twinRouter.openapi(simRemovePatientRoute, async (c) => {
  await removePatient(db, c.req.param('id'), c.req.param('patientId'))
  return c.json({ success: true })
})

const speedRoute = createRoute({
  method: 'patch',
  path: '/speed',
  tags: ['Twin'],
  middleware: [jwtAuth, requirePermission('/twin', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            speed: z.number().min(0.1).max(100),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ speed: z.number() }) } },
      description: 'Speed set',
    },
  },
})
twinRouter.openapi(speedRoute, async (c) => {
  const body = c.req.valid('json')
  setSpeed(body.speed)
  return c.json({ speed: body.speed })
})

const scenarioRoute = createRoute({
  method: 'post',
  path: '/simulations/:id/patients/:patientId/scenario',
  tags: ['Twin'],
  middleware: [jwtAuth, requirePermission('/twin', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            type: z.string().openapi({ example: 'tachycardia' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: successSchema } },
      description: 'Scenario injected',
    },
  },
})
twinRouter.openapi(scenarioRoute, async (c) => {
  const body = c.req.valid('json')
  await injectScenario(db, c.req.param('id'), c.req.param('patientId'), body.type)
  return c.json({ success: true })
})

const statusMatrixRoute = createRoute({
  method: 'get',
  path: '/status-matrix',
  tags: ['Twin'],
  middleware: [jwtAuth, requirePermission('/twin', 'read')] as const,
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(z.object({
            patientId: z.string(),
            patientName: z.string(),
            overallState: z.enum(['stable', 'watch', 'alert', 'emergency']),
            dimensions: z.record(z.object({ value: z.unknown(), status: z.enum(['normal', 'warning', 'critical', 'no_data']) })),
            timestamp: z.string(),
          })),
        },
      },
      description: 'Patient status matrix',
    },
  },
})
twinRouter.openapi(statusMatrixRoute, async (c) => {
  const activePatients = await db
    .select({ id: patients.id, name: patients.name })
    .from(patients)
    .where(eq(patients.status, 'active'))

  const results: Array<PatientStatusResult & { patientName: string }> = []

  for (const patient of activePatients) {
    const latestEvents = await db
      .select({
        metric: events.metric,
        value: events.value,
        unit: events.unit,
        recordedAt: events.recordedAt,
      })
      .from(events)
      .where(
        and(
          eq(events.patientId, patient.id),
          eq(events.kind, 'observation'),
        ),
      )
      .orderBy(desc(events.recordedAt))
      .limit(200)

    const vitals: Record<string, unknown> = {}
    for (const evt of latestEvents) {
      if (!(evt.metric in vitals)) {
        vitals[evt.metric] = evt.value
      }
    }

    const state = evaluatePatientState(patient.id, vitals)
    results.push({ ...state, patientName: patient.name })
  }

  return c.json(results)
})

const stateTransitionsRoute = createRoute({
  method: 'get',
  path: '/state-transitions/:patientId',
  tags: ['Twin'],
  middleware: [jwtAuth, requirePermission('/twin', 'read')] as const,
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string(),
            metric: z.string(),
            value: z.unknown(),
            recordedAt: z.string(),
          })),
        },
      },
      description: 'State transition history',
    },
  },
})
twinRouter.openapi(stateTransitionsRoute, async (c) => {
  const patientId = c.req.param('patientId')
  const rows = await db
    .select({
      id: events.id,
      metric: events.metric,
      value: events.value,
      recordedAt: events.recordedAt,
    })
    .from(events)
    .where(
      and(
        eq(events.patientId, patientId),
        eq(events.kind, 'state_transition'),
      ),
    )
    .orderBy(desc(events.recordedAt))
    .limit(50)

  return c.json(
    rows.map((r) => ({ ...r, recordedAt: r.recordedAt.toISOString() })),
  )
})

const mlTimeseriesRoute = createRoute({
  method: 'get',
  path: '/ml-timeseries/:patientId',
  tags: ['Twin'],
  middleware: [jwtAuth, requirePermission('/twin', 'read')] as const,
  request: {
    query: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
      metrics: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(z.object({
            timestamp: z.string(),
            metric: z.string(),
            value: z.unknown(),
            unit: z.string().nullable(),
          })),
        },
      },
      description: 'ML time-series data',
    },
  },
})
twinRouter.openapi(mlTimeseriesRoute, async (c) => {
  const patientId = c.req.param('patientId')
  const { start, end, metrics } = c.req.valid('query')

  const conditions: ReturnType<typeof and>[] = [
    eq(events.patientId, patientId),
    eq(events.kind, 'observation'),
  ]

  if (start) conditions.push(gte(events.recordedAt, new Date(start)))
  if (end) conditions.push(lte(events.recordedAt, new Date(end)))

  if (metrics) {
    const metricList = metrics.split(',').map((m) => m.trim()).filter(Boolean)
    if (metricList.length > 0) {
      conditions.push(inArray(events.metric, metricList))
    }
  }

  const rows = await db
    .select({
      recordedAt: events.recordedAt,
      metric: events.metric,
      value: events.value,
      unit: events.unit,
    })
    .from(events)
    .where(and(...conditions))
    .orderBy(desc(events.recordedAt))
    .limit(1000)

  return c.json(
    rows.map((r) => ({
      timestamp: r.recordedAt.toISOString(),
      metric: r.metric,
      value: r.value,
      unit: r.unit,
    })),
  )
})

const mlExportRoute = createRoute({
  method: 'get',
  path: '/ml-export',
  tags: ['Twin'],
  middleware: [jwtAuth, requirePermission('/twin', 'write')] as const,
  request: {
    query: z.object({
      format: z.enum(['csv', 'json']).default('json'),
      start: z.string().optional(),
      end: z.string().optional(),
      patientId: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'ML data export',
    },
  },
})
twinRouter.openapi(mlExportRoute, async (c) => {
  const { format, start, end, patientId } = c.req.valid('query')

  const conditions: ReturnType<typeof and>[] = []

  if (patientId) conditions.push(eq(events.patientId, patientId))
  if (start) conditions.push(gte(events.recordedAt, new Date(start)))
  if (end) conditions.push(lte(events.recordedAt, new Date(end)))

  const rows = await db
    .select({
      patientId: events.patientId,
      metric: events.metric,
      value: events.value,
      unit: events.unit,
      recordedAt: events.recordedAt,
      kind: events.kind,
      source: events.source,
    })
    .from(events)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(events.recordedAt))
    .limit(5000)

  if (format === 'csv') {
    const header = 'timestamp,patientId,kind,metric,value,unit,source'
    const csvRows = rows.map(
      (r) =>
        `${r.recordedAt.toISOString()},${r.patientId},${r.kind},${r.metric},${typeof r.value === 'string' ? `"${r.value}"` : String(r.value ?? '')},${r.unit ?? ''},${r.source}`,
    )
    return c.text([header, ...csvRows].join('\n'), 200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="iomtea-export.csv"',
    })
  }

  return c.json(rows)
})

const mlFeaturesRoute = createRoute({
  method: 'post',
  path: '/ml-features',
  tags: ['Twin'],
  middleware: [jwtAuth, requirePermission('/twin', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            patientId: z.string(),
            metric: z.string(),
            window: z.number().min(1).max(1440).default(10),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            avg: z.number().nullable(),
            min: z.number().nullable(),
            max: z.number().nullable(),
            trend: z.number().nullable(),
            volatility: z.number().nullable(),
            count: z.number(),
          }),
        },
      },
      description: 'Window aggregation features',
    },
  },
})
twinRouter.openapi(mlFeaturesRoute, async (c) => {
  const { patientId, metric, window: windowMin } = c.req.valid('json')
  const since = new Date(Date.now() - windowMin * 60 * 1000)

  const rawValues = await db
    .select({ value: events.value, recordedAt: events.recordedAt })
    .from(events)
    .where(
      and(
        eq(events.patientId, patientId),
        eq(events.metric, metric),
        gte(events.recordedAt, since),
      ),
    )
    .orderBy(desc(events.recordedAt))

  const numericValues: number[] = []
  const timestamps: number[] = []
  for (const r of rawValues) {
    const v = typeof r.value === 'number' ? r.value : Number(r.value)
    if (!isNaN(v)) {
      numericValues.push(v)
      timestamps.push(r.recordedAt.getTime())
    }
  }

  const count = numericValues.length
  if (count === 0) {
    return c.json({ avg: null, min: null, max: null, trend: null, volatility: null, count: 0 })
  }

  const sum = numericValues.reduce((a, b) => a + b, 0)
  const avg = sum / count
  const min = Math.min(...numericValues)
  const max = Math.max(...numericValues)

  const variance = numericValues.reduce((acc, v) => acc + (v - avg) ** 2, 0) / count
  const volatility = Math.sqrt(variance)

  let trend: number | null = null
  if (count >= 2) {
    const meanT = timestamps.reduce((a, b) => a + b, 0) / count
    const meanV = avg
    const num = timestamps.reduce((acc, t, i) => acc + (t - meanT) * (numericValues[i] - meanV), 0)
    const den = timestamps.reduce((acc, t) => acc + (t - meanT) ** 2, 0)
    if (den !== 0) trend = num / den
  }

  return c.json({ avg, min, max, trend, volatility, count })
})

const stateLabelsRoute = createRoute({
  method: 'get',
  path: '/state-labels/:patientId',
  tags: ['Twin'],
  middleware: [jwtAuth, requirePermission('/twin', 'read')] as const,
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(z.object({
            timestamp: z.string(),
            state: z.string(),
            duration: z.number().nullable(),
          })),
        },
      },
      description: 'State labels for ML training',
    },
  },
})
twinRouter.openapi(stateLabelsRoute, async (c) => {
  const patientId = c.req.param('patientId')

  const rows = await db
    .select({
      value: events.value,
      recordedAt: events.recordedAt,
    })
    .from(events)
    .where(
      and(
        eq(events.patientId, patientId),
        eq(events.kind, 'state_transition'),
      ),
    )
    .orderBy(events.recordedAt)

  const labels: Array<{ timestamp: string; state: string; duration: number | null }> = []
  for (let i = 0; i < rows.length; i++) {
    const state = typeof rows[i].value === 'string' ? rows[i].value : String(rows[i].value ?? '')
    const ts = rows[i].recordedAt.toISOString()
    const nextTs = i + 1 < rows.length ? rows[i + 1].recordedAt.getTime() : null
    const duration = nextTs !== null ? (nextTs - rows[i].recordedAt.getTime()) / 1000 : null
    labels.push({ timestamp: ts, state, duration })
  }

  return c.json(labels)
})

export { twinRouter }
