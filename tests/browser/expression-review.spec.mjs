import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readdirSync } from 'node:fs';
for (const width of [1280, 375, 320]) {
  test(`expression AI suggestions require application and discard stale requests at ${width}px`, async ({ page }) => {
    const bundle = await build({ stdin: { contents: `
      import React, {useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {ExpressionAIReview} from './src/components/ExpressionAIReview';
      function App() {
        const [english,E]=useState(''), [korean,K]=useState('');
        return <div style={{maxWidth:600}}><input aria-label="영어" value={english} onChange={e=>E(e.target.value)}/><input aria-label="한글" value={korean} onChange={e=>K(e.target.value)}/>
          <ExpressionAIReview english={english} korean={korean} onApply={(e,k)=>{E(e);K(k)}} reviewer={(e,k)=>new Promise((resolve,reject)=>{window.resolveReview=resolve;window.rejectReview=reject;window.reviewInput=[e,k]})}/></div>
      }
      createRoot(document.getElementById('root')).render(<App/>);
    `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife' });
    const css = readdirSync('dist/assets').find(n => n.endsWith('.css'));
    await page.route('**/expression-fixture', route => route.fulfill({ contentType: 'text/html', body: `<link rel="stylesheet" href="/Daily-English-Studio/assets/${css}"><div id="root"></div><script>${bundle.outputFiles[0].text}</script>` }));
    await page.setViewportSize({width,height:900}); await page.goto('/expression-fixture');
    const english=page.getByRole('textbox',{name:'영어',exact:true}), korean=page.getByRole('textbox',{name:'한글',exact:true});
    const check=page.getByRole('button',{name:'AI 검토',exact:true});
    await expect(check).toBeDisabled();
    await korean.fill('나는 이 이슈를 검토하는 데 반나절을 보냈다.'); await check.click();
    expect(await page.evaluate(()=>window.reviewInput[0])).toBe('');
    const suggestion={english:'I spent half a day reviewing this issue.',korean:'나는 이 이슈를 검토하는 데 반나절을 보냈다.',feedback:'검토하는 데 시간을 썼다는 뜻입니다.'};
    await page.evaluate(r=>window.resolveReview(r),suggestion);
    await expect(page.getByText('AI 검토 결과',{exact:true})).toBeVisible(); await expect(english).toHaveValue('');
    await page.getByRole('button',{name:'제안 적용'}).click(); await expect(english).toHaveValue(suggestion.english);
    await expect(page.getByText('AI 검토 결과',{exact:true})).toHaveCount(0);
    await korean.fill('그 이슈를 해결하기 위해 반나절을 사용했다.'); await check.click();
    expect(await page.evaluate(()=>window.reviewInput)).toEqual([suggestion.english,'그 이슈를 해결하기 위해 반나절을 사용했다.']);
    await page.evaluate(r=>window.resolveReview(r),suggestion); await page.getByRole('button',{name:'제안 적용'}).click();
    await expect(korean).toHaveValue(suggestion.korean);
    await korean.fill(''); await check.click(); expect(await page.evaluate(()=>window.reviewInput[1])).toBe('');
    await english.fill('Changed source'); await page.evaluate(r=>window.resolveReview(r),suggestion);
    await expect(page.getByText('AI 검토 결과',{exact:true})).toHaveCount(0); await expect(english).toHaveValue('Changed source');
    await check.click(); await page.evaluate(()=>window.rejectReview(new Error('테스트 연결 오류')));
    await expect(page.getByRole('alert')).toContainText('테스트 연결 오류'); await expect(english).toHaveValue('Changed source');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
