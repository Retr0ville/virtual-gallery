// Dominant-colour extraction for viewer backdrops. Samples a small canvas
// copy of the image and returns the most frequent (quantized) colour.

const SAMPLE = 32; // px — tiny enough to be cheap, big enough to average out
const BUCKET_BITS = 4; // 16 levels per channel

export function dominantColor(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SAMPLE;
        canvas.height = SAMPLE;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
        const data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
        const shift = 8 - BUCKET_BITS;
        const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const key = ((r >> shift) << (BUCKET_BITS * 2)) | ((g >> shift) << BUCKET_BITS) | (b >> shift);
          const cur = buckets.get(key);
          if (cur) {
            cur.n += 1;
            cur.r += r;
            cur.g += g;
            cur.b += b;
          } else {
            buckets.set(key, { n: 1, r, g, b });
          }
        }
        let best = { n: 0, r: 0, g: 0, b: 0 };
        buckets.forEach((v) => {
          if (v.n > best.n) best = v;
        });
        if (best.n === 0) {
          resolve(null);
          return;
        }
        resolve(
          `rgb(${Math.round(best.r / best.n)}, ${Math.round(best.g / best.n)}, ${Math.round(
            best.b / best.n
          )})`
        );
      } catch {
        // Tainted canvas or other read failure — caller falls back to theme.
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
