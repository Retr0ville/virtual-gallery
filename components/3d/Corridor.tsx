// Corridor connecting two rotundas. Walls slightly overlap room wall lines,
// floors/ceilings tuck under/over room discs to avoid visible seams or z-fighting.

import * as THREE from 'three';
import { CEIL_CORR, CORR_L, CORR_W, R, roomCenterX } from '../../utils/layout';
import { CEIL_COLOR, FLOOR_COLOR, TRIM_COLOR, WALL_COLOR } from './Room';

interface CorridorProps {
  index: number; // corridor between room index and index + 1
}

export function Corridor({ index }: CorridorProps) {
  const x0 = roomCenterX(index) + R; // corridor start at first room edge
  const length = CORR_L;

  return (
    <group position={[x0, 0, 0]}>
      {/* floor — slightly below room floors, extends under both room discs */}
      <mesh rotation-x={-Math.PI / 2} position={[length / 2, -0.0005, 0]} receiveShadow>
        <planeGeometry args={[length + 0.4, CORR_W]} />
        <meshPhysicalMaterial
          color={FLOOR_COLOR}
          roughness={0.3}
          clearcoat={0.5}
          clearcoatRoughness={0.4}
          metalness={0}
          envMapIntensity={0.4}
        />
      </mesh>

      {/* ceiling — same faint self-luminance as rotunda ceilings */}
      <mesh rotation-x={Math.PI / 2} position={[length / 2, CEIL_CORR, 0]}>
        <planeGeometry args={[length + 0.16, CORR_W]} />
        <meshStandardMaterial
          color={CEIL_COLOR}
          emissive={CEIL_COLOR}
          emissiveIntensity={0.34}
          roughness={0.95}
          metalness={0}
        />
      </mesh>

      {/* side walls (inner faces flush with door opening edges at z = ±CORR_W/2) */}
      {[-1, 1].map((s) => (
        <mesh
          key={`wall-${s}`}
          position={[length / 2, CEIL_CORR / 2, s * (CORR_W / 2 + 0.06)]}
          receiveShadow
        >
          <boxGeometry args={[length + 0.3, CEIL_CORR, 0.12]} />
          <meshStandardMaterial color={WALL_COLOR} roughness={0.92} metalness={0} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* skirting strips */}
      {[-1, 1].map((s) => (
        <mesh key={`skirt-${s}`} position={[length / 2, 0.05, s * (CORR_W / 2 - 0.005)]}>
          <boxGeometry args={[length + 0.3, 0.1, 0.05]} />
          <meshStandardMaterial color={TRIM_COLOR} roughness={0.6} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
}
