import { createTRPCReact, type CreateTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import type { AppRouter } from '@server/core/trpc/routers/_app'

export const trpc: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>()

export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: '/trpc',
        fetch: async (input, init) => {
          const token = localStorage.getItem('token')
          const headers = new Headers(init?.headers)
          if (token) {
            headers.set('Authorization', `Bearer ${token}`)
          }
          const response = await fetch(input, { ...init, headers })

          if (response.status === 401) {
            const refreshToken = localStorage.getItem('refreshToken')
            if (refreshToken) {
              try {
                const refreshRes = await fetch('/trpc/auth.refresh', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ refreshToken }),
                })
                if (refreshRes.ok) {
                  const data = await refreshRes.json()
                  const result = data.result?.data
                  if (result?.accessToken) {
                    localStorage.setItem('token', result.accessToken)
                    localStorage.setItem('refreshToken', result.refreshToken)
                    localStorage.setItem('expiresAt', String(Date.now() + result.expiresIn * 1000))
                    headers.set('Authorization', `Bearer ${result.accessToken}`)
                    return fetch(input, { ...init, headers })
                  }
                }
              } catch {
                localStorage.removeItem('token')
                localStorage.removeItem('refreshToken')
                localStorage.removeItem('expiresAt')
                window.location.reload()
              }
            }
          }
          return response
        },
      }),
    ],
  })
}
