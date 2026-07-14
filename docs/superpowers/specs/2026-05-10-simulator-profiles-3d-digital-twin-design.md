# Simulator Profiles & 3D Digital Twin Design

Date: 2026-05-10

## Summary

1. **Simulator expansion**: 5 patient profiles, 7 new physiological metrics (including waveform types), enriched scenario injection
2. **Web 3D digital twin**: Tile-grid procedural home scene using React Three Fiber (R3F) + Drei, with anchor-based object placement and real-time data overlay

---

## Part 1: Simulator Expansion

### 1.1 New Patient Profiles

Extend `apps/server/src/simulator/profiles/` from 1 to 5 profiles. Each profile defines baseline vitals, alert rules, schedule events, and conditions.

#### Profile: elderly-cardiac (existing, upgraded)
- Conditions: hypertension, fall_risk
- Baseline: HR 78, RR 18, Temp 36.5, SpO2 96, BP 135/85 (systolic/diastolic), Glucose 5.2 (fasting), ECG standard amplitudes
- Alerts: tachycardia >130, bradycardia <45, hypoxemia <90, hypertension >160/100
- Events: nocturnal bed_exit (02:00-04:00, p=0.35)

#### Profile: post-surgery
- Conditions: post_op, pain_managed, infection_risk
- Baseline: HR 85, RR 20, Temp 37.2, SpO2 94, BP 125/80, Glucose 6.0
- Alerts: HR >120, Temp >38.5 (fever), SpO2 <92, BP drop >20 (hemorrhage risk)
- Events: vital_sign_fluctuation (random HR/BP spikes at 4h intervals), position_change (scheduled posture transitions every 2h per nursing protocol, output as posture observation)

#### Profile: diabetes
- Conditions: type2_diabetes, neuropathy
- Baseline: HR 72, RR 16, Temp 36.5, SpO2 97, BP 130/82, Glucose 5.5 (baseline for generation)
- Alerts: hyperglycemia >11, hypoglycemia <3.5, HR >110
- Events: postprandial_glucose_spike (after each meal, +3-5 mmol/L peak at 30min), nocturnal_hypoglycemia (02:00-05:00, p=0.15)

#### Profile: copd-respiratory
- Conditions: copd, hypoxemia_risk, cachexia
- Baseline: HR 95, RR 25, Temp 36.8, SpO2 92, BP 120/75, Glucose 5.0
- Alerts: SpO2 <88 (severe hypoxemia), RR >35 (respiratory distress), HR >120
- Events: dyspnea_episode (random windows, 2-3x daily, p varies), nocturnal_desaturation (01:00-05:00)

#### Profile: maternity
- Conditions: third_trimester, gestational_hypertension_risk
- Baseline: HR 90, RR 22, Temp 36.8, SpO2 97, BP 120/70, Glucose 4.8
- Alerts: HR >140, HR <50, BP >140/90 (preeclampsia), SpO2 <94
- Events: fetal_movement (periodic, 3-4x/hour daytime), braxton_hicks (random, p=0.1/hr)

### 1.2 New Physiological Metrics

Extend `apps/server/src/simulator/physiology/vitals.ts` with 7 new generators and new data types.

#### Blood Pressure (systolic/diastolic) — scalar ×2
```typescript
function generateBloodPressure(
  systolicBaseline: number, diastolicBaseline: number,
  variability: number, hourOfDay: number, activity: ActivityLevel, hr: number
): { systolic: number; diastolic: number }
```
- Circadian: +3/-3 mmHg night dip
- Activity coupling: +10 systolic during moderate activity
- HR coupling: (HR - baseline)/3 added to systolic
- Gaussian noise ±variability

#### Blood Glucose — scalar
```typescript
function generateGlucose(
  baseline: number, variability: number,
  hourOfDay: number, mealTimes: { time: string }[], simMinutes: number
  // simMinutes = minutes elapsed in simulation day, from clock.simulatedTime
): number
```
- Postprandial model: meal time → glucose peaks at +30min (baseline + 3-5 mmol/L) → exponential decay to baseline over 2h
- Nocturnal drift: slow decline overnight (-0.5 to -1.5 mmol/L)
- Gaussian noise for measurement variation

#### Motion Index (IMU acceleration magnitude) — scalar
```typescript
function generateMotionIndex(activity: ActivityLevel): number
```
- Maps ActivityLevel → base g value: resting=0.01, light=0.05, moderate=0.15, heavy=0.4
- Added perlin-like jitter for natural variation
- Returns acceleration magnitude in g

#### Posture — enum
```typescript
type Posture = 'lying' | 'sitting' | 'standing' | 'walking'

function generatePosture(
  activity: ActivityLevel, hourOfDay: number, bedStatus: number, previousPosture: Posture
): Posture
```
- State machine with transition probabilities per activity level
- lying: when bedStatus=1 or activity=resting at night
- Transition probabilities: lying↔sitting (p=0.1/tick), sitting↔standing (p=0.05), standing↔walking (p=0.15 during light/moderate)
- Prevent impossible transitions (lying→walking direct)

#### ECG Waveform — array of 50 samples per beat
```typescript
function generateECGSamples(hr: number, sampleRate: number = 50): number[]
```
- Synthesize 1 cardiac cycle: P wave (atrial depol) → QRS complex (ventricular depol) → T wave (repolarization)
- P wave: small positive bump, width ~0.08s
- QRS: sharp negative(Q)→positive(R at ~1mV)→negative(S), width ~0.1s
- T wave: medium positive, width ~0.2s
- RR interval = 60000 / HR (ms)
- Returns array of 50 amplitude values for rendering, stored as JSON array in tags

#### Respiratory Waveform — array of 50 samples
```typescript
function generateRespiratoryWaveform(rr: number, sampleRate: number = 50): number[]
```
- Sinusoidal base + 2nd harmonic (thoracic/abdominal phase difference)
- Amplitude normalized 0-1
- Frequency = RR/60 Hz
- Perlin noise for breath-to-breath variability
- 50-sample window stored as JSON array in tags

#### Body Pressure Distribution — 4×4 grid
```typescript
type PressureGrid = number[][]  // 4×4 mmHg values

function generatePressureDistribution(posture: Posture, weight: number): PressureGrid
```
- Supine (lying): bilateral symmetrical, center pressure ~60 mmHg, edges ~15
- Side-lying: asymmetric, one side 80 mmHg, opposite 10 mmHg
- Sitting: concentrated center-back 90 mmHg, surround 5 mmHg
- Standing/walking: returns zero grid (not in bed)
- Weight scaling: base × (weight / 70)
- Gaussian smoothing for realistic gradient

### 1.3 Profile Type Extensions

Add to `PatientProfile` type:
```typescript
baseline: {
  // existing...
  bloodPressure: { systolic: number; diastolic: number; variability: number }
  bloodGlucose: { fasting: number; variability: number; postprandialSpike: number }
  motionIndex: { rest: number }
  ecg: { pAmplitude: number; qrsAmplitude: number; tAmplitude: number }
}
```

### 1.4 Engine Integration

`tickWard()` in `engine.ts` generates ALL new metrics per patient per tick:
- BP, glucose, motion, posture, ECG waveform, respiratory waveform, pressure grid
- Each written as `observation` event with appropriate metric name
- Waveform data stored as JSON array in `tags.waveform`
- Pressure grid stored as JSON 2D array in `tags.grid`

### 1.5 New Scenario Injection Types

Add to `injectScenario()`:
- `hyperglycemia`: glucose=14, alert=critical
- `hypoglycemia`: glucose=2.8, alert=critical
- `hypotension`: BP 80/50, alert=warning
- `arrhythmia`: high HR 180+irregular RR, alert=critical
- `respiratory_distress`: RR 40, SpO2 85, alert=critical

### 1.6 Web Dashboard Updates

- Vital cards gain metric selector (switch between standard/BP/glucose/motion/posture)
- Posture indicator as icon in patient card
- Pressure grid shown as mini heatmap in card expansion
- Scenario injection buttons expanded

---

## Part 2: Web 3D Digital Twin

### 2.1 Dependencies

Add to `apps/web/package.json`:
```json
{
  "@react-three/fiber": "^9.x",
  "@react-three/drei": "^9.x",
  "three": "^0.170.x"
}
```

R3F+Drei chosen for React declarative paradigm, rich helper library, and mature ecosystem.

### 2.2 Tile-Grid Room Generation System

#### Tile Definition
```typescript
const TILE_SIZE = 1 // 1 meter

enum TileType { EMPTY, FLOOR, WALL, DOOR, WINDOW }

interface RoomLayout {
  name: string
  width: number
  height: number
  grid: TileType[][]       // [row][col], row 0 = north
  anchors: AnchorDef[]
}
```

#### Anchor System
```typescript
interface AnchorDef {
  type: string              // BED, SOFA, TABLE, STOVE, TOILET, SINK, TV, CABINET,
                            // MATTRESS_SENSOR, AIR_SENSOR, EMERGENCY_BUTTON, PERSON
  col: number               // tile column (x)
  row: number               // tile row (z)
  orient: 'N'|'S'|'E'|'W'  // facing direction
  wallMount?: boolean       // attach to wall at this tile
  height?: number           // wall mount height (default 1.5m)
}
```

**Safety rules enforced at parse time**:
1. Anchor col/row must point to FLOOR tile (or WALL tile for wall-mount)
2. No two anchors on same tile (unless one is wall-mounted)
3. Walkable path check: A* from every room entry point to all anchor tiles — warn if unreachable

#### Wall Generation
```
For each WALL tile → generate BoxGeometry(TILE_SIZE, WALL_HEIGHT, TILE_SIZE) at tile center
For each WINDOW tile → generate wall box with transparent material (or lower height)
For each DOOR tile → skip wall, generate door frame
```
- `WALL_HEIGHT` = 3m default
- Window: top 1m of wall is glass
- Door: 1m wide × 2.2m tall opening

### 2.3 Full Home Layout

One complete home = 5 rooms stitched together

```
┌──────────────┬──────────┐
│   Kitchen    │ Bedroom  │
│  5×4        │  5×4     │
├──────┬───────┤          │
│      │       │          │
│ Lvg  │ Hall  │          │
│ 4×5  │ 2×2   │          │
│      ├───────┴──────────┤
│      │   Bathroom       │
│      │   3×2            │
└──────┴──────────────────┘
```

**Living Room anchors**: SOFA(S, facing TV), TABLE(center), TV(N wall-mount), AIR_SENSOR, PERSON (spawn)
**Bedroom anchors**: BED(N), CABINET(W), MATTRESS_SENSOR(BED tile), EMERGENCY_BUTTON(E wall-mount)
**Kitchen anchors**: STOVE(N), SINK(W), TABLE(center)
**Bathroom anchors**: TOILET(S wall), SINK(E), AIR_SENSOR
**Hall anchors**: CABINET, motion sensor

### 2.4 3D Entity Components

#### Person (`entities/Person.tsx`)
- Capsule geometry (body) + sphere (head) + cylinder limbs
- Posture-driven animation:
  - `lying`: rotated 90° horizontal on bed
  - `sitting`: hip bend 90°, on sofa/chair anchor
  - `standing`: upright at anchor
  - `walking`: lerp between current and target tile via A* path
- Skin color from profile demographics
- Vital sign overlay (Html component from Drei): floating billboard with HR/SpO2/BP

#### Bed + Pressure Heatmap (`entities/Bed.tsx`)
- BoxGeometry (2m × 0.4m × 1m) + mattress plane on top
- Pressure heatmap: 4×4 grid rendered as a PlaneGeometry with vertex colors
  - Color scale: blue(0) → green(30) → yellow(60) → red(90) mmHg
  - ShaderMaterial with texture update each tick
- Mattress sensor icon floating above

#### Device Marker (`entities/DeviceMarker.tsx`)
- Small sphere + Drei Text label
- Status ring (TorusGeometry): green=normal, yellow=warning, red=alert
- Alert pulse: ring scales 1→1.5→1 over 1s loop, emissive red
- Click → show device detail popup (Html)

#### Room Component (`rooms/Bedroom.tsx` etc.)
- Consumes RoomLayout, builds wall/floor geometry from grid
- Places entity components at anchor positions
- Doorway regions connect to adjacent rooms
- Camera transitions: OrbitControls target lerps to room center on switch

### 2.5 Data Flow

```
Server (simulator/ingest)
  ↓ tRPC polling (refetchInterval: 2000ms)
useSimData hook (React Query)
  ↓ context/provider
3D Scene components
  ↓ reactive props
Entity animations + visual updates
```

- `useSimData`: polls `data.latest` for all patients, returns `{ posture, vitals, pressureGrid, waveforms }`
- Each entity subscribes to relevant data slice via React context
- Waveform lines update geometry each frame via `useFrame`

### 2.6 File Structure

```
apps/web/src/
├── App.tsx                    # Add 3D tab
├── pages/
│   └── DigitalTwinPage.tsx    # New page: 3D canvas + controls
├── 3d/
│   ├── index.tsx              # R3F Canvas wrapper
│   ├── scenes/
│   │   └── HomeScene.tsx      # Full home scene container
│   ├── rooms/
│   │   ├── RoomGenerator.tsx  # Reads RoomLayout, builds walls/floors
│   │   ├── Bedroom.tsx
│   │   ├── LivingRoom.tsx
│   │   ├── Kitchen.tsx
│   │   └── Bathroom.tsx
│   ├── entities/
│   │   ├── Person.tsx
│   │   ├── Bed.tsx
│   │   ├── PressureHeatmap.tsx
│   │   ├── DeviceMarker.tsx
│   │   └── AlertPulse.tsx
│   ├── overlays/
│   │   ├── VitalSignPanel.tsx
│   │   └── WaveformLine.tsx
│   ├── hooks/
│   │   ├── useSimData.ts
│   │   └── useRoomLayout.ts
│   └── layouts/
│       └── homeLayout.ts      # Tile-grid definition for full home
```

### 2.7 Performance Considerations

- InstancedMesh for repeated geometry (floor tiles, wall segments)
- LOD: distant rooms use simplified geometry
- Frustum culling: only render visible rooms (Three.js built-in + manual room visibility toggle)
- Waveform lines: `THREE.Line` with BufferGeometry, update vertex positions in `useFrame`
- Pressure heatmap: update vertex colors via `geometry.attributes.color.needsUpdate = true`
- Polling interval configurable (default 2s), can scale with number of patients

### 2.8 Integration with Existing Dashboard

- Add "数字孪生" tab to the existing Tabs component in `App.tsx`
- When tab active → mount `<DigitalTwinPage />` → R3F Canvas
- When tab inactive → unmount canvas to free GPU resources
- Person selection: click on Person entity in 3D → highlights and syncs with patient list sidebar
- Alert indicator: 3D device markers pulse in sync with alert list

---

## Implementation Order

1. **Phase 2a**: Simulator profiles + new metrics (server only, no frontend changes)
2. **Phase 2b**: Frontend vitals card updates for new metrics
3. **Phase 2c**: Web 3D dependencies + basic scene rendering (empty rooms, no data)
4. **Phase 2d**: Entity rendering (Person, Bed, Devices) with mock data
5. **Phase 2e**: Live data integration (useSimData hook → all entities)
6. **Phase 2f**: Scenario injection + alert pulse visualization

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| 3D performance on low-end devices | LOD + frustum culling + optional 2D fallback |
| Waveform data too large for polling | Send only latest window (50 samples), not full history |
| R3F/Drei version conflicts with React 19 | Lock @react-three/fiber to ^9.0 which supports React 19 |
| Tile layout manual authoring tedious | Provide layout builder helper functions, read from JSON config |
| Pressure heatmap vertex color performance | 16-cell grid updates are trivial; batch with `needsUpdate` flag |
