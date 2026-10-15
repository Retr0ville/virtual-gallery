// Single merged floor (3 room discs + 2 corridor strips) with a blurry
// glass reflection. One mesh = one reflector FBO pass per frame; floor
// medallions (renderOrder 1) still draw on top.
//
// Trap: the mesh MUST keep rotation-x={-PI/2} — MeshReflectorMaterial
// derives its mirror plane from the mesh world transform. Only
// translations are baked into the geometry. Under that rotation local
// (x, y, z) maps to world (x, z, -y): the corridor's -0.0005 drop thus
// goes into the local z translate (avoiding z-fight with room discs).

import { MeshReflectorMaterial } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CORR_L, CORR_W, R, roomCenterX } from '../../utils/layout';
import { FLOOR_COLOR } from './Room';

export function GalleryFloor({ roomCount }: { roomCount: number }) {
  const geometry = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < roomCount; i++) {
      const disc = new THREE.CircleGeometry(R, 96);
      disc.translate(roomCenterX(i), 0, 0);
      parts.push(disc);
    }
    for (let i = 0; i < roomCount - 1; i++) {
      const strip = new THREE.PlaneGeometry(CORR_L + 0.4, CORR_W);
      strip.translate(roomCenterX(i) + R + CORR_L / 2, 0, -0.0005);
      parts.push(strip);
    }
    if (parts.length === 0) return new THREE.BufferGeometry();
    const merged = mergeGeometries(parts, false)!;
    parts.forEach((p) => p.dispose());
    return merged;
  }, [roomCount]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} rotation-x={-Math.PI / 2} receiveShadow>
      {/* props baked into shader defines at material creation — set upfront */}
      <MeshReflectorMaterial
        resolution={512}
        mirror={0.42}
        mixBlur={1.5}
        mixStrength={0.85}
        mixContrast={1}
        blur={[140, 100]}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.25}
        depthScale={0.8}
        color={FLOOR_COLOR}
        roughness={0.32}
        metalness={0}
        envMapIntensity={0.45}
      />
    </mesh>
  );
}
