// E2E verification (Playwright) — entrance, hover, viewer, walk, fly, admin,
// mobile/touch. Self-seeding: fixture paintings + manifest are written into
// public/gallery + data/gallery.json if missing (never overwrites user data).
// Run: node e2e-verify.cjs   (dev server must be on :3000)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const os = require('os');

const OUT = path.join(os.tmpdir(), 'vg-verify');
fs.mkdirSync(OUT, { recursive: true });
const shot = (p, name) =>
  p.screenshot({ path: path.join(OUT, `${name}.png`), timeout: 90000 });
const unlock = (p) => p.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });

// Screen coords for a wall point from the spawn view (perspective-correct).
// fov 68 vertical, aspect 16:10, eye 1.85, spawn (-7, 0) facing +x; artworks
// hang flanking the doorway ahead. Harbor Morning (z -5.90) -> (400, 466);
// Study In Ochre (z +5.90) -> (1040, 466).

// Minimal solid-color PNG generator (also used for fixtures + upload test).
function crc32(buf) {
  let c; const t = [];
  for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = t[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const ty = Buffer.from(type); const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([ty, data])));
  return Buffer.concat([len, ty, data, crc]);
}
function png(w, h, rgb) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) { raw[y * (1 + w * 3)] = 0; for (let x = 0; x < w; x++) { const o = y * (1 + w * 3) + 1 + x * 3; raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; } }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ---- Fixtures: 2 paintings per year across 3 years (2025/2026/2027). ---------
// 2025 order matters: harbor order 2 -> slot at z +2.16 (screen LEFT, x 503),
// ochre order 1 -> slot at z -2.16 (screen RIGHT, x 937) — hover/click coords
// below assume this layout at the spawn.
const YEARS = [
  ['study-in-ochre.png', [166, 116, 50], 'Study In Ochre', 2025, 1],
  ['harbor-morning.png', [38, 54, 84], 'Harbor Morning', 2025, 2],
  ['quiet-field.png', [122, 138, 106], 'Quiet Field', 2026, 3],
  ['night-window.png', [58, 62, 84], 'Night Window', 2026, 4],
  ['north-light.png', [176, 176, 166], 'North Light', 2027, 5],
  ['paper-stack.png', [150, 132, 112], 'Paper Stack', 2027, 6],
];
function seedFixtures() {
  const galleryDir = path.join(__dirname, 'public', 'gallery');
  const manifestPath = path.join(__dirname, 'data', 'gallery.json');
  fs.mkdirSync(galleryDir, { recursive: true });
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  let manifest = { version: 1, items: {} };
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch { /* fresh */ }
  if (!manifest.items || typeof manifest.items !== 'object') manifest = { version: 1, items: {} };
  for (const [fn, rgb, title, year, order] of YEARS) {
    const file = path.join(galleryDir, fn);
    if (!fs.existsSync(file)) fs.writeFileSync(file, png(700, 500, rgb));
    if (!manifest.items[fn]) manifest.items[fn] = { title, year, description: '', order };
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}
seedFixtures();

let browser = null;
(async () => {
  const logs = [];
  const failed = [];
  browser = await chromium.launch({
    // Prefer real GPU (ANGLE D3D11) — the floor reflector is ~20x slower on
    // software GL, starving screenshot capture. Falls back to swiftshader.
    args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader'],
  });

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => failed.push(`${r.url()} :: ${r.failure()?.errorText}`));

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Button enables only when all textures loaded (useProgress) — real ready signal.
  await page.waitForSelector('.entrance-btn:not([disabled])', { timeout: 180000 });
  await page.waitForTimeout(1000);
  await shot(page, '01-entrance');
  const hudBefore = await page.locator('.hud').count();

  await page.click('.entrance-btn');
  await page.waitForTimeout(1800);
  await shot(page, '02-spawn-both-artworks');
  const locked = await page.evaluate(() => document.pointerLockElement !== null);

  // Unlock so real pointer coordinates apply (locked pointer forces center raycast).
  await unlock(page);
  await page.waitForTimeout(200);

  // Hover painting (Harbor Morning, screen left, ~400,466).
  await page.mouse.move(400, 466);
  await page.waitForTimeout(600);
  await shot(page, '03-tooltip-hover');
  const tooltipText = await page.locator('.hud-tooltip.is-visible .hud-tooltip-title').textContent().catch(() => null);

  // Click painting -> viewer.
  await page.mouse.click(400, 466);
  await page.waitForTimeout(900);
  const viewerOpen = await page.locator('.viewer').count();
  await shot(page, '04-viewer');
  let viewerTitle1 = '';
  if (viewerOpen) {
    viewerTitle1 = await page.locator('.viewer-title').textContent();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(600);
    await shot(page, '05-viewer-next');
    await unlock(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
  }
  const viewerClosed = (await page.locator('.viewer').count()) === 0;

  // FPS sample BEFORE walking (software GL runs slow; dt clamp slows sim proportionally).
  const fps = Number(await page.evaluate(() => new Promise((res) => {
    let n = 0; const t0 = performance.now();
    const loop = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(loop); else res(n / 2); };
    requestAnimationFrame(loop);
  })));

  // Clear hover so the walk screenshots start clean (also exercises pointer-out).
  await page.mouse.move(400, 780);
  await page.waitForTimeout(400);
  const tooltipAfterOut = await page.locator('.hud-tooltip.is-visible').count();

  // Spawn (-7, 0) faces +x, in the outer aisle. Holding 'a' (+z is right, so
  // 'a' = -z) runs at the round wall: must NOT leave room 1.
  const ratio = Math.min(1, fps / 20);
  const startYear = await page.locator('.hud-year').textContent();
  await page.keyboard.down('a');
  await page.waitForTimeout(Math.max(3000, Math.round(3000 / ratio)));
  await page.keyboard.up('a');
  await page.waitForTimeout(600);
  const blockedYear = await page.locator('.hud-year').textContent();
  const blockedOk = blockedYear === startYear;
  await shot(page, '06-blocked-by-centerpiece');

  // Line up with the straight walk-through slot at z=0, then hold 'w'
  // (+x, forward): through the hollow middle, out the doorway into 2026.
  const centerZ = async () => {
    for (let i = 0; i < 30; i++) {
      const z = await page.evaluate(() => window.__cam.position.z);
      if (Math.abs(z) < 0.15) break;
      const key = z > 0 ? 'a' : 'd'; // 'a' = -z, 'd' = +z (facing +x)
      await page.keyboard.down(key);
      await page.waitForTimeout(100);
      await page.keyboard.up(key);
      await page.waitForTimeout(150);
    }
  };
  await centerZ();
  const walk = async (key, ms) => {
    await page.keyboard.down(key);
    await page.waitForTimeout(Math.max(ms, Math.round(ms / ratio)));
    await page.keyboard.up(key);
    await page.waitForTimeout(250);
  };
  let yearText = startYear;
  await page.keyboard.down('w');
  // HUD year is '' in corridors — keep polling through the gap.
  for (let i = 0; i < 15 && (yearText === startYear || yearText === ''); i++) {
    await page.waitForTimeout(2000);
    yearText = await page.locator('.hud-year').textContent();
  }
  await page.keyboard.up('w');
  await page.waitForTimeout(800);
  yearText = await page.locator('.hud-year').textContent();
  await shot(page, '07-room2-walked');
  await shot(page, '08-room2-artwork');

  // Locked door: rooms open on her birthday (Oct 15 of their own year). With
  // 2027 still in the future, holding 'w' toward it must stop at the sealed
  // corridor door — the HUD year ends up '' (corridor), never 2027.
  await page.keyboard.down('w');
  await page.waitForTimeout(Math.max(10000, Math.round(10000 / ratio)));
  await page.keyboard.up('w');
  await page.waitForTimeout(600);
  const lockedYear = await page.locator('.hud-year').textContent();
  const doorLocked = lockedYear !== '2027';
  await shot(page, '08b-locked-2027-door');

  // Fly + ascend.
  await page.keyboard.press('f');
  await page.keyboard.down(' ');
  await page.waitForTimeout(Math.max(1500, Math.round(1400 / ratio)));
  await page.keyboard.up(' ');
  await page.waitForTimeout(400);
  await shot(page, '09-fly-high');
  const chip = await page.locator('.hud-chip').textContent();
  await page.keyboard.press('f');
  await page.waitForTimeout(1200);

  // Admin: unlock (real release), open, upload, delete.
  await unlock(page);
  await page.waitForTimeout(300);
  await page.click('.hud-actions .icon-btn');
  await page.waitForTimeout(800);
  await shot(page, '10-admin-open');

  const tmpImg = path.join(OUT, 'e2e-upload-test.png');
  fs.writeFileSync(tmpImg, png(700, 500, [120, 140, 110]));
  const adminItemsBefore = await page.locator('.admin-item').count();
  await page.setInputFiles('.admin input[type=file]', tmpImg);
  await page.waitForTimeout(3000);
  await shot(page, '11-admin-uploaded');
  const adminItemsAfterUpload = await page.locator('.admin-item').count();

  // Delete via title input value (locator hasText can't see input values).
  const e2eRow = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.admin-item'));
    return items.findIndex((el) => {
      const input = el.querySelector('input');
      return !!input && /e2e/i.test(input.value);
    });
  });
  let deleted = false;
  if (e2eRow >= 0) {
    const row = page.locator('.admin-item').nth(e2eRow);
    await row.locator('.admin-side .icon-btn').last().click();
    await page.waitForTimeout(250);
    await row.locator('.admin-side .icon-btn').last().click();
    await page.waitForTimeout(1600);
    deleted = true;
  }
  const adminItemsAfterDelete = await page.locator('.admin-item').count();
  await shot(page, '12-admin-deleted');
  await page.click('.admin-head .icon-btn');
  await page.waitForTimeout(400);
  const hudAfter = await page.locator('.hud').count();

  // Mobile pass. Close desktop context first — its rAF loop keeps burning the
  // software-GL CPU and starves the mobile page (click never becomes actionable).
  await ctx.close();
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const mp = await mctx.newPage();
  mp.on('console', (m) => logs.push(`[mobile:${m.type()}] ${m.text()}`));
  mp.on('pageerror', (e) => logs.push(`[mobile:pageerror] ${e.message}`));
  await mp.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await mp.waitForSelector('.entrance-btn:not([disabled])', { timeout: 180000 });
  await mp.waitForTimeout(2000);
  await mp.click('.entrance-btn', { timeout: 30000 });
  await mp.waitForTimeout(3000);
  await shot(mp, '13-mobile-entered');
  const joyCount = await mp.locator('.touch-joystick').count();
  const crosshairMobile = await mp.locator('.hud-crosshair').count();

  console.log(JSON.stringify({
    hudBefore, locked, tooltipText, viewerOpen, viewerTitle1, viewerClosed,
    fps, ratio, startYear, blockedYear, blockedOk, yearText, lockedYear, doorLocked, tooltipAfterOut, chip,
    adminItemsBefore, adminItemsAfterUpload, adminItemsAfterDelete, deleted, hudAfter,
    joyCount, crosshairMobile,
    consoleErrors: logs.filter((l) => /error|warn/i.test(l)),
    sampleLogs: logs.slice(0, 40),
    failedRequests: failed,
    shotDir: OUT,
  }, null, 2));

  await browser.close();
})().catch(async (e) => {
  console.error('E2E FAILED:', e);
  // Never leak a headless browser on failure — orphans starve the next run.
  if (browser) await browser.close().catch(() => {});
  process.exit(1);
});
