import { z } from 'zod'
import { publicProcedure, protectedProcedure, router } from '../../core/trpc/index'
import { createWard, getWardState, pauseWard, resumeWard, setWardSpeed, listWards, injectScenario } from '../engine'
import { SCENARIO_TYPES } from '../types'

export const simulatorRouter = router({
  createWard: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        patients: z.array(
          z.object({
            profileId: z.string(),
            count: z.number().int().min(1).max(10).default(1),
          }),
        ),
        speed: z.number().min(0.1).max(60).default(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const state = await createWard(ctx.db, input)
      return state
    }),

  pause: protectedProcedure
    .input(z.object({ wardId: z.string() }))
    .mutation(({ input }) => {
      const ok = pauseWard(input.wardId)
      return { success: ok }
    }),

  resume: protectedProcedure
    .input(z.object({ wardId: z.string() }))
    .mutation(({ input }) => {
      const ok = resumeWard(input.wardId)
      return { success: ok }
    }),

  setSpeed: protectedProcedure
    .input(z.object({ wardId: z.string(), speed: z.number().min(0.1).max(60) }))
    .mutation(({ input }) => {
      const ok = setWardSpeed(input.wardId, input.speed)
      return { success: ok, speed: input.speed }
    }),

  status: publicProcedure
    .input(z.object({ wardId: z.string() }).optional())
    .query(({ input }) => {
      if (input?.wardId) {
        return getWardState(input.wardId) ?? null
      }
      return listWards()
    }),

  injectScenario: protectedProcedure
    .input(z.object({ wardId: z.string(), type: z.enum(SCENARIO_TYPES) }))
    .mutation(async ({ input }) => {
      const ok = await injectScenario(input.wardId, input.type)
      return { success: ok }
    }),
})
