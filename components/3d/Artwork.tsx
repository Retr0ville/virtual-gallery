// Artwork — RoundedBox frame + print plane, real aspect ratio from texture,
// hover highlight, click to open viewer. No 3D labels; HUD tooltip handles titles.

import { RoundedBox, useTexture } from '@react-three/drei';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import {
  ARTWORK_CENTER_Y,
  ARTWORK_MAX_H,
  ARTWORK_MAX_W,
  artworkSlots,
} from '../../utils/layout';
import { GalleryItem } from '../../utils/media';

const FRAME_DEPTH = 0.045;
const FRAME_COLOR = '#17171a';
const FRAME_HOVER_EMISSIVE = '#3a3a42';

interface ArtworkProps {
  item: GalleryItem;
  position: [number, number, number];
  rotationY: number;
  onSelect: (item: GalleryItem) => void;
  onHover: (item: GalleryItem | null) => void;
}

export function Artwork({ item, position, rotationY, onSelect, onHover }: ArtworkProps) {
  const texture = useTexture(item.url);
  const [hovered, setHovered] = useState(false);

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
  }, [texture]);

  const { w, h } = useMemo(() => {
    const image = texture.image as { width?: number; height?: number } | undefined;
    const iw = image?.width ?? 4;
    const ih = image?.height ?? 3;
    const aspect = iw / ih;
    let height = ARTWORK_MAX_H;
    let width = height * aspect;
    if (width > ARTWORK_MAX_W) {
      width = ARTWORK_MAX_W;
      height = width / aspect;
    }
    return { w: width, h: height };
  }, [texture]);

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
    <group position={position} rotation-y={rotationY}>
      <RoundedBox
        args={[w + 0.12, h + 0.12, FRAME_DEPTH]}
        radius={0.018}
        smoothness={4}
        position={[0, 0, FRAME_DEPTH / 2]}
        castShadow
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(item);
        }}
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
        onClick={(e) => {
          e.stopPropagation();
          onSelect(item);
        }}
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
    </group>
  );
}

interface RoomArtworksProps {
  roomIndex: number;
  roomCount: number;
  items: GalleryItem[];
  onSelect: (item: GalleryItem) => void;
  onHover: (item: GalleryItem | null) => void;
}

// Places a room's items evenly along the allowed wall arcs (door gaps excluded).
export function RoomArtworks({ roomIndex, roomCount, items, onSelect, onHover }: RoomArtworksProps) {
  const slots = useMemo(
    () => artworkSlots(roomIndex, items.length, roomCount),
    [roomIndex, items.length, roomCount]
  );

  return (
    <>
      {items.map((item, i) => {
        const slot = slots[i];
        if (!slot) return null;
        return (
          <Artwork
            key={item.filename}
            item={item}
            position={[slot.x, ARTWORK_CENTER_Y, slot.z]}
            rotationY={slot.rotationY}
            onSelect={onSelect}
            onHover={onHover}
          />
        );
      })}
    </>
  );
}
