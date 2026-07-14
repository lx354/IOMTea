import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { dashboardResponseSchema } from '@iomtea/shared-types'
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { db } from '../core/db'
import { events, patients } from '../core/db/schema'
import type { AppEnv } from '../core/http/types'
import { jwtAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const dashboard = new OpenAPIHono<AppEnv>()

const summaryRoute = createRoute({
  method: 'get',
  path: '/summary',
  tags: ['Dashboard'],
  middleware: [jwtAuth, requirePermission('/dashboard', 'read')] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: dashboardResponseSchema } },
      description: 'Dashboard summary',
    },
  },
})

dashboard.openapi(summaryRoute, async (c) => {
  const [patientCount] = await db
    .select({ count: sql`count(*)::int`.mapWith(Number) })
    .from(patients)

  const dayAgo = new Date(Date.now() - 86400000)
  const [activeAlerts] = await db
    .select({ count: sql`count(*)::int`.mapWith(Number) })
    .from(events)
    .where(and(sql`${events.kind} = 'alert'`, gte(events.recordedAt, dayAgo)))

  const [criticalAlerts] = await db
    .select({ count: sql`count(*)::int`.mapWith(Number) })
    .from(events)
    .where(and(sql`${events.kind} = 'alert'`, sql`${events.severity} = 'critical'`))

  return c.json({
    patientCount: patientCount?.count ?? 0,
    activeAlerts24h: activeAlerts?.count ?? 0,
    criticalAlerts: criticalAlerts?.count ?? 0,
  })
})

const trendsRoute = createRoute({
  method: 'get',
  path: '/trends',
  tags: ['Dashboard'],
  middleware: [jwtAuth, requirePermission('/dashboard', 'read')] as const,
  request: {
    query: z.object({
      days: z.coerce.number().min(1).max(30).default(7),
    }),
  },
  responses: { 200: { description: 'Alert trend data' } },
})

dashboard.openapi(trendsRoute, async (c) => {
  const { days } = c.req.valid('query')
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const rows = await db
    .select({
      day: sql`date(${events.recordedAt})`.mapWith(String),
      count: sql`count(*)::int`.mapWith(Number),
    })
    .from(events)
    .where(and(eq(events.kind, 'alert'), gte(events.recordedAt, since)))
    .groupBy(sql`date(${events.recordedAt})`)
    .orderBy(sql`date(${events.recordedAt})`)

  return c.json(rows)
})

const recentEventsRoute = createRoute({
  method: 'get',
  path: '/recent-events',
  tags: ['Dashboard'],
  middleware: [jwtAuth, requirePermission('/dashboard', 'read')] as const,
  responses: { 200: { description: 'Recent events timeline' } },
})
dashboard.openapi(recentEventsRoute, async (c) => {
  const rows = await db
    .select({
      id: events.id,
      kind: events.kind,
      metric: events.metric,
      value: events.value,
      patientId: events.patientId,
      source: events.source,
      recordedAt: events.recordedAt,
      tags: events.tags,
    })
    .from(events)
    .orderBy(desc(events.recordedAt))
    .limit(20)

  const patientIds = [...new Set(rows.map((r) => r.patientId))]
  const patientRows = await db
    .select({ id: patients.id, name: patients.name })
    .from(patients)
    .where(patientIds.length > 0 ? inArray(patients.id, patientIds) : undefined)

  const nameMap = new Map(patientRows.map((p) => [p.id, p.name]))
  const formatted = rows.map((r) => ({
    ...r,
    patientName: nameMap.get(r.patientId) ?? r.patientId.slice(0, 8),
  }))

  return c.json(formatted)
})

// ── 患者综合视图 ──

const patientOverviewRoute = createRoute({
  method: 'get',
  path: '/patient/:patientId/overview',
  tags: ['Dashboard'],
  middleware: [jwtAuth, requirePermission('/dashboard', 'read')] as const,
  responses: { 200: { description: 'Patient overview data' } },
})
dashboard.openapi(patientOverviewRoute, async (c) => {
  const { patientId } = c.req.param()

  const latestResult = await db.execute(sql`
    SELECT DISTINCT ON (metric) metric, value, unit, recorded_at
    FROM events WHERE patient_id = ${patientId} AND kind = 'observation' AND value IS NOT NULL
    ORDER BY metric, recorded_at DESC
  `)
  const latestVitals = latestResult as unknown as Array<{ metric: string; value: unknown; unit: string | null; recorded_at: Date }>

  const trendResult = await db.execute(sql`
    SELECT date(recorded_at) AS day, metric, round(avg((value::jsonb)::numeric)::numeric, 1) AS avg_value
    FROM events WHERE patient_id = ${patientId} AND kind = 'observation' AND metric IN ('heart_rate','spo2','systolic_bp')
      AND recorded_at >= now() - interval '7 days'
    GROUP BY day, metric ORDER BY day, metric
  `)
  const trends = trendResult as unknown as Array<{ day: string; metric: string; avg_value: number }>

  const behaviorResult = await db.execute(sql`
    SELECT value, tags, recorded_at FROM events
    WHERE patient_id = ${patientId} AND kind = 'observation' AND metric = 'behavior'
    ORDER BY recorded_at DESC LIMIT 10
  `)
  const behaviors = behaviorResult as unknown as Array<{ value: string; tags: unknown; recorded_at: Date }>

  const alertResult = await db.execute(sql`
    SELECT id, metric, value, severity, source, recorded_at, tags FROM events
    WHERE patient_id = ${patientId} AND (kind = 'alert' OR kind = 'state_transition')
    ORDER BY recorded_at DESC LIMIT 10
  `)
  const alerts = alertResult as unknown as Array<{ id: string; metric: string; value: unknown; severity: string | null; source: string | null; recorded_at: Date; tags: unknown }>

  const chatResult = await db.execute(sql`
    SELECT tags, recorded_at FROM events
    WHERE patient_id = ${patientId} AND metric = 'chat_assessment'
    ORDER BY recorded_at DESC LIMIT 5
  `)
  const chats = chatResult as unknown as Array<{ tags: unknown; recorded_at: Date }>

  return c.json({ latestVitals, trends, behaviors, alerts, chats })
})

// ── 智慧建议 ──

const suggestionsRoute = createRoute({
  method: 'get', path: '/suggestions/:patientId', tags: ['Dashboard'],
  middleware: [jwtAuth, requirePermission('/dashboard', 'read')] as const,
  responses: { 200: { description: 'Smart suggestions list' } },
})
dashboard.openapi(suggestionsRoute, async (c) => {
  const { patientId } = c.req.param()
  const [patient] = await db.execute(sql`SELECT name, tags FROM patients WHERE id = ${patientId} LIMIT 1`) as any[]

  // 构建 PatientData
  const vitals = await db.execute(sql`SELECT DISTINCT ON (metric) metric, value FROM events WHERE patient_id = ${patientId} AND kind = 'observation' AND value IS NOT NULL ORDER BY metric, recorded_at DESC`) as any[]
  const lv: Record<string, number> = {}
  for (const r of vitals) { if (typeof r.value === 'number') lv[r.metric] = r.value }

  const behaviors = await db.execute(sql`SELECT value FROM events WHERE patient_id = ${patientId} AND kind = 'observation' AND metric = 'behavior' ORDER BY recorded_at DESC LIMIT 10`) as any[]

  const chat = await db.execute(sql`SELECT tags FROM events WHERE patient_id = ${patientId} AND metric = 'chat_assessment' ORDER BY recorded_at DESC LIMIT 1`) as any[]
  const tags = chat[0]?.tags as any

  const falls = await db.execute(sql`SELECT COUNT(*) as cnt FROM events WHERE patient_id = ${patientId} AND kind = 'observation' AND metric = 'behavior' AND value = 'falling' AND recorded_at >= now() - interval '24 hours'`) as any[]

  const { generateSuggestions } = await import('../modules/suggestions/engine')
  const data = {
    patientId, patientName: patient?.name || '患者',
    profileId: (patient?.tags as any)?.profileId as string,
    latestVitals: lv,
    recentBehaviors: [...new Set(behaviors.map((b: any) => b.value))],
    lastChatMmse: tags?.mmse as number, lastChatMood: tags?.mood as string,
    fallEvents24h: Number(falls[0]?.cnt || 0),
    timeSinceLastActivity: 120,
    emotionTrend: 'stable' as const,
  }
  const suggestions = generateSuggestions(data)
  return c.json(suggestions)
})

const suggestionFeedbackRoute = createRoute({
  method: 'post', path: '/suggestions/:suggestionId/feedback', tags: ['Dashboard'],
  middleware: [jwtAuth] as const,
  request: { body: { content: { 'application/json': { schema: z.object({ action: z.enum(['adopted', 'dismissed', 'expired']) }) } } } },
  responses: { 200: { description: 'Feedback recorded' } },
})
dashboard.openapi(suggestionFeedbackRoute, async (c) => {
  const { suggestionId } = c.req.param()
  const { action } = c.req.valid('json')
  return c.json({ success: true, id: suggestionId, status: action })
})

// ── 知识图谱 ──

const knowledgeGraphRoute = createRoute({
  method: 'get', path: '/knowledge-graph', tags: ['Dashboard'],
  middleware: [jwtAuth, requirePermission('/dashboard', 'read')] as const,
  responses: { 200: { description: 'Knowledge graph data' } },
})
dashboard.openapi(knowledgeGraphRoute, async (c) => {
  const { getGraph } = await import('../modules/suggestions/knowledge-graph')
  return c.json(getGraph())
})

const graphQueryRoute = createRoute({
  method: 'get', path: '/knowledge-graph/:caseId', tags: ['Dashboard'],
  middleware: [jwtAuth, requirePermission('/dashboard', 'read')] as const,
  responses: { 200: { description: 'Graph nodes for a case' } },
})
dashboard.openapi(graphQueryRoute, async (c) => {
  const { caseId } = c.req.param()
  const { queryRelatedNodes } = await import('../modules/suggestions/knowledge-graph')
  return c.json(queryRelatedNodes(caseId))
})

// ── 多模态融合评分 ──

const fusionScoreRoute = createRoute({
  method: 'get', path: '/fusion-score/:patientId', tags: ['Dashboard'],
  middleware: [jwtAuth, requirePermission('/dashboard', 'read')] as const,
  responses: { 200: { description: 'Fusion safety index' } },
})
dashboard.openapi(fusionScoreRoute, async (c) => {
  const { patientId } = c.req.param()
  const [patient] = await db.execute(sql`SELECT name, tags FROM patients WHERE id = ${patientId} LIMIT 1`) as any[]
  const vitals = await db.execute(sql`SELECT DISTINCT ON (metric) metric, value FROM events WHERE patient_id = ${patientId} AND kind = 'observation' AND value IS NOT NULL ORDER BY metric, recorded_at DESC`) as any[]
  const lv: Record<string, number> = {}
  for (const r of vitals) { if (typeof r.value === 'number') lv[r.metric] = r.value }
  const behaviors = await db.execute(sql`SELECT value FROM events WHERE patient_id = ${patientId} AND kind = 'observation' AND metric = 'behavior' AND recorded_at >= now() - interval '24 hours'`) as any[]
  const posture = await db.execute(sql`SELECT value FROM events WHERE patient_id = ${patientId} AND metric = 'posture' ORDER BY recorded_at DESC LIMIT 1`) as any[]
  const chat = await db.execute(sql`SELECT tags FROM events WHERE patient_id = ${patientId} AND metric = 'chat_assessment' ORDER BY recorded_at DESC LIMIT 1`) as any[]
  const alertCount = await db.execute(sql`SELECT COUNT(*) as cnt FROM events WHERE patient_id = ${patientId} AND kind = 'alert' AND recorded_at >= now() - interval '24 hours'`) as any[]
  const tags = chat[0]?.tags as any
  let postureScore: number | null = null
  try { const pv = posture[0]?.value; if (typeof pv === 'string') postureScore = JSON.parse(pv).overallScore }
  catch { postureScore = null }

  const { computeFusionScore } = await import('../modules/suggestions/fusion-score')
  const report = computeFusionScore({
    patientId, patientName: patient?.name || '患者',
    profileId: (patient?.tags as any)?.profileId,
    vitals: lv,
    behaviors24h: [...new Set(behaviors.map((b: any) => b.value))],
    postureScore,
    cognitiveScore: tags?.mmse,
    moodStatus: tags?.mood,
    recentAlerts: Number(alertCount[0]?.cnt || 0),
  })
  return c.json(report)
})

export { dashboard }
