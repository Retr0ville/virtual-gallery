// Turntable — walnut record player with open acrylic dust cover, black vinyl,
// tonearm with orange stylus, front speaker grille and side controls.
// Sits on the ring-table glass; clicking it (via ClickNavigator) toggles music.

import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

const W = 1.3; // plinth width
const D = 1.0; // plinth depth
const H = 0.26; // plinth height
const PLATTER_R = 0.44;
const PLATTER_X = -0.06;

const WOOD = '#4a2c1d';
const WOOD_DARK = '#38200f';
const GRILLE = '#6b4a33';
const BLACK = '#141416';
const VINYL = '#0c0c0f';
const LABEL = '#efe4cc';
const BRASS = '#c8a24a';
const STEEL = '#b9bec4';
const STYLUS = '#e4572e';

export function Turntable({ playing }: { playing: boolean }) {
  const spin = useRef<THREE.Group>(null);

  useFrame((_, rawDt) => {
    if (!spin.current || !playing) return;
    spin.current.rotation.y += Math.min(rawDt, 0.05) * 2.1;
  });

  return (
    <group userData={{ turntable: true }}>
      {/* walnut plinth */}
      <RoundedBox
        args={[W, H, D]}
        radius={0.03}
        smoothness={4}
        position={[0, H / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={WOOD} roughness={0.5} metalness={0.05} />
      </RoundedBox>

      {/* speaker grille on the front */}
      <mesh position={[0, H * 0.52, D / 2 + 0.004]}>
        <boxGeometry args={[W * 0.82, H * 0.6, 0.02]} />
        <meshStandardMaterial color={GRILLE} roughness={1} metalness={0} />
      </mesh>
      {[0.36, 0.52, 0.68].map((f) => (
        <mesh key={`grille-${f}`} position={[0, H * f, D / 2 + 0.016]}>
          <boxGeometry args={[W * 0.78, 0.007, 0.004]} />
          <meshStandardMaterial color={WOOD_DARK} roughness={0.9} />
        </mesh>
      ))}

      {/* controls recessed on the right cheek */}
      <mesh position={[W / 2 + 0.006, H * 0.55, -0.08]}>
        <boxGeometry args={[0.018, H * 0.62, D * 0.34]} />
        <meshStandardMaterial color="#202024" roughness={0.4} metalness={0.5} />
      </mesh>
      {[-0.07, 0, 0.07].map((z) => (
        <mesh
          key={`knob-${z}`}
          position={[W / 2 + 0.026, H * 0.62, z]}
          rotation-z={Math.PI / 2}
        >
          <cylinderGeometry args={[0.024, 0.024, 0.03, 16]} />
          <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.8} />
        </mesh>
      ))}

      {/* platter + spinning vinyl */}
      <mesh position={[PLATTER_X, H + 0.02, 0]} castShadow>
        <cylinderGeometry args={[PLATTER_R, PLATTER_R, 0.04, 64]} />
        <meshStandardMaterial color="#1b1b1e" roughness={0.45} metalness={0.4} />
      </mesh>
      <group ref={spin} position={[PLATTER_X, H + 0.046, 0]}>
        <mesh position={[0, 0.006, 0]} castShadow>
          <cylinderGeometry args={[PLATTER_R - 0.02, PLATTER_R - 0.02, 0.012, 64]} />
          <meshStandardMaterial color={VINYL} roughness={0.32} metalness={0.05} />
        </mesh>
        {[0.18, 0.26, 0.34].map((r) => (
          <mesh key={`groove-${r}`} position={[0, 0.013, 0]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[r, 0.0025, 6, 64]} />
            <meshStandardMaterial color="#232329" roughness={0.4} metalness={0.1} />
          </mesh>
        ))}
        <mesh position={[0, 0.015, 0]}>
          <cylinderGeometry args={[0.115, 0.115, 0.005, 32]} />
          <meshStandardMaterial color={LABEL} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.0185, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.085, 0.092, 32]} />
          <meshBasicMaterial color={STYLUS} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.022, 12]} />
          <meshStandardMaterial color={STEEL} metalness={0.9} roughness={0.25} />
        </mesh>
      </group>

      {/* tonearm */}
      <group position={[0.5, H + 0.02, -0.38]}>
        <mesh position={[0, 0.035, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.065, 0.07, 24]} />
          <meshStandardMaterial color={STEEL} metalness={0.7} roughness={0.3} />
        </mesh>
        <group position={[0, 0.1, 0]} rotation-y={0.62}>
          <mesh position={[-0.17, 0, 0]} rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.009, 0.011, 0.34, 10]} />
            <meshStandardMaterial color={STEEL} metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh position={[0.045, 0, 0]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.035, 0.035, 0.08, 18]} />
            <meshStandardMaterial color={BLACK} roughness={0.5} metalness={0.4} />
          </mesh>
          <group position={[-0.35, 0, 0]} rotation-y={0.3}>
            <mesh castShadow>
              <boxGeometry args={[0.11, 0.022, 0.05]} />
              <meshStandardMaterial color={BLACK} roughness={0.45} />
            </mesh>
            <mesh position={[-0.055, -0.012, 0]}>
              <boxGeometry args={[0.02, 0.014, 0.045]} />
              <meshStandardMaterial color={STYLUS} roughness={0.4} />
            </mesh>
          </group>
        </group>
      </group>

      {/* open acrylic dust cover, hinged at the back */}
      <group position={[0, H + 0.015, -D / 2 + 0.06]} rotation-x={-1.92}>
        <mesh position={[0, 0, D / 2]} renderOrder={3}>
          <boxGeometry args={[W * 0.98, 0.016, D * 0.94]} />
          <meshPhysicalMaterial
            color="#dff1ee"
            transparent
            opacity={0.16}
            roughness={0.04}
            metalness={0}
            clearcoat={1}
            clearcoatRoughness={0.05}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh key={`lid-edge-${sx}`} position={[sx * (W * 0.49 - 0.01), 0.012, D / 2]}>
            <boxGeometry args={[0.014, 0.014, D * 0.94]} />
            <meshStandardMaterial color={STEEL} roughness={0.35} metalness={0.6} transparent opacity={0.65} />
          </mesh>
        ))}
        <mesh position={[0, 0.012, D * 0.94]}>
          <boxGeometry args={[W * 0.98, 0.014, 0.014]} />
          <meshStandardMaterial color={STEEL} roughness={0.35} metalness={0.6} transparent opacity={0.65} />
        </mesh>
      </group>
      {[-1, 1].map((sx) => (
        <mesh key={`hinge-${sx}`} position={[sx * W * 0.42, H + 0.03, -D / 2 + 0.05]}>
          <boxGeometry args={[0.09, 0.03, 0.05]} />
          <meshStandardMaterial color={BLACK} roughness={0.5} metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
}
