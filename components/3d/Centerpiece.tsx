// Centerpiece — a giant Victorian glass ring table dominates each room: a
// hollow middle you reach through two straight walk-through slots cut at the
// ±x entries, a transparent glass annulus top with brass gallery rims, twelve
// turned bronze legs (kings & queens table), and a cast apron. Light accent
// motes drift slowly above the glass; the year is etched once on the
// hollow-center floor. An optional user GLB (theme.model) rests on the glass
// at the west band. Collision: annulus + straight slots in layout.ts.

import { Instance, Instances, Text, useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { createTextDerivedMaterial } from 'troika-three-text';
import { TABLE_INNER, TABLE_OUTER, TABLE_SLIT, SPAWN_X, SPAWN_Z, roomCenterX } from '../../utils/layout';
import { makeMedallionTexture, makeMoteTexture } from '../../utils/textures';
import { RoomTheme } from '../../utils/themes';
import { roomCameraFade } from './Lighting';
import { Turntable } from './Turntable';

const TABLE_H = 0.78; // glass height — seated-table height
const PIECE_X = -3.9; // west band of the glass, straight ahead of the spawn view
const PIECE_Z = 0;
const DISPLAY_H = 0.9; // GLB max height on the table
const DISPLAY_W = 2.5; // GLB max footprint on the glass
// Record player rests on the glass band, angled toward the spawn view.
const TURNTABLE_X = -3.4;
const TURNTABLE_Z = 2.5;
const TURNTABLE_YAW = Math.atan2(SPAWN_X - TURNTABLE_X, SPAWN_Z - TURNTABLE_Z);
const LEG_R = 4.95; // leg ring radius
const LEGS = 12; // one per seated guest
const BRASS = '#c8a24a';
const BRONZE = '#4a3d30';

// Slim turned leg silhouette (LatheGeometry profile).
const LEG_PROFILE: Array<[number, number]> = [
  [0.14, 0.0],
  [0.14, 0.035],
  [0.07, 0.055],
  [0.105, 0.09],
  [0.055, 0.13],
  [0.045, 0.42],
  [0.06, 0.54],
  [0.045, 0.6],
  [0.1, 0.64],
  [0.1, 0.69],
  [0.05, 0.71],
];

// ---- The ring table ----

function RingTable({ accent, index }: { accent: string; index: number }) {
  const glow = useRef<THREE.PointLight | null>(null);

  useFrame(({ camera }) => {
    const l = glow.current;
    if (l) l.intensity = 2.4 * roomCameraFade(camera, index);
  });

  const legGeo = useMemo(
    () => new THREE.LatheGeometry(LEG_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 24),
    []
  );
  useEffect(() => () => legGeo.dispose(), [legGeo]);

  // Glass annulus as two bands with straight slot edges — the walk-through
  // cuts are parallel, constant width, so angular ring segments won't do.
  const glassGeo = useMemo(() => {
    const bi = Math.asin(TABLE_SLIT / TABLE_INNER);
    const bo = Math.asin(TABLE_SLIT / TABLE_OUTER);
    const s = new THREE.Shape();
    s.absarc(0, 0, TABLE_INNER, bi, Math.PI - bi, false);
    s.lineTo(-TABLE_OUTER * Math.cos(bo), TABLE_SLIT);
    s.absarc(0, 0, TABLE_OUTER, Math.PI - bo, bo, true);
    s.lineTo(TABLE_INNER * Math.cos(bi), TABLE_SLIT);
    return new THREE.ShapeGeometry(s, 96);
  }, []);
  useEffect(() => () => glassGeo.dispose(), [glassGeo]);
  const glassMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#cfe8e4',
        transparent: true,
        opacity: 0.26,
        roughness: 0.05,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.4,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    []
  );
  useEffect(() => () => glassMat.dispose(), [glassMat]);

  // Circular trims end exactly where the straight slot edges cross them.
  const apronR = TABLE_OUTER - 0.03;
  const bandR = TABLE_OUTER - 0.02;
  const apronCut = Math.asin(TABLE_SLIT / apronR);
  const bandCut = Math.asin(TABLE_SLIT / bandR);
  const outerCut = Math.asin(TABLE_SLIT / TABLE_OUTER);
  const innerCut = Math.asin(TABLE_SLIT / TABLE_INNER);

  return (
    <group>
      {/* twelve turned legs (one instanced draw) + cast apron under the glass edge.
          frustumCulled off: instanced bounds cache before instance matrices land. */}
      <Instances geometry={legGeo} frustumCulled={false} castShadow>
        <meshStandardMaterial color={BRONZE} roughness={0.4} metalness={0.55} />
        {Array.from({ length: LEGS }, (_, i) => {
          const a = (i / LEGS) * Math.PI * 2 + Math.PI / 12;
          return (
            <Instance key={`leg-${i}`} position={[Math.sin(a) * LEG_R, 0, Math.cos(a) * LEG_R]} />
          );
        })}
      </Instances>

      {/* apron skirt under the outer edge — split at the straight slots */}
      {[Math.PI / 2 + apronCut, (3 * Math.PI) / 2 + apronCut].map((start) => (
        <mesh key={`apron-${start}`} position-y={0.7}>
          <cylinderGeometry
            args={[apronR, apronR, 0.15, 128, 1, true, start, Math.PI - 2 * apronCut]}
          />
          <meshStandardMaterial
            color={BRONZE}
            roughness={0.45}
            metalness={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {/* brass band on the apron */}
      {[Math.PI / 2 + bandCut, (3 * Math.PI) / 2 + bandCut].map((start) => (
        <mesh key={`band-${start}`} position-y={0.66}>
          <cylinderGeometry
            args={[bandR, bandR, 0.025, 128, 1, true, start, Math.PI - 2 * bandCut]}
          />
          <meshStandardMaterial
            color={BRASS}
            roughness={0.3}
            metalness={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* glass annulus top, cut by the two straight ±x walk-through slots
          (no transmission pass — transparent + clearcoat keeps it cheap) */}
      {[Math.PI / 2, -Math.PI / 2].map((rx) => (
        <mesh
          key={`glass-${rx}`}
          geometry={glassGeo}
          material={glassMat}
          rotation-x={rx}
          position-y={TABLE_H}
          renderOrder={1}
        />
      ))}

      {/* brass gallery rims on both glass edges — straight-cut at the slots */}
      {[outerCut, Math.PI + outerCut].map((start) => (
        <mesh key={`rim-o-${start}`} rotation={[Math.PI / 2, 0, start]} position-y={TABLE_H}>
          <torusGeometry args={[TABLE_OUTER, 0.02, 10, 80, Math.PI - 2 * outerCut]} />
          <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.8} />
        </mesh>
      ))}
      {[innerCut, Math.PI + innerCut].map((start) => (
        <mesh key={`rim-i-${start}`} rotation={[Math.PI / 2, 0, start]} position-y={TABLE_H}>
          <torusGeometry args={[TABLE_INNER, 0.015, 10, 64, Math.PI - 2 * innerCut]} />
          <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.8} />
        </mesh>
      ))}

      {/* straight brass guard rails along every slot edge — cover the cut
          glass and rim ends so nobody catches an edge */}
      {[
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ].map(([sx, sz]) => {
        const xin = Math.sqrt(TABLE_INNER * TABLE_INNER - TABLE_SLIT * TABLE_SLIT);
        const xout = Math.sqrt(TABLE_OUTER * TABLE_OUTER - TABLE_SLIT * TABLE_SLIT);
        return (
          <mesh
            key={`slit-guard-${sx}-${sz}`}
            position={[(sx * (xin + xout)) / 2, TABLE_H + 0.02, sz * TABLE_SLIT]}
          >
            <boxGeometry args={[xout - xin + 0.06, 0.045, 0.036]} />
            <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.8} />
          </mesh>
        );
      })}

      {/* accent under-glow in the hollow middle */}
      <pointLight
        ref={glow}
        position={[0, 0.4, 0]}
        color={accent}
        distance={5}
        decay={2}
        intensity={2.4}
      />
    </group>
  );
}

// ---- Accent motes drifting above the glass ----

const MOTE_COUNT = 90;
const MOTE_R0 = TABLE_INNER + 0.15;
const MOTE_R1 = TABLE_OUTER - 0.15;
const MOTE_Y0 = 0.95;
const MOTE_Y1 = 2.55;
const MOTE_SPEED = 0.55; // base spin, rad/s

// Deterministic hash → [0,1): stable layout across mounts, no jitter between rooms.
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// Lazy module singleton — one canvas texture shared by every room's field.
let moteTexture: THREE.CanvasTexture | null = null;
const getMoteTexture = () => (moteTexture ??= makeMoteTexture());

function MoteField({ accent, index }: { accent: string; index: number }) {
  const material = useRef<THREE.PointsMaterial | null>(null);

  const { geometry, spec } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(MOTE_COUNT * 3);
    // per-mote: radius, base y, spin (signed), bob amp, phase
    const spec = { r: new Float32Array(MOTE_COUNT), y: new Float32Array(MOTE_COUNT), spin: new Float32Array(MOTE_COUNT), bob: new Float32Array(MOTE_COUNT), phase: new Float32Array(MOTE_COUNT) };
    for (let i = 0; i < MOTE_COUNT; i++) {
      spec.r[i] = MOTE_R0 + hash(i * 3.1) * (MOTE_R1 - MOTE_R0);
      spec.y[i] = MOTE_Y0 + hash(i * 7.7 + 1.3) * (MOTE_Y1 - MOTE_Y0);
      spec.spin[i] = (MOTE_SPEED + hash(i * 5.3 + 2.1) * 0.9) * 0.25 * (hash(i * 2.9 + 3.7) < 0.5 ? -1 : 1);
      spec.bob[i] = 0.05 + hash(i * 9.1 + 4.9) * 0.1;
      spec.phase[i] = hash(i * 11.3 + 5.5) * Math.PI * 2;
      pos[i * 3] = Math.sin(spec.phase[i]) * spec.r[i];
      pos[i * 3 + 1] = spec.y[i];
      pos[i * 3 + 2] = Math.cos(spec.phase[i]) * spec.r[i];
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { geometry: geo, spec };
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock, camera }) => {
    const fade = roomCameraFade(camera, index);
    if (material.current) material.current.opacity = 0.55 * fade;
    if (fade < 0.01) return; // invisible — skip buffer churn
    const t = clock.elapsedTime;
    const attr = geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < MOTE_COUNT; i++) {
      const a = spec.phase[i] + t * spec.spin[i];
      arr[i * 3] = Math.sin(a) * spec.r[i];
      arr[i * 3 + 1] = spec.y[i] + Math.sin(t * 0.6 + spec.phase[i]) * spec.bob[i];
      arr[i * 3 + 2] = Math.cos(a) * spec.r[i];
    }
    attr.needsUpdate = true;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        ref={material}
        map={getMoteTexture()}
        color={accent}
        size={0.09}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ---- Balloon scatter — a few helium floats (animated) + air clusters ----

const HELIUM_N = 5; // only a few float, each visibly bobbing/wandering
const ISLANDS = 3; // air-filled floor balloons rest in tight islands
const AIR_TABLE_N = 5; // plus a few loose on the glass top
const AIR_SQUASH = 0.92; // resting balloons squat; helium ones elongate

interface BalloonSpec {
  x: number;
  y: number;
  z: number;
  r: number;
  color: string;
  rotY: number;
  tilt: number; // rotation-x jitter (air balloons only)
}

interface HeliumSpec extends BalloonSpec {
  phase: number;
  bobAmp: number;
  bobW: number;
  swayW: number;
}

function BalloonScatter({ theme, index }: { theme: RoomTheme; index: number }) {
  const heGroups = useRef<Array<THREE.Group | null>>([]);
  const mats = useRef<Array<THREE.MeshStandardMaterial | THREE.MeshBasicMaterial | null>>([]);

  // Unit geometries shared across all balloon batches.
  const geos = useMemo(
    () => ({
      sphere: new THREE.SphereGeometry(1, 20, 14),
      string: new THREE.CylinderGeometry(0.004, 0.004, 1, 5),
      knot: new THREE.CylinderGeometry(0.024, 0.03, 0.05, 8),
    }),
    []
  );
  useEffect(
    () => () => {
      geos.sphere.dispose();
      geos.string.dispose();
      geos.knot.dispose();
    },
    [geos]
  );

  const { helium, air } = useMemo(() => {
    // Random candy colors per balloon (hue-rolled, seeded per room).
    const _c = new THREE.Color();
    const pickColor = (hue: number, sat: number, lit: number) =>
      `#${_c.setHSL(hue, 0.5 + sat * 0.25, 0.52 + lit * 0.15).getHexString()}`;
    // Room-seeded hash stream — each room gets its own stable scatter.
    const h = (i: number, salt: number) => hash(i * 13.7 + salt + index * 977.13);

    // Balloons must not hang over the two straight walk-through slots — no
    // glass there, so a "table" balloon would hover over the void in the path.
    // Positions use a = atan2(x, z), so |cos a| · rr is the distance off-axis.
    const offSlit = (a: number, rr: number, r: number) => {
      const lim = (TABLE_SLIT + r + 0.1) / rr;
      let aa = a;
      while (Math.abs(Math.cos(aa)) < lim) aa += 0.35;
      return aa;
    };

    const helium: HeliumSpec[] = [];
    for (let i = 0; i < HELIUM_N; i++) {
      const rr = 2.9 + h(i, 2) * 3.7; // over the glass band — never in the walk-through hollow
      const r = 0.2 + h(i, 4) * 0.1;
      const a = offSlit(h(i, 1) * Math.PI * 2, rr, r);
      helium.push({
        x: Math.sin(a) * rr,
        y: 1.6 + h(i, 3) * 2.6,
        z: Math.cos(a) * rr,
        r,
        color: pickColor(h(i, 5), h(i, 5.5), h(i, 5.7)),
        rotY: h(i, 6) * Math.PI * 2,
        tilt: 0,
        phase: h(i, 7) * Math.PI * 2,
        bobAmp: 0.09 + h(i, 8) * 0.08,
        bobW: 0.4 + h(i, 9) * 0.4,
        swayW: 0.22 + h(i, 10) * 0.25,
      });
    }

    // Floor balloons: tight islands (a mound per cluster), scattered around.
    const air: BalloonSpec[] = [];
    for (let j = 0; j < ISLANDS; j++) {
      const ia = h(j, 31) * Math.PI * 2;
      const irr = 1.6 + h(j, 32) * 4.8;
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
          color: pickColor(h(s, 37), h(s, 37.5), h(s, 37.7)),
          rotY: h(s, 38) * Math.PI * 2,
          tilt: (h(s, 39) - 0.5) * 0.7,
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
        color: pickColor(h(i, 24), h(i, 24.5), h(i, 24.7)),
        rotY: h(i, 25) * Math.PI * 2,
        tilt: (h(i, 26) - 0.5) * 0.35,
      });
    }

    // Rigid-sphere separation — clustered/random rest spots must not intersect.
    // Table balloons are re-clamped to the glass band and off the slits first
    // each pass; the last pass resolves pairs, so no intersections remain.
    for (let pass = 0; pass < 4; pass++) {
      for (let i = tableStart; i < air.length; i++) {
        const b = air[i];
        const rr = Math.hypot(b.x, b.z);
        const cl = THREE.MathUtils.clamp(rr, 2.85, 5.15);
        if (cl !== rr) {
          b.x *= cl / rr;
          b.z *= cl / rr;
        }
        const a = offSlit(Math.atan2(b.x, b.z), cl, b.r);
        b.x = Math.sin(a) * cl;
        b.z = Math.cos(a) * cl;
      }
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

    return { helium, air };
  }, [theme, index]);

  useFrame(({ clock, camera }) => {
    const fade = roomCameraFade(camera, index);
    for (const m of mats.current) if (m) m.opacity = 0.92 * fade;
    if (fade < 0.01) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < helium.length; i++) {
      const g = heGroups.current[i];
      if (!g) continue;
      const s = helium[i];
      g.position.y = s.y + Math.sin(t * s.bobW + s.phase) * s.bobAmp;
      g.position.x = s.x + Math.sin(t * s.swayW + s.phase) * 0.12;
      g.position.z = s.z + Math.cos(t * s.swayW * 0.8 + s.phase) * 0.12;
      g.rotation.z = Math.sin(t * s.swayW + s.phase) * 0.08;
      g.rotation.x = Math.cos(t * s.bobW * 0.7 + s.phase) * 0.06;
    }
  });

  return (
    <>
      {/* helium — a few floats, each bobbing and wandering; string dangles below */}
      {helium.map((b, i) => {
        const len = 0.35 + hash(i * 7.3 + index * 977.13 + 4.4) * 0.5;
        return (
          <group
            key={`he-${i}`}
            ref={(g) => { heGroups.current[i] = g; }}
            position={[b.x, b.y, b.z]}
          >
            <mesh scale={[b.r, b.r * 1.12, b.r]} rotation-y={b.rotY} castShadow>
              <primitive object={geos.sphere} attach="geometry" />
              <meshStandardMaterial
                ref={(m) => { mats.current[i] = m; }}
                color={b.color}
                roughness={0.32}
                metalness={0.02}
                transparent
                opacity={0.92}
                envMapIntensity={0.7}
              />
            </mesh>
            <mesh position={[0, -b.r * 1.12 - len / 2, 0]} scale={[1, len, 1]}>
              <primitive object={geos.string} attach="geometry" />
              <meshBasicMaterial
                ref={(m) => { mats.current[HELIUM_N] = m; }}
                color="#3a3a3e"
                transparent
                opacity={0.92}
              />
            </mesh>
          </group>
        );
      })}

      {/* air — islands on the floor, a few loose on the glass top */}
      <Instances geometry={geos.sphere} frustumCulled={false} castShadow>
        <meshStandardMaterial
          ref={(m) => { mats.current[HELIUM_N + 1] = m; }}
          roughness={0.38}
          metalness={0.02}
          transparent
          opacity={0.92}
          envMapIntensity={0.7}
        />
        {air.map((b, i) => (
          <Instance
            key={`air-${i}`}
            position={[b.x, b.y, b.z]}
            scale={[b.r * 1.06, b.r * AIR_SQUASH, b.r * 1.06]}
            rotation={[b.tilt, b.rotY, b.tilt * 0.6]}
            color={b.color}
          />
        ))}
      </Instances>
      <Instances geometry={geos.knot} frustumCulled={false}>
        <meshBasicMaterial
          ref={(m) => { mats.current[HELIUM_N + 2] = m; }}
          color="#3a3a3e"
          transparent
          opacity={0.92}
        />
        {air.map((b, i) => (
          <Instance key={`kn-${i}`} position={[b.x, b.y - b.r * AIR_SQUASH + 0.012, b.z]} />
        ))}
      </Instances>
    </>
  );
}

// ---- Her name in chunky letters, laid flat and scattered on the glass ----

const LETTER_NAME = 'SIMILOLUWA';
const LETTER_FONT = '/fonts/inter-700.woff'; // local, OFL — no runtime CDN fetch
const LETTER_SIZE = 0.72;

function LetterScatter({ index }: { index: number }) {
  const gl = useThree((s) => s.gl);

  const letters = useMemo(() => {
    const _c = new THREE.Color();
    const h = (i: number, salt: number) => hash(i * 17.3 + salt + index * 613.7);
    return Array.from(LETTER_NAME).map((ch, i) => {
      const rr = 3.0 + h(i, 52) * 1.8; // annulus band of the glass top
      let a = h(i, 51) * Math.PI * 2;
      // keep glyphs off the straight walk-through slots — a glyph would float
      // over void
      while (Math.abs(Math.cos(a) * rr) < TABLE_SLIT + 0.45) a += 0.35;
      _c.setHSL(h(i, 55), 0.5 + h(i, 56) * 0.25, 0.5 + h(i, 57) * 0.12);
      const color = `#${_c.getHexString()}`;
      _c.multiplyScalar(0.45);
      const back = `#${_c.getHexString()}`;
      return {
        ch,
        x: Math.sin(a) * rr,
        z: Math.cos(a) * rr,
        yaw: h(i, 53) * Math.PI * 2,
        color,
        back,
      };
    });
  }, [index]);

  // Lit (standard) materials derived for troika's SDF glyph shader.
  const mats = useMemo(
    () =>
      letters.map((l) => ({
        front: createTextDerivedMaterial(
          new THREE.MeshStandardMaterial({ color: l.color, roughness: 0.42, metalness: 0.05 })
        ),
        back: createTextDerivedMaterial(
          new THREE.MeshStandardMaterial({ color: l.back, roughness: 0.5, metalness: 0.05 })
        ),
      })),
    [letters]
  );
  useEffect(
    () => () => {
      for (const m of mats) {
        m.front.dispose();
        m.back.dispose();
      }
    },
    [mats]
  );

  // troika builds glyph meshes async — re-bake the frozen shadow maps on sync
  const rebake = () => {
    gl.shadowMap.needsUpdate = true;
  };

  return (
    <>
      {letters.map((l, i) => (
        <group
          key={`${l.ch}-${i}`}
          position={[l.x, TABLE_H + 0.006, l.z]}
          rotation={[-Math.PI / 2, 0, l.yaw]}
        >
          {/* back copy fakes the extrusion depth (sits just under the glass) */}
          <Text font={LETTER_FONT} fontSize={LETTER_SIZE} anchorX="center" anchorY="middle" position={[0, 0, -0.05]} onSync={rebake}>
            {l.ch}
            <primitive object={mats[i].back} attach="material" />
          </Text>
          <Text font={LETTER_FONT} fontSize={LETTER_SIZE} anchorX="center" anchorY="middle" castShadow onSync={rebake}>
            {l.ch}
            <primitive object={mats[i].front} attach="material" />
          </Text>
        </group>
      ))}
    </>
  );
}

// ---- Optional GLB displayed on the glass (user drops files in public/models/) ----

function GlbDisplay({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const gl = useThree((s) => s.gl);
  const object = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const scale = Math.min(
      DISPLAY_H / Math.max(size.y, 1e-4),
      DISPLAY_W / Math.max(size.x, size.z, 1e-4)
    );
    clone.scale.setScalar(scale);
    const scaled = new THREE.Box3().setFromObject(clone);
    const center = scaled.getCenter(new THREE.Vector3());
    clone.position.set(PIECE_X - center.x, TABLE_H - scaled.min.y, PIECE_Z - center.z);
    clone.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    return clone;
  }, [scene]);
  // shadow maps are frozen (ShadowBake) — one-shot re-bake once the model lands
  useEffect(() => {
    gl.shadowMap.needsUpdate = true;
  }, [gl, object]);
  return <primitive object={object} />;
}

interface CenterpieceProps {
  index: number;
  year: number;
  theme: RoomTheme;
  playing: boolean;
}

export function Centerpiece({ index, year, theme, playing }: CenterpieceProps) {
  const medallion = useMemo(() => makeMedallionTexture(year), [year]);
  useEffect(() => () => medallion.dispose(), [medallion]);

  return (
    <group position={[roomCenterX(index), 0, 0]}>
      <RingTable accent={theme.accent} index={index} />

      {/* year etched once on the hollow-center floor */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.004} renderOrder={2}>
        <circleGeometry args={[1.8, 64]} />
        <meshBasicMaterial map={medallion} transparent depthWrite={false} />
      </mesh>

      {/* light accent motes drifting above the glass — or a user GLB instead */}
      <MoteField accent={theme.accent} index={index} />
      <BalloonScatter theme={theme} index={index} />
      <LetterScatter index={index} />
      <group position={[TURNTABLE_X, TABLE_H, TURNTABLE_Z]} rotation-y={TURNTABLE_YAW}>
        <Turntable playing={playing} />
      </group>
      {theme.model && <GlbDisplay url={theme.model} />}
    </group>
  );
}
