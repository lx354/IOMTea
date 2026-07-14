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
      <mesh position={[0, 0.15, 0]} receiveShadow castShadow>
        <boxGeometry args={[2, 0.3, 1]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>
      <mesh position={[0, 0.65, 0.45]} receiveShadow castShadow>
        <boxGeometry args={[2, 1, 0.1]} />
        <meshStandardMaterial color="#6B5335" />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[1.9, 0.05, 0.9]} />
        <meshStandardMaterial color="#fafafa" />
      </mesh>
      <PressureHeatmap grid={grid} position={[0, 0.35, 0]} />
    </group>
  )
}
