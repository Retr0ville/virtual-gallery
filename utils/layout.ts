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
export const TABLE_H = 0.78; // glass height — seated-table height
export const TABLE_INNER = 2.5;
export const TABLE_OUTER = 5.3;
export const TABLE_SLIT = 0.6; // half-width (m) of each straight slot cut
const TABLE_SLIT_CLEAR = 0.45; // collision half-width — narrower than the cut
const TABLE_CLEAR = 0.2; // collision inflation beyond the glass edges

// Player spawn: just inside the first room's closed -x entry, facing into the
// gallery — the ring table, its slots and the way forward open up ahead.
export const SPAWN_X = -7;
export const SPAWN_Z = 0;

// Record player parking spots on the ring table (room-local coords), cycled
// per room. Shared by the renderer, the positional audio emitter, and the
// balloon keep-out.
const TURNTABLE_SPOTS = [
  { x: -3.4, z: 2.5 }, // 2025: west band, near side from the spawn view
  { x: 3.4, z: -2.5 }, // 2026: opposite band, clear of that room's balloons
] as const;
export const TURNTABLE_CLEAR = 1.05; // plinth half-diagonal + margin

export function turntableSpot(roomIndex: number): { x: number; z: number } {
  return TURNTABLE_SPOTS[roomIndex % TURNTABLE_SPOTS.length];
}

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

// ---- Balloon scatter layout ----
// Deterministic per room, shared by the Centerpiece renderer and walk
// collision so the floor clusters the player sees are the ones that block.

export const HELIUM_N = 5; // only a few float, each visibly bobbing/wandering
const AIR_ISLANDS = 3; // air-filled floor balloons rest in tight islands
const AIR_TABLE_N = 5; // plus a few loose on the glass top
export const AIR_SQUASH = 0.92; // resting balloons squat; helium ones elongate
// Floor islands stay clear of the ±x axis: that band holds the spawn, the
// doorways, and the table's walk-through slots.
const ENTRY_CLEAR = 2.0;

export interface HeliumBalloon {
  x: number;
  y: number;
  z: number;
  r: number;
  rotY: number;
  phase: number;
  bobAmp: number;
  bobW: number;
  swayW: number;
}

export interface AirBalloon {
  x: number;
  y: number;
  z: number;
  r: number;
  rotY: number;
  tilt: number; // rotation-x jitter
  seed: number; // color/name seed, stable per room
  table: boolean; // resting on the glass instead of the floor
}

// Deterministic hash → [0,1): stable layout across mounts, no jitter.
export const hash01 = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export function computeBalloons(roomIndex: number): {
  helium: HeliumBalloon[];
  air: AirBalloon[];
} {
  // Room-seeded hash stream — each room gets its own stable scatter.
  const h = (i: number, salt: number) => hash01(i * 13.7 + salt + roomIndex * 977.13);
  const spot = turntableSpot(roomIndex);
  // Balloons must not hang over the two straight walk-through slots — no
  // glass there, so a "table" balloon would hover over the void in the path.
  // Positions use a = atan2(x, z), so |cos a| · rr is the distance off-axis.
  const offSlit = (a: number, rr: number, r: number) => {
    const lim = (TABLE_SLIT + r + 0.1) / rr;
    let aa = a;
    while (Math.abs(Math.cos(aa)) < lim) aa += 0.35;
    return aa;
  };
  // Island clusters also keep clear of the spawn/door approach.
  const offEntry = (a: number, rr: number) => {
    const lim = Math.min(ENTRY_CLEAR / rr, 0.95);
    let aa = a;
    while (Math.abs(Math.cos(aa)) < lim) aa += 0.35;
    return aa;
  };

  const helium: HeliumBalloon[] = [];
  for (let i = 0; i < HELIUM_N; i++) {
    const rr = 2.9 + h(i, 2) * 3.7; // over the glass band — never in the walk-through hollow
    const r = 0.2 + h(i, 4) * 0.1;
    const a = offSlit(h(i, 1) * Math.PI * 2, rr, r);
    helium.push({
      x: Math.sin(a) * rr,
      // Bottom stays above standing eye height, so walking never clips one.
      y: 2.6 + h(i, 3) * 1.7,
      z: Math.cos(a) * rr,
      r,
      rotY: h(i, 6) * Math.PI * 2,
      phase: h(i, 7) * Math.PI * 2,
      bobAmp: 0.09 + h(i, 8) * 0.08,
      bobW: 0.4 + h(i, 9) * 0.4,
      swayW: 0.22 + h(i, 10) * 0.25,
    });
  }

  // Floor balloons: tight islands (a mound per cluster), scattered around.
  const air: AirBalloon[] = [];
  for (let j = 0; j < AIR_ISLANDS; j++) {
    const irr = 1.6 + h(j, 32) * 4.8;
    const ia = offEntry(h(j, 31) * Math.PI * 2, irr);
    const cx = Math.sin(ia) * irr;
    const cz = Math.cos(ia) * irr;
    const cnt = 3 + Math.floor(h(j, 33) * 2);
    for (let k = 0; k < cnt; k++) {
      const s = j * 7 + k;
      const oa = h(s, 34) * Math.PI * 2;
      const od = 0.12 + h(s, 35) * 0.32;
      const r = 0.15 + h(s, 36) * 0.09;
      air.push({
        x: cx + Math.sin(oa) * od,
        y: r * AIR_SQUASH,
        z: cz + Math.cos(oa) * od,
        r,
        rotY: h(s, 38) * Math.PI * 2,
        tilt: (h(s, 39) - 0.5) * 0.7,
        seed: s,
        table: false,
      });
    }
  }
  const tableStart = air.length;
  for (let i = 0; i < AIR_TABLE_N; i++) {
    const rr = 2.75 + h(i, 21) * 2.3; // annulus band of the glass top
    const r = 0.15 + h(i, 23) * 0.09;
    const a = offSlit(h(i, 22) * Math.PI * 2, rr, r);
    air.push({
      x: Math.sin(a) * rr,
      y: TABLE_H + r * AIR_SQUASH,
      z: Math.cos(a) * rr,
      r,
      rotY: h(i, 25) * Math.PI * 2,
      tilt: (h(i, 26) - 0.5) * 0.35,
      seed: i,
      table: true,
    });
  }

  // Table balloons stay on the glass band, off the walk slots, and clear of
  // the record player's plinth (rotate around the table until free).
  const clearTableBalloons = () => {
    for (let i = tableStart; i < air.length; i++) {
      const b = air[i];
      const rr = Math.min(Math.max(Math.hypot(b.x, b.z), 2.85), 5.15);
      const slitLim = (TABLE_SLIT + b.r + 0.1) / rr;
      let a = Math.atan2(b.x, b.z);
      let guard = 0;
      while (
        (Math.abs(Math.cos(a)) < slitLim ||
          Math.hypot(Math.sin(a) * rr - spot.x, Math.cos(a) * rr - spot.z) <
            TURNTABLE_CLEAR + b.r) &&
        guard++ < 40
      ) {
        a += 0.4;
      }
      b.x = Math.sin(a) * rr;
      b.z = Math.cos(a) * rr;
    }
  };

  // Rigid-sphere separation — clustered/random rest spots must not intersect.
  // Table balloons are re-clamped/cleared each pass; the last clear keeps the
  // record player free.
  for (let pass = 0; pass < 4; pass++) {
    clearTableBalloons();
    for (let i = 0; i < air.length; i++) {
      for (let j = i + 1; j < air.length; j++) {
        const A = air[i];
        const B = air[j];
        let dx = B.x - A.x;
        let dz = B.z - A.z;
        const d = Math.hypot(dx, dz);
        const minD = A.r + B.r + 0.05;
        if (d >= minD) continue;
        if (d < 1e-4) {
          dx = 1;
          dz = 0;
        } else {
          dx /= d;
          dz /= d;
        }
        const push = (minD - d) / 2;
        A.x -= dx * push;
        A.z -= dz * push;
        B.x += dx * push;
        B.z += dz * push;
      }
    }
  }
  clearTableBalloons();

  return { helium, air };
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

// Negative region: a solid floor decoration (balloon cluster) — the walk
// player steps around it instead of clipping through.
export interface BlockRegion {
  kind: 'block';
  x: number;
  z: number;
  radius: number;
}

export type Region = CircleRegion | RectRegion | AnnulusRegion | DoorRegion | BlockRegion;

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
  // Floor balloon clusters are solid for the walk player. (Flight deliberately
  // ignores interior blockers, like the ring table.)
  for (let i = 0; i < roomCount; i++) {
    const cx = roomCenterX(i);
    for (const b of computeBalloons(i).air) {
      if (b.table) continue;
      regions.push({ kind: 'block', x: cx + b.x, z: b.z, radius: b.r + 0.12 });
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
  if (r.kind === 'block') {
    const dx = x - r.x;
    const dz = z - r.z;
    return dx * dx + dz * dz <= r.radius * r.radius;
  }
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
}

export function insideAnyRegion(regions: Region[], x: number, z: number): boolean {
  let ok = false;
  for (const r of regions) {
    if (r.kind === 'annulus' || r.kind === 'door' || r.kind === 'block') {
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
