import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readdirSync } from 'node:fs';

for (const width of [320, 375, 1280]) test(`sticky notes create, autosave, recover drafts and isolate accounts at ${width}px`, async ({ page }) => {
  const bundle = await build({ stdin: { contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {StickyNotesTab} from './src/components/StickyNotesTab';
    createRoot(document.getElementById('root')).render(<StickyNotesTab/>);
  `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', plugins: [{ name: 'mock-firebase', setup(b) {
    b.onLoad({ filter: /[\\/]AuthContext\.tsx$/ }, () => ({ loader: 'js', contents: `import {useState} from 'react'; export function useAuth(){const [uid,set]=useState('owner');window.switchUser=set;return {user:uid?{uid}:null,loading:false,signInWithGoogle:async()=>set('owner')}}` }));
    b.onLoad({ filter: /[\\/]firebase\.ts$/ }, () => ({ loader: 'js', contents: `export const db={};` }));
    b.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: 'mock-firestore', namespace: 'notes' }));
    b.onLoad({ filter: /.*/, namespace: 'notes' }, () => ({ loader: 'js', contents: `
      const listeners=new Map();const deleted={};
      const read=uid=>JSON.parse(localStorage.getItem('cloud_'+uid)||'{}');
      export const doc=(db,collection,uid)=>uid;
      export class FieldPath{constructor(...keys){this.keys=keys}}
      export const deleteField=()=>deleted;
      const snap=uid=>({exists:()=>!!localStorage.getItem('cloud_'+uid),data:()=>read(uid)});
      const notify=uid=>listeners.get(uid)?.(snap(uid));
      window.remoteNote=(id,patch)=>{const data=read('owner');Object.assign(data.stickyNotes[id],patch);localStorage.setItem('cloud_owner',JSON.stringify(data));notify('owner')};
      export const onSnapshot=(uid,fn)=>{listeners.set(uid,fn);fn(snap(uid));return ()=>listeners.delete(uid)};
      export const runTransaction=async(db,fn)=>{if(window.failNotes)throw Error('연결을 확인해 주세요.'); await fn({get:async uid=>snap(uid),set:(uid,data)=>{localStorage.setItem('cloud_'+uid,JSON.stringify(data));notify(uid)},update:(uid,path,value)=>{const data=read(uid);data.stickyNotes ||= {};if(value===deleted)delete data.stickyNotes[path.keys[1]];else data.stickyNotes[path.keys[1]]=value;localStorage.setItem('cloud_'+uid,JSON.stringify(data));notify(uid)}})};
    ` }));
  } }] });
  const css = readdirSync('dist/assets').find(n => n.endsWith('.css'));
  await page.route('**/notes-fixture', route => route.fulfill({ contentType: 'text/html', body: `<link rel="stylesheet" href="/Daily-English-Studio/assets/${css}"><div style="padding:12px" id="root"></div><script>${bundle.outputFiles[0].text}</script>` }));
  await page.setViewportSize({ width, height: 900 }); await page.goto('/notes-fixture');
  await page.getByRole('button', { name: '새 메모', exact: true }).click();
  await page.getByLabel('메모 내용', { exact: true }).fill('first line\nsecond line');
  await expect(page.getByRole('heading', { name: 'first line', exact: true })).toBeVisible();
  await page.getByLabel('메모 제목', { exact: true }).fill('회의 영어');
  await page.getByRole('button', { name: '보라 포스트잇' }).click();
  await expect(page.getByText('모든 메모 저장 완료', { exact: false })).toBeVisible();
  await page.reload(); await expect(page.getByLabel('메모 제목')).toHaveValue('회의 영어');
  await expect(page.getByRole('button', { name: '보라 포스트잇' })).toHaveAttribute('aria-pressed', 'true');
  const id = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('cloud_owner')).stickyNotes)[0]);
  await page.evaluate(id => window.remoteNote(id, { body: 'from another device' }), id);
  await expect(page.getByLabel('메모 내용')).toHaveValue('from another device');
  await page.getByRole('button', { name: '새 메모', exact: true }).click();
  expect(await page.locator('article').count()).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const boxes = await page.locator('article').evaluateAll(nodes => nodes.map(n => ({ x: n.getBoundingClientRect().x, y: n.getBoundingClientRect().y })));
  if (width === 1280) expect(boxes[0].y).toBe(boxes[1].y); else expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
  await page.evaluate(() => window.failNotes = true);
  await page.getByLabel('메모 내용').last().fill('offline draft');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.reload(); await expect(page.getByLabel('메모 내용').last()).toHaveValue('offline draft');
  await expect(page.getByText('모든 메모 저장 완료', { exact: false })).toBeVisible();
  await page.evaluate(() => window.switchUser('other'));
  await expect(page.locator('article')).toHaveCount(0);
  await page.evaluate(() => window.switchUser('owner'));
  await expect(page.locator('article')).toHaveCount(2);
  await page.getByRole('button', { name: '회의 영어 삭제' }).click();
  await page.getByRole('button', { name: '취소', exact: true }).click(); await expect(page.locator('article')).toHaveCount(2);
  await page.getByRole('button', { name: '회의 영어 삭제' }).click(); await page.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page.locator('article')).toHaveCount(1); await page.reload(); await expect(page.locator('article')).toHaveCount(1);
});

test('header opens separate notebook and bottom navigation still works', async ({ page }) => {
  await page.goto('/Daily-English-Studio/');
  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: '메모장 열기', exact: true }).click();
    await expect(page.getByRole('heading', { name: '메모장', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '메모장 열기' })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('nav button').first().click();
    await expect(page.getByRole('heading', { name: '메모장', exact: true })).not.toBeVisible();
  }
});
