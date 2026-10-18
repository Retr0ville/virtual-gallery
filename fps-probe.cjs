// TEMP: fps sampler — 3× 4s windows, no screenshots. Delete before commit.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.entrance-btn:not([disabled])', { timeout: 180000 });
  await page.click('.entrance-btn');
  await page.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) {
    const fps = await page.evaluate(() => new Promise((res) => {
      let n = 0; const t0 = performance.now();
      const loop = () => { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(loop); else res(n / 4); };
      requestAnimationFrame(loop);
    }));
    console.log(`sample ${i}: ${fps.toFixed(1)} fps`);
  }
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
