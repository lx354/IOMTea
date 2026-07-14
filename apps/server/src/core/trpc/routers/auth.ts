import { eq } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { createHash } from 'node:crypto'
import { publicProcedure, router } from '../index'
import { loginSchema, registerSchema, tokenPairSchema } from '@iomtea/shared-types'
import { users, refreshTokens } from '../../db/schema'
import { hashPassword, verifyPassword } from '../../lib/password'
import { signAccessToken, signRefreshToken, verifyToken } from '../../lib/jwt'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export const authRouter = router({
  register: publicProcedure
    .input(registerSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1)

      if (existing.length > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Username already exists' })
      }

      const passwordHash = await hashPassword(input.password)

      const [user] = await ctx.db
        .insert(users)
        .values({
          username: input.username,
          passwordHash,
          displayName: input.displayName,
        })
        .returning()

      const jwtPayload = { sub: user.id, role: user.role }
      const accessToken = await signAccessToken(jwtPayload)
      const refreshToken = await signRefreshToken(user.id)

      await ctx.db.insert(refreshTokens).values({
        userId: user.id,
        tokenHash: hashToken(refreshToken.token),
        expiresAt: refreshToken.expiresAt,
      })

      return tokenPairSchema.parse({
        accessToken,
        refreshToken: refreshToken.token,
        expiresAt: refreshToken.expiresAt.getTime(),
      })
    }),

  login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1)

      if (rows.length === 0) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' })
      }

      const user = rows[0]
      const valid = await verifyPassword(user.passwordHash, input.password)

      if (!valid) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' })
      }

      const jwtPayload = { sub: user.id, role: user.role }
      const accessToken = await signAccessToken(jwtPayload)
      const refreshToken = await signRefreshToken(user.id)

      await ctx.db.insert(refreshTokens).values({
        userId: user.id,
        tokenHash: hashToken(refreshToken.token),
        expiresAt: refreshToken.expiresAt,
      })

      return tokenPairSchema.parse({
        accessToken,
        refreshToken: refreshToken.token,
        expiresAt: refreshToken.expiresAt.getTime(),
      })
    }),

  refresh: publicProcedure
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tokenHash = hashToken(input.refreshToken)

      const rows = await ctx.db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1)

      if (rows.length === 0) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid refresh token' })
      }

      const stored = rows[0]

      if (new Date() > stored.expiresAt) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Refresh token expired' })
      }

      const userRows = await ctx.db
        .select()
        .from(users)
        .where(eq(users.id, stored.userId))
        .limit(1)

      if (userRows.length === 0) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User not found' })
      }

      const user = userRows[0]

      // Delete old refresh token (rotation)
      await ctx.db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id))

      const jwtPayload = { sub: user.id, role: user.role }
      const accessToken = await signAccessToken(jwtPayload)
      const newRefreshToken = await signRefreshToken(user.id)

      await ctx.db.insert(refreshTokens).values({
        userId: user.id,
        tokenHash: hashToken(newRefreshToken.token),
        expiresAt: newRefreshToken.expiresAt,
      })

      return tokenPairSchema.parse({
        accessToken,
        refreshToken: newRefreshToken.token,
        expiresAt: newRefreshToken.expiresAt.getTime(),
      })
    }),
})
