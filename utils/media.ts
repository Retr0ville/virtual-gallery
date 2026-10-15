// Shared gallery data types + client-side API helpers + year grouping.

export const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'avif'] as const;
export const CURRENT_YEAR = new Date().getFullYear();

export interface GalleryItem {
  filename: string;
  url: string;
  title: string;
  year: number;
  description: string;
  order: number;
}

export interface ManifestEntry {
  title: string;
  year: number;
  description: string;
  order: number;
}

export interface Manifest {
  version: 1;
  items: Record<string, ManifestEntry>;
}

export interface YearRoom {
  year: number;
  items: GalleryItem[];
}

// Group items into rooms by year, oldest first. Rooms are the gallery layout.
export function groupByYear(items: GalleryItem[]): YearRoom[] {
  const map = new Map<number, GalleryItem[]>();
  for (const item of items) {
    const list = map.get(item.year) ?? [];
    list.push(item);
    map.set(item.year, list);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, list]) => ({
      year,
      items: list
        .slice()
        .sort((a, b) => a.order - b.order || a.filename.localeCompare(b.filename)),
    }));
}

// ---- Client API ----

export async function fetchMedia(): Promise<GalleryItem[]> {
  const res = await fetch('/api/media');
  if (!res.ok) throw new Error('Failed to load gallery');
  const data = (await res.json()) as { items: GalleryItem[] };
  return data.items;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function uploadImage(file: File): Promise<GalleryItem> {
  const dataUrl = await fileToDataUrl(file);
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, dataUrl }),
  });
  const data = (await res.json()) as { item?: GalleryItem; error?: string };
  if (!res.ok || !data.item) throw new Error(data.error ?? 'Upload failed');
  return data.item;
}

export async function updateMediaItem(
  filename: string,
  patch: Partial<Pick<GalleryItem, 'title' | 'year' | 'description' | 'order'>>
): Promise<GalleryItem> {
  const res = await fetch('/api/media', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, ...patch }),
  });
  const data = (await res.json()) as { item?: GalleryItem; error?: string };
  if (!res.ok || !data.item) throw new Error(data.error ?? 'Update failed');
  return data.item;
}

export async function deleteMediaItem(filename: string): Promise<void> {
  const res = await fetch('/api/media', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Delete failed');
  }
}
