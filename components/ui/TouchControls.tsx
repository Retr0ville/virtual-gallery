// Touch controls — minimal virtual joystick (bottom-left) + drag-look zone.
// Writes straight into shared mutable refs consumed by the Player.

import { MutableRefObject, useEffect, useRef } from 'react';
import { LookDelta, MoveInput } from '../3d/Player';

const JOYSTICK_TRAVEL = 40; // px of knob travel for full speed

interface TouchControlsProps {
  active: boolean;
  inputRef: MutableRefObject<MoveInput>;
  lookDeltaRef: MutableRefObject<LookDelta>;
}

export function TouchControls({ active, inputRef, lookDeltaRef }: TouchControlsProps) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const lookRef = useRef<HTMLDivElement>(null);
  const joyTouchId = useRef<number | null>(null);
  const lookTouchId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!active) return;
    const joy = joystickRef.current;
    const knob = knobRef.current;
    const look = lookRef.current;
    if (!joy || !knob || !look) return;

    const ease = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 0.85);

    const updateJoy = (t: Touch) => {
      const rect = joy.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = t.clientX - cx;
      let dy = t.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > JOYSTICK_TRAVEL) {
        dx = (dx / dist) * JOYSTICK_TRAVEL;
        dy = (dy / dist) * JOYSTICK_TRAVEL;
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      inputRef.current.x = ease(dx / JOYSTICK_TRAVEL);
      inputRef.current.z = -ease(dy / JOYSTICK_TRAVEL);
    };

    const onJoyStart = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      joyTouchId.current = t.identifier;
      updateJoy(t);
      e.preventDefault();
    };
    const onJoyMove = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === joyTouchId.current) {
          updateJoy(t);
          e.preventDefault();
        }
      }
    };
    const onJoyEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === joyTouchId.current) {
          joyTouchId.current = null;
          knob.style.transform = 'translate(-50%, -50%)';
          inputRef.current.x = 0;
          inputRef.current.z = 0;
        }
      }
    };

    const onLookStart = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      lookTouchId.current = t.identifier;
      lookLast.current = { x: t.clientX, y: t.clientY };
    };
    const onLookMove = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === lookTouchId.current) {
          lookDeltaRef.current.dx += t.clientX - lookLast.current.x;
          lookDeltaRef.current.dy += t.clientY - lookLast.current.y;
          lookLast.current = { x: t.clientX, y: t.clientY };
          e.preventDefault();
        }
      }
    };
    const onLookEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === lookTouchId.current) lookTouchId.current = null;
      }
    };

    joy.addEventListener('touchstart', onJoyStart, { passive: false });
    joy.addEventListener('touchmove', onJoyMove, { passive: false });
    joy.addEventListener('touchend', onJoyEnd);
    joy.addEventListener('touchcancel', onJoyEnd);
    look.addEventListener('touchstart', onLookStart, { passive: true });
    look.addEventListener('touchmove', onLookMove, { passive: false });
    look.addEventListener('touchend', onLookEnd);
    look.addEventListener('touchcancel', onLookEnd);

    return () => {
      joy.removeEventListener('touchstart', onJoyStart);
      joy.removeEventListener('touchmove', onJoyMove);
      joy.removeEventListener('touchend', onJoyEnd);
      joy.removeEventListener('touchcancel', onJoyEnd);
      look.removeEventListener('touchstart', onLookStart);
      look.removeEventListener('touchmove', onLookMove);
      look.removeEventListener('touchend', onLookEnd);
      look.removeEventListener('touchcancel', onLookEnd);
      inputRef.current.x = 0;
      inputRef.current.z = 0;
    };
  }, [active, inputRef, lookDeltaRef]);

  if (!active) return null;

  return (
    <>
      <div ref={lookRef} className="touch-look" />
      <div ref={joystickRef} className="touch-joystick">
        <div ref={knobRef} className="touch-knob" />
      </div>
    </>
  );
}
