// Artwork — RoundedBox frame + print plane, real aspect ratio from texture,
// hover highlight, click to open viewer. No 3D labels; HUD tooltip handles titles.

import { RoundedBox, useTexture } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import {
  ARTWORK_CENTER_Y,
  ARTWORK_FRAME_PAD,
  placeArtworks,
} from '../../utils/layout';
import { GalleryItem } from '../../utils/media';
import { getCldImageUrl } from 'next-cloudinary';

const FRAME_DEPTH = 0.045;
const FRAME_COLOR = '#17171a';
const FRAME_HOVER_EMISSIVE = '#3a3a42';
const LIGHT_BRASS = '#b08d4f';
const PICTURE_LIGHT = '#fff1d6';

interface ArtworkProps {
  item: GalleryItem;
  width: number;
  height: number;
  position: [number, number, number];
  rotationY: number;
  onHover: (item: GalleryItem | null) => void;
}

export function Artwork({ item, width, height, position, rotationY, onHover }: ArtworkProps) {
  const texture = useTexture(item.url);
  const [hovered, setHovered] = useState(false);
  const lightTarget = useMemo(() => new THREE.Object3D(), []);

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
  }, [texture]);

  const w = width;
  const h = height;
  // Picture light: brass shade on a stem above the frame, warm spot aimed
  // down the print. No shadows — the cone is wide and reads as a wash.
  const frameTop = h / 2 + ARTWORK_FRAME_PAD;
  const barLen = Math.min(w * 0.62, 0.9);
  const barY = frameTop + 0.14;
  const barZ = 0.13;

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = 'pointer';
      return () => {
        document.body.style.cursor = '';
      };
    }
  }, [hovered]);

  const handleOver = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setHovered(true);
    onHover(item);
  };
  const handleOut = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setHovered(false);
    onHover(null);
  };

  return (
    // userData tags the whole artwork for the click-to-fly raycaster.
    <group position={position} rotation-y={rotationY} userData={{ artwork: item }}>
      <RoundedBox
        args={[w + ARTWORK_FRAME_PAD * 2, h + ARTWORK_FRAME_PAD * 2, FRAME_DEPTH]}
        radius={0.018}
        smoothness={4}
        position={[0, 0, FRAME_DEPTH / 2]}
        castShadow
        onPointerOver={handleOver}
        onPointerOut={handleOut}
      >
        <meshStandardMaterial
          color={FRAME_COLOR}
          roughness={0.5}
          metalness={0.2}
          emissive={hovered ? FRAME_HOVER_EMISSIVE : '#000000'}
          emissiveIntensity={hovered ? 1 : 0}
        />
      </RoundedBox>

      <mesh
        position={[0, 0, FRAME_DEPTH + 0.003]}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
      >
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.62}
          metalness={0}
          emissive="#ffffff"
          emissiveMap={texture}
          emissiveIntensity={0.05}
          envMapIntensity={0.25}
        />
      </mesh>

      {/* Picture light fixture — stem + brass shade above the frame. */}
      <mesh position={[0, frameTop + 0.055, 0.045]} castShadow>
        <boxGeometry args={[0.04, 0.13, 0.04]} />
        <meshStandardMaterial color={LIGHT_BRASS} roughness={0.35} metalness={0.7} />
      </mesh>
      <RoundedBox
        args={[barLen, 0.06, 0.16]}
        radius={0.02}
        smoothness={3}
        position={[0, barY, barZ]}
        castShadow
      >
        <meshStandardMaterial color={LIGHT_BRASS} roughness={0.3} metalness={0.75} />
      </RoundedBox>
      <mesh position={[0, barY - 0.032, barZ]}>
        <boxGeometry args={[barLen - 0.06, 0.008, 0.1]} />
        <meshStandardMaterial
          color="#fff8ea"
          emissive="#ffe9c0"
          emissiveIntensity={1.6}
          roughness={0.4}
        />
      </mesh>

      <primitive object={lightTarget} position={[0, -0.12, 0.04]} />
      <spotLight
        position={[0, barY - 0.02, barZ]}
        target={lightTarget}
        angle={1.0}
        penumbra={0.8}
        intensity={2.2}
        distance={2.8}
        decay={2}
        color={PICTURE_LIGHT}
      />
    </group>
  );
}

interface RoomArtworksProps {
  roomIndex: number;
  roomCount: number;
  items: GalleryItem[];
  onHover: (item: GalleryItem | null) => void;
}

// Places a room's items along the allowed wall arcs (door gaps excluded).
// Textures are loaded here first so every print keeps its native aspect ratio
// and the layout can reserve the right amount of wall for each frame.
export function RoomArtworks(props: RoomArtworksProps) {
  if (props.items.length === 0) return null;
  return <ArtworkWall {...props} />;
}

function ArtworkWall({ roomIndex, roomCount, items, onHover }: RoomArtworksProps) {
  const urls = useMemo(
    () =>
      items.map((item) =>
        getCldImageUrl({ src: item.publicId, width: 1024, crop: 'limit', format: 'auto', quality: 'auto' })
      ),
    [items]
  );
  const textures = useTexture(urls) as THREE.Texture[];

  const slots = useMemo(() => {
    const aspects = textures.map((texture) => {
      const image = texture.image as { width?: number; height?: number } | undefined;
      return image?.width && image.height ? image.width / image.height : 1;
    });
    return placeArtworks(roomIndex, roomCount, aspects);
  }, [textures, roomIndex, roomCount]);

  return (
    <>
      {items.map((item, i) => {
        const slot = slots[i];
        if (!slot) return null;
        return (
          // Own boundary: the full-res texture of one artwork must never
          // suspend the rest of the room while it decodes.
          <Suspense key={item.publicId} fallback={null}>
            <Artwork
              item={item}
              width={slot.width}
              height={slot.height}
              position={[slot.x, ARTWORK_CENTER_Y, slot.z]}
              rotationY={slot.rotationY}
              onHover={onHover}
            />
          </Suspense>
        );
      })}
    </>
  );
}
