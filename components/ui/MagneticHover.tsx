// Global magnetic hover — every button leans toward a nearby pointer.
// Buttons opt into the `is-magnetic` class on first pointer contact; CSS vars
// carry the per-button offset so base transforms stay untouched.

import { useEffect } from 'react';

const RADIUS = 170; // px — pull starts within this distance of a button
const STRENGTH = 0.32;
const MAX = 22; // px

// Dense UI (HUD controls, admin panel) gets a much tighter, subtler pull.
const SOFT = { radius: 40, strength: 0.07, max: 3 };

function setPull(btn: HTMLButtonElement, x: number, y: number) {
  btn.classList.add('is-magnetic');
  btn.style.setProperty('--pull-x', `${x}px`);
  btn.style.setProperty('--pull-y', `${y}px`);
}

export function MagneticHover() {
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      // Locked pointer reports a frozen position — don't pull anything.
      if (document.pointerLockElement) return;
      const buttons = document.querySelectorAll<HTMLButtonElement>('button');
      buttons.forEach((btn) => {
        if (btn.disabled || btn.classList.contains('no-magnetic')) return;
        const rect = btn.getBoundingClientRect();
        // Skip hidden and full-surface buttons (e.g. error fallback).
        if (rect.width === 0 || rect.height === 0) return;
        if (rect.width > 220 || rect.height > 220) return;
        // Rect already includes the current offset — subtract it so the pull
        // doesn't chase its own translation.
        const curX = parseFloat(btn.style.getPropertyValue('--pull-x')) || 0;
        const curY = parseFloat(btn.style.getPropertyValue('--pull-y')) || 0;
        const cx = rect.left + rect.width / 2 - curX;
        const cy = rect.top + rect.height / 2 - curY;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);
        const soft = btn.classList.contains('magnet-soft') || btn.closest('.admin') !== null;
        const radius = soft ? SOFT.radius : RADIUS;
        const strength = soft ? SOFT.strength : STRENGTH;
        const max = soft ? SOFT.max : MAX;
        const falloff = Math.max(0, 1 - dist / radius);
        const x = Math.max(-max, Math.min(max, dx * strength * falloff));
        const y = Math.max(-max, Math.min(max, dy * strength * falloff));
        setPull(btn, x, y);
      });
    };
    const reset = () => {
      document.querySelectorAll<HTMLButtonElement>('button.is-magnetic').forEach((btn) => {
        btn.style.setProperty('--pull-x', '0px');
        btn.style.setProperty('--pull-y', '0px');
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('blur', reset);
    document.addEventListener('pointerleave', reset);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('blur', reset);
      document.removeEventListener('pointerleave', reset);
    };
  }, []);
  return null;
}
