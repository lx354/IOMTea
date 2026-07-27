import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { computeJointAnglesFromKeypoints, type JointAngles } from './skeleton-driver'

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

function VoxelPart({ pos, rot, size, color, opacity = 1 }: {
  pos: [number, number, number]; rot: [number, number, number]
  size: [number, number, number]; color: string; opacity?: number
}) {
  return (
    <mesh position={pos} rotation={rot}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  )
}

export default function Avatar3D({ keypoints }: { keypoints?: Record<string, [number, number]> | null }) {
  const anglesRef = useRef<JointAngles>(computeJointAnglesFromKeypoints(keypoints || null))
  const targetRef = useRef<JointAngles>(anglesRef.current)

  if (keypoints) {
    targetRef.current = computeJointAnglesFromKeypoints(keypoints)
  }

  useFrame((_, delta) => {
    const cur = anglesRef.current
    const tgt = targetRef.current
    const t = Math.min(delta * 5, 1)
    const keys = Object.keys(cur) as Array<keyof JointAngles>
    for (const k of keys) {
      for (let i = 0; i < 3; i++) (cur[k] as number[])[i] += ((tgt[k] as number[])[i] - (cur[k] as number[])[i]) * t
    }
  })

  const a = anglesRef.current
  const c = '#38b2ac'

  return (
    <group position={[0, 0, 0]}>
      <VoxelPart pos={[0, 3.2, 0]} rot={a.headTilt} size={[0.35, 0.35, 0.3]} color={c} />
      <VoxelPart pos={[0, 2.2, 0]} rot={a.torsoLean} size={[0.55, 0.9, 0.3]} color={c} opacity={0.9} />
      <VoxelPart pos={[-0.35, 2.5, 0]} rot={a.leftShoulder} size={[0.18, 0.55, 0.15]} color={c} opacity={0.8} />
      <VoxelPart pos={[-0.45, 1.9, 0]} rot={a.leftElbow} size={[0.15, 0.55, 0.13]} color={c} opacity={0.8} />
      <VoxelPart pos={[0.35, 2.5, 0]} rot={a.rightShoulder} size={[0.18, 0.55, 0.15]} color={c} opacity={0.8} />
      <VoxelPart pos={[0.45, 1.9, 0]} rot={a.rightElbow} size={[0.15, 0.55, 0.13]} color={c} opacity={0.8} />
      <VoxelPart pos={[-0.15, 1.3, 0]} rot={a.leftHip} size={[0.2, 0.6, 0.18]} color={c} opacity={0.8} />
      <VoxelPart pos={[-0.15, 0.5, 0]} rot={a.leftKnee} size={[0.18, 0.6, 0.15]} color={c} opacity={0.8} />
      <VoxelPart pos={[0.15, 1.3, 0]} rot={a.rightHip} size={[0.2, 0.6, 0.18]} color={c} opacity={0.8} />
      <VoxelPart pos={[0.15, 0.5, 0]} rot={a.rightKnee} size={[0.18, 0.6, 0.15]} color={c} opacity={0.8} />
      <mesh position={[0, -1.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.8, 32]} />
        <meshBasicMaterial color="#000" transparent opacity={0.1} />
      </mesh>
    </group>
  )
}
