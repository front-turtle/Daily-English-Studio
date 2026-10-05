import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readdirSync } from 'node:fs';

for (const width of [1280, 375, 320]) {
  test(`review dot follows daily completion at ${width}px`, async ({ page }) => {
    const bundle = await build({ stdin: { contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { ReviewTabLabel } from './src/components/ReviewTabLabel';
      const root = createRoot(document.getElementById('root'));
      window.renderReview = props => root.render(<button className="flex flex-col items-center gap-1"><ReviewTabLabel {...props} /></button>);
    `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife' });
    const css = readdirSync('dist/assets').find(name => name.endsWith('.css'));
    await page.route('**/review-dot-fixture', route => route.fulfill({ contentType: 'text/html', body: `<link rel="stylesheet" href="/Daily-English-Studio/assets/${css}"><div id="root"></div><script>${bundle.outputFiles[0].text}</script>` }));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/review-dot-fixture');
    const props = { uid: 'test-user', ready: true, today: '2026-10-05', sessions: [] };
    const render = async changes => page.evaluate(p => window.renderReview(p), { ...props, ...changes });
    const dot = page.getByTestId('review-pending-dot');
    await render({});
    await expect(dot).toBeVisible();
    expect(await dot.evaluate(el => getComputedStyle(el).backgroundColor)).toMatch(/^(rgb|oklch)\(/);
    const box = await dot.boundingBox();
    expect(box.width).toBe(8); expect(box.height).toBe(8);
    await expect(page.getByRole('button', { name: '스마트 복습 오늘 복습 미완료' })).toBeVisible();
    const daily = { version: 1, mode: 'daily-short', date: props.today, timezone: 'Asia/Seoul', dayStart: 0, questions: [{ id: 'q1' }, { id: 'q2' }], answers: { q1: { correct: false } }, createdAt: 0, completedAt: null };
    await render({ sessions: [daily] });
    await expect(dot).toBeVisible();
    const complete = { ...daily, answers: { q1: { correct: false }, q2: { correct: true } }, completedAt: 1 };
    await render({ sessions: [complete] });
    await expect(dot).toHaveCount(0);
    await render({ today: '2026-10-06', sessions: [complete] });
    await expect(dot).toBeVisible();
    await render({ sessions: [{ ...complete, mode: 'extra' }] });
    await expect(dot).toBeVisible();
    await render({ ready: false });
    await expect(dot).toHaveCount(0);
    await render({ uid: undefined });
    await expect(dot).toHaveCount(0);
  });
}

test('global review banner is absent from every navigation tab', async ({ page }) => {
  await page.goto('/Daily-English-Studio/');
  for (let index = 0; index < 5; index++) {
    await page.locator('nav button').nth(index).click();
    await expect(page.getByRole('button', { name: /매일 필수! 오늘의 스마트 복습|오늘의 복습 완료 ·/ })).toHaveCount(0);
    await expect(page.locator('nav button').nth(2)).toContainText('스마트 복습');
  }
});
