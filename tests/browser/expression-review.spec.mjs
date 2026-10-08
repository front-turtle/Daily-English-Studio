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

test('new and existing expressions save only after applying and submitting suggestions', async ({ page }) => {
  const bundle = await build({ stdin: { contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {KeyExpressionsTab} from './src/components/KeyExpressionsTab';
    createRoot(document.getElementById('root')).render(<KeyExpressionsTab currentDate="2026-10-09"
      expressions={[{id:'saved',date:'2026-10-09',expression:'I spent half a day reviewing this issue.',meaning:'해결하기 위해 반나절을 사용했다.',createdAt:0,favorite:false}]}
      onAddExpression={x=>window.added=x} onUpdateExpression={(id,x)=>window.updated={id,...x}} onDeleteExpression={()=>{}}/>);
  `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', plugins: [{ name: 'mock-review', setup(b) {
    b.onLoad({filter:/[\\/]reviewExpression\.ts$/}, () => ({loader:'js',contents:`export async function reviewExpression(e,k) { return {english:e || 'I reviewed this issue.',korean:'이 이슈를 검토했다.',feedback:'검토한다는 의미로 수정했어요.'}; }`}));
  } }] });
  const css=readdirSync('dist/assets').find(n=>n.endsWith('.css'));
  await page.route('**/expression-form-fixture',r=>r.fulfill({contentType:'text/html',body:`<link rel="stylesheet" href="/Daily-English-Studio/assets/${css}"><div id="root"></div><script>${bundle.outputFiles[0].text}</script>`}));
  await page.setViewportSize({width:375,height:900}); await page.goto('/expression-form-fixture');
  await page.getByPlaceholder('예: ~에 감을 잡다, 익숙해지다').fill('이 이슈를 검토했다.');
  await page.getByRole('button',{name:'AI 검토',exact:true}).click();
  await expect(page.getByRole('button',{name:'제안 적용'})).toBeVisible();
  expect(await page.evaluate(()=>window.added)).toBeUndefined();
  await page.getByRole('button',{name:'제안 적용'}).click();
  await page.getByRole('button',{name:'표현 등록하기'}).click();
  expect(await page.evaluate(()=>window.added.expression)).toBe('I reviewed this issue.');
  await page.getByRole('button',{name:'수정',exact:true}).click();
  await page.getByRole('button',{name:'AI 검토',exact:true}).last().click();
  await page.getByRole('button',{name:'제안 적용'}).click();
  expect(await page.evaluate(()=>window.updated)).toBeUndefined();
  await page.getByRole('button',{name:'저장',exact:true}).click();
  expect(await page.evaluate(()=>window.updated)).toMatchObject({id:'saved',meaning:'이 이슈를 검토했다.'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
