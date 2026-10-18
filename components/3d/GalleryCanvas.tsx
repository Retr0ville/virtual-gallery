// Canvas host — renderer config, environment, room/corridor composition,
// artwork placement, lighting rig, player.

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MutableRefObject, RefObject, Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib';
import { YearRoom, GalleryItem } from '../../utils/media';
import { EYE, R, buildRegions, ceilingAt, insideAnyRegion, insideFlightBounds, roomCenterX } from '../../utils/layout';
import { themeForRoom } from '../../utils/themes';
import { RoomArtworks } from './Artwork';
import { Beams } from './Beams';
import { Centerpiece } from './Centerpiece';
import { Corridor } from './Corridor';
import { GalleryFloor } from './GalleryFloor';
import { Lighting } from './Lighting';
import { FlyTarget, LookDelta, MoveInput, MoveMode, Player } from './Player';
import { Room } from './Room';
import { TurntableAudio } from './TurntableAudio';

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

interface ClickNavigatorProps {
  enabled: boolean;
  mode: MoveMode;
  roomCount: number;
  lockedCorridors: readonly boolean[];
  flyToRef: MutableRefObject<FlyTarget | null>;
  onArtworkSelect: (item: GalleryItem) => void;
  onToggleSound: () => void;
}

// Any click on a surface glides the camera there. Artwork clicks target a
// viewing spot in front of the frame, then open the viewer on arrival.
function ClickNavigator({
  enabled,
  mode,
  roomCount,
  lockedCorridors,
  flyToRef,
  onArtworkSelect,
  onToggleSound,
}: ClickNavigatorProps) {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    if (!enabled) return;
    const el = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const regions = buildRegions(roomCount, lockedCorridors);

    const handleClick = (event: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const locked = document.pointerLockElement === el;
      pointer.set(
        locked ? 0 : ((event.clientX - rect.left) / rect.width) * 2 - 1,
        locked ? 0 : -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);

      // Skip points (motes) and additive light shafts — they aren't surfaces.
      const hit = raycaster.intersectObjects(scene.children, true).find((h) => {
        const mesh = h.object as THREE.Mesh;
        if (!mesh.isMesh || !mesh.visible) return false;
        const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as
          | THREE.Material
          | undefined;
        return !material || material.blending !== THREE.AdditiveBlending;
      });
      if (!hit) return;

      let tagged: THREE.Object3D | null = hit.object;
      let turntable = false;
      while (tagged) {
        if (tagged.userData.artwork) break;
        if (tagged.userData.turntable) {
          turntable = true;
          break;
        }
        tagged = tagged.parent;
      }
      if (turntable) {
        onToggleSound();
        return;
      }
      const artwork = tagged?.userData.artwork as GalleryItem | undefined;

      const dest = new THREE.Vector3();
      let lookAt: THREE.Vector3 | undefined;
      let onArrive: (() => void) | undefined;

      if (artwork && tagged) {
        const normal = new THREE.Vector3(0, 0, 1)
          .applyQuaternion(tagged.getWorldQuaternion(new THREE.Quaternion()))
          .normalize();
        const center = tagged.getWorldPosition(new THREE.Vector3());
        dest.copy(center).addScaledVector(normal, 1.6);
        dest.y = EYE;
        lookAt = center;
        const item = artwork;
        onArrive = () => onArtworkSelect(item);
      } else {
        const normal = hit.face
          ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
          : new THREE.Vector3(0, 1, 0);
        dest.copy(hit.point);
        if (normal.y > 0.5) {
          // Floor / tabletop: stand at eye height over the clicked spot.
          dest.y = EYE;
        } else if (normal.y < -0.5) {
          // Ceiling: rise to just below it.
          dest.y = ceilingAt(hit.point.x, hit.point.z, roomCount) - 0.3;
        } else {
          // Wall: back off toward the camera so we end in front of it.
          const toward = camera.position.clone().sub(hit.point);
          toward.y = 0;
          if (toward.lengthSq() < 1e-6) toward.set(0, 0, 1);
          toward.normalize();
          dest.addScaledVector(toward, 1.6);
          dest.y = THREE.MathUtils.clamp(
            hit.point.y,
            EYE,
            ceilingAt(hit.point.x, hit.point.z, roomCount) - 0.3
          );
        }
      }

      const reachable =
        mode === 'walk'
          ? insideAnyRegion(regions, dest.x, dest.z)
          : insideFlightBounds(regions, dest.x, dest.z);
      if (!reachable) return;

      // Locked doors are barriers for click-travel too: never cross the cut
      // plane of a locked corridor, even though the room beyond is rendered.
      for (let i = 0; i < roomCount - 1; i++) {
        if (!lockedCorridors[i]) continue;
        const cutX = roomCenterX(i + 1) - R - 0.12;
        if ((camera.position.x > cutX) !== (dest.x > cutX)) return;
      }

      flyToRef.current = { position: dest, lookAt, onArrive };
    };

    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, [enabled, mode, roomCount, lockedCorridors, flyToRef, onArtworkSelect, onToggleSound, camera, scene, gl]);

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
  flyToRef: MutableRefObject<FlyTarget | null>;
  musicPlaying: boolean;
  onModeToggle: () => void;
  onRoomChange: (index: number) => void;
  onArtworkSelect: (item: GalleryItem) => void;
  onArtworkHover: (item: GalleryItem | null) => void;
  onToggleSound: () => void;
}

export default function GalleryCanvas({
  rooms,
  mode,
  enabled,
  isTouch,
  controlsRef,
  inputRef,
  lookDeltaRef,
  flyToRef,
  musicPlaying,
  onModeToggle,
  onRoomChange,
  onArtworkSelect,
  onArtworkHover,
  onToggleSound,
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
        <TurntableAudio roomCount={rooms.length} playing={musicPlaying} />
        <ClickNavigator
          enabled={enabled}
          mode={mode}
          roomCount={rooms.length}
          lockedCorridors={lockedCorridors}
          flyToRef={flyToRef}
          onArtworkSelect={onArtworkSelect}
          onToggleSound={onToggleSound}
        />

        <Suspense fallback={null}>
          {rooms.map((room, i) => (
            <group key={room.year}>
              <Room index={i} year={room.year} roomCount={rooms.length} theme={themeForRoom(i)} />
              <Centerpiece index={i} year={room.year} theme={themeForRoom(i)} playing={musicPlaying} />
              <Suspense fallback={null}>
                <RoomArtworks
                  roomIndex={i}
                  roomCount={rooms.length}
                  items={room.items}
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
          flyToRef={flyToRef}
          onModeToggle={onModeToggle}
          onRoomChange={onRoomChange}
        />
      </Canvas>
    </div>
  );
}
