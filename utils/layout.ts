// Gallery layout math — shared by scene geometry, artwork placement, and collision.
// Everything is pure data/math, no three.js imports.

export const R = 8; // rotunda interior radius
export const WALL_H = 4.8; // rotunda wall height
export const CORR_L = 6; // corridor length between rotundas
export const CORR_W = 2.6; // corridor width / door opening width
export const DOOR_H = 2.6; // door opening height
export const CEIL_CORR = 2.8; // corridor ceiling height
export const EYE = 1.65; // walk eye height
export const MARGIN = 0.35; // player collision radius
export const ROOM_SPACING = 2 * R + CORR_L; // distance between rotunda centers
export const GAP = CORR_W / R; // door arc angle (radians)
export const ARTWORK_CENTER_Y = 1.55;
export const ARTWORK_MAX_H = 1.5;
export const ARTWORK_MAX_W = 2.6;
export const ARTWORK_WALL_OFFSET = 0.06; // artwork plane offset from wall
const ART_MARGIN = 0.22; // clearance between door edge and first artwork (radians)

export type Vec2 = { x: number; z: number };

export function roomCenterX(index: number): number {
  return index * ROOM_SPACING;
}

export interface ArtworkSlot {
  x: number;
  z: number;
  rotationY: number;
}

// Distribute n artworks along the allowed wall arcs of a room, skipping door gaps.
// Door openings sit at theta = PI/2 (+x) and theta = 3PI/2 (-x).
// CylinderGeometry convention: x = r*sin(theta), z = r*cos(theta).
export function artworkSlots(roomIndex: number, n: number, roomCount: number): ArtworkSlot[] {
  if (n <= 0) return [];
  const cx = roomCenterX(roomIndex);
  const rArt = R - ARTWORK_WALL_OFFSET;
  const g = GAP / 2 + ART_MARGIN;
  const first = roomIndex === 0;
  const last = roomIndex === roomCount - 1;

  // Allowed arcs as monotonically increasing [start, end] theta segments.
  // End rooms (single door) cluster artworks on the closed wall facing the
  // entrance, so entering/spawning faces the art instead of bare wall.
  // Middle rooms spread across both side walls between the two doors.
  const span = Math.min(Math.PI, n * 0.55); // centered span for end rooms
  const segs: Array<[number, number]> = [];
  if (roomCount === 1) {
    segs.push([0, 2 * Math.PI]);
  } else if (first) {
    const c = (3 * Math.PI) / 2; // -x wall, opposite the +x door
    segs.push([c - span / 2, c + span / 2]);
  } else if (last) {
    const c = Math.PI / 2; // +x wall, opposite the -x door
    segs.push([c - span / 2, c + span / 2]);
  } else {
    segs.push([Math.PI / 2 + g, (3 * Math.PI) / 2 - g]);
    segs.push([(3 * Math.PI) / 2 + g, (5 * Math.PI) / 2 - g]);
  }

  const total = segs.reduce((sum, [a, b]) => sum + (b - a), 0);
  const step = total / n;
  const slots: ArtworkSlot[] = [];

  for (let k = 0; k < n; k++) {
    let pos = (k + 0.5) * step;
    let theta = segs[0][0];
    for (const [a, b] of segs) {
      const len = b - a;
      if (pos <= len) {
        theta = a + pos;
        break;
      }
      pos -= len;
      theta = b;
    }
    const x = cx + rArt * Math.sin(theta);
    const z = rArt * Math.cos(theta);
    slots.push({ x, z, rotationY: theta + Math.PI });
  }
  return slots;
}

// ---- Collision regions ----

export interface CircleRegion {
  kind: 'circle';
  x: number;
  z: number;
  radius: number;
}

export interface RectRegion {
  kind: 'rect';
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type Region = CircleRegion | RectRegion;

export function buildRegions(roomCount: number): Region[] {
  const regions: Region[] = [];
  for (let i = 0; i < roomCount; i++) {
    regions.push({ kind: 'circle', x: roomCenterX(i), z: 0, radius: R - MARGIN });
  }
  for (let i = 0; i < roomCount - 1; i++) {
    regions.push({
      kind: 'rect',
      minX: roomCenterX(i) + R - 0.4,
      maxX: roomCenterX(i + 1) - R + 0.4,
      minZ: -CORR_W / 2 + MARGIN,
      maxZ: CORR_W / 2 - MARGIN,
    });
  }
  return regions;
}

export function insideRegion(r: Region, x: number, z: number): boolean {
  if (r.kind === 'circle') {
    const dx = x - r.x;
    const dz = z - r.z;
    return dx * dx + dz * dz <= r.radius * r.radius;
  }
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
}

export function insideAnyRegion(regions: Region[], x: number, z: number): boolean {
  for (const r of regions) {
    if (insideRegion(r, x, z)) return true;
  }
  return false;
}

// Ceiling height at a point: corridors are lower than rotundas.
export function ceilingAt(x: number, z: number, roomCount: number): number {
  for (let i = 0; i < roomCount - 1; i++) {
    const minX = roomCenterX(i) + R - 0.4;
    const maxX = roomCenterX(i + 1) - R + 0.4;
    if (x >= minX && x <= maxX && Math.abs(z) <= CORR_W / 2) return CEIL_CORR;
  }
  return WALL_H;
}

// Room under the player, or -1 when in a corridor.
export function currentRoomIndex(x: number, z: number, roomCount: number): number {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < roomCount; i++) {
    const dx = x - roomCenterX(i);
    const d = dx * dx + z * z;
    if (d < R * R && d < bestDist) {
      best = i;
      bestDist = d;
    }
  }
  return best;
}
