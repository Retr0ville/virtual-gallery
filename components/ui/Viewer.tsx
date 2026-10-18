// Fullscreen viewer — images wrap the inside of a very large cylinder, so the
// current print faces you and only slivers of its neighbours peek in at the
// screen edges. Keyboard / arrow navigation.

import { useEffect, useState } from 'react';
import { CldImage } from 'next-cloudinary';
import { dominantColor } from '../../utils/colors';
import { GalleryItem } from '../../utils/media';
import { themeForRoom } from '../../utils/themes';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from './Icons';

interface ViewerProps {
  item: GalleryItem;
  items: GalleryItem[];
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

// Cylinder geometry. Radius scales with the viewport so the curvature reads
// the same everywhere; neighbours are tucked to the screen edges by solving
// R·sinθ − S·cosθ = vw/2 − SLIVER (S = slide half-width).
const SLIVER_VW = 0.04; // neighbour visible band per side (fraction of viewport)
const MIN_SLIVER = 24; // px floor for small screens
const SLOT_VW = 0.9; // slide width as a fraction of viewport width
const INACTIVE_SCALE = 0.84; // neighbours sit visibly smaller on the ring

export function Viewer({ item, items, onClose, onNext, onPrev }: ViewerProps) {
  const [vw, setVw] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth
  );
  const [imageColors, setImageColors] = useState<Record<string, string>>({});

  // Sample each print's dominant colour for its slide backdrop.
  useEffect(() => {
    let alive = true;
    items.forEach((it) => {
      dominantColor(it.url).then((color) => {
        if (!alive || !color) return;
        setImageColors((prev) => ({ ...prev, [it.publicId]: color }));
      });
    });
    return () => {
      alive = false;
    };
  }, [items]);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Entering the viewer always frees the cursor — even if the parent's paused
  // flag hasn't committed yet. The click that opened the viewer also reaches
  // drei's canvas click-to-lock handler, whose requestPointerLock can resolve
  // *after* the exit calls — so keep forcing the lock off for the whole time
  // the viewer is mounted.
  useEffect(() => {
    const release = () => {
      if (document.pointerLockElement) document.exitPointerLock();
    };
    release();
    document.addEventListener('pointerlockchange', release);
    return () => document.removeEventListener('pointerlockchange', release);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') onNext();
      else if (e.key === 'ArrowLeft') onPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNext, onPrev]);

  const index = Math.max(
    0,
    items.findIndex((i) => i.publicId === item.publicId)
  );
  const count = items.length;
  const halfSlot = (vw * SLOT_VW) / 2;
  const neighbourHalf = halfSlot * INACTIVE_SCALE;
  // Slides sit tangent to a ring. Default spacing from the sliver target; cap
  // it at one full turn so the ring can't wrap back over itself (with enough
  // prints the old fixed step reached ~11 rad total and overlapped images).
  const baseRadius = vw * 1.5;
  const target = vw / 2 - Math.max(MIN_SLIVER, vw * SLIVER_VW);
  const desiredStep =
    Math.asin(Math.min(1, target / Math.hypot(baseRadius, neighbourHalf))) +
    Math.atan2(neighbourHalf, baseRadius);
  const maxStep = (Math.PI * 2) / Math.max(count, 2);
  const step = Math.min(desiredStep, maxStep);
  // Once the step is compressed, grow the ring until an adjacent (scaled)
  // slide's near edge projects outside the active print — no overlap.
  const minRadius =
    count > 1
      ? ((halfSlot + neighbourHalf * Math.cos(step)) / Math.sin(step)) * 1.01
      : baseRadius;
  const radius = Math.max(baseRadius, minRadius);
  // Rooms are ordered by year, so an item's accent follows its year's room.
  const yearOrder = Array.from(new Set(items.map((i) => i.year))).sort((a, b) => a - b);
  const accentFor = (it: GalleryItem) =>
    themeForRoom(Math.max(0, yearOrder.indexOf(it.year))).accent;

  return (
    <div className="viewer">
      <div
        className="viewer-stage"
        style={{ perspective: `${radius * 2}px` }}
      >
        <div
          className="viewer-cylinder"
          style={{
            transform: `translateZ(${-radius}px) rotateY(${-index * step}rad)`,
          }}
        >
          {items.map((it, i) => (
            <div
              key={it.publicId}
              className="viewer-slide"
              style={{
                transform: `rotateY(${i * step}rad) translateZ(${radius}px) scale(${
                  i === index ? 1 : INACTIVE_SCALE
                })`,
              }}
              aria-hidden={i !== index}
            >
              <div
                className="viewer-slide-backdrop"
                style={{
                  background: imageColors[it.publicId] ?? accentFor(it),
                }}
              />
              <CldImage
                className="viewer-image"
                src={it.publicId}
                width={it.width ?? 1600}
                height={it.height ?? 1200}
                crop="limit"
                sizes="90vw"
                alt={it.title}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="viewer-bar">
        <div className="viewer-meta">
          <div className="viewer-title">{item.title}</div>
          <div className="viewer-sub">
            {item.year}
            {item.description ? ` — ${item.description}` : ''}
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close viewer">
          <CloseIcon />
        </button>
      </div>

      <button
        className="icon-btn viewer-nav viewer-nav-prev"
        onClick={onPrev}
        aria-label="Previous image"
      >
        <ChevronLeftIcon />
      </button>

      <button
        className="icon-btn viewer-nav viewer-nav-next"
        onClick={onNext}
        aria-label="Next image"
      >
        <ChevronRightIcon />
      </button>

      <div className="viewer-caption">Arrow keys to browse · Esc to close</div>
    </div>
  );
}
