import { useRef, useMemo } from 'react'
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

  const bodyRotation: [number, number, number] = useMemo(() => {
    switch (posture) {
      case 'lying': return [0, 0, Math.PI / 2]
      case 'sitting': return [0, 0, 0]
      default: return [0, 0, 0]
    }
  }, [posture])

  const bodyOffset: [number, number, number] = posture === 'lying' ? [0, 0.3, 0] : [0, 1.1, 0]

  return (
    <group ref={groupRef} position={position} rotation={bodyRotation} onClick={onClick}>
      <mesh position={bodyOffset} castShadow>
        <capsuleGeometry args={[0.2, 1.2, 4, 8]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>
      <mesh position={[0, posture === 'lying' ? 1.1 : 2.1, 0]} castShadow>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>
      {vitals && vitals.length > 0 && (
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
