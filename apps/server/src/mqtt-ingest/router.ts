import { eq, inArray } from 'drizzle-orm'
import type mqtt from 'mqtt'
import { db } from '../core/db'
import { events, patients } from '../core/db/schema.js'
import { usersPin } from '../core/db/schema/pin'
import { userPatientLinks } from '../core/db/schema/user-patient'
import { createChildLogger } from '../core/lib/logger'
import { getMetricUnit, isValueInRange, normalizeMetric } from '../core/lib/metrics'
import { broadcastManager } from '../core/realtime/broadcast'

const logger = createChildLogger('mqtt-router')

async function handleDeviceEvent(topicId: string, body: Record<string, unknown>): Promise<void> {
  const pin = body.pin as string | undefined
  if (!pin || pin.length < 4) {
    logger.debug({ topicId }, '设备事件无有效 PIN，跳过')
    return
  }

  const [pinRecord] = await db.select().from(usersPin).where(eq(usersPin.pin, pin)).limit(1)
  if (!pinRecord) {
    logger.debug({ pin }, 'PIN 未注册，跳过设备事件')
    return
  }

  const [patient] = await db
    .select({ id: patients.id })
    .from(patients)
    .innerJoin(userPatientLinks, eq(userPatientLinks.patientId, patients.id))
    .where(eq(userPatientLinks.userId, pinRecord.userId))
    .limit(1)
  if (!patient) {
    logger.debug({ pin, userId: pinRecord.userId }, 'PIN 未关联患者，跳过')
    return
  }

  const event = body.event as string
  const metric = body.metric as string
  const value = body.value !== undefined ? Number(body.value) : null

  if (event === 'healthObservation' || event === 'healthAlert') {
    if (!metric) return
    const normalizedMetric = normalizeMetric(metric)
    const numValue = value !== null ? value : Number.NaN
    if (isNaN(numValue)) return

    const kind = event === 'healthAlert' ? 'alert' : 'observation'
    await db
      .insert(events)
      .values({
        patientId: patient.id,
        pinCode: pin,
        kind,
        metric: normalizedMetric,
        value: numValue,
        unit: (body.unit as string) || getMetricUnit(normalizedMetric),
        source: 'iot' as const,
        severity: event === 'healthAlert' ? (body.severity as string) || 'warning' : undefined,
        status: event === 'healthAlert' ? ('active' as const) : undefined,
        tags: { deviceId: body.deviceId, ...((body.metadata as any) || {}) },
        recordedAt: new Date(),
      } as any)
      .catch((err) => {
        logger.warn({ err, metric }, '设备事件写入失败')
      })

    broadcastManager.broadcastVitals(patient.id, [
      {
        metric,
        value: numValue,
        unit: (body.unit as string | null) ?? null,
      },
    ])
  } else if (event === 'fallDetected') {
    await db
      .insert(events)
      .values({
        patientId: patient.id,
        pinCode: pin,
        kind: 'alert' as const,
        metric: 'fall_detected',
        value: null,
        severity: 'critical' as const,
        status: 'active' as const,
        source: 'iot' as const,
        tags: {
          deviceId: body.deviceId,
          confidence: body.confidence,
          ...((body.metadata as any) || {}),
        },
        recordedAt: new Date(),
      } as any)
      .catch((err) => {
        logger.warn({ err }, 'fall_detected 事件写入失败')
      })
  }

  await db.update(usersPin).set({ lastSeenAt: new Date() }).where(eq(usersPin.pin, pin))
}

const TOPIC_ROOT_SEGMENT = 'users'
const PIN_PATTERN = /^\d{4,6}$/

function toFiniteNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function normalizeRecordedAt(raw: unknown): Date {
  if (typeof raw !== 'string' || raw.trim() === '') return new Date()
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return new Date()
  return parsed
}

function resolveUnit(metric: string, rawUnit: unknown): string | undefined {
  if (typeof rawUnit === 'string' && rawUnit.trim() !== '') return rawUnit.trim()
  return getMetricUnit(metric)
}

export function parseHealthPayload(body: Record<string, unknown>) {
  if (typeof body.metric !== 'string' || !body.metric.trim()) return null
  const metric = normalizeMetric(body.metric)

  const value = toFiniteNumber(body.value)
  if (value === null) return null
  if (!isValueInRange(metric, value)) return null

  return {
    metric,
    value,
    unit: resolveUnit(metric, body.unit),
    recordedAt: normalizeRecordedAt(body.recordedAt),
    payloadSource: typeof body.source === 'string' ? body.source : undefined,
  }
}

function parsePayloadObject(payload: Buffer): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(payload.toString())
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function parseTopic(topic: string): { pin: string; topicSource: string; routeType: string } | null {
  const parts = topic.split('/')
  if (parts.length < 4 || parts[0] !== TOPIC_ROOT_SEGMENT) return null

  const pin = parts[1]
  if (!PIN_PATTERN.test(pin)) return null

  const topicSource = parts[2]
  const routeType = parts[3] ?? ''
  if (!routeType) return null

  return { pin, topicSource, routeType }
}

async function resolvePatientId(userId: string): Promise<string | null> {
  const [patient] = await db
    .select({ id: patients.id })
    .from(patients)
    .innerJoin(userPatientLinks, eq(userPatientLinks.patientId, patients.id))
    .where(eq(userPatientLinks.userId, userId))
    .orderBy(userPatientLinks.createdAt)
    .limit(1)
  return patient?.id ?? null
}

function buildEventTags(
  topicSource: string,
  routeType: string,
  payloadSource: string | undefined,
): Record<string, unknown> {
  const tags: Record<string, unknown> = {
    topicSource,
    routeType,
    payloadSource: payloadSource ?? null,
  }

  return tags
}

async function handleHealthEvent(
  pin: string,
  topicSource: string,
  routeType: string,
  body: Record<string, unknown>,
): Promise<void> {
  const KNOWN_STRING_METRICS = new Set(['posture', 'bed_status'])
  let normalized = parseHealthPayload(body)
  if (!normalized) {
    const rawMetric = typeof body.metric === 'string' ? body.metric.trim() : ''
    if (rawMetric && KNOWN_STRING_METRICS.has(normalizeMetric(rawMetric))) {
      normalized = {
        metric: normalizeMetric(rawMetric),
        value: body.value ?? null,
        unit: resolveUnit(rawMetric, body.unit),
        recordedAt: normalizeRecordedAt(body.recordedAt),
        payloadSource: typeof body.source === 'string' ? body.source : undefined,
      }
    }
  }
  if (!normalized) return

  const [pinRecord] = await db.select().from(usersPin).where(eq(usersPin.pin, pin)).limit(1)
  if (!pinRecord) return

  const patientId = await resolvePatientId(pinRecord.userId)
  if (!patientId) return

  const tags = buildEventTags(topicSource, routeType, normalized.payloadSource)

  await db.insert(events).values({
    patientId,
    pinCode: pin,
    kind: 'observation',
    metric: normalized.metric,
    value: normalized.value,
    unit: normalized.unit,
    source: 'iot',
    tags,
    recordedAt: normalized.recordedAt,
  })

  await db.update(usersPin).set({ lastSeenAt: new Date() }).where(eq(usersPin.pin, pin))
}

async function handleAdminMessage(
  client: mqtt.MqttClient,
  pin: string,
  action: string,
  body: Record<string, unknown>,
): Promise<void> {
  if (action === 'verify') {
    const [record] = await db.select().from(usersPin).where(eq(usersPin.pin, pin)).limit(1)
    const response = {
      pin,
      valid: !!record,
      userId: record?.userId ?? null,
      nickname: record?.nickname ?? '',
      requestId: (body.requestId as string) ?? '',
    }
    client.publish(
      `iomtea/admin/pin/verify/${pin}/result`,
      JSON.stringify(response),
      { qos: 1 },
      (err) => {
        if (err) console.error('[mqtt-admin] publish error:', err)
      },
    )
  }
}

export async function routeMessage(
  topic: string,
  payload: Buffer,
  client?: mqtt.MqttClient,
): Promise<void> {
  const parts = topic.split('/')

  if (
    parts[0] === 'iomtea' &&
    parts[1] === 'device' &&
    parts.length >= 4 &&
    parts[3] === 'events'
  ) {
    const topicId = parts[2]
    const body = parsePayloadObject(payload)
    if (!body) return
    await handleDeviceEvent(topicId, body)
    return
  }

  const parsedTopic = parseTopic(topic)
  if (!parsedTopic) return
  const { pin, topicSource, routeType } = parsedTopic

  const body = parsePayloadObject(payload)
  if (!body) return

  if (topicSource === 'admin' && client) {
    await handleAdminMessage(client, pin, routeType, body)
    return
  }

  await handleHealthEvent(pin, topicSource, routeType, body)
}
