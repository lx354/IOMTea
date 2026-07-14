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
      ringRef.current.scale.setScalar(scale)
      const mat = ringRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.5 + Math.sin(pulseRef.current * 2) * 0.5
    }
  })

  return (
    <group position={position} onClick={onClick}>
      <mesh castShadow>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={statusColors[status]} emissive={statusColors[status]} emissiveIntensity={0.2} />
      </mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.03, 8, 16]} />
        <meshStandardMaterial color={statusColors[status]} emissive={statusColors[status]} emissiveIntensity={0.1} />
      </mesh>
      <Html position={[0, 0.3, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{ color: '#fff', fontSize: 9, background: 'rgba(0,0,0,0.6)', padding: '1px 4px', borderRadius: 2, whiteSpace: 'nowrap' }}>
          {label}
        </div>
      </Html>
    </group>
  )
}
