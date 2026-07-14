/// <reference types="@react-three/fiber" />
import { RoomGenerator } from '../rooms/RoomGenerator'
import { homeLayout, TILE_SIZE, type RoomLayout, type AnchorDef } from '../layouts/homeLayout'
import { Person } from '../entities/Person'
import { Bed } from '../entities/Bed'
import { DeviceMarker } from '../entities/DeviceMarker'
import type { SimPatientData } from '../data'

function anchorToWorld(layout: RoomLayout, anchor: AnchorDef): [number, number, number] {
  const x = layout.offsetX + anchor.col * TILE_SIZE + TILE_SIZE / 2
  const z = layout.offsetZ + anchor.row * TILE_SIZE + TILE_SIZE / 2
  const y = anchor.wallMount ? (anchor.height || 1.5) : 0
  return [x, y, z]
}

interface HomeSceneProps {
  patientData?: SimPatientData[]
}

export function HomeScene({ patientData = [] }: HomeSceneProps) {
  const pd = patientData[0]

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
                return <Bed key={key} position={pos} pressureGrid={pd?.pressureGrid || undefined} />
              case 'PERSON':
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
              case 'MATTRESS_SENSOR': {
                const hasAlert = pd?.alerts?.length > 0
                const hasCritical = pd?.alerts?.some((a) => a.severity === 'critical')
                const hasWarning = pd?.alerts?.some((a) => a.severity === 'warning')
                const markerStatus = hasCritical ? 'alert' : hasWarning ? 'warning' : 'normal'
                return <DeviceMarker key={key} position={[pos[0], pos[1] + 0.5, pos[2]]} label="床垫" status={hasAlert ? markerStatus : 'normal'} />
              }
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
