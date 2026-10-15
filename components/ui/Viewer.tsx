// Fullscreen viewer — clean image presentation with keyboard navigation.

import { useEffect } from 'react';
import { GalleryItem } from '../../utils/media';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from './Icons';

interface ViewerProps {
  item: GalleryItem;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export function Viewer({ item, onClose, onNext, onPrev }: ViewerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') onNext();
      else if (e.key === 'ArrowLeft') onPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNext, onPrev]);

  return (
    <div className="viewer">
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

      <button className="icon-btn viewer-nav viewer-nav-prev" onClick={onPrev} aria-label="Previous image">
        <ChevronLeftIcon />
      </button>

      <img className="viewer-image" src={item.url} alt={item.title} draggable={false} />

      <button className="icon-btn viewer-nav viewer-nav-next" onClick={onNext} aria-label="Next image">
        <ChevronRightIcon />
      </button>

      <div className="viewer-caption">Arrow keys to browse · Esc to close</div>
    </div>
  );
}
