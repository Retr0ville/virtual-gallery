// Rotunda room — one year, circular interior.
// Door gaps are built from cylinder arc segments; upper wall band spans above door height.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { CORR_W, DOOR_H, DOOR_HINGE_X, DOOR_LEAF_W, GAP, R, WALL_H, doorLeafAngle, roomCenterX } from '../../utils/layout';
import { makeYearPlateTexture } from '../../utils/textures';
import { RoomTheme } from '../../utils/themes';

// Neutral defaults — corridors and non-themed surfaces use these.
export const WALL_COLOR = '#ece7de';
export const CEIL_COLOR = '#f1ede5';
export const FLOOR_COLOR = '#aaa69e';
export const TRIM_COLOR = '#1b1b1e';

const BRASS = '#c8a24a';
const SEGMENTS_PER_RAD = 26;
// Two-tone paint split (m). Artworks hang over the line, as on a real painted
// wall; the rail sits behind their backing plane, never in front of the art.
const DADO_H = 1.0;

function Portal({ x }: { x: number }) {
  return (
    <group position={[x, 0, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, DOOR_H / 2, s * (CORR_W / 2 + 0.14)]} castShadow>
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

// One pair of double leaves per corridor, hung on the room's +x doorway.
// A closed leaf points toward the opening centre; the swing sweeps it past 90°
// to rest against the wall beside its own hinge. Pairs are uneven and differ
// room to room — as if someone opened them. Angles come from layout so
// collision matches the meshes exactly.
function OpenDoors({ index }: { index: number }) {
  return (
    <>
      {([1, -1] as const).map((hz) => {
        const angle = doorLeafAngle(index, hz);
        return (
          <group key={hz} position={[DOOR_HINGE_X, 0, hz * (CORR_W / 2)]} rotation-y={angle}>
            <mesh position={[0, DOOR_H / 2, DOOR_LEAF_W / 2]} castShadow receiveShadow>
              <boxGeometry args={[0.06, DOOR_H - 0.04, DOOR_LEAF_W]} />
              <meshStandardMaterial color={TRIM_COLOR} roughness={0.55} metalness={0.12} />
            </mesh>
            {[1, -1].map((fx) => (
              <group key={fx}>
                {[0.62, 1.75].map((py) => (
                  <mesh key={py} position={[fx * 0.033, py, DOOR_LEAF_W / 2]}>
                    <boxGeometry args={[0.014, 0.72, DOOR_LEAF_W - 0.34]} />
                    <meshStandardMaterial color="#2a2a2e" roughness={0.5} metalness={0.18} />
                  </mesh>
                ))}
                <mesh position={[fx * 0.05, 1.02, DOOR_LEAF_W - 0.14]}>
                  <sphereGeometry args={[0.035, 14, 10]} />
                  <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.8} />
                </mesh>
              </group>
            ))}
          </group>
        );
      })}
    </>
  );
}

interface RoomProps {
  index: number;
  year: number;
  roomCount: number;
  theme: RoomTheme;
}

export function Room({ index, year, roomCount, theme }: RoomProps) {
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

  const plate = useMemo(() => makeYearPlateTexture(year), [year]);
  useEffect(() => () => plate.dispose(), [plate]);

  return (
    <group position={[cx, 0, 0]}>
      {/* floor is a single merged mesh in GalleryFloor.tsx (reflector) */}

      {/* ceiling — faint self-luminance (museum ceilings glow softly;
          down-facing normals receive almost no direct light otherwise) */}
      <mesh rotation-x={Math.PI / 2} position-y={WALL_H}>
        <circleGeometry args={[R, 96]} />
        <meshStandardMaterial
          color={theme.ceiling}
          emissive={theme.ceiling}
          emissiveIntensity={0.34}
          roughness={0.95}
          metalness={0}
        />
      </mesh>

      {/* ceiling halo ring — this room's signature accent, floating under the
          ceiling like a cove light */}
      <mesh rotation-x={Math.PI / 2} position-y={WALL_H - 0.08}>
        <torusGeometry args={[2.5, 0.018, 10, 96]} />
        <meshBasicMaterial color={theme.accent} toneMapped={false} />
      </mesh>

      {/* two-tone wall arcs (door gaps between them): deeper dado band below
          the rail, main wall tone above */}
      {lowerArcs.map(([start, len], i) => {
        const seg = Math.max(14, Math.round(len * SEGMENTS_PER_RAD));
        return (
          <group key={`arc-${i}`}>
            <mesh position-y={DADO_H / 2} receiveShadow>
              <cylinderGeometry args={[R, R, DADO_H, seg, 1, true, start, len]} />
              <meshStandardMaterial color={theme.wallLower} roughness={0.92} metalness={0} side={THREE.BackSide} />
            </mesh>
            <mesh position-y={(DADO_H + DOOR_H) / 2} receiveShadow>
              <cylinderGeometry args={[R, R, DOOR_H - DADO_H, seg, 1, true, start, len]} />
              <meshStandardMaterial color={theme.wall} roughness={0.92} metalness={0} side={THREE.BackSide} />
            </mesh>
            {/* painted chair rail on the tone split, standing proud of the wall */}
            <mesh position-y={DADO_H}>
              <cylinderGeometry args={[R - 0.02, R - 0.02, 0.05, seg, 1, true, start, len]} />
              <meshStandardMaterial color={theme.rail} roughness={0.55} metalness={0.04} side={THREE.BackSide} />
            </mesh>
          </group>
        );
      })}

      {/* upper wall band (continuous above doors) */}
      <mesh position-y={(DOOR_H + WALL_H) / 2}>
        <cylinderGeometry args={[R, R, WALL_H - DOOR_H, 128, 1, true]} />
        <meshStandardMaterial color={theme.wall} roughness={0.92} metalness={0} side={THREE.BackSide} />
      </mesh>

      {/* skirting */}
      <mesh position-y={0.05}>
        <cylinderGeometry args={[R - 0.015, R - 0.015, 0.1, 128, 1, true]} />
        <meshStandardMaterial color={TRIM_COLOR} roughness={0.6} metalness={0.1} side={THREE.BackSide} />
      </mesh>

      {/* doorway portal trims */}
      {hasDoorPlusX && <Portal x={R} />}
      {hasDoorMinusX && <Portal x={-R} />}

      {/* one pair of open leaves per corridor (room's +x doorway); locked
          future doors are separate, sealed slabs in the corridor */}
      {hasDoorPlusX && <OpenDoors index={index} />}

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
