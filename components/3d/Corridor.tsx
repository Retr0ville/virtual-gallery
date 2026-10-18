// Corridor connecting two rotundas. Walls slightly overlap room wall lines,
// floors/ceilings tuck under/over room discs to avoid visible seams or z-fighting.

import * as THREE from 'three';
import { useEffect, useMemo } from 'react';
import { CEIL_CORR, CORR_L, CORR_W, DOOR_H, R, roomCenterX } from '../../utils/layout';
import { makeDoorPlaqueTexture } from '../../utils/textures';
import { CEIL_COLOR, TRIM_COLOR, WALL_COLOR } from './Room';

const BRASS = '#c8a24a';

interface CorridorProps {
  index: number; // corridor between room index and index + 1
  year: number; // year of the room this corridor leads into
  lineColor: string; // faint emissive guide line along the walls
  locked?: boolean; // door into a future year — sealed until that year arrives
}

export function Corridor({ index, year, lineColor, locked }: CorridorProps) {
  const x0 = roomCenterX(index) + R; // corridor start at first room edge
  const length = CORR_L;
  const plate = useMemo(() => makeDoorPlaqueTexture(year), [year]);
  useEffect(() => () => plate.dispose(), [plate]);

  return (
    <group position={[x0, 0, 0]}>
      {/* floor is part of the merged reflector mesh in GalleryFloor.tsx */}

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

      {/* faint emissive guide line at knee height on both walls — draws the
          eye into the next room without glowing like neon */}
      {[-1, 1].map((s) => (
        <mesh key={`line-${s}`} position={[length / 2, 0.5, s * (CORR_W / 2 - 0.004)]}>
          {/* stop 4cm short of the portal trims at each end — no overlap */}
          <boxGeometry args={[length - 0.24, 0.12, 0.012]} />
          <meshStandardMaterial
            color={lineColor}
            emissive={lineColor}
            emissiveIntensity={0.28}
            roughness={0.45}
            metalness={0.05}
          />
        </mesh>
      ))}

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

      {/* locked double door sealing the far room (future year) — flush with
          that room's wall, knobs on the near face */}
      {locked && (
        <group position={[length - 0.06, 0, 0]}>
          {[-1, 1].map((s) => (
            <mesh key={`leaf-${s}`} position={[0, DOOR_H / 2, s * (CORR_W / 4 + 0.02)]} castShadow>
              <boxGeometry args={[0.06, DOOR_H - 0.04, CORR_W / 2 - 0.06]} />
              <meshStandardMaterial color={TRIM_COLOR} roughness={0.5} metalness={0.15} />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={`knob-${s}`} position={[-0.06, 1.02, s * 0.14]}>
              <sphereGeometry args={[0.035, 14, 10]} />
              <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.8} />
            </mesh>
          ))}
          {/* brass plaque on one leaf only — hotel-room style, dark inset rule */}
          <group position={[-0.045, 2.05, -(CORR_W / 4 + 0.02)]} rotation-y={-Math.PI / 2}>
            <mesh position-z={0.004}>
              <boxGeometry args={[0.72, 0.185, 0.012]} />
              <meshStandardMaterial
                color="#b3884f"
                roughness={0.32}
                metalness={0.6}
                emissive="#523d18"
                emissiveIntensity={0.22}
              />
            </mesh>
            <mesh position-z={0.011}>
              <planeGeometry args={[0.72, 0.18]} />
              <meshBasicMaterial map={plate} transparent depthWrite={false} />
            </mesh>
          </group>
        </group>
      )}
    </group>
  );
}
