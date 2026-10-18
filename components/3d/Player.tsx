// Player controller — walk + fly modes, pointer-lock mouse look,
// analytic collision against the union of room circles and corridor rects.

import { PointerLockControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { MutableRefObject, Ref, RefObject, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib';
import {
  EYE,
  SPAWN_X,
  SPAWN_Z,
  buildRegions,
  ceilingAt,
  currentRoomIndex,
  insideAnyRegion,
  insideFlightBounds,
} from '../../utils/layout';

export type MoveMode = 'walk' | 'fly';

// Click-to-travel destination. Player glides the camera here and fires the
// optional callback on arrival (used to open the artwork viewer).
export interface FlyTarget {
  position: THREE.Vector3;
  onArrive?: () => void;
}

export interface MoveInput {
  x: number; // strafe, +1 = right
  z: number; // forward, +1 = forward
}

export interface LookDelta {
  dx: number;
  dy: number;
}

const WALK_SPEED = 4.2;
const SPRINT_SPEED = 6.0;
const FLY_SPEED = 6.5;
const FLY_VERTICAL_SPEED = 3.0;
const ACCEL = 10;
const LOOK_SENSITIVITY = 0.0022;
const PITCH_LIMIT = Math.PI / 2 - 0.05;

const UP = new THREE.Vector3(0, 1, 0);
// Allocation-free frame temps.
const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

interface PlayerProps {
  roomCount: number;
  lockedCorridors: readonly boolean[];
  enabled: boolean;
  mode: MoveMode;
  isTouch: boolean;
  canvasSelector: string;
  controlsRef: RefObject<PointerLockControlsImpl | null>;
  inputRef: MutableRefObject<MoveInput>;
  lookDeltaRef: MutableRefObject<LookDelta>;
  flyToRef: MutableRefObject<FlyTarget | null>;
  onModeToggle: () => void;
  onRoomChange: (index: number) => void;
}

export function Player({
  roomCount,
  lockedCorridors,
  enabled,
  mode,
  isTouch,
  canvasSelector,
  controlsRef,
  inputRef,
  lookDeltaRef,
  flyToRef,
  onModeToggle,
  onRoomChange,
}: PlayerProps) {
  const camera = useThree((s) => s.camera);
  const setEvents = useThree((s) => s.setEvents);
  const regions = useMemo(
    () => buildRegions(roomCount, lockedCorridors),
    [roomCount, lockedCorridors]
  );
  const keys = useRef<Set<string>>(new Set());
  const velocity = useRef(new THREE.Vector3());
  const bobPhase = useRef(0);
  const lastRoom = useRef(-2);

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const onModeToggleRef = useRef(onModeToggle);
  onModeToggleRef.current = onModeToggle;
  const onRoomChangeRef = useRef(onRoomChange);
  onRoomChangeRef.current = onRoomChange;

  // Initial placement: just inside the first room's closed entry, facing into
  // the gallery across the ring table.
  useEffect(() => {
    camera.position.set(SPAWN_X, EYE, SPAWN_Z);
    camera.rotation.set(0, -Math.PI / 2, 0);
    velocity.current.set(0, 0, 0);
  }, [camera]);

  // drei's PointerLockControls replaces events.compute (forcing raycasts to
  // screen center) whenever its `enabled` prop is true — including while the
  // pointer is NOT locked and the real cursor is visible. That breaks hover
  // and click on artworks at the real cursor position. Parent effects run
  // after child effects, so this override wins on every enabled commit:
  // center raycast only while actually locked, real offsets otherwise.
  useEffect(() => {
    if (isTouch) return;
    setEvents({
      compute(event, state) {
        if (document.pointerLockElement) {
          state.pointer.set(0, 0);
        } else {
          state.pointer.set(
            (event.offsetX / state.size.width) * 2 - 1,
            -(event.offsetY / state.size.height) * 2 + 1
          );
        }
        state.raycaster.setFromCamera(state.pointer, state.camera);
      },
    });
  }, [isTouch, enabled, setEvents]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!enabledRef.current) return;
      if (e.code === 'KeyF' && !e.repeat) {
        onModeToggleRef.current();
        return;
      }
      keys.current.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);

    if (!enabledRef.current) {
      velocity.current.multiplyScalar(Math.exp(-8 * dt));
      inputRef.current.x = 0;
      inputRef.current.z = 0;
      return;
    }

    // Touch look deltas (mobile drag-look).
    const look = lookDeltaRef.current;
    if (look.dx !== 0 || look.dy !== 0) {
      _euler.setFromQuaternion(camera.quaternion);
      _euler.y -= look.dx * LOOK_SENSITIVITY;
      _euler.x = THREE.MathUtils.clamp(_euler.x - look.dy * LOOK_SENSITIVITY, -PITCH_LIMIT, PITCH_LIMIT);
      camera.quaternion.setFromEuler(_euler);
      look.dx = 0;
      look.dy = 0;
    }

    const pos = camera.position;

    // Click-to-travel: glide straight to the requested point, bypassing the
    // normal movement/collision step, then resume the current mode.
    const flight = flyToRef.current;
    if (flight) {
      pos.lerp(flight.position, 1 - Math.exp(-5 * dt));
      velocity.current.set(0, 0, 0);
      if (pos.distanceToSquared(flight.position) < 0.0036) {
        pos.copy(flight.position);
        flyToRef.current = null;
        flight.onArrive?.();
      }
      const flightRoom = currentRoomIndex(pos.x, pos.z, roomCount);
      if (flightRoom !== lastRoom.current) {
        lastRoom.current = flightRoom;
        onRoomChangeRef.current(flightRoom);
      }
      return;
    }

    // Walk is blocked by furniture and door leaves; fly only by the walls.
    const isWalk = modeRef.current === 'walk';
    const inBounds = isWalk ? insideAnyRegion : insideFlightBounds;

    // Layout changed under the player (a year was removed from the manifest)
    // — snap back to the spawn instead of freezing outside all regions.
    if (!inBounds(regions, pos.x, pos.z)) {
      pos.set(SPAWN_X, EYE, SPAWN_Z);
      velocity.current.set(0, 0, 0);
      return;
    }

    const k = keys.current;
    const move = inputRef.current;

    let ix = move.x;
    let iz = move.z;
    if (k.has('KeyW') || k.has('ArrowUp')) iz += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) iz -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) ix += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) ix -= 1;
    const mag = Math.hypot(ix, iz);
    if (mag > 1) {
      ix /= mag;
      iz /= mag;
    }

    camera.getWorldDirection(_dir);
    if (isWalk) _dir.y = 0;
    _dir.normalize();
    _right.crossVectors(_dir, UP).normalize();

    const sprint = k.has('ShiftLeft') || k.has('ShiftRight');
    const speed = isWalk ? (sprint ? SPRINT_SPEED : WALK_SPEED) : FLY_SPEED;

    _desired
      .set(0, 0, 0)
      .addScaledVector(_dir, iz * speed)
      .addScaledVector(_right, ix * speed);

    if (!isWalk) {
      let vy = 0;
      if (k.has('Space')) vy += FLY_VERTICAL_SPEED;
      if (sprint) vy -= FLY_VERTICAL_SPEED;
      // Add to the pitch-directed component instead of replacing it, so W
      // while looking up/down actually climbs/dives like free flight.
      _desired.y += vy;
    }

    const v = velocity.current;
    v.lerp(_desired, 1 - Math.exp(-ACCEL * dt));

    // Horizontal collision with slide.
    const dx = v.x * dt;
    const dz = v.z * dt;
    let nx = pos.x + dx;
    let nz = pos.z + dz;
    if (!inBounds(regions, nx, nz)) {
      if (inBounds(regions, pos.x + dx, pos.z)) {
        nz = pos.z;
      } else if (inBounds(regions, pos.x, pos.z + dz)) {
        nx = pos.x;
      } else {
        nx = pos.x;
        nz = pos.z;
      }
    }
    pos.x = nx;
    pos.z = nz;

    if (isWalk) {
      const planarSpeed = Math.hypot(v.x, v.z);
      if (planarSpeed > 0.05) {
        bobPhase.current += dt * planarSpeed * 2.6;
      }
      const bob = planarSpeed > 0.05 ? Math.sin(bobPhase.current) * 0.018 : 0;
      pos.y += (EYE + bob - pos.y) * (1 - Math.exp(-8 * dt));
    } else {
      const ceil = ceilingAt(pos.x, pos.z, roomCount) - 0.3;
      pos.y = THREE.MathUtils.clamp(pos.y + v.y * dt, 0.45, ceil);
    }

    const room = currentRoomIndex(pos.x, pos.z, roomCount);
    if (room !== lastRoom.current) {
      lastRoom.current = room;
      onRoomChangeRef.current(room);
    }
  });

  // Touch devices: no PointerLockControls at all — drei attaches its
  // click-to-lock handler unconditionally, which would fire on every tap.
  if (isTouch) return null;

  return (
    <PointerLockControls
      ref={controlsRef as unknown as Ref<PointerLockControlsImpl>}
      selector={canvasSelector}
      enabled={enabled}
    />
  );
}
