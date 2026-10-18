// Gallery layout math — shared by scene geometry, artwork placement, and collision.
// Everything is pure data/math, no three.js imports.

export const R = 8; // rotunda interior radius
export const WALL_H = 4.8; // rotunda wall height
export const CORR_L = 6; // corridor length between rotundas
export const CORR_W = 2.6; // corridor width / door opening width
export const DOOR_H = 2.6; // door opening height
// Open door leaves: double doors hinged at the jambs, swung into the room and
// left wide open. The pair is deliberately uneven — like someone pushed both
// leaves and let them rest where they stopped. Shared with collision so the
// leaves are solid.
export const DOOR_LEAF_W = CORR_W / 2 - 0.06;
export const DOOR_HINGE_X = R - 0.12;

// Resting angles per room (degrees, first = +z hinge, second = -z hinge).
// Every room was "opened" differently — pairs never match, and the -z leaf is
// always the wider-open one. Indexed modulo so extra years keep cycling.
const DOOR_PAIR_DEG: Array<[number, number]> = [
  [120, 154],
  [102, 140],
  [116, 148],
];

// Swing angle (radians, world Y) of one leaf of the room's +x doorway (the
// only pair on each corridor). `hinge` is the leaf's jamb (+1 = +z). Closed
// leaf points across the opening; the swing sweeps it into the room past the
// wall normal.
export function doorLeafAngle(roomIndex: number, hinge: 1 | -1): number {
  const pair = DOOR_PAIR_DEG[roomIndex % DOOR_PAIR_DEG.length];
  const degrees = hinge > 0 ? pair[0] : pair[1];
  return (hinge > 0 ? Math.PI : 0) + hinge * ((degrees * Math.PI) / 180);
}
export const CEIL_CORR = 2.8; // corridor ceiling height
export const EYE = 1.85; // walk eye height
export const MARGIN = 0.35; // player collision radius
export const ROOM_SPACING = 2 * R + CORR_L; // distance between rotunda centers
export const GAP = CORR_W / R; // door arc angle (radians)
export const ARTWORK_CENTER_Y = 1.55;
export const ARTWORK_MAX_H = 1.5;
export const ARTWORK_MAX_W = 2.6;
export const ARTWORK_FRAME_PAD = 0.06; // frame border around the print, per side
export const ARTWORK_GAP = 0.34; // clear wall between neighbouring frames
export const ARTWORK_WALL_OFFSET = 0.06; // artwork plane offset from wall
const ART_MARGIN = 0.22; // clearance between door edge and first artwork (radians)

// Center table keep-out: a giant Victorian glass ring table (hollow middle)
// dominates each room. The annulus between inner and outer radius is blocked,
// except two straight, constant-width walk-through slots along the ±x axis
// (aligned with the doorways) so the player can cross into the hollow center
// and walk the outer aisle.
export const TABLE_INNER = 2.5;
export const TABLE_OUTER = 5.3;
export const TABLE_SLIT = 0.6; // half-width (m) of each straight slot cut
const TABLE_SLIT_CLEAR = 0.45; // collision half-width — narrower than the cut
const TABLE_CLEAR = 0.2; // collision inflation beyond the glass edges

// Player spawn: just inside the first room's closed -x entry, facing into the
// gallery — the ring table, its slots and the way forward open up ahead.
export const SPAWN_X = -7;
export const SPAWN_Z = 0;

export type Vec2 = { x: number; z: number };

export function roomCenterX(index: number): number {
  return index * ROOM_SPACING;
}

export interface ArtworkSlot {
  x: number;
  z: number;
  rotationY: number;
  width: number; // print width (frame adds ARTWORK_FRAME_PAD on each side)
  height: number;
}

// Allowed wall arcs for a room's artworks, as [start, length] theta segments.
// Door openings sit at theta = PI/2 (+x) and theta = 3PI/2 (-x).
// CylinderGeometry convention: x = r*sin(theta), z = r*cos(theta).
export function artworkArcs(
  roomIndex: number,
  n: number,
  roomCount: number
): Array<[number, number]> {
  if (n <= 0) return [];
  const g = GAP / 2 + ART_MARGIN;
  const first = roomIndex === 0;
  const last = roomIndex === roomCount - 1;

  // End rooms (single door) cluster artworks on the closed wall facing the
  // entrance, so entering/spawning faces the art instead of bare wall.
  // Middle rooms spread across both side walls between the two doors.
  const span = Math.min(Math.PI, n * 0.55); // centered span for end rooms
  if (roomCount === 1) return [[0, 2 * Math.PI]];
  if (first) {
    // Spawn sits at the closed -x entry facing into the room; hang the year's
    // artworks on the walls flanking the doorway ahead (never behind spawn).
    const c = Math.PI / 2; // +x wall (doorway)
    const half = Math.min(Math.PI / 2 - g, 0.55 + n * 0.18);
    return [
      [c - g - half, half],
      [c + g, half],
    ];
  }
  if (last) {
    const c = Math.PI / 2; // closed +x wall, opposite the -x door
    return [[c - span / 2, span]];
  }
  return [
    [Math.PI / 2 + g, Math.PI - 2 * g],
    [(3 * Math.PI) / 2 + g, Math.PI - 2 * g],
  ];
}

// Lay out artworks with their true aspect ratios: prints keep their native
// proportions (capped), frames get a uniform gap, and the whole set shrinks
// uniformly if a wall arc cannot hold it. One item per arc is centred, so a
// room with few pieces stays symmetric.
export function placeArtworks(
  roomIndex: number,
  roomCount: number,
  aspects: number[]
): ArtworkSlot[] {
  const n = aspects.length;
  if (n === 0) return [];
  const segs = artworkArcs(roomIndex, n, roomCount);
  const rArt = R - ARTWORK_WALL_OFFSET;

  const sizes = aspects.map((rawAspect) => {
    const aspect = rawAspect > 0 && Number.isFinite(rawAspect) ? rawAspect : 1;
    let height = ARTWORK_MAX_H;
    let width = height * aspect;
    if (width > ARTWORK_MAX_W) {
      width = ARTWORK_MAX_W;
      height = width / aspect;
    }
    return { width, height };
  });

  // Spread items across arcs, always feeding the least-loaded arc (relative to
  // its capacity) — keeps multi-image rooms balanced.
  const caps = segs.map(([, len]) => len * rArt);
  const loads = caps.map(() => 0);
  const buckets: number[][] = segs.map(() => []);
  for (let i = 0; i < n; i++) {
    const outerW = sizes[i].width + 2 * ARTWORK_FRAME_PAD + ARTWORK_GAP;
    let best = 0;
    let bestRatio = Infinity;
    for (let j = 0; j < segs.length; j++) {
      const ratio = (loads[j] + outerW) / caps[j];
      if (ratio < bestRatio) {
        bestRatio = ratio;
        best = j;
      }
    }
    buckets[best].push(i);
    loads[best] += outerW;
  }

  // Shrink prints uniformly if any arc's chain (frames + gaps included) is
  // longer than the wall available. Frame borders stay a constant width.
  let scale = 1;
  for (let j = 0; j < segs.length; j++) {
    const bucket = buckets[j];
    if (bucket.length === 0) continue;
    const printSum = bucket.reduce((sum, i) => sum + sizes[i].width, 0);
    const room = caps[j] - bucket.length * 2 * ARTWORK_FRAME_PAD - (bucket.length - 1) * ARTWORK_GAP;
    scale = Math.min(scale, room > 0 ? room / printSum : 0.02);
  }
  scale = Math.max(scale, 0.02);

  const slots: ArtworkSlot[] = [];
  for (let j = 0; j < segs.length; j++) {
    const bucket = buckets[j];
    if (bucket.length === 0) continue;
    const [start, len] = segs[j];
    const widths = bucket.map((i) => scale * sizes[i].width + 2 * ARTWORK_FRAME_PAD);
    const chain = widths.reduce((sum, w) => sum + w, 0) + (bucket.length - 1) * ARTWORK_GAP;
    let angle = start + len / 2 - chain / 2 / rArt;
    for (let k = 0; k < bucket.length; k++) {
      const i = bucket[k];
      const span = widths[k] / rArt;
      const theta = angle + span / 2;
      angle += span + ARTWORK_GAP / rArt;
      // Flat frames on a curved wall: pull the piece inward enough that its
      // back corners stay clear of the wall (and of the chair rail).
      const halfW = widths[k] / 2;
      const rr = Math.sqrt(Math.max((R - 0.03) ** 2 - halfW * halfW, 1));
      slots[i] = {
        x: roomCenterX(roomIndex) + rr * Math.sin(theta),
        z: rr * Math.cos(theta),
        rotationY: theta + Math.PI,
        width: sizes[i].width * scale,
        height: sizes[i].height * scale,
      };
    }
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

// Negative region: position inside a blocked band is never allowed, even if a
// positive region also contains it. Used for the ring table — blocked between
// rInner and rOuter except within `slit` half-width of the x axis (the two
// straight walk-through slots aligned with the doorways).
export interface AnnulusRegion {
  kind: 'annulus';
  x: number;
  z: number;
  rInner: number;
  rOuter: number;
  slit: number;
}

// Negative region: the swept slab of an open door leaf — a thin rotated box.
export interface DoorRegion {
  kind: 'door';
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  cos: number;
  sin: number;
}

export type Region = CircleRegion | RectRegion | AnnulusRegion | DoorRegion;

// Corridors lead between successive rooms. A corridor into a room whose year
// hasn't arrived yet (year > current year) is sealed by a locked door: the
// positive walk region stops just short of the far door plane.
export function buildRegions(roomCount: number, lockedCorridors?: readonly boolean[]): Region[] {
  const regions: Region[] = [];
  for (let i = 0; i < roomCount; i++) {
    regions.push({ kind: 'circle', x: roomCenterX(i), z: 0, radius: R - MARGIN });
    regions.push({
      kind: 'annulus',
      x: roomCenterX(i),
      z: 0,
      rInner: TABLE_INNER - TABLE_CLEAR,
      rOuter: TABLE_OUTER + TABLE_CLEAR,
      slit: TABLE_SLIT_CLEAR,
    });
  }
  for (let i = 0; i < roomCount - 1; i++) {
    regions.push({
      kind: 'rect',
      minX: roomCenterX(i) + R - 0.4,
      maxX: lockedCorridors?.[i] ? roomCenterX(i + 1) - R - 0.12 : roomCenterX(i + 1) - R + 0.4,
      minZ: -CORR_W / 2 + MARGIN,
      maxZ: CORR_W / 2 - MARGIN,
    });
  }
  // One pair of open leaves per corridor, hung on the room's +x doorway.
  for (let i = 0; i < roomCount - 1; i++) {
    const cx = roomCenterX(i);
    for (const hinge of [1, -1] as const) {
      const angle = doorLeafAngle(i, hinge);
      const c = Math.cos(angle);
      const sn = Math.sin(angle);
      regions.push({
        kind: 'door',
        x: cx + DOOR_HINGE_X + (sn * DOOR_LEAF_W) / 2,
        z: hinge * (CORR_W / 2) + (c * DOOR_LEAF_W) / 2,
        halfX: 0.07,
        halfZ: DOOR_LEAF_W / 2 + 0.02,
        cos: c,
        sin: sn,
      });
    }
  }
  return regions;
}

export function insideRegion(r: Region, x: number, z: number): boolean {
  if (r.kind === 'circle') {
    const dx = x - r.x;
    const dz = z - r.z;
    return dx * dx + dz * dz <= r.radius * r.radius;
  }
  if (r.kind === 'annulus') {
    const dx = x - r.x;
    const dz = z - r.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < r.rInner * r.rInner || d2 > r.rOuter * r.rOuter) return false;
    return Math.abs(dz) > r.slit;
  }
  if (r.kind === 'door') {
    const dx = x - r.x;
    const dz = z - r.z;
    const lx = dx * r.cos - dz * r.sin;
    const lz = dx * r.sin + dz * r.cos;
    return Math.abs(lx) <= r.halfX && Math.abs(lz) <= r.halfZ;
  }
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
}

export function insideAnyRegion(regions: Region[], x: number, z: number): boolean {
  let ok = false;
  for (const r of regions) {
    if (r.kind === 'annulus' || r.kind === 'door') {
      if (insideRegion(r, x, z)) return false;
    } else if (insideRegion(r, x, z)) {
      ok = true;
    }
  }
  return ok;
}

// Flight bounds: only the outer walls count. Interior blockers (the ring
// table, open door leaves) don't constrain a flying camera.
export function insideFlightBounds(regions: Region[], x: number, z: number): boolean {
  for (const r of regions) {
    if ((r.kind === 'circle' || r.kind === 'rect') && insideRegion(r, x, z)) return true;
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
