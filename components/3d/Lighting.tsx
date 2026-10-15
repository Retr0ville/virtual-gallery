// Lighting rig. Budget-conscious: per room 1 shadow-casting downlight + 2 wall washes.
// Lights stay mounted; intensity fades with player distance to avoid shader recompiles.

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CORR_L, R, roomCenterX } from '../../utils/layout';

const _target = new THREE.Vector3();

function RoomLighting({
  index,
  groupRef,
}: {
  index: number;
  groupRef: (g: THREE.Group | null) => void;
}) {
  const downTarget = useMemo(() => new THREE.Object3D(), []);
  const washTargetPlusZ = useMemo(() => new THREE.Object3D(), []);
  const washTargetMinusZ = useMemo(() => new THREE.Object3D(), []);

  return (
    <group position={[roomCenterX(index), 0, 0]} ref={groupRef}>
      {/* shadow-casting downlight */}
      <primitive object={downTarget} position={[0, 0, 0]} />
      <spotLight
        position={[0, 4.7, 0]}
        target={downTarget}
        angle={1.15}
        penumbra={1}
        intensity={26}
        distance={13}
        decay={2}
        color="#fff6e8"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0004}
      />

      {/* wall wash toward +z arc */}
      <primitive object={washTargetPlusZ} position={[0, 1.45, 7.6]} />
      <spotLight
        position={[0, 4.5, 3.2]}
        target={washTargetPlusZ}
        angle={1.05}
        penumbra={0.9}
        intensity={55}
        distance={16}
        decay={2}
        color="#fff2df"
      />

      {/* wall wash toward -z arc */}
      <primitive object={washTargetMinusZ} position={[0, 1.45, -7.6]} />
      <spotLight
        position={[0, 4.5, -3.2]}
        target={washTargetMinusZ}
        angle={1.05}
        penumbra={0.9}
        intensity={55}
        distance={16}
        decay={2}
        color="#fff2df"
      />
    </group>
  );
}

function CorridorLighting({ index }: { index: number }) {
  const target = useMemo(() => new THREE.Object3D(), []);
  const cx = roomCenterX(index) + R + CORR_L / 2;
  return (
    <group position={[cx, 0, 0]}>
      <primitive object={target} position={[0, 0, 0]} />
      <spotLight
        position={[0, 2.7, 0]}
        target={target}
        angle={0.7}
        penumbra={1}
        intensity={9}
        distance={6}
        decay={2}
        color="#fff4e4"
      />
    </group>
  );
}

interface LightingProps {
  roomCount: number;
}

export function Lighting({ roomCount }: LightingProps) {
  const camera = useThree((s) => s.camera);
  const roomGroups = useRef<Array<THREE.Group | null>>([]);

  useFrame(() => {
    for (let i = 0; i < roomCount; i++) {
      const g = roomGroups.current[i];
      if (!g) continue;
      const dx = camera.position.x - roomCenterX(i);
      const dz = camera.position.z;
      const dist = Math.hypot(dx, dz);
      const fade = 1 - THREE.MathUtils.smoothstep(dist, 12, 30);
      g.traverse((o) => {
        const light = o as THREE.Light;
        if (!light.isLight) return;
        if (light.userData.baseIntensity === undefined) {
          light.userData.baseIntensity = light.intensity;
        }
        light.intensity = (light.userData.baseIntensity as number) * fade;
      });
    }
  });

  return (
    <>
      {Array.from({ length: roomCount }, (_, i) => (
        <RoomLighting
          key={`room-light-${i}`}
          index={i}
          groupRef={(g) => {
            roomGroups.current[i] = g;
          }}
        />
      ))}
      {Array.from({ length: roomCount - 1 }, (_, i) => (
        <CorridorLighting key={`corr-light-${i}`} index={i} />
      ))}
    </>
  );
}
