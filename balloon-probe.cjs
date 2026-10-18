// TEMP diagnostic: sector views of the balloon scatter. Delete before commit.
const { chromium } = require('playwright');
const path = require('path');
const os = require('os');
const OUT = path.join(os.tmpdir(), 'vg-balloons');
require('fs').mkdirSync(OUT, { recursive: true });
const shot = (p, n) => p.screenshot({ path: path.join(OUT, `${n}.png`), timeout: 90000 });

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.entrance-btn:not([disabled])', { timeout: 180000 });
  await page.click('.entrance-btn');
  await page.waitForTimeout(2000);
  await shot(page, 'a-west'); // spawn yaw faces -x

  await page.mouse.click(720, 700); // pointer lock
  await page.waitForTimeout(300);
  // +90deg
  for (let i = 0; i < 3; i++) { await page.mouse.move(100, 700); await page.mouse.move(340, 700); await page.waitForTimeout(60); }
  await page.waitForTimeout(400);
  await shot(page, 'b-turn90');
  // +90 (180 total)
  for (let i = 0; i < 3; i++) { await page.mouse.move(100, 700); await page.mouse.move(340, 700); await page.waitForTimeout(60); }
  await page.waitForTimeout(400);
  await shot(page, 'c-turn180');
  // +90 (270 total)
  for (let i = 0; i < 3; i++) { await page.mouse.move(100, 700); await page.mouse.move(340, 700); await page.waitForTimeout(60); }
  await page.waitForTimeout(400);
  await shot(page, 'd-turn270');
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
