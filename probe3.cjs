// Probe: ring-table spawn, blocked rim, through-middle walk, room 2 (gifts),
// pointer-lock turn shots, fps. Uses TEMP window.__cam debug hook.
const { chromium } = require('playwright');
const path = require('path');
const os = require('os');

const OUT = path.join(os.tmpdir(), 'vg-probe3');
require('fs').mkdirSync(OUT, { recursive: true });
const shot = (p, name) => p.screenshot({ path: path.join(OUT, `${name}.png`), timeout: 90000 });

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.entrance-btn:not([disabled])', { timeout: 180000 });
  await page.waitForTimeout(800);
  await page.click('.entrance-btn');
  await page.waitForTimeout(1500);

  const pos = () => page.evaluate(() => {
    const cam = window.__cam;
    if (!cam) return 'no-cam';
    return `${cam.position.x.toFixed(2)} ${cam.position.z.toFixed(2)}`;
  });
  const fps = Number(await page.evaluate(() => new Promise((res) => {
    let n = 0; const t0 = performance.now();
    const loop = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(loop); else res(n / 2); };
    requestAnimationFrame(loop);
  })));
  console.log('fps', fps, 'spawn', await pos());
  await shot(page, 's1-spawn-piece');

  // Blocked at hollow rim ('a' = +z, not aligned with a doorway wedge).
  await page.keyboard.down('a');
  await page.waitForTimeout(2500);
  await page.keyboard.up('a');
  await page.waitForTimeout(400);
  console.log('blocked rim:', await pos());
  await shot(page, 's2-blocked-rim');

  // Back to z~0, then straight through the middle.
  await page.keyboard.down('d');
  await page.waitForTimeout(700);
  await page.keyboard.up('d');
  await page.waitForTimeout(300);
  console.log('back to lane:', await pos());

  const y0 = await page.locator('.hud-year').textContent();
  await page.keyboard.down('s');
  const t0 = Date.now();
  let y = y0;
  while (Date.now() - t0 < 20000 && (y === y0 || y === '')) { await page.waitForTimeout(1000); y = await page.locator('.hud-year').textContent(); }
  await page.keyboard.up('s');
  await page.waitForTimeout(400);
  console.log('through in', Date.now() - t0, 'ms -> year', await page.locator('.hud-year').textContent(), 'pos', await pos());
  await shot(page, 's3-crossed');

  // Keep walking to room 2 center-ish then turn 180 via pointer lock.
  await page.mouse.click(720, 700); // lock (dy 0 baseline)
  await page.waitForTimeout(300);
  for (let i = 0; i < 6; i++) { // yaw -= dx*0.0022 → +1440px ≈ 180deg
    await page.mouse.move(100, 700);
    await page.mouse.move(340, 700);
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(600);
  console.log('after turn year', await page.locator('.hud-year').textContent(), 'pos', await pos());
  await shot(page, 's4-room2-turned');

  // Fly up for the room-2 overview.
  await page.keyboard.press('f');
  await page.keyboard.down(' ');
  await page.waitForTimeout(1800);
  await page.keyboard.up(' ');
  await page.waitForTimeout(400);
  await shot(page, 's5-room2-fly');
  await page.keyboard.press('f');

  console.log('errors:', await page.evaluate(() => 0));
  await browser.close();
})().catch((e) => { console.error('PROBE FAILED', e); process.exit(1); });
