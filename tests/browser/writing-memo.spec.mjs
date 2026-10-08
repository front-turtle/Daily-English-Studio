import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readdirSync } from 'node:fs';
for (const width of [1280, 375, 320]) {
  test(`writing memo restores drafts, isolates dates and saves with composition at ${width}px`, async ({page}) => {
    const bundle=await build({stdin:{contents:`
      import React,{useState} from 'react'; import {createRoot} from 'react-dom/client';
      import {DailyWritingTab} from './src/components/DailyWritingTab';
      function App(){const [date,D]=useState('2026-10-09'),[items,I]=useState([]);
        return <><button onClick={()=>D(d=>d==='2026-10-09'?'2026-10-08':'2026-10-09')}>날짜 전환</button>
        <DailyWritingTab compositions={items} currentDate={date} onSaveComposition={x=>{window.saved=x;I([{...x,id:'test',createdAt:0,updatedAt:0}])}} onUpdateComposition={(id,x)=>{window.updated=x;I(s=>s.map(c=>({...c,...x})))}} onDeleteComposition={()=>{}}/></>;
      }createRoot(document.getElementById('root')).render(<App/>);
    `,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',plugins:[{name:'mock-services',setup(b){
      b.onLoad({filter:/[\\/]AuthContext\.tsx$/},()=>({loader:'js',contents:'export function useAuth(){return {markSaving(){},markSynced(){}}}'}));
      b.onLoad({filter:/[\\/]geminiReview\.ts$/},()=>({loader:'js',contents:'export async function reviewEnglishWriting(){throw new Error("not used")}'}));
    }}]});
    const css=readdirSync('dist/assets').find(n=>n.endsWith('.css'));
    await page.route('**/memo-fixture',r=>r.fulfill({contentType:'text/html',body:`<link rel="stylesheet" href="/Daily-English-Studio/assets/${css}"><div id="root"></div><script>${bundle.outputFiles[0].text}</script>`}));
    await page.setViewportSize({width,height:900});await page.goto('/memo-fixture');
    const memo=page.getByLabel('작성 메모',{exact:false}).first();
    await memo.fill('핵심: 검토했다\n구성: 상황 → 감정');
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('daily_writing_draft_2026-10-09')||'{}').writingMemo)).toBe('핵심: 검토했다\n구성: 상황 → 감정');
    await page.reload();await expect(memo).toHaveValue('핵심: 검토했다\n구성: 상황 → 감정');
    await page.getByRole('button',{name:'날짜 전환'}).click();await expect(memo).toHaveValue('');
    await memo.fill('전날의 메모');
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('daily_writing_draft_2026-10-08')||'{}').writingMemo)).toBe('전날의 메모');
    await page.getByRole('button',{name:'날짜 전환'}).click();await expect(memo).toHaveValue('핵심: 검토했다\n구성: 상황 → 감정');
    await page.getByPlaceholder('예: 오늘 회의에서 내 생각을 명확하게 전달하기가 조금 힘들었어.').fill('나는 검토했다.');
    await page.getByPlaceholder("예: In today's meeting, it was hard to explain my thought clearly.").fill('I reviewed it.');
    await page.getByRole('button',{name:'영작 저장하기'}).click();
    expect(await page.evaluate(()=>window.saved.writingMemo)).toBe('핵심: 검토했다\n구성: 상황 → 감정');await expect(memo).toHaveValue('');
    await expect.poll(()=>page.evaluate(()=>localStorage.getItem('daily_writing_draft_2026-10-09'))).toBeNull();
    await page.getByRole('button',{name:'메모 수정'}).click();await page.getByLabel('작성 메모 수정',{exact:true}).fill('수정한 메모');
    await page.getByRole('button',{name:'메모 저장'}).click();expect(await page.evaluate(()=>window.updated)).toEqual({writingMemo:'수정한 메모'});
    await page.getByRole('button',{name:'메모 수정'}).click();await page.getByLabel('작성 메모 수정',{exact:true}).fill('');await page.getByRole('button',{name:'메모 저장'}).click();
    expect(await page.evaluate(()=>window.updated)).toEqual({writingMemo:''});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
