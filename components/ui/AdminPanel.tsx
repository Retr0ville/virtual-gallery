// Admin panel — upload channel. Drag-drop / file picker, inline metadata editing,
// reorder within a year, delete with inline confirm.

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import { CldImage } from 'next-cloudinary';
import {
  CURRENT_YEAR,
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
    .sort((a, b) => a.year - b.year || a.order - b.order || a.publicId.localeCompare(b.publicId));
}

export function AdminPanel({ open, items, onClose, onChanged }: AdminPanelProps) {
  const [dragOver, setDragOver] = useState(false);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [uploadYear, setUploadYear] = useState(String(CURRENT_YEAR));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  // Escape closes the panel, matching the viewer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleFiles = async (files: FileList | File[]) => {
    const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    // Year field applies to the whole batch; bad input falls back to today.
    const parsedYear = Math.round(Number(uploadYear));
    const year =
      Number.isFinite(parsedYear) && parsedYear >= 1900 && parsedYear <= 2200
        ? parsedYear
        : CURRENT_YEAR;
    const newJobs: UploadJob[] = images.map((f) => ({ name: f.name, status: 'uploading' }));
    setJobs((prev) => [...prev, ...newJobs]);
    let any = false;
    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      try {
        await uploadImage(file, year);
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

  const commitField = async (publicId: string, patch: Partial<Pick<GalleryItem, 'title' | 'year' | 'description'>>) => {
    try {
      await updateMediaItem(publicId, patch);
      onChanged();
    } catch {
      // Silent — list refetch below restores server truth.
      onChanged();
    }
  };

  const handleDeleteClick = async (publicId: string) => {
    if (confirmDelete !== publicId) {
      setConfirmDelete(publicId);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmDelete(null), 3000);
      return;
    }
    setConfirmDelete(null);
    try {
      await deleteMediaItem(publicId);
    } finally {
      onChanged();
    }
  };

  const handleMove = async (item: GalleryItem, dir: -1 | 1) => {
    const yearItems = sortItems(items.filter((i) => i.year === item.year));
    const idx = yearItems.findIndex((i) => i.publicId === item.publicId);
    const swapWith = yearItems[idx + dir];
    if (!swapWith) return;
    const a = item.order;
    const b = swapWith.order;
    try {
      await updateMediaItem(item.publicId, { order: b });
      await updateMediaItem(swapWith.publicId, { order: a });
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
        <div className="admin-year">
          <span>Upload year</span>
          <input
            className="admin-input admin-input-year"
            type="number"
            min={1900}
            max={2200}
            value={uploadYear}
            aria-label="Year for new uploads"
            onChange={(e) => setUploadYear(e.target.value)}
            onBlur={() => {
              const n = Math.round(Number(uploadYear));
              if (!Number.isFinite(n) || n < 1900 || n > 2200) {
                setUploadYear(String(CURRENT_YEAR));
              }
            }}
          />
        </div>
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
              <div className="admin-item" key={item.publicId}>
                <CldImage
                  className="admin-thumb"
                  src={item.publicId}
                  width={58}
                  height={58}
                  crop="fill"
                  alt=""
                  loading="lazy"
                />
                <div className="admin-fields">
                  <input
                    className="admin-input"
                    defaultValue={item.title}
                    key={`${item.publicId}-title`}
                    placeholder="Title"
                    onBlur={(e) => {
                      if (e.target.value !== item.title) commitField(item.publicId, { title: e.target.value });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                  />
                  <input
                    className="admin-input"
                    defaultValue={item.description}
                    key={`${item.publicId}-desc`}
                    placeholder="Description"
                    onBlur={(e) => {
                      if (e.target.value !== item.description) commitField(item.publicId, { description: e.target.value });
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
                      key={`${item.publicId}-year`}
                      min={1900}
                      max={2200}
                      placeholder="Year"
                      onBlur={(e) => {
                        const year = Number(e.target.value);
                        if (Number.isFinite(year) && year !== item.year) commitField(item.publicId, { year });
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
                    className={`icon-btn ${confirmDelete === item.publicId ? 'is-danger' : ''}`}
                    onClick={() => handleDeleteClick(item.publicId)}
                    aria-label={confirmDelete === item.publicId ? 'Confirm delete' : 'Delete'}
                    title={confirmDelete === item.publicId ? 'Click again to confirm' : 'Delete'}
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
