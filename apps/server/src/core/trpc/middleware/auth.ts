import { TRPCError } from '@trpc/server'
import { middleware, publicProcedure } from '../init'
import { verifyToken } from '../../lib/jwt'

export const authMiddleware = middleware(async ({ ctx, next }) => {
  const authHeader = ctx.req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Missing token' })
  }

  const token = authHeader.slice(7)
  try {
    const payload = await verifyToken(token)
    return next({
      ctx: {
        ...ctx,
        userId: payload.sub,
        userRole: payload.role,
      },
    })
  } catch {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' })
  }
})

export const protectedProcedure = publicProcedure.use(authMiddleware)
