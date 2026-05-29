# AGENTS.md

## Project Identity

| Category | Value |
|----------|-------|
| **Name** | IOMTea |
| **Purpose** | 认知障碍老人居家风险行为数字孪生系统 |
| **Languages** | TypeScript (strict), Chinese documentation |
| **Monorepo** | pnpm + Turborepo |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **API Server** | Hono + Zod OpenAPI + Drizzle ORM + PostgreSQL |
| **Web Frontend** | React 19 + Mantine v8 + TanStack Router + Zustand |
| **Mini Program** | 原生 WeChat Mini Program (WXML/WXSS/JS) |
| **Hardware** | Python + Ultralytics YOLO + GPIO (Raspberry Pi 5) |
| **Auth** | JWT (jose) + Argon2 password hashing + refresh token rotation |
| **Real-time** | WebSocket (ws) at `/ws` with JWT auth |
| **DB Migrations** | drizzle-kit (`db:generate`, `db:migrate`, `db:push`) |
| **Lint/Format** | Biome (2-space indent, single quotes, no semicolons) |
| **Containerization** | Docker Compose |

## Directory Map

```
apps/server/          Backend API (Hono REST + OpenAPI + Drizzle + WebSocket)
  src/index.ts        Entry point: middleware, routes, bootstrap, MQTT, WS
  src/routes/         REST API routes (15 files, ~70 endpoints)
  src/modules/twin/   Digital twin engine (engine, state-machine, profiles, operations)
  src/mqtt-ingest/    MQTT device data ingestion (listener, router)
  src/middleware/      Hono middleware (JWT auth, RBAC)
  src/core/db/        Drizzle schema definitions + enums
apps/web/             React 19 web dashboard (Mantine v8 + TanStack Router)
  src/pages/          Page components (TwinStatusMatrix, AlertBoard, etc.)
  src/hooks/          React hooks (useTwinStatus, useRealtime)
  src/api/client.ts   HTTP API client (axios)
apps/miniapp/         WeChat mini program (native WXML/WXSS/JS)
hardware/raspberry-pi/  Raspberry Pi terminal (Python scripts + wiring guide)
packages/shared-types/  Shared Zod schemas, constants
docs/                 Project documentation
```

## Architecture

**Pattern**: DDD-Lite with 3 bounded contexts

| Context | Path | Responsibility |
|---------|------|---------------|
| **Core** | `apps/server/src/core/` | Auth, users, patients, alerts, data, RBAC |
| **Twin** | `apps/server/src/modules/twin/` | Digital twin engine, state machine, profiles, scenarios |
| **MQTT-Ingest** | `apps/server/src/mqtt-ingest/` | MQTT device data ingestion, PIN auth, metric normalization |

**Communication rules**: Contexts communicate only via `events` table or REST API calls. Never cross-import internal modules. Shared types in `@iomtea/shared-types` only.

**REST API**: 15 route files in `routes/` using Hono + @hono/zod-openapi. Each route uses:
- `createRoute()` from `@hono/zod-openapi` with request/response schemas
- `jwtAuth` middleware from `middleware/auth.ts` for authenticated routes
- `requirePermission('resource:action')` from `middleware/rbac.ts` for RBAC
- OpenAPI spec auto-generated → `/openapi.json` → Scalar API docs at `/docs`

**RBAC**: Roles: super_admin, admin, user. Permissions: `patient:read|write|delete`, `alert:read|manage`, `dashboard:view`, etc.

**State Machine**: 11-dimension health evaluation (8 vital + 3 behavior) → 4-level overall risk (stable/watch/alert/emergency). Configurable thresholds in `state-machine.ts`.

## Key Conventions

- **File size**: ≤200 lines per file, function-first design (no classes for stateless logic)
- **Router naming**: kebab-case files (`alert-rule.ts`)
- **Schemas**: Zod validation schemas in `routes/` files or `packages/shared-types/`
- **Imports**: No `as any` — use proper type helpers. No `any` in new code.
- **Error handling**: Return proper HTTP status codes, log errors via `createChildLogger`
- **Formatting**: Biome (2-space indent, single quotes, no semicolons, trailing commas)
- **DB access**: Direct Drizzle queries via `db`, no Repository interfaces
- **Metric handling**: Always use `normalizeMetric()` from `core/lib/metrics.ts` (never raw strings)
- **New routes**: Use `@hono/zod-openapi`'s `createRoute()` + `openapi()` pattern

## Build Commands

```bash
pnpm dev            # Start all apps in dev mode
pnpm build          # Build all apps
pnpm typecheck      # Type-check all packages
pnpm lint           # Lint all packages

# Per-app
pnpm dev --filter @iomtea/server
pnpm dev --filter @iomtea/web

# Database
cd apps/server && pnpm db:generate   # Generate migration from schema changes
cd apps/server && pnpm db:migrate    # Apply migrations
cd apps/server && pnpm db:push       # Push schema directly (dev only)
```

## Database

**Engine**: PostgreSQL via Drizzle ORM.

**Core tables**: `users`, `refresh_tokens`, `patients`, `events`, `users_pin`, `user_patient_links`
**Feature tables**: `medications`, `plans`, `plan_completions`, `credit_transactions`, `form_definitions`, `form_responses`, `patient_tags`, `patient_tag_links`, `sim_configs`, `sim_patients`

**Key design**: `events` table is the unified data bus — all observations, alerts, and state transitions flow through it. The `value` column is `jsonb` supporting numbers, strings, and booleans.

## Auth

- **JWT**: Signed with `jose` library. Access token in `Authorization: Bearer <token>` header.
- **Password**: Argon2 hashing via `@node-rs/argon2`.
- **Refresh tokens**: Rotated on use (insert new, then delete old — atomic rotation).
- **RBAC**: `requirePermission` middleware checks user's role permissions.
- **WebSocket**: Token required as `?token=` query parameter. Invalid tokens receive 4001 close code.

## Bootstrap Sequence (index.ts)

1. Database connection check
2. Auto-create demo account (`demo`/`demo123`, role=admin) on empty system
3. Optional super admin creation (via env vars)
4. Seed demo data (3 patients + 48h events + alerts + medications) on empty patients table
5. Seed RBAC permissions
6. Start MQTT listener (if enabled)
7. Start HTTP server + WebSocket at `/ws`

## State Machine Dimensions

11 dimensions evaluated each tick:
- **Vital**: heart_rate, spo2, temperature, systolic_bp, diastolic_bp, glucose, motion_index, posture
- **Behavior**: night_wandering, repetitive_behavior, wandering_risk

Overall risk levels: stable (0 warnings) → watch (1) → alert (2+) → emergency (critical+ or fall)

## Key Files

| File | Purpose |
|------|---------|
| `apps/server/src/index.ts` | Server entry point, bootstrap, route mounting |
| `apps/server/src/modules/twin/engine.ts` | Simulation tick loop, state tracking |
| `apps/server/src/modules/twin/state-machine.ts` | 11-dimension health evaluation |
| `apps/server/src/modules/twin/profiles.ts` | 5 patient profiles with baselines |
| `apps/server/src/modules/twin/operations.ts` | Scenario injections (11 types) |
| `apps/server/src/mqtt-ingest/router.ts` | MQTT message routing, PIN auth |
| `apps/server/src/routes/twin.ts` | Twin REST API (simulation + status matrix + ML) |
| `apps/web/src/pages/TwinStatusMatrix.tsx` | Risk status matrix dashboard |
| `apps/web/src/hooks/useTwinStatus.ts` | Status matrix polling hook |
| `hardware/raspberry-pi/main.py` | Pi main loop (20s sensor→YOLO→MQTT) |

## Important Notes

- **Flutter**: Archived (code at `apps/flutter/`, CI removed)
- **CI/CD**: All GitHub Actions workflows removed (deploy-server, deploy-web, flutter)
- **Digital twin is in-memory**: `engine.ts` uses module-level Maps. Server restart = all simulations lost.
- **No more tRPC**: Migrated to Hono REST + OpenAPI. Route files in `src/routes/`, not `core/trpc/`.
- **No more `sim/` directory**: Merged into `modules/twin/`.
- **No Error Boundary**: Frontend uses `StateComponents.tsx` + `QueryGate.tsx` for loading/error/empty states.
- **No appointments module**: Removed 2026-05.
- **Thesis alignment**: See `docs/thesis-alignment.md` for system-to-thesis mapping.

## Future Development Directions

The following areas are natural next steps for this project, ordered by priority:

### P1 — Core Completion

- **LSTM risk prediction model**: `ml-*` API routes provide the data pipeline (time-series export, window aggregation, state labels). A PyTorch model needs to be trained on historical events data and integrated into the state machine for predictive risk scoring instead of reactive threshold-based evaluation.
- **Intervention suggestion engine**: Current alerts carry free-text intervention suggestions in `tags.intervention_suggestion`. A structured rule engine or knowledge base could generate suggestions dynamically based on behavior type, severity, and patient history.
- **Mini program data sync**: `apps/miniapp/` stores data only in localStorage. REST API calls need to be added for server synchronization.

### P2 — Production Hardening

- **Error Boundary**: React Error Boundary wrapper around the entire frontend to prevent white-screen crashes.
- **State persistence for twin engine**: Move simulation state from in-memory Maps to database-backed storage so simulations survive server restarts.
- **OpenAPI type generation**: Frontend TypeScript types should be auto-generated from the server's OpenAPI spec (`/openapi.json`) rather than manually maintained.
- **Responsive layout**: The 11-dimension status matrix table needs responsive handling for tablet and mobile viewports.

### P3 — Thesis / Research Extension

- **3D twin visualization**: Replace the 2D status matrix with a Blender-rendered 3D elderly avatar and home environment (per the thesis "three-level twin" requirement).
- **Federated learning**: Extend `POST /twin/ml-features` with privacy-preserving cross-family model training infrastructure.
- **Multi-modal sensor fusion**: Integrate real bio-radar, BCG mattress, and environmental sensor data streams (currently using simulated data from the twin engine).
- **ZBI/SUS scale integration**: Embed the Zarit Caregiver Burden Interview and System Usability Scale as in-app forms for thesis data collection.

### P4 — Developer Experience

- **Docker Compose profiles**: Add a `dev` profile to docker-compose.yml that starts only postgres (no mosquitto, no build services).
- **Test coverage**: The project has minimal tests (~3 test files). Priority areas: state-machine.ts threshold logic, MQTT router metric normalization, REST API integration tests.
- **CI/CD pipeline**: If deploying to production, restore GitHub Actions workflows for automated build and deployment.
