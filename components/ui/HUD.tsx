// HUD overlay — wordmark, room year, hover tooltip, controls hint, mode toggle.

import { useEffect, useState } from 'react';
import { GalleryItem } from '../../utils/media';
import { MoveMode } from '../3d/Player';

interface HUDProps {
  mode: MoveMode;
  year: number | null;
  hovered: GalleryItem | null;
  roomItemCount: number;
  entered: boolean;
  isTouch: boolean;
  onToggleMode: () => void;
}

export function HUD({
  mode,
  year,
  hovered,
  roomItemCount,
  entered,
  isTouch,
  onToggleMode,
}: HUDProps) {
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    if (!entered) return;
    setHintVisible(true);
    const t = setTimeout(() => setHintVisible(false), 8000);
    return () => clearTimeout(t);
  }, [entered, mode]);

  if (!entered) return null;

  const hint =
    roomItemCount === 0
      ? 'No artworks yet'
      : mode === 'walk'
        ? 'WASD move · Shift sprint · F fly · Click travel · Esc release cursor'
        : 'WASD move · Space up · Shift down · F walk · Click travel · Esc release cursor';

  return (
    <div className="hud">
      <div className="hud-wordmark">SIMILOLUWA'S GALLERY</div>
      <div className={`hud-year ${year !== null ? 'is-visible' : ''}`}>{year ?? ''}</div>
      {!isTouch && <div className="hud-crosshair" />}

      <div className={`hud-tooltip ${hovered ? 'is-visible' : ''}`}>
        <div className="hud-tooltip-title">{hovered?.title ?? ''}</div>
        {hovered && (
          <div className="hud-tooltip-sub">
            {hovered.description ? `${hovered.year} — ${hovered.description}` : hovered.year}
          </div>
        )}
      </div>

      <div className={`hud-hint ${hintVisible ? '' : 'is-hidden'}`}>{hint}</div>

      <div className="hud-actions">
        <button className="hud-chip magnet-soft" onClick={onToggleMode}>
          {mode === 'walk' ? 'Fly' : 'Walk'}
        </button>
      </div>
    </div>
  );
}
