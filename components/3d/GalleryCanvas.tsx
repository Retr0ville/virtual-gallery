// Canvas host — renderer config, environment, room/corridor composition,
// artwork placement, lighting rig, player.

import { Canvas, useThree } from '@react-three/fiber';
import { MutableRefObject, RefObject, Suspense, useEffect } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib';
import { YearRoom, GalleryItem } from '../../utils/media';
import { RoomArtworks } from './Artwork';
import { Corridor } from './Corridor';
import { Lighting } from './Lighting';
import { LookDelta, MoveInput, MoveMode, Player } from './Player';
import { Room } from './Room';

export const BG_COLOR = '#e9e4da';
export const CANVAS_ID = 'gallery-canvas';

// Local PBR environment (no CDN fetch) — subtle reflections on floor and trims.
function EnvSetup() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = env.texture;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

interface GalleryCanvasProps {
  rooms: YearRoom[];
  mode: MoveMode;
  enabled: boolean;
  isTouch: boolean;
  controlsRef: RefObject<PointerLockControlsImpl | null>;
  inputRef: MutableRefObject<MoveInput>;
  lookDeltaRef: MutableRefObject<LookDelta>;
  onModeToggle: () => void;
  onRoomChange: (index: number) => void;
  onArtworkSelect: (item: GalleryItem) => void;
  onArtworkHover: (item: GalleryItem | null) => void;
}

export default function GalleryCanvas({
  rooms,
  mode,
  enabled,
  isTouch,
  controlsRef,
  inputRef,
  lookDeltaRef,
  onModeToggle,
  onRoomChange,
  onArtworkSelect,
  onArtworkHover,
}: GalleryCanvasProps) {
  return (
    <div id={CANVAS_ID} className={`app-canvas ${enabled ? '' : 'is-disabled'}`}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: 68, near: 0.1, far: 220, position: [0, 1.65, 2.5] }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <color attach="background" args={[BG_COLOR]} />
        <fogExp2 attach="fog" args={[BG_COLOR, 0.008]} />
        <hemisphereLight args={['#ffffff', '#4a4a48', 0.5]} />
        <EnvSetup />
        <Lighting roomCount={rooms.length} />

        <Suspense fallback={null}>
          {rooms.map((room, i) => (
            <group key={room.year}>
              <Room index={i} year={room.year} roomCount={rooms.length} />
              <RoomArtworks
                roomIndex={i}
                roomCount={rooms.length}
                items={room.items}
                onSelect={onArtworkSelect}
                onHover={onArtworkHover}
              />
            </group>
          ))}

          {rooms.slice(1).map((_, i) => (
            <Corridor key={`corr-${i}`} index={i} />
          ))}
        </Suspense>

        <Player
          roomCount={rooms.length}
          enabled={enabled}
          mode={mode}
          isTouch={isTouch}
          canvasSelector={`#${CANVAS_ID}`}
          controlsRef={controlsRef}
          inputRef={inputRef}
          lookDeltaRef={lookDeltaRef}
          onModeToggle={onModeToggle}
          onRoomChange={onRoomChange}
        />
      </Canvas>
    </div>
  );
}
