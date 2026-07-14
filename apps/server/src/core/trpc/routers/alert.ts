import { eq, and, desc } from 'drizzle-orm'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { protectedProcedure, router } from '../index'
import { ALERT_SEVERITIES, ALERT_STATUSES, alertSchema } from '@iomtea/shared-types'
import { events } from '../../db/schema'

export const alertRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        status: z.enum(ALERT_STATUSES).optional(),
        severity: z.enum(ALERT_SEVERITIES).optional(),
        patientId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.pageSize
      const conditions = [eq(events.kind, 'alert')]
      if (input.status) conditions.push(eq(events.status, input.status))
      if (input.severity) conditions.push(eq(events.severity, input.severity))
      if (input.patientId) conditions.push(eq(events.patientId, input.patientId))

      const rows = await ctx.db
        .select()
        .from(events)
        .where(and(...conditions))
        .limit(input.pageSize)
        .offset(offset)
        .orderBy(desc(events.recordedAt))

      return z.array(alertSchema).parse(rows.map((a) => ({
        id: a.id,
        patientId: a.patientId,
        deviceId: a.deviceId,
        kind: 'alert' as const,
        metric: a.metric,
        value: a.value,
        unit: a.unit,
        severity: a.severity,
        status: a.status,
        tags: a.tags,
        recordedAt: a.recordedAt.getTime(),
        createdAt: a.createdAt.getTime(),
      })))
    }),

  acknowledge: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(events)
        .set({ status: 'acknowledged' })
        .where(and(eq(events.id, input.id), eq(events.kind, 'alert')))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Alert not found' })
      }
      return alertSchema.pick({ id: true, status: true }).parse({ id: updated.id, status: updated.status })
    }),

  resolve: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(events)
        .set({ status: 'resolved' })
        .where(and(eq(events.id, input.id), eq(events.kind, 'alert')))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Alert not found' })
      }
      return alertSchema.pick({ id: true, status: true }).parse({ id: updated.id, status: updated.status })
    }),
})
