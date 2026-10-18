// Shared gallery data types + client-side API helpers + year grouping.

export const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'avif'] as const;
export const CURRENT_YEAR = new Date().getFullYear();

export interface GalleryItem {
  publicId: string;
  url: string;
  title: string;
  year: number;
  description: string;
  order: number;
  width?: number;
  height?: number;
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
        .sort((a, b) => a.order - b.order || a.publicId.localeCompare(b.publicId)),
    }));
}

// ---- Client API ----

export async function fetchMedia(): Promise<GalleryItem[]> {
  const res = await fetch('/api/media');
  if (!res.ok) throw new Error('Failed to load gallery');
  const data = (await res.json()) as { items: GalleryItem[] };
  return data.items;
}

export async function uploadImage(file: File, year?: number): Promise<GalleryItem> {
  const headers: Record<string, string> = {
    'Content-Type': file.type || 'application/octet-stream',
    'x-file-name': encodeURIComponent(file.name),
  };
  if (year !== undefined) headers['x-upload-year'] = String(year);

  // Send the File directly — no FileReader/base64/JSON on the main thread.
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers,
    body: file,
  });
  const data = (await res.json()) as { item?: GalleryItem; error?: string };
  if (!res.ok || !data.item) throw new Error(data.error ?? 'Upload failed');
  return data.item;
}

export async function updateMediaItem(
  publicId: string,
  patch: Partial<Pick<GalleryItem, 'title' | 'year' | 'description' | 'order'>>
): Promise<GalleryItem> {
  const res = await fetch('/api/media', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicId, ...patch }),
  });
  const data = (await res.json()) as { item?: GalleryItem; error?: string };
  if (!res.ok || !data.item) throw new Error(data.error ?? 'Update failed');
  return data.item;
}

export async function deleteMediaItem(publicId: string): Promise<void> {
  const res = await fetch('/api/media', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicId }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Delete failed');
  }
}
