import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readdirSync } from 'node:fs';

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
    for (const days of [0, 7, 14, 21, 30, 45, 60, 90, 120, 150, 180, 210, 240, 300, 365]) {
      await page.evaluate(days => window.showGarden(days, '성장 단계'), days);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('.garden-plant').first()).toBeVisible();
    }
    const asset = await page.request.get('/Daily-English-Studio/garden-meadow-v1.webp');
    expect(asset.ok()).toBe(true);
    expect((await asset.body()).length).toBeLessThan(400000);
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
