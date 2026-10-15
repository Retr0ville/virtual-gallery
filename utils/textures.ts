// Canvas-generated textures — no external font/asset downloads.
// Rendered with system fonts in the browser; crisp at any DPI.

import * as THREE from 'three';

const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}

function finalize(canvas: HTMLCanvasElement, anisotropy = 8): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

// Draw text with manual letter-spacing, centered horizontally around centerX.
function drawSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  spacing: number
): number {
  const widths = Array.from(text).map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let x = centerX - total / 2;
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], x + widths[i] / 2, y);
    x += widths[i] + spacing;
  }
  return total;
}

// Year signage plate shown above doorways. Transparent background.
export function makeYearPlateTexture(year: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 256;
  const { canvas, ctx } = makeCanvas(w, h);
  const text = String(year);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 92px ${FONT}`;
  ctx.fillStyle = 'rgba(26,26,28,0.92)';
  const total = drawSpacedText(ctx, text, w / 2, h / 2 - 14, 20);
  ctx.fillStyle = 'rgba(26,26,28,0.55)';
  ctx.fillRect((w - total) / 2, h / 2 + 62, total, 3);
  return finalize(canvas, 4);
}

// Circular floor medallion with the year, subtle ring. Transparent background.
export function makeMedallionTexture(year: number): THREE.CanvasTexture {
  const s = 1024;
  const { canvas, ctx } = makeCanvas(s, s);
  ctx.strokeStyle = 'rgba(42,42,44,0.42)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2 - 30, 0, Math.PI * 2);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `500 148px ${FONT}`;
  ctx.fillStyle = 'rgba(42,42,44,0.68)';
  drawSpacedText(ctx, String(year), s / 2, s / 2 + 6, 30);
  return finalize(canvas, 8);
}
