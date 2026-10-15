// Entrance overlay — real asset loading progress, click to enter (pointer-lock gesture).

import { useProgress } from '@react-three/drei';
import { useEffect, useState } from 'react';

interface EntranceProps {
  onEnter: () => void;
}

export function Entrance({ onEnter }: EntranceProps) {
  const { progress, active } = useProgress();
  const [settled, setSettled] = useState(false);
  const [closing, setClosing] = useState(false);
  const [done, setDone] = useState(false);

  // Empty gallery loads zero tracked assets — loader never reaches 100.
  // Treat a quiet loader (no activity for a moment) as done.
  useEffect(() => {
    if (active) {
      setSettled(false);
      return;
    }
    const t = setTimeout(() => setSettled(true), 400);
    return () => clearTimeout(t);
  }, [active, progress]);

  const ready = !active && (progress >= 100 || settled);

  const handleClick = () => {
    if (!ready || closing) return;
    setClosing(true);
    onEnter();
    setTimeout(() => setDone(true), 750);
  };

  if (done) return null;

  return (
    <div className={`entrance ${closing ? 'is-closing' : ''}`}>
      <div className="entrance-wordmark">Gallery</div>
      <div className="entrance-sub">A walk through the years</div>

      <div className="entrance-progress">
        <div className="entrance-progress-bar" style={{ width: `${Math.min(100, progress)}%` }} />
      </div>

      <button className="entrance-btn" onClick={handleClick} disabled={!ready}>
        {ready ? 'Enter' : 'Loading'}
      </button>

      <div className="entrance-hint">
        Mouse look · WASD move · F to fly
      </div>
    </div>
  );
}
