import { createTRPCClient, httpLink, TRPCClientError } from '@trpc/client'
import Taro from '@tarojs/taro'
import type { AppRouter } from '@server/core/trpc/routers/_app'

const API_BASE = 'http://localhost:3000'

function taroFetcher(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString()
  const body = init?.body as string | undefined

  return new Promise((resolve, reject) => {
    Taro.request({
      url: url.startsWith('http') ? url : `${API_BASE}${url}`,
      method: (init?.method || 'GET') as any,
      header: {
        'content-type': 'application/json',
        ...(init?.headers as Record<string, string>),
      },
      data: body ? JSON.parse(body) : undefined,
      success(res) {
        resolve(
          new Response(JSON.stringify(res.data), {
            status: res.statusCode,
            headers: new Headers(res.header as Record<string, string>),
          }),
        )
      },
      fail(err) {
        reject(new TRPCClientError(err.errMsg || 'Network error'))
      },
    })
  })
}

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpLink({
      url: `${API_BASE}/trpc`,
      fetch: taroFetcher as any,
      headers() {
        const token = Taro.getStorageSync('token')
        return token ? { Authorization: `Bearer ${token}` } : {}
      },
    }),
  ],
})
