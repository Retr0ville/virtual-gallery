// Admin panel — upload channel. Drag-drop / file picker, inline metadata editing,
// reorder within a year, delete with inline confirm.

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import {
  GalleryItem,
  deleteMediaItem,
  updateMediaItem,
  uploadImage,
} from '../../utils/media';
import { ArrowDownIcon, ArrowUpIcon, CloseIcon, ImagePlusIcon, TrashIcon } from './Icons';

interface AdminPanelProps {
  open: boolean;
  items: GalleryItem[];
  onClose: () => void;
  onChanged: () => void;
}

interface UploadJob {
  name: string;
  status: 'uploading' | 'error';
  error?: string;
}

function sortItems(items: GalleryItem[]): GalleryItem[] {
  return items
    .slice()
    .sort((a, b) => a.year - b.year || a.order - b.order || a.filename.localeCompare(b.filename));
}

export function AdminPanel({ open, items, onClose, onChanged }: AdminPanelProps) {
  const [dragOver, setDragOver] = useState(false);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const handleFiles = async (files: FileList | File[]) => {
    const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    const newJobs: UploadJob[] = images.map((f) => ({ name: f.name, status: 'uploading' }));
    setJobs((prev) => [...prev, ...newJobs]);
    let any = false;
    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      try {
        await uploadImage(file);
        any = true;
        setJobs((prev) =>
          prev.filter((j) => !(j.name === file.name && j.status === 'uploading'))
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setJobs((prev) =>
          prev.map((j) =>
            j.name === file.name && j.status === 'uploading'
              ? { ...j, status: 'error', error: message }
              : j
          )
        );
      }
    }
    if (any) onChanged();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  };

  const handlePick = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFiles(e.target.files);
    e.target.value = '';
  };

  const commitField = async (filename: string, patch: Partial<Pick<GalleryItem, 'title' | 'year' | 'description'>>) => {
    try {
      await updateMediaItem(filename, patch);
      onChanged();
    } catch {
      // Silent — list refetch below restores server truth.
      onChanged();
    }
  };

  const handleDeleteClick = async (filename: string) => {
    if (confirmDelete !== filename) {
      setConfirmDelete(filename);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmDelete(null), 3000);
      return;
    }
    setConfirmDelete(null);
    try {
      await deleteMediaItem(filename);
    } finally {
      onChanged();
    }
  };

  const handleMove = async (item: GalleryItem, dir: -1 | 1) => {
    const yearItems = sortItems(items.filter((i) => i.year === item.year));
    const idx = yearItems.findIndex((i) => i.filename === item.filename);
    const swapWith = yearItems[idx + dir];
    if (!swapWith) return;
    const a = item.order;
    const b = swapWith.order;
    try {
      await updateMediaItem(item.filename, { order: b });
      await updateMediaItem(swapWith.filename, { order: a });
    } finally {
      onChanged();
    }
  };

  const sorted = sortItems(items);

  return (
    <div className={`admin ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="admin-head">
        <div className="admin-title">Manage Gallery</div>
        <button className="icon-btn" onClick={onClose} aria-label="Close panel">
          <CloseIcon />
        </button>
      </div>

      <div className="admin-body">
        <div
          className={`admin-drop ${dragOver ? 'is-dragover' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlusIcon />
          Drop images here or click to browse
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          hidden
          onChange={handlePick}
        />

        {jobs.length > 0 && (
          <div className="admin-queue">
            {jobs.map((j) => (
              <div key={`${j.name}-${j.status}`} className={j.status === 'error' ? 'admin-queue-error' : ''}>
                {j.status === 'uploading' ? `Uploading ${j.name}` : `Failed: ${j.name} — ${j.error}`}
              </div>
            ))}
          </div>
        )}

        {sorted.length === 0 ? (
          <div className="admin-empty">No images yet</div>
        ) : (
          <div className="admin-list">
            {sorted.map((item) => (
              <div className="admin-item" key={item.filename}>
                <img className="admin-thumb" src={item.url} alt="" loading="lazy" />
                <div className="admin-fields">
                  <input
                    className="admin-input"
                    defaultValue={item.title}
                    key={`${item.filename}-title`}
                    placeholder="Title"
                    onBlur={(e) => {
                      if (e.target.value !== item.title) commitField(item.filename, { title: e.target.value });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                  />
                  <input
                    className="admin-input"
                    defaultValue={item.description}
                    key={`${item.filename}-desc`}
                    placeholder="Description"
                    onBlur={(e) => {
                      if (e.target.value !== item.description) commitField(item.filename, { description: e.target.value });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                  />
                  <div className="admin-row">
                    <input
                      className="admin-input admin-input-year"
                      type="number"
                      defaultValue={item.year}
                      key={`${item.filename}-year`}
                      min={1900}
                      max={2200}
                      placeholder="Year"
                      onBlur={(e) => {
                        const year = Number(e.target.value);
                        if (Number.isFinite(year) && year !== item.year) commitField(item.filename, { year });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                    />
                  </div>
                </div>
                <div className="admin-side">
                  <button
                    className="icon-btn"
                    onClick={() => handleMove(item, -1)}
                    aria-label="Move earlier"
                    title="Move earlier"
                  >
                    <ArrowUpIcon />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => handleMove(item, 1)}
                    aria-label="Move later"
                    title="Move later"
                  >
                    <ArrowDownIcon />
                  </button>
                  <button
                    className={`icon-btn ${confirmDelete === item.filename ? 'is-danger' : ''}`}
                    onClick={() => handleDeleteClick(item.filename)}
                    aria-label={confirmDelete === item.filename ? 'Confirm delete' : 'Delete'}
                    title={confirmDelete === item.filename ? 'Click again to confirm' : 'Delete'}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
