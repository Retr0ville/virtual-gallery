// Canvas host — renderer config, environment, room/corridor composition,
// artwork placement, lighting rig, player.

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MutableRefObject, RefObject, Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib';
import { YearRoom, GalleryItem } from '../../utils/media';
import { themeForRoom } from '../../utils/themes';
import { RoomArtworks } from './Artwork';
import { Beams } from './Beams';
import { Centerpiece } from './Centerpiece';
import { Corridor } from './Corridor';
import { GalleryFloor } from './GalleryFloor';
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

// Nothing animated in the scene casts shadows (beams/motes don't). Freeze the
// shadow maps: bake for the first frames (mounts/loads settle), then skip the
// per-frame shadow pass — it otherwise runs twice per frame (main + reflector).
function ShadowBake() {
  const gl = useThree((s) => s.gl);
  const frames = useRef(0);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);
  useFrame(() => {
    if (frames.current < 45) {
      frames.current += 1;
      gl.shadowMap.needsUpdate = true;
    }
  });
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
  // A corridor into a room whose year hasn't arrived yet is sealed by a
  // locked door: rooms open on her birthday, Oct 15 of their own year.
  const lockedCorridors = useMemo(() => {
    const now = Date.now();
    return rooms.slice(1).map((r) => now < new Date(r.year, 9, 15).getTime());
  }, [rooms]);

  return (
    <div id={CANVAS_ID} className={`app-canvas ${enabled ? '' : 'is-disabled'}`}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: 68, near: 0.1, far: 220, position: [0, 1.65, 2.5] }}
        onCreated={({ gl, camera }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          // Debug hook for the probe scripts (probe3.cjs reads positions).
          (window as unknown as { __cam?: THREE.Camera }).__cam = camera;
        }}
      >
        <color attach="background" args={[BG_COLOR]} />
        <fogExp2 attach="fog" args={[BG_COLOR, 0.008]} />
        <hemisphereLight args={['#ffffff', '#4a4a48', 0.5]} />
        <EnvSetup />
        <ShadowBake />
        <Lighting roomCount={rooms.length} />
        <Beams roomCount={rooms.length} />
        <GalleryFloor roomCount={rooms.length} />

        <Suspense fallback={null}>
          {rooms.map((room, i) => (
            <group key={room.year}>
              <Room index={i} year={room.year} roomCount={rooms.length} theme={themeForRoom(i)} />
              <Centerpiece index={i} year={room.year} theme={themeForRoom(i)} />
              <Suspense fallback={null}>
                <RoomArtworks
                  roomIndex={i}
                  roomCount={rooms.length}
                  items={room.items}
                  onSelect={onArtworkSelect}
                  onHover={onArtworkHover}
                />
              </Suspense>
            </group>
          ))}

          {rooms.slice(1).map((_, i) => (
            <Corridor
              key={`corr-${i}`}
              index={i}
              year={rooms[i + 1].year}
              lineColor={i === 0 ? '#ffa53c' : themeForRoom(i + 1).accent}
              locked={lockedCorridors[i]}
            />
          ))}
        </Suspense>

        <Player
          roomCount={rooms.length}
          lockedCorridors={lockedCorridors}
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
