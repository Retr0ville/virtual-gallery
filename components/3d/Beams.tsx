// Concert-style colored beam fixtures. Four per room on the track rail,
// throwing slow-sweeping shafts across the floor. Spot lights and cone
// opacity fade with camera distance like the museum rig (lights stay
// mounted — no shader recompiles).

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { roomCenterX } from '../../utils/layout';
import { makeBeamTexture } from '../../utils/textures';
import { roomCameraFade } from './Lighting';
import { TRIM_COLOR } from './Room';

const RAIL_R = 7.4; // matches track rail radius in Room.tsx
const RAIL_Y = 4.52; // matches rail fixture height
const CONE_TOP_R = 0.09;
const CONE_BOT_R = 1.9;
const CONE_L = 4.7; // pivot (4.52) down to ~floor
const SPOT_ANGLE = Math.atan(CONE_BOT_R / CONE_L); // ~0.384 rad
const TILT = 0.28; // constant inward lean (local +x after yaw = room center)
const SWEEP_AMP = 0.45;
const SWEEP_SPEED = 0.32;
const BEAMS_PER_ROOM = 4;
const BEAM_OPACITY = 0.18;
const BEAM_INTENSITY = 32;
const PALETTE = ['#ff4fa3', '#2fc9ff', '#ffa53c', '#8f5cff'];

// Azimuths offset from artwork slots; yaw = azimuth + PI/2 throws inward.
const azimuth = (k: number) => Math.PI / 8 + (k * Math.PI) / 2;
const phase = (k: number, roomIndex: number) => (k * Math.PI) / 2 + roomIndex * 0.85;

function RoomBeams({ index }: { index: number }) {
  const beamTex = useMemo(() => makeBeamTexture(), []);
  useEffect(() => () => beamTex.dispose(), [beamTex]);
  const targets = useMemo(
    () => Array.from({ length: BEAMS_PER_ROOM }, () => new THREE.Object3D()),
    []
  );
  const pivots = useRef<Array<THREE.Group | null>>([]);
  const cones = useRef<Array<THREE.Mesh | null>>([]);
  const lights = useRef<Array<THREE.SpotLight | null>>([]);

  useFrame(({ camera, clock }) => {
    const fade = roomCameraFade(camera, index);
    const t = clock.getElapsedTime();
    for (let k = 0; k < BEAMS_PER_ROOM; k++) {
      const pivot = pivots.current[k];
      if (pivot) {
        pivot.rotation.y =
          azimuth(k) + Math.PI / 2 + Math.sin(t * SWEEP_SPEED + phase(k, index)) * SWEEP_AMP;
      }
      const cone = cones.current[k];
      if (cone) {
        (cone.material as THREE.MeshBasicMaterial).opacity = BEAM_OPACITY * fade;
      }
      const light = lights.current[k];
      if (light) light.intensity = BEAM_INTENSITY * fade;
    }
  });

  return (
    <group position={[roomCenterX(index), 0, 0]}>
      {Array.from({ length: BEAMS_PER_ROOM }, (_, k) => {
        const a = azimuth(k);
        const color = PALETTE[k % PALETTE.length];
        return (
          <group
            key={`beam-${k}`}
            position={[RAIL_R * Math.sin(a), RAIL_Y, RAIL_R * Math.cos(a)]}
            ref={(g) => {
              pivots.current[k] = g;
            }}
          >
            {/* fixture head hung from the rail */}
            <mesh position-y={0.08}>
              <cylinderGeometry args={[0.045, 0.045, 0.16, 12]} />
              <meshStandardMaterial color={TRIM_COLOR} roughness={0.45} metalness={0.55} />
            </mesh>

            <group rotation-z={TILT}>
              {/* visible shaft */}
              <mesh
                position={[0, -CONE_L / 2, 0]}
                renderOrder={2}
                ref={(m) => {
                  cones.current[k] = m;
                }}
              >
                <cylinderGeometry args={[CONE_TOP_R, CONE_BOT_R, CONE_L, 32, 1, true]} />
                <meshBasicMaterial
                  map={beamTex}
                  color={color}
                  transparent
                  opacity={BEAM_OPACITY}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                  side={THREE.DoubleSide}
                  fog={false}
                />
              </mesh>

              <primitive object={targets[k]} position={[0, -CONE_L, 0]} />
              <spotLight
                angle={SPOT_ANGLE}
                penumbra={0.7}
                intensity={BEAM_INTENSITY}
                distance={12}
                decay={2}
                color={color}
                target={targets[k]}
                ref={(l) => {
                  lights.current[k] = l;
                }}
              />
            </group>
          </group>
        );
      })}
    </group>
  );
}

export function Beams({ roomCount }: { roomCount: number }) {
  return (
    <>
      {Array.from({ length: roomCount }, (_, i) => (
        <RoomBeams key={`beams-${i}`} index={i} />
      ))}
    </>
  );
}
