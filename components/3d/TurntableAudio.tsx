// Music source — a single positional emitter that rides along with the
// turntable of whichever room the camera is in, so the song always comes out
// of the record player next to you. Clicking any turntable toggles playback.

import { PositionalAudio } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { currentRoomIndex, roomCenterX, turntableSpot } from '../../utils/layout';

const EMIT_Y = 1.1; // above the glass, at platter height
const VOLUME = 0.9;
const REF_DISTANCE = 3; // full volume within 3m, inverse falloff beyond

interface TurntableAudioProps {
  roomCount: number;
  playing: boolean;
}

export function TurntableAudio({ roomCount, playing }: TurntableAudioProps) {
  const group = useRef<THREE.Group>(null);
  const sound = useRef<THREE.PositionalAudio | null>(null);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  // Corridors report -1; keep emitting from the last room's turntable there.
  const lastRoom = useRef(0);

  // The shared AudioContext starts suspended (browser autoplay policy).
  // Resume it on the first real gesture: Enter, a turntable click, HUD toggle.
  useEffect(() => {
    const unlock = () => {
      const ctx = sound.current?.listener.context;
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Follow the player's room; in corridors stay with the room just left.
  useFrame(({ camera }) => {
    const room = currentRoomIndex(camera.position.x, camera.position.z, roomCount);
    if (room >= 0) lastRoom.current = room;
    const spot = turntableSpot(lastRoom.current);
    group.current?.position.set(roomCenterX(lastRoom.current) + spot.x, EMIT_Y, spot.z);

    const audio = sound.current;
    if (!audio || !audio.buffer) return;
    if (playingRef.current && !audio.isPlaying) audio.play();
    else if (!playingRef.current && audio.isPlaying) audio.pause();
  });

  return (
    <group ref={group}>
      {/* Buffer loads via suspense; silence until ready. */}
      <Suspense fallback={null}>
        <PositionalAudio
          ref={(node) => {
            sound.current = node;
            // setVolume/setRefDistance are methods, not R3F-settable props.
            node?.setVolume(VOLUME);
            node?.setRefDistance(REF_DISTANCE);
          }}
          url="/bgm/hbd.m4a"
          loop
        />
      </Suspense>
    </group>
  );
}
