import { test, expect } from '@playwright/test';

test('header pronunciation works from every tab without opening AI tutor', async ({ page }) => {
  await page.addInitScript(() => {
    window.__speechRates = [];
    window.speechSynthesis.speak = utterance => { window.__speechRates.push(utterance.rate); };
    window.speechSynthesis.cancel = () => {};
  });
  await page.goto('/Daily-English-Studio/');
  await expect(page.getByRole('heading', { name: '스마트 복습', exact: true })).toBeVisible();
  await expect(page.locator('nav button').nth(2)).toHaveText(/스마트 복습/);
  await page.getByText('새싹부터 지구까지 · 16단계 여정 보기').click();
  await expect(page.getByText('아마존', { exact: true })).toBeVisible();
  await expect(page.getByText('생명의 지구', { exact: true })).toBeVisible();
  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => { const r = el.getBoundingClientRect(); return r.width && r.right > innerWidth + 1; }).map(el => ({ tag: el.tagName, cls: el.className, text: el.textContent?.slice(0, 50) })));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), JSON.stringify({ width, overflow })).toBe(true);
    const center = await page.locator('nav button').nth(2).boundingBox();
    expect(Math.abs(center.x + center.width / 2 - width / 2)).toBeLessThan(3);
  }
  const aiButton = page.getByRole('button', { name: 'AI 영어 튜터 열기' });
  const pronunciationButton = page.getByRole('button', { name: '발음 확인', exact: true });
  const aiBox = await aiButton.boundingBox(), pronunciationBox = await pronunciationButton.boundingBox();
  expect(pronunciationBox.x).toBeGreaterThan(aiBox.x);
  expect(pronunciationBox.x - (aiBox.x + aiBox.width)).toBeLessThan(20);
  await expect(pronunciationButton).toBeVisible();
  await page.getByRole('button', { name: '발음 확인', exact: true }).click();
  await page.getByLabel('듣고 싶은 영어').fill('This is a temporary pronunciation test.');
  await page.getByRole('button', { name: '0.75배속', exact: true }).click();
  await page.getByRole('button', { name: '발음 듣기', exact: true }).click();
  await page.getByRole('button', { name: '1.25배속', exact: true }).click();
  expect(await page.evaluate(() => window.__speechRates)).toEqual([0.75, 1.25]);
  await page.getByRole('button', { name: '발음 확인 닫기' }).click();
  await expect(page.getByRole('heading', { name: '스마트 복습', exact: true })).toBeVisible();
  await page.locator('nav button').first().click();
  await page.getByRole('button', { name: '발음 확인', exact: true }).click();
  await expect(page.getByLabel('듣고 싶은 영어')).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('uncompressed WAV upload preserves original and rejects files above 5MB', async ({ page }) => {
  const seconds = 60, rate = 22050, length = seconds * rate;
  const wav = Buffer.alloc(44 + length * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) wav.writeInt16LE(Math.round(Math.sin(i * 440 * 2 * Math.PI / rate) * 10000), 44 + i * 2);

  await page.goto('/Daily-English-Studio/');
  await page.getByRole('button', { name: '음성 & 녹음', exact: true }).click();
  await page.locator('input[type=file]').first().setInputFiles({ name: 'synthetic-60-seconds.wav', mimeType: 'audio/wav', buffer: wav });
  await expect(page.getByText('선택됨: synthetic-60-seconds.wav', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '파일 업로드하기', exact: true }).click();
  await expect(page.getByText('원본 음성 파일이 저장되었습니다!', { exact: true })).toBeVisible({ timeout: 45000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('audio_items_v2')));
  expect(saved[0].fileName).toBe('synthetic-60-seconds.wav');
  expect(saved[0].audioBase64?.startsWith('data:audio/mpeg;base64,')).toBe(false);
  expect(saved[0].audioBase64?.startsWith('data:audio/wav;base64,') || saved[0].audioUrl?.startsWith('indexeddb:')).toBe(true);

  await page.reload();
  await page.getByRole('button', { name: /음성 & 녹음/ }).click();
  await expect(page.getByText('synthetic-60-seconds', { exact: true })).toBeVisible();

  await page.locator('input[type=file]').first().setInputFiles({
    name: 'over-limit.wav', mimeType: 'audio/wav', buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole('alert')).toContainText('5MB를 초과');
  await expect(page.getByRole('button', { name: '파일 업로드하기', exact: true })).toBeDisabled();
});
