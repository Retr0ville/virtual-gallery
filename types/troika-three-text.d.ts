// Minimal types for troika-three-text (ships none). Only what we use.
declare module 'troika-three-text' {
  import type { Material, Mesh } from 'three';

  // Derives a material that retains troika's SDF glyph shader, layering the
  // given base material's shading on top. (UMD builds export only this name;
  // the ESM build also aliases it as createDerivedMaterial.)
  export function createTextDerivedMaterial(baseMaterial: Material, derivedMaterial?: Material | null): Material;

  export class Text extends Mesh {
    text: string;
    font: string | null;
    fontSize: number;
    anchorX: number | string;
    anchorY: number | string;
    sync(callback?: () => void): void;
    dispose(): void;
  }

  export function preloadFont(
    options: { font?: string | null; characters?: string | string[] },
    callback: () => void
  ): void;
}
