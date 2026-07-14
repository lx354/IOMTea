import type { inferAsyncReturnType } from '@trpc/server'
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import { db } from '../db'

export async function createContext(opts: FetchCreateContextFnOptions) {
  return {
    db,
    req: opts.req,
  }
}

export type Context = inferAsyncReturnType<typeof createContext>
