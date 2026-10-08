import React, { useState } from 'react';
export function WritingMemo({ value = '', onSave }: { value?: string; onSave: (memo: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  return <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 space-y-2 text-xs sm:text-sm">
    <div className="flex items-center justify-between gap-2"><strong className="text-amber-900">작성 메모</strong>
      {!editing && <button type="button" onClick={() => { setText(value); setEditing(true); }} className="rounded-lg px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100">{value ? '메모 수정' : '메모 추가'}</button>}
    </div>
    {editing ? <><textarea aria-label="작성 메모 수정" value={text} onChange={e => setText(e.target.value)} rows={3} className="w-full rounded-lg border border-amber-200 bg-white p-2 outline-none focus:border-indigo-500" />
      <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditing(false)} className="rounded-lg px-3 py-1.5 text-slate-600">취소</button><button type="button" onClick={() => { onSave(text.trim()); setEditing(false); }} className="rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white">메모 저장</button></div>
    </> : <p className="whitespace-pre-wrap break-words text-slate-600">{value || '핵심 내용이나 문장 구성 과정을 기록해 보세요.'}</p>}
  </div>;
}
