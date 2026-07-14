import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { protectedProcedure, router } from '../index'
import {
  patientSchema,
  patientCreateSchema,
  patientUpdateSchema,
  patientListInputSchema,
} from '@iomtea/shared-types'
import { patients } from '../../db/schema'

export const patientRouter = router({
  list: protectedProcedure
    .input(patientListInputSchema)
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.pageSize
      let query = ctx.db.select().from(patients).$dynamic()
      if (input.status) {
        query = query.where(eq(patients.status, input.status))
      }
      const rows = await query.limit(input.pageSize).offset(offset).orderBy(patients.createdAt)

      return rows.map((p) => patientSchema.parse({
        id: p.id,
        name: p.name,
        birthDate: p.birthDate,
        gender: p.gender,
        room: p.room,
        bedNumber: p.bedNumber,
        status: p.status,
        tags: p.tags,
        createdAt: p.createdAt.getTime(),
      }))
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(patients)
        .where(eq(patients.id, input.id))
        .limit(1)

      if (rows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Patient not found' })
      }
      const p = rows[0]
      return patientSchema.parse({
        id: p.id,
        name: p.name,
        birthDate: p.birthDate,
        gender: p.gender,
        room: p.room,
        bedNumber: p.bedNumber,
        status: p.status,
        tags: p.tags,
        createdAt: p.createdAt.getTime(),
      })
    }),

  create: protectedProcedure
    .input(patientCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db.insert(patients).values(input).returning()
      return patientSchema.parse({
        id: created.id,
        name: created.name,
        birthDate: created.birthDate,
        gender: created.gender,
        room: created.room,
        bedNumber: created.bedNumber,
        status: created.status,
        createdAt: created.createdAt.getTime(),
      })
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), data: patientUpdateSchema }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(patients)
        .set(input.data)
        .where(eq(patients.id, input.id))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Patient not found' })
      }
      return patientSchema.parse({
        id: updated.id,
        name: updated.name,
        birthDate: updated.birthDate,
        gender: updated.gender,
        room: updated.room,
        bedNumber: updated.bedNumber,
        status: updated.status,
        createdAt: updated.createdAt.getTime(),
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(patients).where(eq(patients.id, input.id))
      return { success: true }
    }),
})
