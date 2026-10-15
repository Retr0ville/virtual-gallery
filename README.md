# Gallery

A virtual walk through the years — a first-person 3D gallery where each circular room (rotunda) represents one year of artworks, chained by corridors from oldest to newest.

Built with Next.js 14 (Pages Router), React Three Fiber, drei and three.js. No external asset CDNs, no placeholder services — everything renders locally with PBR materials and canvas-generated signage.

## Features

- **Walkable + flyable** — WASD to move, Shift to sprint, `F` toggles fly mode (Space up / Shift down), pointer-lock mouse look. Touch devices get a virtual joystick + drag-look.
- **Rotunda per year** — artworks are grouped by year; rooms are laid out oldest → newest along a corridor spine.
- **Upload channel** — in-gallery admin panel (bottom-right gear icon): drag-drop images, edit title/year/description inline, reorder, delete. Images also work by dropping files straight into `public/gallery/`.
- **Real loading** — the entrance screen reports actual asset loading progress before you enter.
- **Fullscreen viewer** — click any artwork; browse with arrow keys, close with `Esc`.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## How data works

- Image files live in `public/gallery/`.
- Metadata (title, year, description, order) lives in `data/gallery.json`, managed through the admin panel or the API:

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/media` | `GET` | list all items |
| `/api/media` | `PATCH` | update metadata (`filename`, `title?`, `year?`, `description?`, `order?`) |
| `/api/media` | `DELETE` | remove item + file |
| `/api/upload` | `POST` | upload `{ name, dataUrl }` (image only, ≤ 25 MB) |

Uploads are content-sniffed (jpeg/png/webp/avif), filenames are sanitized and uniquified, and path traversal is rejected. Files dropped into `public/gallery/` manually get sensible defaults (title from filename, year from file mtime).

## Controls

| Input | Walk | Fly |
| --- | --- | --- |
| `WASD` / arrows | move | move |
| `Shift` | sprint | descend |
| `Space` | — | ascend |
| `F` | fly mode | walk mode |
| Mouse | look (pointer lock) | look |
| `Esc` | release cursor | release cursor |
| Touch | joystick + drag right half | same |

## Project layout

```
components/3d/    scene: Room, Corridor, Artwork, Lighting, Player, GalleryCanvas
components/ui/    overlays: Entrance, HUD, Viewer, AdminPanel, TouchControls, Icons
pages/api/        media (list/update/delete), upload
utils/            layout math + collision, media types/client, server store, canvas textures
data/             gallery.json manifest (runtime)
public/gallery/   image storage
```
