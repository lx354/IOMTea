/// <reference types="@react-three/fiber" />
import { useMemo } from 'react'
import type { RoomLayout } from '../layouts/homeLayout'
import { TILE_SIZE, TileType } from '../layouts/homeLayout'

const WALL_HEIGHT = 3
const WALL_COLOR = '#f5f0e8'
const FLOOR_COLOR = '#d4c5b2'

interface RoomGeneratorProps {
  layout: RoomLayout
}

export function RoomGenerator({ layout }: RoomGeneratorProps) {
  const { walls, windows, floorVertices } = useMemo(() => {
    const wallMeshes: { pos: [number, number, number]; size: [number, number, number] }[] = []
    const windowMeshes: { pos: [number, number, number]; size: [number, number, number] }[] = []
    const floorTiles: [number, number][] = []

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
        } else if (tile === TileType.WINDOW) {
          wallMeshes.push({
            pos: [worldX, 0.75, worldZ],
            size: [TILE_SIZE, 1.5, TILE_SIZE],
          })
          windowMeshes.push({
            pos: [worldX, 2.25, worldZ],
            size: [TILE_SIZE, 1.5, TILE_SIZE],
          })
        }

        if (tile === TileType.FLOOR || tile === TileType.DOOR) {
          floorTiles.push([worldX, worldZ])
        }
      }
    }
    return { walls: wallMeshes, windows: windowMeshes, floorVertices: floorTiles }
  }, [layout])

  return (
    <group>
      {floorVertices.map(([fx, fz], i) => (
        <mesh key={`floor-${i}`} position={[fx, 0, fz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[TILE_SIZE, TILE_SIZE]} />
          <meshStandardMaterial color={FLOOR_COLOR} />
        </mesh>
      ))}

      {walls.map((w, i) => (
        <mesh key={`wall-${i}`} position={w.pos} castShadow receiveShadow>
          <boxGeometry args={w.size} />
          <meshStandardMaterial color={WALL_COLOR} />
        </mesh>
      ))}

      {windows.map((w, i) => (
        <mesh key={`win-${i}`} position={w.pos} castShadow>
          <boxGeometry args={w.size} />
          <meshStandardMaterial color="#a8d8ea" transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  )
}
