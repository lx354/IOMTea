import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { protectedProcedure, router } from '../index'
import {
  deviceSchema,
  deviceCreateSchema,
  deviceUpdateSchema,
  deviceListInputSchema,
} from '@iomtea/shared-types'
import { devices } from '../../db/schema'

export const deviceRouter = router({
  list: protectedProcedure
    .input(deviceListInputSchema)
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.pageSize
      let query = ctx.db.select().from(devices).$dynamic()
      if (input.deviceType) {
        query = query.where(eq(devices.deviceType, input.deviceType))
      }
      if (input.status) {
        query = query.where(eq(devices.status, input.status))
      }
      const rows = await query.limit(input.pageSize).offset(offset).orderBy(devices.createdAt)

      return z.array(deviceSchema).parse(rows.map((d) => ({
        id: d.id,
        serialNumber: d.serialNumber,
        deviceType: d.deviceType,
        status: d.status,
        patientId: d.patientId,
        lastSeen: d.lastSeen?.getTime() ?? null,
        tags: d.tags,
        createdAt: d.createdAt.getTime(),
      })))
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(devices)
        .where(eq(devices.id, input.id))
        .limit(1)

      if (rows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Device not found' })
      }
      const d = rows[0]
      return deviceSchema.parse({
        id: d.id,
        serialNumber: d.serialNumber,
        deviceType: d.deviceType,
        status: d.status,
        patientId: d.patientId,
        lastSeen: d.lastSeen?.getTime() ?? null,
        tags: d.tags,
        createdAt: d.createdAt.getTime(),
      })
    }),

  create: protectedProcedure
    .input(deviceCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db.insert(devices).values(input).returning()
      return deviceSchema.parse({
        id: created.id,
        serialNumber: created.serialNumber,
        deviceType: created.deviceType,
        status: created.status,
        patientId: created.patientId,
        lastSeen: created.lastSeen?.getTime() ?? null,
        tags: created.tags,
        createdAt: created.createdAt.getTime(),
      })
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), data: deviceUpdateSchema }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(devices)
        .set(input.data)
        .where(eq(devices.id, input.id))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Device not found' })
      }
      return deviceSchema.parse({
        id: updated.id,
        serialNumber: updated.serialNumber,
        deviceType: updated.deviceType,
        status: updated.status,
        patientId: updated.patientId,
        lastSeen: updated.lastSeen?.getTime() ?? null,
        tags: updated.tags,
        createdAt: updated.createdAt.getTime(),
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(devices).where(eq(devices.id, input.id))
      return { success: true }
    }),
})
