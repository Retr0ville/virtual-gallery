// HUD overlay — wordmark, room year, hover tooltip, controls hint, mode + admin buttons.

import { useEffect, useState } from 'react';
import { GalleryItem } from '../../utils/media';
import { MoveMode } from '../3d/Player';
import { AdjustIcon } from './Icons';

interface HUDProps {
  mode: MoveMode;
  year: number | null;
  hovered: GalleryItem | null;
  roomItemCount: number;
  entered: boolean;
  isTouch: boolean;
  onToggleMode: () => void;
  onOpenAdmin: () => void;
}

export function HUD({
  mode,
  year,
  hovered,
  roomItemCount,
  entered,
  isTouch,
  onToggleMode,
  onOpenAdmin,
}: HUDProps) {
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setHintVisible(false), 8000);
    return () => clearTimeout(t);
  }, []);

  if (!entered) return null;

  const hint =
    roomItemCount === 0
      ? 'No artworks yet — open the panel to upload'
      : mode === 'walk'
        ? 'WASD move · Shift sprint · F fly · Esc release cursor'
        : 'WASD move · Space up · Shift down · F walk · Esc release cursor';

  return (
    <div className="hud">
      <div className="hud-wordmark">Gallery</div>
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
        <button className="hud-chip" onClick={onToggleMode}>
          {mode === 'walk' ? 'Fly' : 'Walk'}
        </button>
        <button className="icon-btn" onClick={onOpenAdmin} aria-label="Manage gallery" title="Manage gallery">
          <AdjustIcon />
        </button>
      </div>
    </div>
  );
}
