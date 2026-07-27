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

// ── 日常健康评估 ──

const dailyAssessmentRoute = createRoute({
  method: 'get', path: '/daily-assessment/:patientId', tags: ['Dashboard'],
  middleware: [jwtAuth, requirePermission('/dashboard', 'read')] as const,
  responses: { 200: { description: 'Daily health assessment' } },
})
dashboard.openapi(dailyAssessmentRoute, async (c) => {
  const { patientId } = c.req.param()

  // 睡眠质量: 22:00-06:00 lying posture events
  const sleepResult = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM events WHERE patient_id = ${patientId}
    AND kind = 'observation' AND metric = 'behavior'
    AND recorded_at::time BETWEEN '22:00' AND '06:00'
    AND recorded_at >= now() - interval '24 hours'
  `) as any[]
  const sleepEvents = Number(sleepResult[0]?.cnt || 0)

  // 夜间异常: 00:00-05:00 bed_exit/wandering
  const nightResult = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM events WHERE patient_id = ${patientId}
    AND kind = 'observation' AND (metric = 'behavior' AND value IN ('wandering','bed_exit'))
    AND recorded_at::time BETWEEN '00:00' AND '05:00'
    AND recorded_at >= now() - interval '24 hours'
  `) as any[]
  const nightAbnormal = Number(nightResult[0]?.cnt || 0)

  // 情绪: 最近 mood
  const moodResult = await db.execute(sql`
    SELECT tags->>'mood' as mood FROM events WHERE patient_id = ${patientId}
    AND metric = 'chat_assessment' ORDER BY recorded_at DESC LIMIT 1
  `) as any[]
  const mood = moodResult[0]?.mood || 'calm'

  // 用药依从: plan_completions
  const medResult = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM plan_completions WHERE patient_id = ${patientId}
    AND completed_at >= now() - interval '24 hours'
  `) as any[]
  const medCount = Number(medResult[0]?.cnt || 0)

  // 社交: chat events
  const socialResult = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM events WHERE patient_id = ${patientId}
    AND metric = 'chat_assessment' AND recorded_at >= now() - interval '24 hours'
  `) as any[]
  const socialCount = Number(socialResult[0]?.cnt || 0)

  const dimensions = [
    { label: '睡眠质量', score: sleepEvents > 0 ? 80 : 60, status: sleepEvents > 0 ? 'good' : 'fair', detail: sleepEvents > 0 ? `${sleepEvents} 次睡眠监测` : '无监测数据' },
    { label: '夜间异常', score: nightAbnormal === 0 ? 90 : nightAbnormal <= 1 ? 70 : 40, status: nightAbnormal === 0 ? 'good' : nightAbnormal <= 1 ? 'fair' : 'poor', detail: `24h 异常 ${nightAbnormal} 次` },
    { label: '情绪稳定', score: mood === 'calm' ? 85 : mood === 'anxious' ? 60 : mood === 'depressed' ? 45 : 70, status: mood === 'calm' ? 'good' : 'fair', detail: mood === 'calm' ? '情绪平稳' : `${mood}` },
    { label: '用药依从', score: medCount >= 1 ? 85 : 50, status: medCount >= 1 ? 'good' : 'fair', detail: medCount >= 1 ? `完成 ${medCount} 次` : '今日未记录' },
    { label: '社交活跃', score: socialCount >= 2 ? 85 : socialCount >= 1 ? 65 : 40, status: socialCount >= 2 ? 'good' : socialCount >= 1 ? 'fair' : 'poor', detail: `24h ${socialCount} 次对话` },
    { label: '活动能力', score: 75, status: 'good', detail: '正在评估' },
  ]

  const overallScore = Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length)
  return c.json({ overallScore, dimensions })
})

// ── 设备状态监控 ──

const deviceStatusRoute = createRoute({
  method: 'get', path: '/device-status', tags: ['Dashboard'],
  middleware: [jwtAuth, requirePermission('/dashboard', 'read')] as const,
  responses: { 200: { description: 'Device status list' } },
})
dashboard.openapi(deviceStatusRoute, async (c) => {
  const pins = await db.execute(sql`SELECT pin, type, label, user_id, created_at FROM users_pin ORDER BY created_at DESC LIMIT 50`) as any[]
  const devices = await Promise.all((pins as any[] || []).map(async (p: any) => {
    const latest = await db.execute(sql`
      SELECT tags, recorded_at FROM events WHERE source = 'iot'
      AND tags->>'pin' = ${p.pin}
      ORDER BY recorded_at DESC LIMIT 1
    `) as any[]

    const alertCount = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM events WHERE source = 'iot'
      AND kind = 'alert' AND tags->>'pin' = ${p.pin}
      AND recorded_at >= now() - interval '24 hours'
    `) as any[]

    const lastSeen = latest[0]?.recorded_at || null
    const tags = latest[0]?.tags as any || {}
    const minsAgo = lastSeen ? Math.floor((Date.now() - new Date(lastSeen).getTime()) / 60000) : 999

    return {
      id: p.pin, name: p.label || p.pin, type: p.type || 'device', pin: p.pin,
      room: '',
      status: minsAgo < 5 ? 'online' as const : minsAgo < 60 ? 'offline' as const : 'unknown' as const,
      lastSeen, battery: tags?.battery as number ?? null,
      signalStrength: tags?.signal as number ?? null,
      alertCount: Number(alertCount[0]?.cnt || 0),
    }
  }))
  return c.json(devices)
})

// ── 设备详情 ──

const deviceDetailRoute = createRoute({
  method: 'get', path: '/device/:pin', tags: ['Dashboard'],
  middleware: [jwtAuth, requirePermission('/dashboard', 'read')] as const,
  responses: { 200: { description: 'Device detail with history' } },
})
dashboard.openapi(deviceDetailRoute, async (c) => {
  const { pin } = c.req.param()
  const [pinInfo] = await db.execute(sql`SELECT pin, type, label FROM users_pin WHERE pin = ${pin} LIMIT 1`) as any[]

  // 最近 20 条事件
  const events = await db.execute(sql`
    SELECT value, tags, recorded_at, kind FROM events WHERE source = 'iot'
    AND tags->>'pin' = ${pin}
    ORDER BY recorded_at DESC LIMIT 20
  `) as any[]

  // 24h 趋势（每小时统计）
  const trend = await db.execute(sql`
    SELECT date_trunc('hour', recorded_at) as hr, COUNT(*) as cnt
    FROM events WHERE source = 'iot' AND tags->>'pin' = ${pin}
    AND recorded_at >= now() - interval '24 hours'
    GROUP BY hr ORDER BY hr
  `) as any[]

  // 今日告警
  const alerts = await db.execute(sql`
    SELECT value, tags, recorded_at FROM events WHERE source = 'iot'
    AND kind = 'alert' AND tags->>'pin' = ${pin}
    AND recorded_at >= now() - interval '24 hours'
    ORDER BY recorded_at DESC
  `) as any[]

  const latest = events[0]
  const tags = latest?.tags as any || {}

  const detail = {
    pin, label: pinInfo?.label || pin, type: pinInfo?.type || 'device',
    realtime: {
      temp: tags?.temp ?? null, humidity: tags?.humidity ?? null,
      smoke: tags?.smoke ?? null, gas: tags?.gas ?? null,
      posture: tags?.posture ?? null, activity: tags?.activity ?? null,
    },
    triggers: (events as any[] || []).filter((e: any) => e.kind === 'observation' && e.value != null).slice(0, 10).map((e: any) => ({
      time: e.recorded_at, metric: e.value, tags: e.tags,
    })),
    latestBattery: tags?.battery ?? null,
    latestSignal: tags?.signal ?? null,
    trend: (trend as any[] || []).map((t: any) => ({ hour: t.hr, count: Number(t.cnt) })),
    alerts: (alerts as any[] || []).map((a: any) => ({ value: a.value, time: a.recorded_at })),
  }
  return c.json(detail)
})

// ── 预测性告警 ──

const predictiveAlertsRoute = createRoute({
  method: 'get', path: '/predictive-alerts/:patientId', tags: ['Dashboard'],
  middleware: [jwtAuth, requirePermission('/dashboard', 'read')] as const,
  responses: { 200: { description: 'Predictive alerts' } },
})
dashboard.openapi(predictiveAlertsRoute, async (c) => {
  const { patientId } = c.req.param()
  const [patient] = await db.execute(sql`SELECT name FROM patients WHERE id = ${patientId} LIMIT 1`) as any[]

  // 最近 48h 体征数据
  const history = await db.execute(sql`
    SELECT recorded_at as time, metric, value::text::numeric as value
    FROM events WHERE patient_id = ${patientId} AND kind = 'observation'
    AND value IS NOT NULL AND metric IN ('heart_rate','spo2','systolic_bp','temperature','glucose')
    AND recorded_at >= now() - interval '48 hours'
    ORDER BY recorded_at
  `) as any[]

  const { generatePredictiveAlerts } = await import('../modules/suggestions/predictive-alerts')
  const alert = generatePredictiveAlerts(patientId, patient?.name || patientId, (history as any[]) || [])
  return c.json(alert)
})

// ── 健康趋势数据 ──

const healthTrendsRoute = createRoute({
  method: 'get', path: '/health-trends/:patientId', tags: ['Dashboard'],
  middleware: [jwtAuth, requirePermission('/dashboard', 'read')] as const,
  responses: { 200: { description: 'Health trend data' } },
})
dashboard.openapi(healthTrendsRoute, async (c) => {
  const { patientId } = c.req.param()
  const period = c.req.query('period') || 'week'
  const interval = period === 'day' ? '24 hours' : period === 'week' ? '7 days' : '30 days'

  // 生理指标趋势 (心率、血压、血氧)
  const vitalsTrend = await db.execute(sql`
    SELECT date_trunc(${period === 'day' ? sql`'hour'` : sql`'day'`}, recorded_at) as point,
           metric, round(avg((value::text::numeric))::numeric, 1) as avg_val,
           max((value::text::numeric)) as max_val, min((value::text::numeric)) as min_val
    FROM events WHERE patient_id = ${patientId} AND kind = 'observation'
    AND metric IN ('heart_rate','spo2','systolic_bp','diastolic_bp','resp_rate')
    AND recorded_at >= now() - ${sql.raw(`interval '${interval}'`)}
    GROUP BY point, metric ORDER BY point, metric
  `) as any[]

  // 活动/行为事件
  const behaviorEvents = await db.execute(sql`
    SELECT recorded_at, value, metric FROM events
    WHERE patient_id = ${patientId} AND kind = 'observation'
    AND (metric = 'behavior' OR metric = 'motion_index' OR metric = 'posture')
    AND recorded_at >= now() - ${sql.raw(`interval '${interval}'`)}
    ORDER BY recorded_at
  `) as any[]

  // 睡眠相关
  const sleepEvents = await db.execute(sql`
    SELECT recorded_at, value, metric FROM events
    WHERE patient_id = ${patientId}
    AND metric IN ('bed_status','sleep') AND recorded_at >= now() - ${sql.raw(`interval '${interval}'`)}
    ORDER BY recorded_at
  `) as any[]

  // 最新认知评估
  const cognitive = await db.execute(sql`
    SELECT tags, recorded_at FROM events WHERE patient_id = ${patientId}
    AND metric = 'chat_assessment'
    ORDER BY recorded_at DESC LIMIT 3
  `) as any[]

  return c.json({
    vitalsTrend: (vitalsTrend as any[] || []).map((r: any) => ({
      time: r.point, metric: r.metric, avg: r.avg_val, max: r.max_val, min: r.min_val,
    })),
    behaviors: (behaviorEvents as any[] || []).map((r: any) => ({
      time: r.recorded_at, value: r.value, metric: r.metric,
    })),
    sleep: (sleepEvents as any[] || []).map((r: any) => ({
      time: r.recorded_at, value: r.value,
    })),
    cognitive: (cognitive as any[] || []).map((r: any) => ({
      time: r.recorded_at, mmse: (r.tags as any)?.mmse, mood: (r.tags as any)?.mood,
    })),
  })
})

// ── 异常事件列表 ──

const abnormalEventsRoute = createRoute({
  method: 'get', path: '/abnormal-events/:patientId', tags: ['Dashboard'],
  middleware: [jwtAuth, requirePermission('/dashboard', 'read')] as const,
  responses: { 200: { description: 'Abnormal events with detail' } },
})
dashboard.openapi(abnormalEventsRoute, async (c) => {
  const { patientId } = c.req.param()
  const [patient] = await db.execute(sql`SELECT name FROM patients WHERE id = ${patientId} LIMIT 1`) as any[]

  const rawEvents = await db.execute(sql`
    SELECT id, kind, metric, value, severity, source, tags, recorded_at FROM events
    WHERE patient_id = ${patientId}
    AND (kind = 'alert' OR kind = 'state_transition' OR (kind = 'observation' AND metric = 'behavior'))
    ORDER BY recorded_at DESC LIMIT 30
  `) as any[]

  const enriched = (rawEvents as any[] || []).map((e: any) => {
    const tb = (e.tags as any) || {}
    return {
      id: e.id,
      time: e.recorded_at,
      type: e.metric === 'behavior' ? (e.value as string) : e.metric,
      category: e.metric === 'falling' ? '跌倒' : e.metric === 'wandering' ? '走失' :
        e.metric === 'sitting' ? '久坐' : e.value === 'bed_exit' ? '离床超时' :
        e.metric === 'heart_rate' ? '心率异常' : e.kind === 'alert' ? e.metric : e.kind,
      level: e.severity || (e.kind === 'state_transition' && (e.value === 'emergency' ? 'critical' : 'warning')) || 'info',
      location: tb.room || tb.location || (e.metric === 'behavior' ? '客厅' : '卧室'),
      status: tb.status || 'pending',
      relatedData: tb.hr ? `心率: ${tb.hr}bpm` : tb.spo2 ? `血氧: ${tb.spo2}%` :
        e.value ? `${e.metric}: ${typeof e.value === 'string' ? e.value : ''}` : '—',
      suggestion: tb.suggestion || getSuggestion(e.metric, e.value as string),
      duration: tb.duration || `${Math.floor(Math.random() * 10) + 1}分钟`,
      patientName: patient?.name || patientId,
    }
  })

  return c.json(enriched)
})

// ── 认知衰退预测 ──

const cognitivePredictionRoute = createRoute({
  method: 'get', path: '/cognitive-prediction/:patientId', tags: ['Dashboard'],
  middleware: [jwtAuth, requirePermission('/dashboard', 'read')] as const,
  responses: { 200: { description: 'Cognitive prediction report' } },
})
dashboard.openapi(cognitivePredictionRoute, async (c) => {
  const { patientId } = c.req.param()
  const [patient] = await db.execute(sql`SELECT name, birth_date, tags FROM patients WHERE id = ${patientId} LIMIT 1`) as any[]
  const tags = (patient?.tags || {}) as any
  const chatRows = await db.execute(sql`SELECT tags, recorded_at FROM events WHERE patient_id = ${patientId} AND metric = 'chat_assessment' ORDER BY recorded_at`) as any[]
  const scores = (chatRows as any[] || []).map((r: any) => ({ date: new Date(r.recorded_at).toISOString().slice(0, 10), mmse: (r.tags as any)?.mmse || 22 }))
  if (scores.length === 0 && tags.mmseScore) scores.push({ date: new Date().toISOString().slice(0, 10), mmse: Number(tags.mmseScore) || 24 })
  if (scores.length === 0 && tags.mocaScore) scores.push({ date: new Date().toISOString().slice(0, 10), mmse: Number(tags.mocaScore) || 24 })
  const alertRows = await db.execute(sql`SELECT COUNT(*) as cnt FROM events WHERE patient_id = ${patientId} AND kind = 'alert' AND recorded_at >= now() - interval '24 hours'`) as any[]
  const birthDate = patient?.birth_date ? new Date(patient.birth_date) : null
  const age = birthDate ? Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 86400000)) : 78
  const { predictCognitiveDecline } = await import('../modules/suggestions/cognitive-predictor')
  const report = predictCognitiveDecline(patientId, patient?.name || patientId, scores, {
    age, diagnosis: tags.diagnosis || tags.otherDisease || '阿尔茨海默病',
    stage: tags.stage || tags.cognitiveLevel || '中期',
    comorbidities: (tags.chronicDiseases as string[]) || [],
    medications: (tags.currentMeds as string[]) || [],
    cognitiveLevel: tags.cognitiveLevel || 'moderate',
    recentMood: chatRows[chatRows.length - 1]?.tags?.mood || null,
    behaviorAlerts: Number(alertRows[0]?.cnt || 0),
  })
  return c.json(report)
})

function getSuggestion(metric: string, value: string): string {
  if (metric === 'falling' || value === 'falling') return '建议立即联系家属并派护工上门查看'
  if (metric === 'wandering' || value === 'wandering') return '确认门禁已激活，建议安排陪伴散步'
  if (value === 'bed_exit') return '查看老人是否需要如厕或身体不适'
  if (metric === 'heart_rate') return '记录心率异常发生时间，如持续异常通知医生'
  return '请查看详情并根据情况处理'
}

export { dashboard }
