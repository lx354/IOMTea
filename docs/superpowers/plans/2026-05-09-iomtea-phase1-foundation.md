# IOMTea Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the monorepo infrastructure, server skeleton with Hono+tRPC+Drizzle, auth flow, core CRUD, and web client with end-to-end type safety via tRPC.

**Architecture:** Turborepo monorepo with `apps/server` (Hono+tRPC), `apps/web` (React+Vite), `packages/shared-types` (Zod+tRPC types). Server exposes tRPC procedures consumed by web via `@trpc/react-query`. Auth uses JWT access+refresh tokens. Drizzle ORM with PostgreSQL.

**Tech Stack:** Hono 4, tRPC 11, Drizzle ORM, PostgreSQL, React 19, Vite, Mantine, TanStack Router, Zustand, pino, jose, @node-rs/argon2, zod, pnpm

**Convention:** No interface abstractions over Drizzle. Simple CRUD inlines Drizzle queries in tRPC procedures. Complex logic (auth, ingest) gets dedicated service modules. All types derive from Zod schemas in `shared-types`.

---

## Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `biome.json`
- Create: `.gitignore`
- Create: `.npmrc`
- Create: `tsconfig.base.json`

- [ ] **Step 1: Create root package.json**

```bash
New-Item -ItemType File -Path "D:\repo\dev\iomtea\package.json"
```

```json
{
  "name": "iomtea",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "format": "biome format --write ."
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "turbo": "^2.5.0",
    "typescript": "^5.7.0"
  },
  "packageManager": "pnpm@9.15.0"
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["tsconfig.base.json"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

- [ ] **Step 4: Create biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "asNeeded"
    }
  }
}
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
.env
*.db
.turbo/
```

- [ ] **Step 6: Create .npmrc**

```
auto-install-peers=true
strict-peer-dependencies=false
```

- [ ] **Step 7: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 8: Initialize git and install dependencies**

```bash
git init
```

```bash
pnpm install
```

```bash
pnpm exec biome format --write .
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: initialize iomtea monorepo with turborepo"
```

---

## Task 2: shared-types Package

**Files:**
- Create: `packages/shared-types/package.json`
- Create: `packages/shared-types/tsconfig.json`
- Create: `packages/shared-types/src/index.ts`
- Create: `packages/shared-types/src/schemas/auth.ts`
- Create: `packages/shared-types/src/schemas/user.ts`
- Create: `packages/shared-types/src/schemas/patient.ts`
- Create: `packages/shared-types/src/schemas/device.ts`
- Create: `packages/shared-types/src/constants.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@iomtea/shared-types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schemas": "./src/schemas/index.ts"
  },
  "dependencies": {
    "zod": "^3.24.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create constants.ts**

```typescript
export const USER_ROLES = ['admin', 'doctor', 'nurse', 'caregiver'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const DEVICE_TYPES = ['mattress', 'vision', 'imu', 'generic'] as const
export type DeviceType = (typeof DEVICE_TYPES)[number]

export const DEVICE_STATUSES = ['active', 'inactive', 'maintenance'] as const
export type DeviceStatus = (typeof DEVICE_STATUSES)[number]

export const ALERT_SEVERITIES = ['critical', 'warning', 'info'] as const
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number]

export const ALERT_STATUSES = ['active', 'acknowledged', 'resolved'] as const
export type AlertStatus = (typeof ALERT_STATUSES)[number]

export const ALERT_TYPES = ['fall_detected', 'bed_exit', 'vital_anomaly', 'device_offline'] as const
export type AlertType = (typeof ALERT_TYPES)[number]
```

- [ ] **Step 4: Create schemas/auth.ts**

```typescript
import { z } from 'zod'

export const loginSchema = z.object({
  username: z.string().min(2).max(50),
  password: z.string().min(6).max(100),
})

export const registerSchema = z.object({
  username: z.string().min(2).max(50),
  password: z.string().min(6).max(100),
  displayName: z.string().min(1).max(100),
})

export const tokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type TokenPair = z.infer<typeof tokenPairSchema>
```

- [ ] **Step 5: Create schemas/user.ts**

```typescript
import { z } from 'zod'
import { USER_ROLES } from '../constants'

export const userSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  displayName: z.string(),
  role: z.enum(USER_ROLES),
  createdAt: z.number(),
})

export const userUpdateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  role: z.enum(USER_ROLES).optional(),
})

export const userListInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

export type User = z.infer<typeof userSchema>
export type UserUpdateInput = z.infer<typeof userUpdateSchema>
```

- [ ] **Step 6: Create schemas/patient.ts**

```typescript
import { z } from 'zod'

export const patientSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  birthDate: z.string().nullable(),
  gender: z.enum(['male', 'female', 'other']).nullable(),
  room: z.string().nullable(),
  bedNumber: z.string().nullable(),
  status: z.enum(['active', 'discharged']),
  createdAt: z.number(),
})

export const patientCreateSchema = z.object({
  name: z.string().min(1).max(100),
  birthDate: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  room: z.string().max(20).optional(),
  bedNumber: z.string().max(20).optional(),
})

export const patientUpdateSchema = patientCreateSchema.partial()

export const patientListInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'discharged']).optional(),
})

export type Patient = z.infer<typeof patientSchema>
export type PatientCreateInput = z.infer<typeof patientCreateSchema>
export type PatientUpdateInput = z.infer<typeof patientUpdateSchema>
```

- [ ] **Step 7: Create schemas/device.ts**

```typescript
import { z } from 'zod'
import { DEVICE_TYPES, DEVICE_STATUSES } from '../constants'

export const deviceSchema = z.object({
  id: z.string().uuid(),
  serialNumber: z.string(),
  deviceType: z.enum(DEVICE_TYPES),
  status: z.enum(DEVICE_STATUSES),
  patientId: z.string().uuid().nullable(),
  lastSeen: z.number().nullable(),
  createdAt: z.number(),
})

export const deviceCreateSchema = z.object({
  serialNumber: z.string().min(1).max(100),
  deviceType: z.enum(DEVICE_TYPES),
})

export const deviceUpdateSchema = z.object({
  status: z.enum(DEVICE_STATUSES).optional(),
  patientId: z.string().uuid().nullable().optional(),
})

export const deviceListInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  deviceType: z.enum(DEVICE_TYPES).optional(),
  status: z.enum(DEVICE_STATUSES).optional(),
})

export type Device = z.infer<typeof deviceSchema>
export type DeviceCreateInput = z.infer<typeof deviceCreateSchema>
export type DeviceUpdateInput = z.infer<typeof deviceUpdateSchema>
```

- [ ] **Step 8: Create schemas/index.ts**

```typescript
export * from './auth'
export * from './user'
export * from './patient'
export * from './device'
```

- [ ] **Step 9: Create index.ts (barrel export)**

```typescript
export * from './constants'
export * from './schemas'
```

- [ ] **Step 10: Build and verify**

```bash
pnpm install
```

```bash
pnpm --filter @iomtea/shared-types build
```

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add shared-types package with zod schemas"
```

---

## Task 3: Server Skeleton

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/src/index.ts`
- Create: `apps/server/src/env.ts`
- Create: `apps/server/src/db/index.ts`
- Create: `apps/server/src/trpc/context.ts`
- Create: `apps/server/src/trpc/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@iomtea/server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.0",
    "@hono/trpc-server": "^0.3.0",
    "@iomtea/shared-types": "workspace:*",
    "@node-rs/argon2": "^2.0.0",
    "@trpc/server": "^11.0.0",
    "drizzle-orm": "^0.38.0",
    "hono": "^4.6.0",
    "jose": "^5.9.0",
    "pino": "^9.5.0",
    "pino-pretty": "^13.0.0",
    "postgres": "^3.4.0",
    "uuid": "^11.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/uuid": "^10.0.0",
    "drizzle-kit": "^0.30.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create env.ts**

```typescript
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().default('postgresql://localhost:5432/iomtea'),
  JWT_SECRET: z.string().default('dev-secret-change-in-production'),
  JWT_EXPIRES_IN: z.string().default('2h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().default(3000),
})

export const env = envSchema.parse(process.env)
export type Env = z.infer<typeof envSchema>
```

- [ ] **Step 4: Create db/index.ts**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../env'
import * as schema from './schema'

const client = postgres(env.DATABASE_URL, { max: 20 })
export const db = drizzle(client, { schema })
export type DbClient = typeof db
```

- [ ] **Step 5: Create db/schema.ts (placeholder, populated in Task 4)**

```typescript
// Schema tables will be added in Task 4
export {}
```

- [ ] **Step 6: Create trpc/context.ts**

```typescript
import type { inferAsyncReturnType } from '@trpc/server'
import type { CreateHTTPContextOptions } from '@trpc/server/adapters/standalone'
import { db } from '../db'

export async function createContext(opts: CreateHTTPContextOptions) {
  return {
    db,
    req: opts.req,
    res: opts.res,
  }
}

export type Context = inferAsyncReturnType<typeof createContext>
```

- [ ] **Step 7: Create trpc/init.ts (separate to avoid circular deps with middleware)**

```typescript
import { initTRPC } from '@trpc/server'
import type { Context } from './context'

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure
export const middleware = t.middleware
export const mergeRouters = t.mergeRouters
```

- [ ] **Step 7b: Create trpc/index.ts (barrel re-export)**

```typescript
export { router, publicProcedure, middleware, mergeRouters } from './init'
```

Wait — no superjson. Let me fix:

```typescript
import { initTRPC, TRPCError } from '@trpc/server'
import type { Context } from './context'

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure
export const middleware = t.middleware
export const mergeRouters = t.mergeRouters
```

- [ ] **Step 8: Create trpc/routers/_app.ts**

```typescript
import { router } from '../index'

export const appRouter = router({})

export type AppRouter = typeof appRouter
```

- [ ] **Step 9: Create src/index.ts (entry point)**

```typescript
import { Hono } from 'hono'
import { trpcServer } from '@hono/trpc-server'
import { serve } from '@hono/node-server'
import { appRouter } from './trpc/routers/_app'
import { createContext } from './trpc/context'
import { env } from './env'
import pino from 'pino'

const logger = pino({
  transport: { target: 'pino-pretty', options: { colorize: true } },
})

const app = new Hono()

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext,
  }),
)

app.get('/health', (c) => c.json({ status: 'ok' }))

logger.info({ port: env.PORT }, 'starting server')
serve({ fetch: app.fetch, port: env.PORT })
```

- [ ] **Step 10: Install and verify server starts**

```bash
pnpm install
```

```bash
pnpm --filter @iomtea/server dev
```

Expected: server starts on port 3000. `GET /health` returns `{"status":"ok"}`.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add server skeleton with hono + trpc"
```

---

## Task 4: Database Schema

**Files:**
- Create: `apps/server/src/db/schema.ts`
- Create: `apps/server/drizzle.config.ts`

- [ ] **Step 1: Create drizzle.config.ts**

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/iomtea',
  },
})
```

- [ ] **Step 2: Create db/schema.ts (full schema)**

```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['admin', 'doctor', 'nurse', 'caregiver'])
export const deviceTypeEnum = pgEnum('device_type', ['mattress', 'vision', 'imu', 'generic'])
export const deviceStatusEnum = pgEnum('device_status', ['active', 'inactive', 'maintenance'])
export const patientStatusEnum = pgEnum('patient_status', ['active', 'discharged'])
export const alertSeverityEnum = pgEnum('alert_severity', ['critical', 'warning', 'info'])
export const alertStatusEnum = pgEnum('alert_status', ['active', 'acknowledged', 'resolved'])

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  role: roleEnum('role').notNull().default('caregiver'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const patients = pgTable('patients', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  birthDate: varchar('birth_date', { length: 10 }),
  gender: varchar('gender', { length: 10 }),
  room: varchar('room', { length: 20 }),
  bedNumber: varchar('bed_number', { length: 20 }),
  status: patientStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const devices = pgTable('devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  serialNumber: varchar('serial_number', { length: 100 }).notNull().unique(),
  deviceType: deviceTypeEnum('device_type').notNull(),
  status: deviceStatusEnum('status').notNull().default('active'),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
  lastSeen: timestamp('last_seen', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const dataStreams = pgTable('data_streams', {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  streamType: varchar('stream_type', { length: 20 }).notNull(), // 'metric' | 'event'
  dataType: varchar('data_type', { length: 50 }).notNull(),     // 'heart_rate', 'fall_detected', etc.
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const observations = pgTable('observations', {
  id: uuid('id').defaultRandom().primaryKey(),
  streamId: uuid('stream_id').notNull().references(() => dataStreams.id, { onDelete: 'cascade' }),
  valueNumeric: doublePrecision('value_numeric'),
  valueText: text('value_text'),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const alertEvents = pgTable('alert_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  streamId: uuid('stream_id').references(() => dataStreams.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 50 }).notNull(),
  severity: alertSeverityEnum('severity').notNull(),
  status: alertStatusEnum('status').notNull().default('active'),
  payload: jsonb('payload').default({}),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const ingestRawData = pgTable('ingest_raw_data', {
  id: uuid('id').defaultRandom().primaryKey(),
  source: varchar('source', { length: 50 }).notNull(),
  rawPayload: text('raw_payload').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('received'),
  error: text('error'),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  resource: varchar('resource', { length: 100 }).notNull(),
  resourceId: varchar('resource_id', { length: 50 }),
  details: jsonb('details').default({}),
  ip: varchar('ip', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

- [ ] **Step 3: Ensure PostgreSQL is running, then generate migrations**

```bash
pnpm --filter @iomtea/server db:generate
```

- [ ] **Step 4: Apply migrations**

```bash
pnpm --filter @iomtea/server db:migrate
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add drizzle schema with 11 tables"
```

---

## Task 5: Auth Module

**Files:**
- Create: `apps/server/src/lib/jwt.ts`
- Create: `apps/server/src/lib/password.ts`
- Create: `apps/server/src/trpc/routers/auth.ts`
- Modify: `apps/server/src/trpc/routers/_app.ts`
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1: Create lib/password.ts**

```typescript
import { hash, verify } from '@node-rs/argon2'

export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  })
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return verify(hash, password)
}
```

- [ ] **Step 2: Create lib/jwt.ts**

```typescript
import { SignJWT, jwtVerify } from 'jose'
import { env } from '../env'

const secret = new TextEncoder().encode(env.JWT_SECRET)
const alg = 'HS256'

export interface JwtPayload {
  sub: string // user id
  role: string
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/)
  if (!match) throw new Error(`Invalid duration: ${duration}`)
  const value = Number.parseInt(match[1])
  switch (match[2]) {
    case 's': return value
    case 'm': return value * 60
    case 'h': return value * 3600
    case 'd': return value * 86400
    default: return value
  }
}

export async function signAccessToken(payload: JwtPayload): Promise<string> {
  const expiresIn = parseDuration(env.JWT_EXPIRES_IN)
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(secret)
}

export async function signRefreshToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const expiresIn = parseDuration(env.JWT_REFRESH_EXPIRES_IN)
  const token = await new SignJWT({})
    .setProtectedHeader({ alg })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .setJti(crypto.randomUUID())
    .sign(secret)
  const expiresAt = new Date(Date.now() + expiresIn * 1000)
  return { token, expiresAt }
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, secret)
  return payload as unknown as JwtPayload
}
```

- [ ] **Step 3: Create trpc/routers/auth.ts**

```typescript
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
```

- [ ] **Step 4: Update _app.ts to include auth router**

```typescript
import { router } from '../index'
import { authRouter } from './auth'

export const appRouter = router({
  auth: authRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 5: Update shared-types/src/index.ts to re-export schemas for client use**

This is already done in Task 2 step 9. Verify it exports the auth schemas:

```typescript
export * from './constants'
export * from './schemas'
```

- [ ] **Step 6: Test auth flow manually**

Start server, then test with curl:

```bash
curl -X POST http://localhost:3000/trpc/auth.register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","displayName":"Admin"}'
```

Expected: returns `{ accessToken, refreshToken, expiresAt }`.

```bash
curl -X POST http://localhost:3000/trpc/auth.login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Expected: returns `{ accessToken, refreshToken, expiresAt }`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add auth module with register/login/refresh"
```

---

## Task 6: Core CRUD Routers

**Files:**
- Create: `apps/server/src/trpc/middleware/auth.ts`
- Create: `apps/server/src/trpc/routers/user.ts`
- Create: `apps/server/src/trpc/routers/patient.ts`
- Create: `apps/server/src/trpc/routers/device.ts`
- Create: `apps/server/src/trpc/routers/alert.ts`
- Modify: `apps/server/src/trpc/routers/_app.ts`
- Modify: `apps/server/src/trpc/index.ts` (add protectedProcedure)

- [ ] **Step 1: Create auth middleware**

```typescript
// apps/server/src/trpc/middleware/auth.ts
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
```

- [ ] **Step 2: Add protectedProcedure re-export to trpc/index.ts**

```typescript
export { router, publicProcedure, middleware, mergeRouters } from './init'
export { protectedProcedure } from './middleware/auth'
```

This makes `protectedProcedure` available to all routers importing from `../index`.

- [ ] **Step 3: Create user router**

```typescript
// apps/server/src/trpc/routers/user.ts
import { eq, like, or } from 'drizzle-orm'
import { z } from 'zod'
import { publicProcedure, protectedProcedure, router } from '../index'
import { userSchema, userUpdateSchema, userListInputSchema } from '@iomtea/shared-types'
import { users } from '../../db/schema'

export const userRouter = router({
  list: protectedProcedure
    .input(userListInputSchema)
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.pageSize
      const rows = await ctx.db
        .select()
        .from(users)
        .limit(input.pageSize)
        .offset(offset)
        .orderBy(users.createdAt)

      return rows.map((u) => userSchema.parse({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        createdAt: u.createdAt.getTime(),
      }))
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1)

    if (rows.length === 0) throw new Error('User not found')
    const u = rows[0]
    return userSchema.parse({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      createdAt: u.createdAt.getTime(),
    })
  }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), data: userUpdateSchema }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(users)
        .set(input.data)
        .where(eq(users.id, input.id))
        .returning()

      if (!updated) throw new Error('User not found')
      return userSchema.parse({
        id: updated.id,
        username: updated.username,
        displayName: updated.displayName,
        role: updated.role,
        createdAt: updated.createdAt.getTime(),
      })
    }),
})
```

- [ ] **Step 4: Create patient router**

```typescript
// apps/server/src/trpc/routers/patient.ts
import { eq } from 'drizzle-orm'
import { z } from 'zod'
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

      if (rows.length === 0) throw new Error('Patient not found')
      const p = rows[0]
      return patientSchema.parse({
        id: p.id,
        name: p.name,
        birthDate: p.birthDate,
        gender: p.gender,
        room: p.room,
        bedNumber: p.bedNumber,
        status: p.status,
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

      if (!updated) throw new Error('Patient not found')
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
```

- [ ] **Step 5: Create device router**

```typescript
// apps/server/src/trpc/routers/device.ts
import { eq } from 'drizzle-orm'
import { z } from 'zod'
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

      return rows.map((d) => deviceSchema.parse({
        id: d.id,
        serialNumber: d.serialNumber,
        deviceType: d.deviceType,
        status: d.status,
        patientId: d.patientId,
        lastSeen: d.lastSeen?.getTime() ?? null,
        createdAt: d.createdAt.getTime(),
      }))
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(devices)
        .where(eq(devices.id, input.id))
        .limit(1)

      if (rows.length === 0) throw new Error('Device not found')
      const d = rows[0]
      return deviceSchema.parse({
        id: d.id,
        serialNumber: d.serialNumber,
        deviceType: d.deviceType,
        status: d.status,
        patientId: d.patientId,
        lastSeen: d.lastSeen?.getTime() ?? null,
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

      if (!updated) throw new Error('Device not found')
      return deviceSchema.parse({
        id: updated.id,
        serialNumber: updated.serialNumber,
        deviceType: updated.deviceType,
        status: updated.status,
        patientId: updated.patientId,
        lastSeen: updated.lastSeen?.getTime() ?? null,
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
```

- [ ] **Step 6: Create alert router**

```typescript
// apps/server/src/trpc/routers/alert.ts
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import { protectedProcedure, router } from '../index'
import { ALERT_SEVERITIES, ALERT_STATUSES } from '@iomtea/shared-types'
import { alertEvents } from '../../db/schema'

export const alertRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        status: z.enum(ALERT_STATUSES).optional(),
        severity: z.enum(ALERT_SEVERITIES).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.pageSize
      let query = ctx.db.select().from(alertEvents).$dynamic()
      if (input.status) query = query.where(eq(alertEvents.status, input.status))
      if (input.severity) query = query.where(eq(alertEvents.severity, input.severity))
      const rows = await query
        .limit(input.pageSize)
        .offset(offset)
        .orderBy(desc(alertEvents.recordedAt))

      return rows.map((a) => ({
        id: a.id,
        deviceId: a.deviceId,
        patientId: a.patientId,
        type: a.type,
        severity: a.severity,
        status: a.status,
        payload: a.payload,
        recordedAt: a.recordedAt.getTime(),
        createdAt: a.createdAt.getTime(),
      }))
    }),

  acknowledge: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(alertEvents)
        .set({ status: 'acknowledged' })
        .where(eq(alertEvents.id, input.id))
        .returning()

      return { id: updated.id, status: updated.status }
    }),

  resolve: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(alertEvents)
        .set({ status: 'resolved' })
        .where(eq(alertEvents.id, input.id))
        .returning()

      return { id: updated.id, status: updated.status }
    }),
})
```

- [ ] **Step 7: Update _app.ts with all routers**

```typescript
import { router } from '../index'
import { authRouter } from './auth'
import { userRouter } from './user'
import { patientRouter } from './patient'
import { deviceRouter } from './device'
import { alertRouter } from './alert'

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  patient: patientRouter,
  device: deviceRouter,
  alert: alertRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 8: Verify server starts and routes work**

```bash
pnpm --filter @iomtea/server dev
```

Test with curl after registering a user:

```bash
# Login and save token
TOKEN=$(curl -s -X POST http://localhost:3000/trpc/auth.login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.result.data.accessToken')

# Create a patient
curl -X POST http://localhost:3000/trpc/patient.create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test Patient","gender":"male"}'

# List patients
curl http://localhost:3000/trpc/patient.list?input=%7B%7D \
  -H "Authorization: Bearer $TOKEN"
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add core crud routers (user, patient, device, alert)"
```

---

## Task 7: Web Client Skeleton + tRPC Integration

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.node.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/trpc.ts`
- Create: `apps/web/src/store/auth.ts`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/pages/LoginPage.tsx`
- Create: `apps/web/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@iomtea/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@iomtea/shared-types": "workspace:*",
    "@mantine/core": "^8.3.0",
    "@mantine/notifications": "^8.3.0",
    "@tanstack/react-query": "^5.60.0",
    "@tanstack/react-router": "^1.100.0",
    "@trpc/client": "^11.0.0",
    "@trpc/react-query": "^11.0.0",
    "@trpc/server": "^11.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
  },
})
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>IOMTea</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create src/store/auth.ts**

```typescript
import { create } from 'zustand'

interface AuthState {
  token: string | null
  refreshToken: string | null
  expiresAt: number | null
  setTokens: (access: string, refresh: string, expiresAt: number) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  expiresAt: Number(localStorage.getItem('expiresAt')) || null,
  setTokens: (token, refreshToken, expiresAt) => {
    localStorage.setItem('token', token)
    localStorage.setItem('refreshToken', refreshToken)
    localStorage.setItem('expiresAt', String(expiresAt))
    set({ token, refreshToken, expiresAt })
  },
  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('expiresAt')
    set({ token: null, refreshToken: null, expiresAt: null })
  },
}))
```

- [ ] **Step 6: Create src/trpc.ts**

```typescript
import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import type { AppRouter } from '@iomtea/shared-types'

// AppRouter type will be exported from server later — for now use any cast
// After Task 8, the server will export AppRouter to shared-types
export const trpc = createTRPCReact<AppRouter>()

export function getTrpcClient() {
  const token = localStorage.getItem('token')
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: '/trpc',
        headers: () => {
          const t = localStorage.getItem('token')
          return t ? { Authorization: `Bearer ${t}` } : {}
        },
      }),
    ],
  })
}
```

- [ ] **Step 7: Create src/main.tsx**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import { trpc, getTrpcClient } from './trpc'
import { App } from './App'

const queryClient = new QueryClient()
const trpcClient = getTrpcClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <Notifications />
          <App />
        </MantineProvider>
      </QueryClientProvider>
    </trpc.Provider>
  </React.StrictMode>,
)
```

- [ ] **Step 8: Create src/App.tsx**

```typescript
import { useAuthStore } from './store/auth'

function LoginPage() {
  const setTokens = useAuthStore((s) => s.setTokens)
  // ... simple login form (expand later)
  return <div>Login</div>
}

function DashboardPage() {
  const token = useAuthStore((s) => s.token)
  const logout = useAuthStore((s) => s.logout)

  return (
    <div>
      <h1>IOMTea Dashboard</h1>
      <button onClick={logout}>Logout</button>
    </div>
  )
}

export function App() {
  const token = useAuthStore((s) => s.token)
  return token ? <DashboardPage /> : <LoginPage />
}
```

- [ ] **Step 9: Install and test**

```bash
pnpm install
```

```bash
pnpm --filter @iomtea/web dev
```

Expected: web app loads at http://localhost:5173.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add web client skeleton with trpc + mantine"
```

---

## Task 8: tRPC Type Bridge (Server → Shared-Types → Web)

**Files:**
- Modify: `packages/shared-types/src/index.ts`
- Modify: `apps/server/src/index.ts` (add CORS + export AppRouter type)
- Modify: `apps/web/src/trpc.ts`

- [ ] **Step 1: Update shared-types to receive AppRouter type**

We need the AppRouter type in shared-types so web can import it. The cleanest way: server exports the `AppRouter` type, and shared-types re-exports it via a generated or manually synced file.

Option A (manual sync for now — simpler): shared-types defines a stub that server replaces.

Actually, the cleanest approach: shared-types has a file that the server "fills in". But that creates coupling.

Simplest approach: Store `AppRouter` type in shared-types directly. The tRPC routers can be defined to match.

Wait — the AppRouter type MUST come from the actual tRPC router definition. Let me think...

Best approach for Phase 1: The `AppRouter` type is defined in `shared-types` as a generic interface, and the server's actual router `satisfies` that interface. Web imports the type from shared-types.

Actually no — tRPC infers the router type. The simplest thing is to just have `shared-types` export a placeholder that the web uses with a type assertion, knowing the server is the real source.

For now, the pragmatic approach: web's `createTRPCReact<AppRouter>()` where `AppRouter` is exported from a shared-types file that mirrors the server's router structure as a type.

Let me use the approach: server exports a `.d.ts` or we just manually keep them in sync since the router structure is simple.

Actually the SIMPLEST approach: Just export the `AppRouter` type from the server package, and have shared-types re-export it.

```typescript
// shared-types/src/router.ts — this re-exports from server
export type { AppRouter } from '@iomtea/server/trpc/routers/_app'
```

But this would create a circular dependency if server depends on shared-types.

Let me use this approach instead:
1. shared-types defines NO AppRouter type
2. web imports AppRouter directly from server's source via a path alias
3. This adds server as a devDependency of web (just for types, not runtime)

Actually this is getting complicated. Let me use the pragmatic approach:

**store the AppRouter type definition in shared-types as a separate file that both server and web import.**

```typescript
// packages/shared-types/src/router.ts
import type { Router } from './_generated'
export type AppRouter = Router
```

Then server writes the actual router type to `_generated.ts`.

OK this is overengineering for Phase 1. Let me just do the simplest thing: **web imports the type directly from the server package using workspace references.** Since Turborepo handles build ordering, this works.

Let me update the plan:

- Server adds `"exports"` to package.json to expose the router type
- Web imports `import type { AppRouter } from '@iomtea/server'` (type-only import)
- Turborepo `dependsOn: ["^build"]` ensures server builds first

But we don't want to build server just for types. Even better: use `tsconfig` paths to reference server source directly.

OK you know what, let me just do the absolute simplest thing that will work NOW:

```typescript
// apps/web/src/trpc.ts
import { createTRPCReact } from '@trpc/react-query'
import type { Router } from '@trpc/server'
// Import the actual router type from the server package
import type { AppRouter } from '../../server/src/trpc/routers/_app'
```

With tsconfig paths configured to allow this. This is what the T3 stack does in monorepos.

Let me update the plan to reflect this approach. It's clean and simple.

- [ ] **Step 1: Add CORS to server and expose type via index export**

Modify `apps/server/src/index.ts`:

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { trpcServer } from '@hono/trpc-server'
import { serve } from '@hono/node-server'
import { appRouter } from './trpc/routers/_app'
import { createContext } from './trpc/context'
import { env } from './env'
import pino from 'pino'

const logger = pino({
  transport: { target: 'pino-pretty', options: { colorize: true } },
})

const app = new Hono()

app.use('*', cors({
  origin: ['http://localhost:5173'],
  credentials: true,
}))

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext,
    onError: ({ error }) => {
      logger.error({ err: error }, 'tRPC error')
    },
  }),
)

app.get('/health', (c) => c.json({ status: 'ok' }))

logger.info({ port: env.PORT }, 'starting server')
serve({ fetch: app.fetch, port: env.PORT })

export type { AppRouter } from './trpc/routers/_app'
```

- [ ] **Step 2: Update web vite.config.ts to add proxy and resolve alias**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/trpc': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 3: Update web tsconfig.json to allow cross-package type imports**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./src/*"],
      "@iomtea/shared-types": ["../../packages/shared-types/src/index.ts"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Update trpc.ts to import real AppRouter type**

```typescript
import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import type { AppRouter } from '@iomtea/server/src/trpc/routers/_app'

export const trpc = createTRPCReact<AppRouter>()

export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: '/trpc',
        headers() {
          const token = localStorage.getItem('token')
          return token ? { Authorization: `Bearer ${token}` } : {}
        },
      }),
    ],
  })
}
```

Wait — we need a path alias for `@iomtea/server`. Let me add it to web's tsconfig and vite config.

Actually, for simplicity in Phase 1, let me just use a relative import:

```typescript
import type { AppRouter } from '../../../server/src/trpc/routers/_app'
```

This works because both are in the monorepo and TS can resolve the relative path.

- [ ] **Step 5: Update web package.json to add server as devDependency for types**

```json
{
  "devDependencies": {
    "@iomtea/server": "workspace:*",
    ...
  }
}
```

Actually, with workspace reference and `"@iomtea/server"` package, we can `import type { AppRouter } from '@iomtea/server'` if server's package.json has proper exports.

OK let me just go with the relative import approach for Phase 1. Clean and zero config.

- [ ] **Step 5 (revised): Update src/trpc.ts**

```typescript
import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../../../server/src/trpc/routers/_app'

export const trpc = createTRPCReact<AppRouter>()

export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: '/trpc',
        headers() {
          const token = localStorage.getItem('token')
          return token ? { Authorization: `Bearer ${token}` } : {}
        },
      }),
    ],
  })
}
```

- [ ] **Step 6: Install and verify type resolution**

```bash
pnpm install
```

```bash
pnpm --filter @iomtea/web typecheck
```

Expected: No type errors. The AppRouter type from server is properly resolved.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: bridge tRPC types from server to web client"
```

---

## Not Yet Covered (Future Phases)

The following are deferred to subsequent plans:

- **Login/Dashboard pages** with full UI (Mantine forms, charts)
- **Taro miniapp** scaffold + tRPC adapter
- **MQTT/TCP ingest** modules
- **Data routing** (DataStream → Observation/AlertEvent)
- **Flutter** app strip-down
- **Docker** + CI/CD
- **Tests** (Vitest for server, React Testing Library for web)
