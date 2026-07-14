# Simulator Profiles & 3D Digital Twin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand simulator from 1 to 5 patient profiles with 7 new physiological metrics (BP, glucose, motion, posture, ECG waveform, respiratory waveform, pressure distribution) and build a Web 3D digital twin using React Three Fiber with tile-grid procedural home scene generation.

**Architecture:** Server-side: new profile files + new physiology generator modules (pure functions) + engine integration. Frontend: R3F + Drei canvas with tile-grid room generator, anchor-based entity placement, live data polling via existing tRPC infrastructure.

**Tech Stack:** TypeScript, Node.js, Drizzle ORM, React 19, Vite 6, Mantine 8, @react-three/fiber, @react-three/drei, three

**Spec:** `docs/superpowers/specs/2026-05-10-simulator-profiles-3d-digital-twin-design.md`

---

## Phase 2a: Simulator Profiles + New Metrics (Server Only)

### Task 1: Extend PatientProfile types

**Files:**
- Modify: `apps/server/src/simulator/types.ts`

- [ ] **Step 1: Add new baseline fields and types to types.ts**

Replace the `baseline` field in `PatientProfile`:

```typescript
export interface PatientProfile {
  id: string
  name: string
  demographics: {
    ageRange: [number, number]
    gender: 'male' | 'female' | 'other' | 'any'
    weightRange: [number, number]
  }
  baseline: {
    heartRate: { resting: number; variability: number; circadianFactor: number }
    respiratoryRate: { resting: number; variability: number }
    temperature: { resting: number; variability: number }
    spO2: { resting: number; variability: number }
    bloodPressure: { systolic: number; diastolic: number; variability: number }
    bloodGlucose: { fasting: number; variability: number; postprandialSpike: number }
  }
  conditions: string[]
  schedule: {
    sleep: { start: string; end: string }
    meals: { time: string }[]
    events: { type: string; window: [string, string]; probability: number }[]
  }
  devices: string[]
  alerts: {
    metric: string
    condition: 'gt' | 'lt' | 'eq'
    threshold: number
    severity: 'critical' | 'warning' | 'info'
    message: string
  }[]
}
```

Add new types below existing `ActivityLevel`:

```typescript
export type Posture = 'lying' | 'sitting' | 'standing' | 'walking'

export interface BPReading {
  systolic: number
  diastolic: number
}

export type PressureGrid = number[][]
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: TypeScript errors in existing profiles that don't have the new baseline fields (will be fixed in Task 9).

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/simulator/types.ts
git commit -m "feat: extend PatientProfile types with BP, glucose, posture, pressure grid"
```

---

### Task 2: Create blood pressure generator

**Files:**
- Create: `apps/server/src/simulator/physiology/blood-pressure.ts`

- [ ] **Step 1: Write the module**

```typescript
import type { ActivityLevel } from '../types'

function gaussian(mean: number, std: number): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

const activitySystolicMod: Record<ActivityLevel, number> = {
  resting: 0, light: 3, moderate: 10, heavy: 20,
}

export function generateBloodPressure(
  systolicBaseline: number,
  diastolicBaseline: number,
  variability: number,
  hourOfDay: number,
  activity: ActivityLevel,
  hr: number,
): { systolic: number; diastolic: number } {
  const circadian = Math.sin((hourOfDay - 3) * Math.PI / 12) * 3
  const activityVal = activitySystolicMod[activity]
  const hrCoupling = (hr - 70) * 0.15
  const noise = gaussian(0, variability)
  const systolic = clamp(systolicBaseline + circadian + activityVal + hrCoupling + noise, 70, 220)
  const diastolic = clamp(diastolicBaseline + (circadian + hrCoupling) * 0.6 + gaussian(0, variability * 0.7), 40, 130)
  return {
    systolic: Math.round(systolic),
    diastolic: Math.round(diastolic),
  }
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/simulator/physiology/blood-pressure.ts
git commit -m "feat: add blood pressure generator"
```

---

### Task 3: Create blood glucose generator

**Files:**
- Create: `apps/server/src/simulator/physiology/glucose.ts`

- [ ] **Step 1: Write the module**

```typescript
function gaussian(mean: number, std: number): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function generateGlucose(
  fastingBaseline: number,
  variability: number,
  postprandialSpike: number,
  hourOfDay: number,
  mealTimes: { time: string }[],
  simMinutes: number,
): number {
  let postprandialEffect = 0
  for (const meal of mealTimes) {
    const [h, m] = meal.time.split(':').map(Number)
    const mealMin = h * 60 + m
    const elapsed = simMinutes - mealMin
    if (elapsed >= 0 && elapsed < 180) {
      const peak = fastingBaseline + postprandialSpike
      const decay = peak - fastingBaseline
      const factor = elapsed < 30
        ? elapsed / 30
        : Math.exp(-(elapsed - 30) / 60)
      postprandialEffect += decay * factor
    }
  }
  const hour = Math.floor(hourOfDay)
  const nocturnalDrift = (hour >= 23 || hour < 5)
    ? -0.5 - Math.random() * 1.0
    : 0
  const noise = gaussian(0, variability)
  return Math.round((fastingBaseline + postprandialEffect + nocturnalDrift + noise) * 10) / 10
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/simulator/physiology/glucose.ts
git commit -m "feat: add blood glucose generator with postprandial model"
```

---

### Task 4: Create motion index generator

**Files:**
- Create: `apps/server/src/simulator/physiology/motion.ts`

- [ ] **Step 1: Write the module**

```typescript
import type { ActivityLevel } from '../types'

const baseMotion: Record<ActivityLevel, number> = {
  resting: 0.01,
  light: 0.05,
  moderate: 0.15,
  heavy: 0.4,
}

function simpleJitter(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

let jitterCounter = 0

export function generateMotionIndex(activity: ActivityLevel): number {
  jitterCounter++
  const base = baseMotion[activity]
  const jitter = simpleJitter(jitterCounter) * base * 0.5
  return Math.max(0, Math.round((base + jitter) * 1000) / 1000)
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/simulator/physiology/motion.ts
git commit -m "feat: add motion index generator"
```

---

### Task 5: Create posture generator

**Files:**
- Create: `apps/server/src/simulator/physiology/posture.ts`

- [ ] **Step 1: Write the module**

```typescript
import type { Posture, ActivityLevel } from '../types'

interface TransitionMap {
  [key: string]: { next: Posture; prob: number }[]
}

const transitions: Record<Posture, TransitionMap> = {
  lying: {
    resting: [{ next: 'lying', prob: 0.95 }, { next: 'sitting', prob: 0.05 }],
    light: [{ next: 'lying', prob: 0.1 }, { next: 'sitting', prob: 0.8 }, { next: 'standing', prob: 0.1 }],
    moderate: [{ next: 'sitting', prob: 0.3 }, { next: 'standing', prob: 0.6 }, { next: 'walking', prob: 0.1 }],
    heavy: [{ next: 'standing', prob: 0.3 }, { next: 'walking', prob: 0.7 }],
  },
  sitting: {
    resting: [{ next: 'sitting', prob: 0.8 }, { next: 'lying', prob: 0.2 }],
    light: [{ next: 'sitting', prob: 0.7 }, { next: 'standing', prob: 0.25 }, { next: 'lying', prob: 0.05 }],
    moderate: [{ next: 'sitting', prob: 0.2 }, { next: 'standing', prob: 0.7 }, { next: 'walking', prob: 0.1 }],
    heavy: [{ next: 'standing', prob: 0.4 }, { next: 'walking', prob: 0.6 }],
  },
  standing: {
    resting: [{ next: 'standing', prob: 0.4 }, { next: 'sitting', prob: 0.5 }, { next: 'lying', prob: 0.1 }],
    light: [{ next: 'standing', prob: 0.5 }, { next: 'walking', prob: 0.3 }, { next: 'sitting', prob: 0.2 }],
    moderate: [{ next: 'standing', prob: 0.3 }, { next: 'walking', prob: 0.6 }, { next: 'sitting', prob: 0.1 }],
    heavy: [{ next: 'walking', prob: 0.8 }, { next: 'standing', prob: 0.2 }],
  },
  walking: {
    resting: [{ next: 'walking', prob: 0.1 }, { next: 'standing', prob: 0.7 }, { next: 'sitting', prob: 0.2 }],
    light: [{ next: 'walking', prob: 0.3 }, { next: 'standing', prob: 0.6 }, { next: 'sitting', prob: 0.1 }],
    moderate: [{ next: 'walking', prob: 0.6 }, { next: 'standing', prob: 0.4 }],
    heavy: [{ next: 'walking', prob: 0.9 }, { next: 'standing', prob: 0.1 }],
  },
}

export function generatePosture(
  activity: ActivityLevel,
  hourOfDay: number,
  bedStatus: number,
  previousPosture: Posture,
): Posture {
  if (bedStatus === 1) { return 'lying' }
  const options = transitions[previousPosture][activity] || [{ next: previousPosture, prob: 1 }]
  const r = Math.random()
  let cumulative = 0
  for (const opt of options) {
    cumulative += opt.prob
    if (r <= cumulative) return opt.next
  }
  return options[options.length - 1].next
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/simulator/physiology/posture.ts
git commit -m "feat: add posture state machine generator"
```

---

### Task 6: Create ECG waveform generator

**Files:**
- Create: `apps/server/src/simulator/physiology/ecg-waveform.ts`

- [ ] **Step 1: Write the module**

```typescript
export function generateECGSamples(hr: number): number[] {
  const samples: number[] = []
  const sampleCount = 50
  const rrInterval = 60 / hr
  const totalDuration = rrInterval
  const dt = totalDuration / sampleCount

  for (let i = 0; i < sampleCount; i++) {
    let t = i * dt

    // Normalize t within one cardiac cycle (0..1)
    const phase = t / totalDuration

    // P wave (atrial depolarization): around 0.15-0.25 of cycle
    const pCenter = 0.20
    const pWidth = 0.04
    const pAmplitude = 0.15
    const pWave = pAmplitude * Math.exp(-Math.pow((phase - pCenter) / pWidth, 2))

    // QRS complex (ventricular depolarization): around 0.30-0.40
    const qrsCenter = 0.35
    const qrsWidth = 0.015
    const qrsAmplitude = 1.0
    const qrsWave = qrsAmplitude * Math.exp(-Math.pow((phase - qrsCenter) / qrsWidth, 2))
    // Q wave dip
    const qDip = -0.2 * Math.exp(-Math.pow((phase - 0.32) / 0.008, 2))
    // S wave dip
    const sDip = -0.3 * Math.exp(-Math.pow((phase - 0.38) / 0.008, 2))

    // T wave (repolarization): around 0.50-0.70
    const tCenter = 0.60
    const tWidth = 0.06
    const tAmplitude = 0.3
    const tWave = tAmplitude * Math.exp(-Math.pow((phase - tCenter) / tWidth, 2))

    const value = pWave + qDip + qrsWave + sDip + tWave
    samples.push(Math.round(value * 1000) / 1000)
  }

  return samples
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/simulator/physiology/ecg-waveform.ts
git commit -m "feat: add ECG waveform synthesizer"
```

---

### Task 7: Create respiratory waveform generator

**Files:**
- Create: `apps/server/src/simulator/physiology/respiratory-waveform.ts`

- [ ] **Step 1: Write the module**

```typescript
function simplePerlin(seed: number): number {
  const x = Math.sin(seed * 6.283) * 0.5 + 0.5
  return x * 2 - 1
}

export function generateRespiratoryWaveform(rr: number): number[] {
  const samples: number[] = []
  const sampleCount = 50
  const duration = 5 // 5-second window
  const dt = duration / sampleCount
  const freq = rr / 60 // Hz
  let noiseIdx = Math.random() * 1000

  for (let i = 0; i < sampleCount; i++) {
    const t = i * dt
    // Fundamental + 2nd harmonic
    const fundamental = Math.sin(2 * Math.PI * freq * t)
    const harmonic = Math.sin(4 * Math.PI * freq * t + 0.5) * 0.3
    // Breath-to-breath variability
    const variability = simplePerlin(noiseIdx + i * 0.1) * 0.05
    // Combine and normalize
    const raw = (fundamental + harmonic) / 1.3
    samples.push(Math.round((raw + variability) * 1000) / 1000)
  }

  return samples
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/simulator/physiology/respiratory-waveform.ts
git commit -m "feat: add respiratory waveform generator"
```

---

### Task 8: Create body pressure distribution generator

**Files:**
- Create: `apps/server/src/simulator/physiology/pressure-distribution.ts`

- [ ] **Step 1: Write the module**

```typescript
import type { Posture } from '../types'

export type PressureGrid = number[][]

export function generatePressureDistribution(
  posture: Posture,
  weight: number,
): PressureGrid {
  const grid: PressureGrid = Array.from({ length: 4 }, () => Array(4).fill(0))
  const weightFactor = weight / 70

  if (posture === 'walking' || posture === 'standing') {
    return grid.map(row => row.map(() => Math.round(Math.random() * 3))) // minimal residual
  }

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let basePressure = 0

      if (posture === 'lying') {
        const distToCenter = Math.sqrt((r - 1.5) ** 2 + (c - 1.5) ** 2)
        basePressure = 60 * Math.exp(-distToCenter * 0.6)
        // Symmetrical
        basePressure += 10 * (1 - Math.abs(r - 1.5) / 2)
      } else if (posture === 'sitting') {
        const distToBack = Math.abs(c - 0)
        const distToCenter = Math.abs(r - 1.5)
        basePressure = 90 * Math.exp(-distToBack * 0.5) * Math.exp(-distToCenter * 0.3)
      } else {
        // side-lying
        const distToLeft = Math.abs(c - 0)
        basePressure = 80 * Math.exp(-distToLeft * 0.4) * Math.exp(-Math.abs(r - 1.5) * 0.3)
      }

      const noise = (Math.random() - 0.5) * 10
      grid[r][c] = Math.max(0, Math.round(basePressure * weightFactor + noise))
    }
  }

  return grid
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/simulator/physiology/pressure-distribution.ts
git commit -m "feat: add body pressure distribution generator"
```

---

### Task 9: Update elderly-cardiac profile with new baselines

**Files:**
- Modify: `apps/server/src/simulator/profiles/elderly-cardiac.ts`

- [ ] **Step 1: Update profile to include new baseline fields**

```typescript
import type { PatientProfile } from '../types'

export const elderlyCardiacProfile: PatientProfile = {
  id: 'elderly-cardiac',
  name: '老年心血管患者',
  demographics: {
    ageRange: [65, 85],
    gender: 'any',
    weightRange: [50, 80],
  },
  baseline: {
    heartRate: { resting: 78, variability: 8, circadianFactor: 6 },
    respiratoryRate: { resting: 18, variability: 3 },
    temperature: { resting: 36.5, variability: 0.3 },
    spO2: { resting: 96, variability: 1.5 },
    bloodPressure: { systolic: 135, diastolic: 85, variability: 5 },
    bloodGlucose: { fasting: 5.2, variability: 0.4, postprandialSpike: 3.5 },
  },
  conditions: ['hypertension', 'fall_risk'],
  schedule: {
    sleep: { start: '21:00', end: '06:00' },
    meals: [{ time: '07:00' }, { time: '12:00' }, { time: '18:00' }],
    events: [
      { type: 'bed_exit', window: ['02:00', '04:00'], probability: 0.35 },
    ],
  },
  devices: ['mattress'],
  alerts: [
    { metric: 'heart_rate', condition: 'gt', threshold: 130, severity: 'warning', message: '心动过速' },
    { metric: 'heart_rate', condition: 'lt', threshold: 45, severity: 'critical', message: '心动过缓' },
    { metric: 'spO2', condition: 'lt', threshold: 90, severity: 'critical', message: '低血氧' },
    { metric: 'systolic_bp', condition: 'gt', threshold: 160, severity: 'warning', message: '高血压' },
  ],
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/simulator/profiles/elderly-cardiac.ts
git commit -m "feat: add BP and glucose baselines to elderly-cardiac profile"
```

---

### Task 10: Create post-surgery profile

**Files:**
- Create: `apps/server/src/simulator/profiles/post-surgery.ts`

- [ ] **Step 1: Write the profile**

```typescript
import type { PatientProfile } from '../types'

export const postSurgeryProfile: PatientProfile = {
  id: 'post-surgery',
  name: '术后恢复患者',
  demographics: {
    ageRange: [30, 70],
    gender: 'any',
    weightRange: [45, 90],
  },
  baseline: {
    heartRate: { resting: 85, variability: 10, circadianFactor: 5 },
    respiratoryRate: { resting: 20, variability: 4 },
    temperature: { resting: 37.2, variability: 0.5 },
    spO2: { resting: 94, variability: 2 },
    bloodPressure: { systolic: 125, diastolic: 80, variability: 6 },
    bloodGlucose: { fasting: 6.0, variability: 0.5, postprandialSpike: 3 },
  },
  conditions: ['post_op', 'infection_risk'],
  schedule: {
    sleep: { start: '22:00', end: '06:00' },
    meals: [{ time: '07:30' }, { time: '12:30' }, { time: '18:30' }],
    events: [
      { type: 'position_change', window: ['08:00', '18:00'], probability: 0.5 },
      { type: 'bed_exit', window: ['22:00', '02:00'], probability: 0.1 },
    ],
  },
  devices: ['mattress'],
  alerts: [
    { metric: 'heart_rate', condition: 'gt', threshold: 120, severity: 'warning', message: '心动过速' },
    { metric: 'temperature', condition: 'gt', threshold: 38.5, severity: 'critical', message: '术后发热' },
    { metric: 'spO2', condition: 'lt', threshold: 92, severity: 'critical', message: '低血氧' },
    { metric: 'systolic_bp', condition: 'lt', threshold: 90, severity: 'critical', message: '低血压(出血风险)' },
  ],
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/simulator/profiles/post-surgery.ts
git commit -m "feat: add post-surgery patient profile"
```

---

### Task 11: Create diabetes profile

**Files:**
- Create: `apps/server/src/simulator/profiles/diabetes.ts`

- [ ] **Step 1: Write the profile**

```typescript
import type { PatientProfile } from '../types'

export const diabetesProfile: PatientProfile = {
  id: 'diabetes',
  name: '糖尿病患者',
  demographics: {
    ageRange: [40, 75],
    gender: 'any',
    weightRange: [55, 100],
  },
  baseline: {
    heartRate: { resting: 72, variability: 7, circadianFactor: 4 },
    respiratoryRate: { resting: 16, variability: 3 },
    temperature: { resting: 36.5, variability: 0.3 },
    spO2: { resting: 97, variability: 1 },
    bloodPressure: { systolic: 130, diastolic: 82, variability: 5 },
    bloodGlucose: { fasting: 5.5, variability: 0.6, postprandialSpike: 5 },
  },
  conditions: ['type2_diabetes', 'neuropathy'],
  schedule: {
    sleep: { start: '22:00', end: '06:00' },
    meals: [{ time: '07:00' }, { time: '12:00' }, { time: '18:00' }],
    events: [
      { type: 'bed_exit', window: ['02:00', '05:00'], probability: 0.15 },
    ],
  },
  devices: ['mattress'],
  alerts: [
    { metric: 'glucose', condition: 'gt', threshold: 11, severity: 'critical', message: '高血糖' },
    { metric: 'glucose', condition: 'lt', threshold: 3.5, severity: 'critical', message: '低血糖' },
    { metric: 'heart_rate', condition: 'gt', threshold: 110, severity: 'warning', message: '心动过速' },
  ],
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/simulator/profiles/diabetes.ts
git commit -m "feat: add diabetes patient profile"
```

---

### Task 12: Create COPD respiratory profile

**Files:**
- Create: `apps/server/src/simulator/profiles/copd-respiratory.ts`

- [ ] **Step 1: Write the profile**

```typescript
import type { PatientProfile } from '../types'

export const copdRespiratoryProfile: PatientProfile = {
  id: 'copd-respiratory',
  name: 'COPD呼吸疾病患者',
  demographics: {
    ageRange: [55, 85],
    gender: 'any',
    weightRange: [40, 70],
  },
  baseline: {
    heartRate: { resting: 95, variability: 12, circadianFactor: 7 },
    respiratoryRate: { resting: 25, variability: 5 },
    temperature: { resting: 36.8, variability: 0.4 },
    spO2: { resting: 92, variability: 2.5 },
    bloodPressure: { systolic: 120, diastolic: 75, variability: 4 },
    bloodGlucose: { fasting: 5.0, variability: 0.3, postprandialSpike: 2.5 },
  },
  conditions: ['copd', 'hypoxemia_risk'],
  schedule: {
    sleep: { start: '22:00', end: '05:00' },
    meals: [{ time: '08:00' }, { time: '12:00' }, { time: '17:30' }],
    events: [
      { type: 'bed_exit', window: ['01:00', '05:00'], probability: 0.25 },
    ],
  },
  devices: ['mattress'],
  alerts: [
    { metric: 'spO2', condition: 'lt', threshold: 88, severity: 'critical', message: '严重低血氧' },
    { metric: 'resp_rate', condition: 'gt', threshold: 35, severity: 'critical', message: '呼吸窘迫' },
    { metric: 'heart_rate', condition: 'gt', threshold: 120, severity: 'warning', message: '心动过速' },
  ],
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/simulator/profiles/copd-respiratory.ts
git commit -m "feat: add COPD respiratory patient profile"
```

---

### Task 13: Create maternity profile

**Files:**
- Create: `apps/server/src/simulator/profiles/maternity.ts`

- [ ] **Step 1: Write the profile**

```typescript
import type { PatientProfile } from '../types'

export const maternityProfile: PatientProfile = {
  id: 'maternity',
  name: '孕产监护',
  demographics: {
    ageRange: [22, 42],
    gender: 'female',
    weightRange: [55, 90],
  },
  baseline: {
    heartRate: { resting: 90, variability: 10, circadianFactor: 5 },
    respiratoryRate: { resting: 22, variability: 4 },
    temperature: { resting: 36.8, variability: 0.3 },
    spO2: { resting: 97, variability: 1.5 },
    bloodPressure: { systolic: 120, diastolic: 70, variability: 5 },
    bloodGlucose: { fasting: 4.8, variability: 0.3, postprandialSpike: 4 },
  },
  conditions: ['third_trimester', 'gestational_hypertension_risk'],
  schedule: {
    sleep: { start: '22:00', end: '06:30' },
    meals: [{ time: '07:30' }, { time: '12:00' }, { time: '18:30' }],
    events: [
      { type: 'bed_exit', window: ['03:00', '05:00'], probability: 0.4 },
    ],
  },
  devices: ['mattress'],
  alerts: [
    { metric: 'heart_rate', condition: 'gt', threshold: 140, severity: 'critical', message: '心动过速' },
    { metric: 'heart_rate', condition: 'lt', threshold: 50, severity: 'warning', message: '心动过缓' },
    { metric: 'systolic_bp', condition: 'gt', threshold: 140, severity: 'critical', message: '子痫前期风险' },
    { metric: 'spO2', condition: 'lt', threshold: 94, severity: 'warning', message: '低血氧' },
  ],
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/simulator/profiles/maternity.ts
git commit -m "feat: add maternity patient profile"
```

---

### Task 14: Register new profiles in index

**Files:**
- Modify: `apps/server/src/simulator/profiles/index.ts`

- [ ] **Step 1: Add imports and registry entries**

```typescript
import type { PatientProfile } from '../types'
import { elderlyCardiacProfile } from './elderly-cardiac'
import { postSurgeryProfile } from './post-surgery'
import { diabetesProfile } from './diabetes'
import { copdRespiratoryProfile } from './copd-respiratory'
import { maternityProfile } from './maternity'

export const profiles: Record<string, PatientProfile> = {
  'elderly-cardiac': elderlyCardiacProfile,
  'post-surgery': postSurgeryProfile,
  'diabetes': diabetesProfile,
  'copd-respiratory': copdRespiratoryProfile,
  'maternity': maternityProfile,
}

export function getProfile(id: string): PatientProfile {
  const p = profiles[id]
  if (!p) throw new Error(`Profile not found: ${id}`)
  return p
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/simulator/profiles/index.ts
git commit -m "feat: register all 5 patient profiles"
```

---

### Task 15: Update engine to generate all new metrics

**Files:**
- Modify: `apps/server/src/simulator/engine.ts`

- [ ] **Step 1: Add imports for new generators**

Replace existing imports at top of file with:

```typescript
import { SimulationClock } from './clock'
import type { PatientInstance, SimulatedEvent, WardState, PatientProfile, Posture } from './types'
import { generateHeartRate, generateRespiratoryRate, generateTemperature, generateSpO2, generateBedStatus } from './physiology/vitals'
import type { ActivityLevel } from './physiology/vitals'
import { generateBloodPressure } from './physiology/blood-pressure'
import { generateGlucose } from './physiology/glucose'
import { generateMotionIndex } from './physiology/motion'
import { generatePosture } from './physiology/posture'
import { generateECGSamples } from './physiology/ecg-waveform'
import { generateRespiratoryWaveform } from './physiology/respiratory-waveform'
import { generatePressureDistribution } from './physiology/pressure-distribution'
import { createPatientInstance, type FactoryDeps } from './factory'
import { getProfile } from './profiles'
```

- [ ] **Step 2: Update tickWard to generate all new metrics**

Replace the vitals generation block inside `tickWard` (from `const hr =` through `const bed =`) with:

```typescript
    const hr = generateHeartRate(patient.baselines.heartRate.resting, patient.baselines.heartRate.variability, patient.baselines.heartRate.circadianFactor, hour, patient.activity, ward.clock.tick)
    const rr = generateRespiratoryRate(patient.baselines.respiratoryRate.resting, patient.baselines.respiratoryRate.variability, patient.activity, hr)
    const temp = generateTemperature(patient.baselines.temperature.resting, patient.baselines.temperature.variability, hour)
    const spo2 = generateSpO2(patient.baselines.spO2.resting, patient.baselines.spO2.variability)
    const bed = generateBedStatus(patient.activity, hour, profile.schedule.events)

    const bp = generateBloodPressure(patient.baselines.bloodPressure.systolic, patient.baselines.bloodPressure.diastolic, patient.baselines.bloodPressure.variability, hour, patient.activity, hr)

    const simMinutes = ward.clock.simulatedTime.getHours() * 60 + ward.clock.simulatedTime.getMinutes()
    const glucose = generateGlucose(patient.baselines.bloodGlucose.fasting, patient.baselines.bloodGlucose.variability, patient.baselines.bloodGlucose.postprandialSpike, hour, profile.schedule.meals, simMinutes)

    const motion = generateMotionIndex(patient.activity)

    const patientData = patient as PatientInstance & { posture?: Posture }
    const posture = generatePosture(patient.activity, hour, bed, patientData.posture || 'lying')
    patientData.posture = posture

    const ecgSamples = generateECGSamples(Math.round(hr))
    const respSamples = generateRespiratoryWaveform(Math.round(rr))

    const weight = profile.demographics.weightRange[0] + Math.random() * (profile.demographics.weightRange[1] - profile.demographics.weightRange[0])
    const pressureGrid = generatePressureDistribution(posture, weight)

    const now = ward.clock.simulatedTime
```

- [ ] **Step 3: Update observation events array to include new metrics**

Replace the `const obs: SimulatedEvent[]` block with:

```typescript
    const obs: SimulatedEvent[] = [
      { patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'heart_rate', value: Math.round(hr), unit: 'bpm', tags: { simulated: true }, recordedAt: now },
      { patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'resp_rate', value: Math.round(rr), unit: 'rpm', tags: { simulated: true }, recordedAt: now },
      { patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'temperature', value: Math.round(temp * 10) / 10, unit: '\u00b0C', tags: { simulated: true }, recordedAt: now },
      { patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'spo2', value: Math.round(spo2), unit: '%', tags: { simulated: true }, recordedAt: now },
      { patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'systolic_bp', value: bp.systolic, unit: 'mmHg', tags: { simulated: true }, recordedAt: now },
      { patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'diastolic_bp', value: bp.diastolic, unit: 'mmHg', tags: { simulated: true }, recordedAt: now },
      { patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'glucose', value: glucose, unit: 'mmol/L', tags: { simulated: true }, recordedAt: now },
      { patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'motion_index', value: motion, unit: 'g', tags: { simulated: true }, recordedAt: now },
      { patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'posture', value: null, unit: null, tags: { simulated: true, posture }, recordedAt: now },
      { patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'ecg_waveform', value: null, unit: null, tags: { simulated: true, waveform: ecgSamples }, recordedAt: now },
      { patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'resp_waveform', value: null, unit: null, tags: { simulated: true, waveform: respSamples }, recordedAt: now },
      { patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'pressure_grid', value: null, unit: null, tags: { simulated: true, grid: pressureGrid, posture }, recordedAt: now },
    ]
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/simulator/engine.ts
git commit -m "feat: generate all new metrics (BP, glucose, motion, posture, ECG, resp waveform, pressure grid) in tickWard"
```

---

### Task 16: Update injectScenario with new types

**Files:**
- Modify: `apps/server/src/simulator/engine.ts` (injectScenario function)
- Modify: `apps/server/src/simulator/trpc/simulator.ts` (Zod enum)

- [ ] **Step 1: Add new injection cases to injectScenario in engine.ts**

Below the existing `else if (type === 'low_spo2')` block, add:

```typescript
    } else if (type === 'hyperglycemia') {
      rows.push(
        { patientId: pt, deviceId: dev, kind: 'observation', metric: 'glucose', value: 14, unit: 'mmol/L', tags: { simulated: true, scenario: 'demo' }, recordedAt: now },
        { patientId: pt, deviceId: dev, kind: 'alert', metric: 'glucose', value: 14, unit: 'mmol/L', severity: 'critical', status: 'active', tags: { simulated: true, scenario: 'demo', message: '高血糖危象' }, recordedAt: now },
      )
    } else if (type === 'hypoglycemia') {
      rows.push(
        { patientId: pt, deviceId: dev, kind: 'observation', metric: 'glucose', value: 2.8, unit: 'mmol/L', tags: { simulated: true, scenario: 'demo' }, recordedAt: now },
        { patientId: pt, deviceId: dev, kind: 'alert', metric: 'glucose', value: 2.8, unit: 'mmol/L', severity: 'critical', status: 'active', tags: { simulated: true, scenario: 'demo', message: '低血糖危象' }, recordedAt: now },
      )
    } else if (type === 'hypotension') {
      rows.push(
        { patientId: pt, deviceId: dev, kind: 'observation', metric: 'systolic_bp', value: 80, unit: 'mmHg', tags: { simulated: true, scenario: 'demo' }, recordedAt: now },
        { patientId: pt, deviceId: dev, kind: 'observation', metric: 'diastolic_bp', value: 50, unit: 'mmHg', tags: { simulated: true, scenario: 'demo' }, recordedAt: now },
        { patientId: pt, deviceId: dev, kind: 'alert', metric: 'systolic_bp', value: 80, unit: 'mmHg', severity: 'warning', status: 'active', tags: { simulated: true, scenario: 'demo', message: '低血压' }, recordedAt: now },
      )
    } else if (type === 'arrhythmia') {
      rows.push(
        { patientId: pt, deviceId: dev, kind: 'observation', metric: 'heart_rate', value: 185, unit: 'bpm', tags: { simulated: true, scenario: 'demo', irregular: true }, recordedAt: now },
        { patientId: pt, deviceId: dev, kind: 'alert', metric: 'heart_rate', value: 185, unit: 'bpm', severity: 'critical', status: 'active', tags: { simulated: true, scenario: 'demo', message: '心律失常' }, recordedAt: now },
      )
    } else if (type === 'respiratory_distress') {
      rows.push(
        { patientId: pt, deviceId: dev, kind: 'observation', metric: 'resp_rate', value: 40, unit: 'rpm', tags: { simulated: true, scenario: 'demo' }, recordedAt: now },
        { patientId: pt, deviceId: dev, kind: 'observation', metric: 'spo2', value: 85, unit: '%', tags: { simulated: true, scenario: 'demo' }, recordedAt: now },
        { patientId: pt, deviceId: dev, kind: 'alert', metric: 'spo2', value: 85, unit: '%', severity: 'critical', status: 'active', tags: { simulated: true, scenario: 'demo', message: '呼吸窘迫' }, recordedAt: now },
      )
```

- [ ] **Step 2: Update simulator.ts Zod enum**

Change the `type` Zod enum in `injectScenario` input from:
```typescript
type: z.enum(['bed_exit', 'tachycardia', 'fall', 'low_spo2'])
```
to:
```typescript
type: z.enum(['bed_exit', 'tachycardia', 'fall', 'low_spo2', 'hyperglycemia', 'hypoglycemia', 'hypotension', 'arrhythmia', 'respiratory_distress'])
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/simulator/engine.ts apps/server/src/simulator/trpc/simulator.ts
git commit -m "feat: add 5 new scenario injection types (hyper/hypoglycemia, hypotension, arrhythmia, respiratory distress)"
```

---

### Task 17: Update demo bootstrap for multi-profile ward

**Files:**
- Modify: `apps/server/src/index.ts:48-50`

- [ ] **Step 1: Update demo ward creation to use all 5 profiles**

Replace:
```typescript
      patients: [{ profileId: 'elderly-cardiac', count: 3 }],
```
with:
```typescript
      patients: [
        { profileId: 'elderly-cardiac', count: 1 },
        { profileId: 'post-surgery', count: 1 },
        { profileId: 'diabetes', count: 1 },
        { profileId: 'copd-respiratory', count: 1 },
        { profileId: 'maternity', count: 1 },
      ],
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/index.ts
git commit -m "feat: demo mode uses all 5 patient profiles in ward"
```

---

## Phase 2b: Frontend Dashboard Updates for New Metrics

### Task 18: Add metric selector and new metric display to patient cards

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Add metric selector state and expanded scenario buttons**

Add these after the existing `injectActions` array:

```typescript
const [selectedMetric, setSelectedMetric] = useState<string>('standard')

const metricOptions = [
  { value: 'standard', label: '基础' },
  { value: 'bp', label: '血压' },
  { value: 'glucose', label: '血糖' },
  { value: 'motion', label: '体动' },
]

const injectActions = [
  { label: '离床', type: 'bed_exit' as const, color: 'orange' },
  { label: '心动过速', type: 'tachycardia' as const, color: 'red' },
  { label: '跌倒', type: 'fall' as const, color: 'red' },
  { label: '低血氧', type: 'low_spo2' as const, color: 'red' },
  { label: '高血糖', type: 'hyperglycemia' as const, color: 'orange' },
  { label: '低血糖', type: 'hypoglycemia' as const, color: 'red' },
  { label: '低血压', type: 'hypotension' as const, color: 'orange' },
  { label: '心律失常', type: 'arrhythmia' as const, color: 'red' },
  { label: '呼吸窘迫', type: 'respiratory_distress' as const, color: 'red' },
]
```

- [ ] **Step 2: Add metric selector UI above patient cards**

Add before `<Grid>` in the dashboard view:

```typescript
<SegmentedControl
  value={selectedMetric}
  onChange={setSelectedMetric}
  data={metricOptions}
  mb="md"
/>
```

Note: Import `SegmentedControl` from `@mantine/core` at top of file.

- [ ] **Step 3: Add new metric displays inside patient cards**

After the existing temperature display block (inside the inner `<Paper bg="gray.0">`), add conditional metric blocks:

```typescript
{selectedMetric === 'bp' && (() => {
  const sys = gv('systolic_bp'), dia = gv('diastolic_bp')
  return (
    <>
      <Grid.Col span={6}><Stack gap={0}>
        <Text size="xs" c="dimmed">收缩压</Text>
        <Text size="xl" fw={700} c={sys && sys.value != null && sys.value > 150 ? 'red' : 'green'}>
          {sys && sys.value != null ? sys.value : '--'}<Text component="span" size="sm" fw={400}> mmHg</Text>
        </Text>
      </Stack></Grid.Col>
      <Grid.Col span={6}><Stack gap={0}>
        <Text size="xs" c="dimmed">舒张压</Text>
        <Text size="xl" fw={700} c={dia && dia.value != null && dia.value > 100 ? 'red' : 'green'}>
          {dia && dia.value != null ? dia.value : '--'}<Text component="span" size="sm" fw={400}> mmHg</Text>
        </Text>
      </Stack></Grid.Col>
    </>
  )
})()}
{selectedMetric === 'glucose' && (() => {
  const glu = gv('glucose')
  const val = glu?.value
  const color = val != null ? (val > 11 || val < 3.5 ? 'red' : val > 8 ? 'orange' : 'green') : undefined
  return (
    <Grid.Col span={12}><Stack gap={0}>
      <Text size="xs" c="dimmed">血糖</Text>
      <Text size="xl" fw={700} c={color}>
        {val != null ? val : '--'}<Text component="span" size="sm" fw={400}> mmol/L</Text>
      </Text>
    </Stack></Grid.Col>
  )
})()}
{selectedMetric === 'motion' && (() => {
  const mot = gv('motion_index')
  const val = mot?.value
  return (
    <Grid.Col span={12}><Stack gap={0}>
      <Text size="xs" c="dimmed">体动指数</Text>
      <Text size="xl" fw={700} c={val != null && val > 0.2 ? 'orange' : 'green'}>
        {val != null ? val : '--'}<Text component="span" size="sm" fw={400}> g</Text>
      </Text>
    </Stack></Grid.Col>
  )
})()}
```

- [ ] **Step 4: Add posture indicator to patient card header**

Inside the `<Group justify="space-between" mb="xs">` of each patient card, add after the online badge:

```typescript
{(() => {
  const posture = vitals.find((v: any) => v.metric === 'posture')
  const p = posture?.tags?.posture as string || 'unknown'
  const postureLabels: Record<string, string> = { lying: '躺卧', sitting: '坐姿', standing: '站立', walking: '行走' }
  return <Badge size="xs" variant="light" color="blue">{postureLabels[p] || p}</Badge>
})()}
```

- [ ] **Step 5: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS (may need to add type imports)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat: add metric selector, BP/glucose/motion/posture display to dashboard"
```

---

## Phase 2c: Web 3D Dependencies + Basic Scene

### Task 19: Add R3F/Drei/Three dependencies to web

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add dependencies**

```bash
pnpm --filter web add @react-three/fiber @react-three/drei three
```

- [ ] **Step 2: Add type dependencies**

```bash
pnpm --filter web add -D @types/three
```

- [ ] **Step 3: Verify install**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "feat: add @react-three/fiber, @react-three/drei, three dependencies"
```

---

### Task 20: Create tile-grid home layout definitions

**Files:**
- Create: `apps/web/src/3d/layouts/homeLayout.ts`

- [ ] **Step 1: Write layout file**

```typescript
export const TILE_SIZE = 1

export enum TileType {
  EMPTY = 0,
  FLOOR = 1,
  WALL = 2,
  DOOR = 3,
  WINDOW = 4,
}

export interface AnchorDef {
  type: string
  col: number
  row: number
  orient: 'N' | 'S' | 'E' | 'W'
  wallMount?: boolean
  height?: number
}

export interface RoomLayout {
  name: string
  offsetX: number
  offsetZ: number
  grid: TileType[][]
  anchors: AnchorDef[]
}

const F = TileType.FLOOR
const W = TileType.WALL
const D = TileType.DOOR
const V = TileType.WINDOW

export const homeLayout: RoomLayout[] = [
  {
    name: 'bedroom',
    offsetX: 5,
    offsetZ: 0,
    grid: [
      [W, W, W, W, W],
      [W, F, F, F, W],
      [W, F, F, F, W],
      [W, V, D, F, W],
      [W, W, W, W, W],
    ],
    anchors: [
      { type: 'BED', col: 3, row: 1, orient: 'N' },
      { type: 'CABINET', col: 1, row: 1, orient: 'E' },
      { type: 'MATTRESS_SENSOR', col: 3, row: 1, orient: 'N' },
      { type: 'EMERGENCY_BUTTON', col: 4, row: 1, orient: 'W', wallMount: true, height: 1.4 },
    ],
  },
  {
    name: 'livingroom',
    offsetX: 0,
    offsetZ: 5,
    grid: [
      [W, W, W, W, W],
      [W, F, F, F, W],
      [W, F, F, F, W],
      [W, F, F, F, W],
      [W, D, W, W, W],
    ],
    anchors: [
      { type: 'SOFA', col: 3, row: 2, orient: 'S' },
      { type: 'TABLE', col: 1, row: 2, orient: 'N' },
      { type: 'TV', col: 1, row: 1, orient: 'S', wallMount: true, height: 1.2 },
      { type: 'AIR_SENSOR', col: 2, row: 3, orient: 'N' },
      { type: 'PERSON', col: 1, row: 3, orient: 'N' },
    ],
  },
  {
    name: 'kitchen',
    offsetX: 5,
    offsetZ: 5,
    grid: [
      [W, W, W, W, W],
      [W, F, F, F, W],
      [W, F, F, F, W],
      [W, F, F, D, W],
      [W, W, W, W, W],
    ],
    anchors: [
      { type: 'STOVE', col: 3, row: 1, orient: 'S' },
      { type: 'SINK', col: 1, row: 1, orient: 'S' },
      { type: 'TABLE', col: 2, row: 3, orient: 'N' },
    ],
  },
  {
    name: 'bathroom',
    offsetX: 5,
    offsetZ: 9,
    grid: [
      [W, W, W, W],
      [W, F, F, W],
      [W, D, F, W],
      [W, W, W, W],
    ],
    anchors: [
      { type: 'TOILET', col: 1, row: 1, orient: 'S' },
      { type: 'SINK', col: 2, row: 1, orient: 'E' },
      { type: 'AIR_SENSOR', col: 2, row: 2, orient: 'N' },
    ],
  },
  {
    name: 'hall',
    offsetX: 2,
    offsetZ: 8,
    grid: [
      [W, D],
      [W, F],
      [W, W],
    ],
    anchors: [
      { type: 'MOTION_SENSOR', col: 1, row: 1, orient: 'N' },
    ],
  },
]
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/3d/layouts/homeLayout.ts
git commit -m "feat: define tile-grid home layout with 5 rooms and anchors"
```

---

### Task 21: Create RoomGenerator component

**Files:**
- Create: `apps/web/src/3d/rooms/RoomGenerator.tsx`

- [ ] **Step 1: Write the RoomGenerator**

```typescript
import { useMemo } from 'react'
import * as THREE from 'three'
import type { RoomLayout } from '../layouts/homeLayout'
import { TILE_SIZE, TileType } from '../layouts/homeLayout'

const WALL_HEIGHT = 3
const WALL_COLOR = '#f5f0e8'
const FLOOR_COLOR = '#d4c5b2'

interface RoomGeneratorProps {
  layout: RoomLayout
}

export function RoomGenerator({ layout }: RoomGeneratorProps) {
  const { walls, doors, windows, floorGeom } = useMemo(() => {
    const wallMeshes: { pos: [number, number, number]; size: [number, number, number] }[] = []
    const doorPositions: [number, number, number][] = []
    const windowMeshes: { pos: [number, number, number]; size: [number, number, number] }[] = []
    const floorVertices: [number, number][] = []

    const rows = layout.grid.length
    const cols = layout.grid[0]?.length || 0

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tile = layout.grid[r][c]
        const worldX = layout.offsetX + c * TILE_SIZE + TILE_SIZE / 2
        const worldZ = layout.offsetZ + r * TILE_SIZE + TILE_SIZE / 2

        if (tile === TileType.WALL) {
          wallMeshes.push({
            pos: [worldX, WALL_HEIGHT / 2, worldZ],
            size: [TILE_SIZE, WALL_HEIGHT, TILE_SIZE],
          })
        } else if (tile === TileType.DOOR) {
          doorPositions.push([worldX, 0, worldZ])
        } else if (tile === TileType.WINDOW) {
          // Bottom wall portion
          wallMeshes.push({
            pos: [worldX, 0.75, worldZ],
            size: [TILE_SIZE, 1.5, TILE_SIZE],
          })
          // Window (glass) portion
          windowMeshes.push({
            pos: [worldX, 2.25, worldZ],
            size: [TILE_SIZE, 1.5, TILE_SIZE],
          })
        }

        if (tile === TileType.FLOOR || tile === TileType.DOOR) {
          floorVertices.push([worldX, worldZ])
        }
      }
    }
    return { walls: wallMeshes, doors: doorPositions, windows: windowMeshes, floorVertices }
  }, [layout])

  return (
    <group>
      {/* Floor */}
      {floorGeom.map(([fx, fz], i) => (
        <mesh key={`floor-${i}`} position={[fx, 0, fz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[TILE_SIZE, TILE_SIZE]} />
          <meshStandardMaterial color={FLOOR_COLOR} />
        </mesh>
      ))}

      {/* Walls */}
      {walls.map((w, i) => (
        <mesh key={`wall-${i}`} position={w.pos} castShadow receiveShadow>
          <boxGeometry args={w.size} />
          <meshStandardMaterial color={WALL_COLOR} />
        </mesh>
      ))}

      {/* Windows */}
      {windows.map((w, i) => (
        <mesh key={`win-${i}`} position={w.pos} castShadow>
          <boxGeometry args={w.size} />
          <meshStandardMaterial color="#a8d8ea" transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/3d/rooms/RoomGenerator.tsx
git commit -m "feat: create tile-grid room generator component"
```

---

### Task 22: Create HomeScene container

**Files:**
- Create: `apps/web/src/3d/scenes/HomeScene.tsx`

- [ ] **Step 1: Write the HomeScene**

```typescript
import { RoomGenerator } from '../rooms/RoomGenerator'
import { homeLayout } from '../layouts/homeLayout'

export function HomeScene() {
  return (
    <group>
      <ambientLight intensity={0.4} />
      <directionalLight position={[15, 20, 10]} intensity={0.8} castShadow />
      {homeLayout.map((room) => (
        <RoomGenerator key={room.name} layout={room} />
      ))}
    </group>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/3d/scenes/HomeScene.tsx
git commit -m "feat: create HomeScene container rendering all rooms"
```

---

### Task 23: Create DigitalTwinPage with R3F Canvas

**Files:**
- Create: `apps/web/src/pages/DigitalTwinPage.tsx`

- [ ] **Step 1: Write the page**

```typescript
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { HomeScene } from '../3d/scenes/HomeScene'
import { Container } from '@mantine/core'

export function DigitalTwinPage() {
  return (
    <Container fluid p={0} style={{ height: 'calc(100vh - 120px)' }}>
      <Canvas
        camera={{ position: [15, 12, 15], fov: 50 }}
        shadows
        style={{ background: '#1a1a2e' }}
      >
        <HomeScene />
        <OrbitControls
          target={[5, 0, 5]}
          maxPolarAngle={Math.PI / 2.5}
          minDistance={5}
          maxDistance={30}
        />
      </Canvas>
    </Container>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/DigitalTwinPage.tsx
git commit -m "feat: create DigitalTwinPage with R3F Canvas and orbit controls"
```

---

### Task 24: Add "数字孪生" tab to App.tsx

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Add import and tab**

Add import at top:
```typescript
import { DigitalTwinPage } from './pages/DigitalTwinPage'
```

Add new Tab after existing tabs:
```typescript
<Tabs.Tab value="digitaltwin">数字孪生</Tabs.Tab>
```

Add render block after existing tab content:
```typescript
{activeTab === 'digitaltwin' && <DigitalTwinPage />}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat: add digital twin tab to dashboard navigation"
```

---

## Phase 2d: Entity Rendering

### Task 25: Create Person entity

**Files:**
- Create: `apps/web/src/3d/entities/Person.tsx`

- [ ] **Step 1: Write the Person component**

```typescript
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

interface PersonProps {
  position: [number, number, number]
  posture: string
  skinColor?: string
  vitals?: { label: string; value: string | number; unit?: string }[]
  onClick?: () => void
}

export function Person({ position, posture, skinColor = '#f5c6a0', vitals, onClick }: PersonProps) {
  const groupRef = useRef<THREE.Group>(null)

  const bodyRotation = useMemo(() => {
    switch (posture) {
      case 'lying': return [0, 0, Math.PI / 2] as const
      case 'sitting': return [0, 0, 0] as const
      default: return [0, 0, 0] as const
    }
  }, [posture])

  const bodyOffset: [number, number, number] = posture === 'lying' ? [0, 0.3, 0] : [0, 1.1, 0]

  useFrame(() => {
    if (!groupRef.current) return
    groupRef.current.position.set(...position)
    groupRef.current.rotation.set(...bodyRotation)
  })

  return (
    <group ref={groupRef} onClick={onClick}>
      {/* Body (capsule approximation with cylinder + spheres) */}
      <mesh position={bodyOffset} castShadow>
        <capsuleGeometry args={[0.2, 1.2, 4, 8]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>
      {/* Head */}
      <mesh position={[0, posture === 'lying' ? 1.1 : 2.1, 0]} castShadow>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>
      {/* Vital sign overlay */}
      {vitals && (
        <Html position={[0, posture === 'lying' ? 1.5 : 2.5, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: 11, whiteSpace: 'nowrap' }}>
            {vitals.map((v, i) => (
              <div key={i}>{v.label}: {v.value}{v.unit || ''}</div>
            ))}
          </div>
        </Html>
      )}
    </group>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/3d/entities/Person.tsx
git commit -m "feat: create Person entity with posture-driven animation and vital sign overlay"
```

---

### Task 26: Create Bed entity with pressure heatmap

**Files:**
- Create: `apps/web/src/3d/entities/Bed.tsx`
- Create: `apps/web/src/3d/entities/PressureHeatmap.tsx`

- [ ] **Step 1: Write the PressureHeatmap component**

```typescript
import { useRef, useMemo } from 'react'
import * as THREE from 'three'

const pressureColors = [
  new THREE.Color('#0044ff'), // 0
  new THREE.Color('#00aa00'), // 30
  new THREE.Color('#ffcc00'), // 60
  new THREE.Color('#ff4400'), // 90
]

function pressureToColor(value: number): THREE.Color {
  const t = Math.min(1, Math.max(0, value / 90))
  const idx = t * (pressureColors.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.min(lo + 1, pressureColors.length - 1)
  const frac = idx - lo
  return pressureColors[lo].clone().lerp(pressureColors[hi], frac)
}

interface PressureHeatmapProps {
  grid: number[][]
  position: [number, number, number]
}

export function PressureHeatmap({ grid, position }: PressureHeatmapProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  const { geometry } = useMemo(() => {
    const rows = 4
    const cols = 4
    const size = 1.8
    const cellW = size / cols
    const cellH = size / rows

    const geo = new THREE.PlaneGeometry(size, size, cols, rows)
    const colors = new Float32Array((cols + 1) * (rows + 1) * 3)

    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const gr = Math.min(r, rows - 1)
        const gc = Math.min(c, cols - 1)
        const val = (grid[gr] && grid[gr][gc]) || 0
        const color = pressureToColor(val)
        const idx = (r * (cols + 1) + c) * 3
        colors[idx] = color.r
        colors[idx + 1] = color.g
        colors[idx + 2] = color.b
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return { geometry: geo }
  }, [grid])

  return (
    <mesh ref={meshRef} geometry={geometry} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <meshBasicMaterial vertexColors side={THREE.DoubleSide} transparent opacity={0.7} />
    </mesh>
  )
}
```

- [ ] **Step 2: Write the Bed component**

```typescript
import { PressureHeatmap } from './PressureHeatmap'

interface BedProps {
  position: [number, number, number]
  pressureGrid?: number[][]
}

export function Bed({ position, pressureGrid }: BedProps) {
  const defaultGrid = Array.from({ length: 4 }, () => Array(4).fill(0))
  const grid = pressureGrid && pressureGrid.length === 4 ? pressureGrid : defaultGrid

  return (
    <group position={position}>
      {/* Bed frame */}
      <mesh position={[0, 0.15, 0]} receiveShadow castShadow>
        <boxGeometry args={[2, 0.3, 1]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>
      {/* Headboard */}
      <mesh position={[0, 0.65, 0.45]} receiveShadow castShadow>
        <boxGeometry args={[2, 1, 0.1]} />
        <meshStandardMaterial color="#6B5335" />
      </mesh>
      {/* Mattress surface */}
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[1.9, 0.05, 0.9]} />
        <meshStandardMaterial color="#fafafa" />
      </mesh>
      {/* Pressure heatmap on mattress */}
      <PressureHeatmap grid={grid} position={[0, 0.35, 0]} />
    </group>
  )
}
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/3d/entities/Bed.tsx apps/web/src/3d/entities/PressureHeatmap.tsx
git commit -m "feat: create Bed entity with pressure heatmap shader"
```

---

### Task 27: Create DeviceMarker entity

**Files:**
- Create: `apps/web/src/3d/entities/DeviceMarker.tsx`

- [ ] **Step 1: Write the DeviceMarker**

```typescript
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

type MarkerStatus = 'normal' | 'warning' | 'alert'

interface DeviceMarkerProps {
  position: [number, number, number]
  label: string
  status?: MarkerStatus
  onClick?: () => void
}

const statusColors: Record<MarkerStatus, string> = {
  normal: '#00cc66',
  warning: '#ff9900',
  alert: '#ff3333',
}

export function DeviceMarker({ position, label, status = 'normal', onClick }: DeviceMarkerProps) {
  const ringRef = useRef<THREE.Mesh>(null)
  const pulseRef = useRef(0)

  useFrame((_, delta) => {
    if (status === 'alert' && ringRef.current) {
      pulseRef.current += delta * 3
      const scale = 1 + Math.sin(pulseRef.current) * 0.3
      ringRef.current.scale.setScalar(scale);
      (ringRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + Math.sin(pulseRef.current * 2) * 0.5
    }
  })

  return (
    <group position={position} onClick={onClick}>
      {/* Device sphere */}
      <mesh castShadow>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={statusColors[status]} emissive={statusColors[status]} emissiveIntensity={0.2} />
      </mesh>
      {/* Status ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.03, 8, 16]} />
        <meshStandardMaterial color={statusColors[status]} emissive={statusColors[status]} emissiveIntensity={0.1} />
      </mesh>
      {/* Label */}
      <Html position={[0, 0.3, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{ color: '#fff', fontSize: 9, background: 'rgba(0,0,0,0.6)', padding: '1px 4px', borderRadius: 2, whiteSpace: 'nowrap' }}>
          {label}
        </div>
      </Html>
    </group>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/3d/entities/DeviceMarker.tsx
git commit -m "feat: create DeviceMarker entity with alert pulse animation"
```

---

### Task 28: Place entities in HomeScene

**Files:**
- Modify: `apps/web/src/3d/scenes/HomeScene.tsx`

- [ ] **Step 1: Update HomeScene to place entities at anchors**

```typescript
import { RoomGenerator } from '../rooms/RoomGenerator'
import { homeLayout, TILE_SIZE } from '../layouts/homeLayout'
import { Person } from '../entities/Person'
import { Bed } from '../entities/Bed'
import { DeviceMarker } from '../entities/DeviceMarker'

function anchorToWorld(layout: typeof homeLayout[0], anchor: typeof homeLayout[0]['anchors'][0]): [number, number, number] {
  const x = layout.offsetX + anchor.col * TILE_SIZE + TILE_SIZE / 2
  const z = layout.offsetZ + anchor.row * TILE_SIZE + TILE_SIZE / 2
  const y = anchor.wallMount ? (anchor.height || 1.5) : 0
  return [x, y, z]
}

export function HomeScene() {
  return (
    <group>
      <ambientLight intensity={0.4} />
      <directionalLight position={[15, 20, 10]} intensity={0.8} castShadow />
      {homeLayout.map((room) => (
        <group key={room.name}>
          <RoomGenerator layout={room} />
          {room.anchors.map((anchor, i) => {
            const pos = anchorToWorld(room, anchor)
            const key = `${room.name}-${anchor.type}-${i}`
            switch (anchor.type) {
              case 'BED':
                return <Bed key={key} position={pos} />
              case 'PERSON':
                return <Person key={key} position={pos} posture="standing" />
              case 'MATTRESS_SENSOR':
                return <DeviceMarker key={key} position={[pos[0], pos[1] + 0.5, pos[2]]} label="床垫" status="normal" />
              case 'AIR_SENSOR':
                return <DeviceMarker key={key} position={pos} label="环境" status="normal" />
              case 'EMERGENCY_BUTTON':
                return <DeviceMarker key={key} position={pos} label="紧急" status="normal" />
              case 'MOTION_SENSOR':
                return <DeviceMarker key={key} position={pos} label="体动" status="normal" />
              case 'TV':
                return <DeviceMarker key={key} position={pos} label="电视" status="normal" />
              default:
                return null
            }
          })}
        </group>
      ))}
    </group>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/3d/scenes/HomeScene.tsx
git commit -m "feat: place entities (Person, Bed, DeviceMarker) at anchors in HomeScene"
```

---

## Phase 2e: Live Data Integration

### Task 29: Create useSimData hook

**Files:**
- Create: `apps/web/src/3d/hooks/useSimData.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useMemo } from 'react'
import { trpc } from '../../trpc'

export interface SimPatientData {
  patientId: string
  patientName: string
  posture: string
  heartRate: number | null
  spO2: number | null
  systolicBP: number | null
  diastolicBP: number | null
  pressureGrid: number[][] | null
  ecgWaveform: number[] | null
  alerts: { metric: string; severity: string; message: string }[]
}

export function useSimData(patientIds: string[]) {
  const enabled = patientIds.length > 0

  const allLatest = trpc.data.latest.useQuery(
    { patientId: patientIds[0] || '' },
    { enabled: false },
  )

  const queries = patientIds.map((pid) =>
    trpc.data.latest.useQuery(
      { patientId: pid },
      { enabled, refetchInterval: 2000 },
    ),
  )

  const alerts = trpc.alert.list.useQuery(
    { pageSize: 20, status: 'active' },
    { enabled, refetchInterval: 3000 },
  )

  const patientData: SimPatientData[] = useMemo(() => {
    return queries.map((q, i) => {
      const vitals = q.data || []
      const gv = (m: string) => vitals.find((v: any) => v.metric === m)

      const postureEv = gv('posture')
      const pressureEv = gv('pressure_grid')
      const ecgEv = gv('ecg_waveform')

      const patientId = patientIds[i] || ''

      return {
        patientId,
        patientName: `患者 ${i + 1}`,
        posture: (postureEv?.tags?.posture as string) || 'lying',
        heartRate: gv('heart_rate')?.value ?? null,
        spO2: gv('spo2')?.value ?? null,
        systolicBP: gv('systolic_bp')?.value ?? null,
        diastolicBP: gv('diastolic_bp')?.value ?? null,
        pressureGrid: (pressureEv?.tags?.grid as number[][]) || null,
        ecgWaveform: (ecgEv?.tags?.waveform as number[]) || null,
        alerts: (alerts.data || [])
          .filter((a: any) => a.patientId === patientId)
          .map((a: any) => ({ metric: a.metric, severity: a.severity, message: a.tags?.message || a.metric })),
      }
    })
  }, [queries, alerts.data, patientIds])

  return { patientData, isLoading: queries.some((q) => q.isLoading) }
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/3d/hooks/useSimData.ts
git commit -m "feat: create useSimData hook polling tRPC for patient data"
```

---

### Task 30: Wire live data to HomeScene

**Files:**
- Modify: `apps/web/src/3d/scenes/HomeScene.tsx`
- Modify: `apps/web/src/pages/DigitalTwinPage.tsx`

- [ ] **Step 1: Update DigitalTwinPage to fetch patient IDs and pass data**

```typescript
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { HomeScene } from '../3d/scenes/HomeScene'
import { Container, Loader, Text } from '@mantine/core'
import { trpc } from '../trpc'
import { useSimData } from '../3d/hooks/useSimData'

export function DigitalTwinPage() {
  const { data: patients, isLoading } = trpc.patient.list.useQuery({ pageSize: 20, status: 'active' }, { refetchInterval: 10000 })
  const patientIds = patients?.map((p: any) => p.id) || []
  const patientNames = patients?.map((p: any) => p.name) || []
  const { patientData, isLoading: simLoading } = useSimData(patientIds)

  if (isLoading) {
    return <Container py="xl"><Loader /><Text mt="md">加载患者数据...</Text></Container>
  }

  return (
    <Container fluid p={0} style={{ height: 'calc(100vh - 120px)' }}>
      <Canvas
        camera={{ position: [15, 12, 15], fov: 50 }}
        shadows
        style={{ background: '#1a1a2e' }}
      >
        <HomeScene patientData={patientData} patientNames={patientNames} />
        <OrbitControls
          target={[5, 0, 5]}
          maxPolarAngle={Math.PI / 2.5}
          minDistance={5}
          maxDistance={30}
        />
      </Canvas>
    </Container>
  )
}
```

- [ ] **Step 2: Update HomeScene to accept and use patient data**

Add props to HomeScene:
```typescript
import type { SimPatientData } from '../hooks/useSimData'

interface HomeSceneProps {
  patientData?: SimPatientData[]
  patientNames?: string[]
}

export function HomeScene({ patientData = [], patientNames = [] }: HomeSceneProps) {
```

Wire Person entities with live data:
```typescript
case 'PERSON': {
  const pidx = 0
  const pd = patientData[pidx]
  return (
    <Person
      key={key}
      position={pos}
      posture={pd?.posture || 'standing'}
      vitals={pd ? [
        { label: 'HR', value: pd.heartRate ?? '--', unit: 'bpm' },
        { label: 'SpO2', value: pd.spO2 ?? '--', unit: '%' },
        { label: 'BP', value: pd.systolicBP && pd.diastolicBP ? `${pd.systolicBP}/${pd.diastolicBP}` : '--', unit: 'mmHg' },
      ] : undefined}
    />
  )
}
```

Wire Bed with pressure data:
```typescript
case 'BED': {
  const pidx = 0
  const pd = patientData[pidx]
  return <Bed key={key} position={pos} pressureGrid={pd?.pressureGrid || undefined} />
}
```

Wire DeviceMarker with alert status:
```typescript
case 'MATTRESS_SENSOR': {
  const pidx = 0
  const pd = patientData[pidx]
  const hasAlert = pd?.alerts?.length > 0
  const maxSeverity = pd?.alerts?.some((a: any) => a.severity === 'critical') ? 'alert'
    : pd?.alerts?.some((a: any) => a.severity === 'warning') ? 'warning' : 'normal'
  return <DeviceMarker key={key} position={[pos[0], pos[1] + 0.5, pos[2]]} label="床垫" status={hasAlert ? maxSeverity : 'normal'} />
}
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/3d/scenes/HomeScene.tsx apps/web/src/pages/DigitalTwinPage.tsx
git commit -m "feat: wire live simulation data to 3D entities"
```

---

### Task 31: Verify end-to-end functionality

- [ ] **Step 1: Start the full stack**

```bash
docker compose up -d
```

- [ ] **Step 2: Verify server starts and ward auto-creates**

Check server logs for "demo mode" messages

- [ ] **Step 3: Open web dashboard**

Navigate to `http://localhost:5173`, login as `demo`/`demo123`

- [ ] **Step 4: Verify dashboard shows all 5 patients with new metrics**

Check metric selector (基础/血压/血糖/体动) and posture badges

- [ ] **Step 5: Switch to 数字孪生 tab**

Verify 3D scene renders with rooms, person, bed, heatmap, device markers

- [ ] **Step 6: Test scenario injection**

Click injection buttons (高血糖, 低血糖, 低血压, 心律失常, 呼吸窘迫) and verify alerts appear in 3D and alert list

- [ ] **Step 7: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 8: Commit any fixes**

```bash
git add -A
git commit -m "fix: end-to-end integration fixes"
```
