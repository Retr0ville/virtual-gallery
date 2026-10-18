// Gallery page — data fetch, scene composition, overlay orchestration.

import Head from 'next/head';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib';
import GalleryCanvas from '../components/3d/GalleryCanvas';
import { LookDelta, MoveInput, MoveMode } from '../components/3d/Player';
import { AdminPanel } from '../components/ui/AdminPanel';
import { Entrance } from '../components/ui/Entrance';
import { HUD } from '../components/ui/HUD';
import { TouchControls } from '../components/ui/TouchControls';
import { Viewer } from '../components/ui/Viewer';
import { CURRENT_YEAR, GalleryItem, YearRoom, fetchMedia, groupByYear } from '../utils/media';

export default function Home() {
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);
  const [mode, setMode] = useState<MoveMode>('walk');
  const [currentRoom, setCurrentRoom] = useState(0);
  const [selected, setSelected] = useState<GalleryItem | null>(null);
  const [hovered, setHovered] = useState<GalleryItem | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  const inputRef = useRef<MoveInput>({ x: 0, z: 0 });
  const lookDeltaRef = useRef<LookDelta>({ dx: 0, dy: 0 });
  const controlsRef = useRef<PointerLockControlsImpl | null>(null);

  useEffect(() => {
    setIsTouch(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  useEffect(() => {
    fetch('/api/admin-login')
      .then((res) => res.json())
      .then((data: { authenticated?: boolean }) => setAdminAuthed(Boolean(data.authenticated)))
      .catch(() => setAdminAuthed(false));
  }, []);

  const handleAdminLogin = useCallback(() => {
    setAdminAuthed(true);
    setAdminOpen(true);
  }, []);

  const loadItems = useCallback(async () => {
    try {
      const list = await fetchMedia();
      setItems(list);
      setError(null);
    } catch {
      setError('Failed to load gallery');
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const rooms = useMemo<YearRoom[]>(() => {
    const grouped = groupByYear(items ?? []);
    return grouped.length > 0 ? grouped : [{ year: CURRENT_YEAR, items: [] }];
  }, [items]);

  const flatItems = useMemo(() => rooms.flatMap((r) => r.items), [rooms]);

  const activeRoom =
    currentRoom >= 0 && currentRoom < rooms.length ? rooms[currentRoom] : null;

  // Any overlay takes the pointer: input disabled, pointer lock released.
  const paused = !entered || selected !== null || adminOpen;

  useEffect(() => {
    if (paused && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [paused]);

  const handleEnter = useCallback(() => {
    setEntered(true);
    const dom = controlsRef.current?.domElement;
    if (!dom) return;
    try {
      const result = dom.requestPointerLock() as unknown;
      if (result instanceof Promise) result.catch(() => {});
    } catch {
      // Pointer lock unavailable — WASD still works, click-to-lock may retry.
    }
  }, []);

  const handleModeToggle = useCallback(() => {
    setMode((m) => (m === 'walk' ? 'fly' : 'walk'));
  }, []);

  const handleRoomChange = useCallback((index: number) => {
    setCurrentRoom(index);
  }, []);

  const handleArtworkSelect = useCallback((item: GalleryItem) => {
    // Drop pointer lock before the viewer mounts so the cursor is free.
    if (document.pointerLockElement) document.exitPointerLock();
    setSelected(item);
  }, []);

  const handleArtworkHover = useCallback((item: GalleryItem | null) => {
    setHovered(item);
  }, []);

  const handleStep = useCallback(
    (dir: 1 | -1) => {
      setSelected((cur) => {
        if (!cur || flatItems.length === 0) return cur;
        const idx = flatItems.findIndex((i) => i.publicId === cur.publicId);
        if (idx === -1) return cur;
        return flatItems[(idx + dir + flatItems.length) % flatItems.length];
      });
    },
    [flatItems]
  );

  return (
    <>
      <Head>
        <title>Similoluwa's Gallery</title>
        <meta name="description" content="A virtual walk through the years" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <main className="app">
        <GalleryCanvas
          rooms={rooms}
          mode={mode}
          enabled={!paused}
          isTouch={isTouch}
          controlsRef={controlsRef}
          inputRef={inputRef}
          lookDeltaRef={lookDeltaRef}
          onModeToggle={handleModeToggle}
          onRoomChange={handleRoomChange}
          onArtworkSelect={handleArtworkSelect}
          onArtworkHover={handleArtworkHover}
        />

        <HUD
          mode={mode}
          year={activeRoom?.year ?? null}
          hovered={hovered}
          roomItemCount={activeRoom?.items.length ?? 0}
          entered={entered}
          isTouch={isTouch}
          canManage={adminAuthed}
          onToggleMode={handleModeToggle}
          onOpenAdmin={() => setAdminOpen(true)}
        />

        {isTouch && (
          <TouchControls
            active={entered && !paused}
            inputRef={inputRef}
            lookDeltaRef={lookDeltaRef}
          />
        )}

        {selected && (
          <Viewer
            item={selected}
            items={flatItems}
            onClose={() => setSelected(null)}
            onNext={() => handleStep(1)}
            onPrev={() => handleStep(-1)}
          />
        )}

        <AdminPanel
          open={adminOpen}
          items={items ?? []}
          onClose={() => setAdminOpen(false)}
          onChanged={loadItems}
        />

        <Entrance
          onEnter={handleEnter}
          onAdminLogin={handleAdminLogin}
          adminAuthed={adminAuthed}
        />

        {error && (
          <button className="app-error" onClick={loadItems}>
            {error} — click to retry
          </button>
        )}
      </main>
    </>
  );
}
