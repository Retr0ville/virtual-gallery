// Ad-hoc probe: spawn view, walk-around timing, corridor, room 2, fly, fps.
// Real GPU headless (same args as e2e). Not part of the suite.
const { chromium } = require('playwright');
const path = require('path');
const os = require('os');

const OUT = path.join(os.tmpdir(), 'vg-probe');
require('fs').mkdirSync(OUT, { recursive: true });
const shot = (p, name) => p.screenshot({ path: path.join(OUT, `${name}.png`), timeout: 90000 });
const unlock = (p) => p.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.entrance-btn:not([disabled])', { timeout: 180000 });
  await page.waitForTimeout(1000);
  await page.click('.entrance-btn');
  await page.waitForTimeout(2000);
  await unlock(page);
  await page.waitForTimeout(300);
  await shot(page, 'p1-spawn-cake');

  const fps = Number(await page.evaluate(() => new Promise((res) => {
    let n = 0; const t0 = performance.now();
    const loop = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(loop); else res(n / 2); };
    requestAnimationFrame(loop);
  })));

  const year = () => page.locator('.hud-year').textContent();
  console.log('fps', fps, 'year0', await year());

  // Blocked straight.
  await page.keyboard.down('s');
  await page.waitForTimeout(4000);
  await page.keyboard.up('s');
  await page.waitForTimeout(500);
  console.log('blockedYear', await year());
  await shot(page, 'p2-blocked');

  // Walk-around phases.
  const walk = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); await page.waitForTimeout(250); };
  await walk('a', 2000);
  await shot(page, 'p3-north');
  await walk('s', 3000);
  await shot(page, 'p4-northwest-wall');
  await walk('d', 1900);
  await shot(page, 'p5-doorlane');
  let y = await year();
  const t0 = Date.now();
  await page.keyboard.down('s');
  while (Date.now() - t0 < 30000 && y === '2025') { await page.waitForTimeout(1000); y = await year(); }
  await page.keyboard.up('s');
  await page.waitForTimeout(500);
  console.log('walked in', Date.now() - t0, 'ms ->', 'year', await year());
  await shot(page, 'p6-room2');

  // Look toward corridor + walk back to see teaser line.
  await page.keyboard.down('w'); // facing -x after? camera unchanged (faces -x)
  await page.waitForTimeout(1500);
  await page.keyboard.up('w');
  await page.waitForTimeout(400);
  await shot(page, 'p7-room2-look');

  // Fly up for overview.
  await page.keyboard.press('f');
  await page.keyboard.down(' ');
  await page.waitForTimeout(2000);
  await page.keyboard.up(' ');
  await page.waitForTimeout(400);
  await shot(page, 'p8-fly');
  await page.keyboard.press('f');

  // Turn around via keyboard? no — look at corridor from room 2 by walking back through door.
  console.log(JSON.stringify({
    fps, logs: logs.filter((l) => /error|warn|pageerror/i.test(l)),
    ok: true,
  }));
  await browser.close();
})().catch((e) => { console.error('PROBE FAILED', e); process.exit(1); });
