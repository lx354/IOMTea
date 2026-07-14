import { useRef, useMemo } from 'react'
import * as THREE from 'three'

const pressureColors = [
  new THREE.Color('#0044ff'),
  new THREE.Color('#00aa00'),
  new THREE.Color('#ffcc00'),
  new THREE.Color('#ff4400'),
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

  const geometry = useMemo(() => {
    const rows = 4
    const cols = 4
    const size = 1.8

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
    return geo
  }, [grid])

  return (
    <mesh ref={meshRef} geometry={geometry} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <meshBasicMaterial vertexColors side={THREE.DoubleSide} transparent opacity={0.7} />
    </mesh>
  )
}
