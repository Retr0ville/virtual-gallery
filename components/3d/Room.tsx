// Rotunda room — one year, circular interior.
// Door gaps are built from cylinder arc segments; upper wall band spans above door height.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { CORR_W, DOOR_H, GAP, R, WALL_H, roomCenterX } from '../../utils/layout';
import { makeMedallionTexture, makeYearPlateTexture } from '../../utils/textures';

export const WALL_COLOR = '#ece7de';
export const CEIL_COLOR = '#f1ede5';
export const FLOOR_COLOR = '#aaa69e';
export const TRIM_COLOR = '#1b1b1e';

const SEGMENTS_PER_RAD = 26;

function Portal({ x }: { x: number }) {
  return (
    <group position={[x, 0, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, DOOR_H / 2, s * (CORR_W / 2 + 0.15)]} castShadow>
          <boxGeometry args={[0.16, DOOR_H, 0.3]} />
          <meshStandardMaterial color={TRIM_COLOR} roughness={0.65} metalness={0.08} />
        </mesh>
      ))}
      <mesh position={[0, DOOR_H + 0.125, 0]} castShadow>
        <boxGeometry args={[0.16, 0.25, CORR_W + 0.6]} />
        <meshStandardMaterial color={TRIM_COLOR} roughness={0.65} metalness={0.08} />
      </mesh>
    </group>
  );
}

interface RoomProps {
  index: number;
  year: number;
  roomCount: number;
}

export function Room({ index, year, roomCount }: RoomProps) {
  const cx = roomCenterX(index);
  const single = roomCount === 1;
  const hasDoorPlusX = !single && index !== roomCount - 1;
  const hasDoorMinusX = !single && index !== 0;

  const lowerArcs = useMemo<Array<[number, number]>>(() => {
    if (single) return [[0, Math.PI * 2]];
    if (hasDoorPlusX && hasDoorMinusX) {
      return [
        [Math.PI / 2 + GAP / 2, Math.PI - GAP],
        [(3 * Math.PI) / 2 + GAP / 2, Math.PI - GAP],
      ];
    }
    const start = hasDoorPlusX ? Math.PI / 2 + GAP / 2 : (3 * Math.PI) / 2 + GAP / 2;
    return [[start, Math.PI * 2 - GAP]];
  }, [single, hasDoorPlusX, hasDoorMinusX]);

  const medallion = useMemo(() => makeMedallionTexture(year), [year]);
  const plate = useMemo(() => makeYearPlateTexture(year), [year]);
  useEffect(() => () => medallion.dispose(), [medallion]);
  useEffect(() => () => plate.dispose(), [plate]);

  return (
    <group position={[cx, 0, 0]}>
      {/* floor is a single merged mesh in GalleryFloor.tsx (reflector) */}

      {/* ceiling — faint self-luminance (museum ceilings glow softly;
          down-facing normals receive almost no direct light otherwise) */}
      <mesh rotation-x={Math.PI / 2} position-y={WALL_H}>
        <circleGeometry args={[R, 96]} />
        <meshStandardMaterial
          color={CEIL_COLOR}
          emissive={CEIL_COLOR}
          emissiveIntensity={0.34}
          roughness={0.95}
          metalness={0}
        />
      </mesh>

      {/* lower wall arcs (door gaps between them) */}
      {lowerArcs.map(([start, len], i) => (
        <mesh key={`arc-${i}`} position-y={DOOR_H / 2} receiveShadow>
          <cylinderGeometry
            args={[R, R, DOOR_H, Math.max(14, Math.round(len * SEGMENTS_PER_RAD)), 1, true, start, len]}
          />
          <meshStandardMaterial color={WALL_COLOR} roughness={0.92} metalness={0} side={THREE.BackSide} />
        </mesh>
      ))}

      {/* upper wall band (continuous above doors) */}
      <mesh position-y={(DOOR_H + WALL_H) / 2}>
        <cylinderGeometry args={[R, R, WALL_H - DOOR_H, 128, 1, true]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.92} metalness={0} side={THREE.BackSide} />
      </mesh>

      {/* skirting */}
      <mesh position-y={0.05}>
        <cylinderGeometry args={[R - 0.015, R - 0.015, 0.1, 128, 1, true]} />
        <meshStandardMaterial color={TRIM_COLOR} roughness={0.6} metalness={0.1} side={THREE.BackSide} />
      </mesh>

      {/* doorway portal trims */}
      {hasDoorPlusX && <Portal x={R} />}
      {hasDoorMinusX && <Portal x={-R} />}

      {/* year signage above doorways, interior side */}
      {hasDoorPlusX && (
        <mesh position={[R - 0.03, DOOR_H + 0.75, 0]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[1.5, 0.375]} />
          <meshBasicMaterial map={plate} transparent depthWrite={false} />
        </mesh>
      )}
      {hasDoorMinusX && (
        <mesh position={[-R + 0.03, DOOR_H + 0.75, 0]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[1.5, 0.375]} />
          <meshBasicMaterial map={plate} transparent depthWrite={false} />
        </mesh>
      )}

      {/* floor medallion */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.004} renderOrder={1}>
        <circleGeometry args={[1.15, 64]} />
        <meshBasicMaterial map={medallion} transparent depthWrite={false} />
      </mesh>

      {/* track rail + fixtures */}
      <mesh rotation-x={Math.PI / 2} position-y={4.62}>
        <torusGeometry args={[7.4, 0.022, 8, 128]} />
        <meshStandardMaterial color={TRIM_COLOR} roughness={0.45} metalness={0.55} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={`fx-${i}`} position={[7.4 * Math.sin(a), 4.52, 7.4 * Math.cos(a)]}>
            <cylinderGeometry args={[0.032, 0.032, 0.16, 10]} />
            <meshStandardMaterial color={TRIM_COLOR} roughness={0.45} metalness={0.55} />
          </mesh>
        );
      })}
    </group>
  );
}
