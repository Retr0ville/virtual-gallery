// Per-room identity. Each year-room gets its own palette, beam colors,
// accent lighting and drifting accent motes above the table so stepping into
// a new year feels like a different room. Themes cycle by room index
// (data-driven — new years inherit the next theme automatically).

export interface RoomTheme {
  id: string;
  wall: string; // upper wall tone
  wallLower: string; // dado band below DADO_H, deeper companion tone
  rail: string; // painted chair rail at the tone split
  ceiling: string;
  beams: [string, string, string, string];
  accent: string; // halo ring, motes, rim light, threshold glow, corridor line
  artLight: string; // wall wash color
  // Optional GLB (path under /public, e.g. '/models/sculpture.glb'). When set
  // it is displayed on the room's glass center table.
  model?: string;
}

// Two-tone walls: soft upper tone, deeper dusty lower band, ivory-ish rail —
// muted, lit like a well-styled bedroom rather than a showflat.
export const THEMES: RoomTheme[] = [
  {
    id: 'rose',
    wall: '#ece7de',
    wallLower: '#ddc7bd',
    rail: '#f5efe6',
    ceiling: '#f1ede5',
    beams: ['#ff4fa3', '#ff7ac2', '#ffa53c', '#8f5cff'],
    accent: '#ff4fa3',
    artLight: '#fff2df',
  },
  {
    id: 'lagoon',
    wall: '#e4e7ec',
    wallLower: '#c7d4db',
    rail: '#f1f4f6',
    ceiling: '#eaeef2',
    beams: ['#2fc9ff', '#4f8fff', '#7cf5d4', '#b48cff'],
    accent: '#2fc9ff',
    artLight: '#eef6ff',
  },
  {
    id: 'amber',
    wall: '#eae3d2',
    wallLower: '#d8c3a4',
    rail: '#f5eddd',
    ceiling: '#f2ecdd',
    beams: ['#ffa53c', '#ff6d3c', '#ffd166', '#ff8f5c'],
    accent: '#ffa53c',
    artLight: '#fff0d6',
  },
  {
    id: 'violet',
    wall: '#e7e3ec',
    wallLower: '#d2c5db',
    rail: '#f2edf6',
    ceiling: '#efeaf4',
    beams: ['#8f5cff', '#b48cff', '#2fc9ff', '#ff4fa3'],
    accent: '#8f5cff',
    artLight: '#f3efff',
  },
];

export const themeForRoom = (index: number): RoomTheme => THEMES[index % THEMES.length];
