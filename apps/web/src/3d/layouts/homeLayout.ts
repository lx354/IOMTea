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
