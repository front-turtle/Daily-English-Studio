import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readdirSync } from 'node:fs';
import { LANDSCAPE_STAGES, landscapeForStreak } from '../../src/lib/growthLandscape';

async function openGarden(page, reduced = false) {
  const bundle = await build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import{GrowthScene}from'./src/components/GrowthScene';const root=createRoot(document.getElementById('root'));window.showGarden=(streak,stageName)=>root.render(<GrowthScene streak={streak} stageName={stageName}/>);`, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, write: false, outfile: 'garden-fixture.js', external: ['/Daily-English-Studio/*'], define: { 'process.env.NODE_ENV': '"production"' } });
  const js = bundle.outputFiles.find(f => f.path.endsWith('.js')).text;
  const css = bundle.outputFiles.find(f => f.path.endsWith('.css')).text;
  const appCss = readdirSync('dist/assets').find(name => name.endsWith('.css'));
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.route('**/garden-fixture', route => route.fulfill({ contentType: 'text/html', body: `<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/Daily-English-Studio/assets/${appCss}"><style>${css}body{margin:0;padding:16px;font-family:Arial}button{font:inherit}</style><div id="root"></div><script>${js}</script>` }));
  await page.goto('/garden-fixture');
  await page.evaluate(() => window.showGarden(2, '새싹'));
  await expect(page.getByTestId('living-garden')).toBeVisible();
}

for (const width of [1280, 375, 320]) {
  test(`living garden grows, animates and stays responsive at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openGarden(page);
    const garden = page.getByTestId('living-garden');
    await expect(garden).toHaveAttribute('data-paused', 'false');
    await expect(page.getByTestId('garden-butterfly')).toHaveCount(0);
    await page.evaluate(() => window.showGarden(3, '두 잎 새싹'));
    await expect(page.getByTestId('garden-butterfly')).toHaveCount(1);
    const before = await page.locator('.garden-butterfly').evaluate(el => getComputedStyle(el).transform);
    await page.waitForTimeout(500);
    expect(await page.locator('.garden-butterfly').evaluate(el => getComputedStyle(el).transform)).not.toBe(before);
    for (const [label, weather] of [['산들바람', 'wind'], ['촉촉한 비', 'rain'], ['햇살', 'sun']]) {
      await page.getByRole('button', { name: `정원 날씨: ${label}` }).click();
      await expect(garden).toHaveAttribute('data-weather', weather);
    }
    await page.getByRole('button', { name: '정원 움직임 멈추기' }).click();
    await expect(garden).toHaveAttribute('data-paused', 'true');
    expect(await page.locator('.garden-sway').first().evaluate(el => getComputedStyle(el).animationPlayState)).toBe('paused');
    await page.getByRole('button', { name: '정원 움직임 재생' }).click();
    await expect(garden).toHaveAttribute('data-paused', 'false');
    for (const days of [0, 6, 7, 14, 21, 29, 30, 45, 60, 89, 90, 119, 120, 149, 150, 180, 209, 210, 239, 240, 300, 365, 0]) {
      await page.evaluate(days => window.showGarden(days, '성장 단계'), days);
      const scenery = landscapeForStreak(days);
      await expect(garden).toHaveAttribute('data-landscape', scenery.key);
      expect(await page.locator('.garden-landscape').evaluate(el => getComputedStyle(el).backgroundImage)).toContain(scenery.asset);
      await expect(page.getByRole('heading', { name: scenery.name, exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.getByTestId('living-garden')).toBeVisible();
      await expect(page.locator('.garden-plant')).toHaveCount(1);
      await expect(page.getByTestId('garden-growing-plant')).toContainText(`${days}일`);
    }
    const asset = await page.request.get('/Daily-English-Studio/garden-meadow-v1.webp');
    expect(asset.ok()).toBe(true);
    expect((await asset.body()).length).toBeLessThan(400000);
    await page.evaluate(() => window.showGarden(7, '어린나무'));
    await expect(page.locator('.garden-plant--tree')).toBeVisible();
    await garden.dispatchEvent('pointerdown', {pointerId:1,isPrimary:true,button:0,clientX:250,clientY:150});
    await garden.dispatchEvent('pointerup', {pointerId:1,isPrimary:true,button:0,clientX:150,clientY:152});
    await expect(garden).toHaveAttribute('data-viewing-day','3');
    await expect(garden).toHaveAttribute('data-landscape','meadow');
    await expect(page.locator('.garden-plant--sprout')).toBeVisible();
    await page.getByRole('button',{name:'이전 성장 모습',exact:true}).click();
    await expect(garden).toHaveAttribute('data-viewing-day','0');
    await expect(page.getByRole('button',{name:'이전 성장 모습',exact:true})).toBeDisabled();
    await expect(page.getByTestId('garden-butterfly')).toHaveCount(0);
    await page.getByRole('button',{name:'다음 성장 모습',exact:true}).click();
    await expect(garden).toHaveAttribute('data-viewing-day','3');
    await page.getByRole('button',{name:'현재로',exact:true}).click();
    await expect(garden).toHaveAttribute('data-viewing-day','7');
    await expect(page.getByRole('button',{name:'다음 성장 모습',exact:true})).toBeDisabled();
    // Vertical scrolling must not navigate the gallery.
    await garden.dispatchEvent('pointerdown',{pointerId:2,isPrimary:true,button:0,clientX:250,clientY:150});
    await garden.dispatchEvent('pointerup',{pointerId:2,isPrimary:true,button:0,clientX:180,clientY:300});
    await expect(garden).toHaveAttribute('data-viewing-day','7');
  });
}

test('garden respects reduced motion and pauses when scrolled away', async ({ page }) => {
  await openGarden(page, true);
  await expect(page.getByTestId('living-garden')).toHaveAttribute('data-paused', 'true');
  await expect(page.getByRole('button', { name: '동작 줄이기 설정 적용됨' })).toBeDisabled();
  expect(await page.locator('.garden-sway').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.getByTestId('living-garden')).toHaveAttribute('data-paused', 'false');
  await page.evaluate(() => { document.body.style.minHeight = '3000px'; window.scrollTo(0, 1500); });
  await expect(page.getByTestId('living-garden')).toHaveAttribute('data-paused', 'true');
});

test('automatic garden weather cycles without changing review data', async ({ page }) => {
  await page.clock.install();
  await openGarden(page);
  await expect(page.getByTestId('living-garden')).toHaveAttribute('data-paused', 'false');
  await page.clock.runFor(19000);
  await expect(page.getByTestId('living-garden')).toHaveAttribute('data-weather', 'wind');
  await page.clock.runFor(18000);
  await expect(page.getByTestId('living-garden')).toHaveAttribute('data-weather', 'rain');
  await page.clock.runFor(18000);
  await expect(page.getByTestId('living-garden')).toHaveAttribute('data-weather', 'sun');
});

test('every scenery asset decodes and is available in the PWA cache manifest', async ({ page }) => {
  await openGarden(page);
  const serviceWorker = await page.request.get('/Daily-English-Studio/sw.js');
  const worker = await serviceWorker.text();
  for (const scenery of LANDSCAPE_STAGES) {
    const url = '/Daily-English-Studio/' + scenery.asset;
    const asset = await page.request.get(url);
    expect(asset.ok(), scenery.key).toBe(true);
    expect((await asset.body()).length, scenery.key).toBeLessThan(500000);
    expect(worker, scenery.key).toContain(scenery.asset);
    await page.evaluate(async url => { const img = new Image(); img.src = url; await img.decode(); }, url);
  }
});
